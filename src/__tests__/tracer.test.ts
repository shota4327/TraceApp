import { describe, it, expect, beforeAll, vi } from 'vitest';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { PYTHON_TRACER_SCRIPT } from '../worker/pythonTracer';
import { renderHook, act } from '@testing-library/react';
import { useTraceEngine } from '../hooks/useTraceEngine';

import path from 'path';

/**
 * Pyodide sys.settrace トレースエンジンの単体テスト
 * - 基本的な順次・分岐・ループ実行
 * - 10,000ステップ上限ガード (TraceLimitExceeded(BaseException))
 * - try...except Exception: を突破する上限ガード検証
 * - NaN / Infinity / -Infinity の文字列化
 * - 循環参照の _safe_repr フォールバック
 * - stdout キャプチャ (stdoutDelta, stdoutCumulative)
 * - スコープ分離 (globals, locals) と changedVars 自動検知
 */

describe('Pyodide トレースエンジン単体テスト (tracer.test.ts)', () => {
  let pyodide: PyodideInterface;

  beforeAll(async () => {
    // Vitest (Node.js) 環境で Pyodide をローカル node_modules/pyodide からロード
    const pyodidePath = path.resolve(process.cwd(), 'node_modules/pyodide');
    pyodide = await loadPyodide({ indexURL: pyodidePath });
    await pyodide.runPythonAsync(PYTHON_TRACER_SCRIPT);
  }, 30000); // Pyodide 初回ロード用タイムアウト設定

  it('1. 基本的な順次・代入コードでトレースが正常に動作すること (テスト1)', () => {
    const code = `
x = 5
y = 3
total = x + y
print(total)
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    expect(result.snapshots.length).toBeGreaterThan(0);
    expect(result.stdout).toBe('8\n');

    // 最後のスナップショットの変数状態を確認
    const lastSnap = result.snapshots[result.snapshots.length - 1];
    expect(lastSnap.globals.x).toBe(5);
    expect(lastSnap.globals.y).toBe(3);
    expect(lastSnap.globals.total).toBe(8);
  });

  it('2. 条件分岐コードで実行パスのみトレースされること (テスト2)', () => {
    const code = `
score = 75
if score >= 80:
    grade = "A"
elif score >= 60:
    grade = "B"
else:
    grade = "C"
print(grade)
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    expect(result.stdout).toBe('B\n');

    // grade が "B" に更新され、"A" や "C" は記録されないこと
    const gradeSnaps = result.snapshots.filter((s: any) => s.globals.grade !== undefined);
    expect(gradeSnaps.length).toBeGreaterThan(0);
    expect(gradeSnaps[gradeSnaps.length - 1].globals.grade).toBe('B');
  });

  it('3. ループと関数定義・呼び出しでローカル・グローバルスコープが分離されること (テスト3)', () => {
    const code = `def add(a, b):
    result = a + b
    return result

total = 0
for i in range(1, 4):
    total = add(total, i)
print(total)`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    expect(result.stdout).toBe('6\n');

    // 関数 add 実行中のスナップショットを抽出
    const funcSnaps = result.snapshots.filter((s: any) => s.functionName === 'add');
    expect(funcSnaps.length).toBeGreaterThan(0);
    // 関数内では locals に a, b が含まれ、def 行 (Line 1) が executedLine となること
    const firstFuncSnap = funcSnaps[0];
    expect(firstFuncSnap.locals.a).toBeDefined();
    expect(firstFuncSnap.locals.b).toBeDefined();
    expect(firstFuncSnap.executedLine).toBe(1);

    // Line の実行フローが 5 → 6 → 7 → 1 → 2 → 3 → 7 → 6 → 7 → 1 → 2 → 3 → 7 → 6 → 7 → 1 → 2 → 3 → 7 → 6 → 8 と一致すること
    const nonEndSnaps = result.snapshots.filter((s: any) => s.event !== 'end');
    const lineFlow = nonEndSnaps.map((s: any) => s.line);
    expect(lineFlow).toEqual([
      5, 6, 7, 1, 2, 3, 7, 6, 7, 1, 2, 3, 7, 6, 7, 1, 2, 3, 7, 6, 8
    ]);

    // globals に関数オブジェクト (add) が含まれないこと
    for (const snap of result.snapshots) {
      expect(snap.globals.add).toBeUndefined();
    }
  });

  it('4. ステップ数上限ガード (10,000ステップ) が発動し、TraceLimitExceeded で停止すること', () => {
    const code = `
i = 0
while True:
    i += 1
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 50); // テスト用に上限を 50 ステップに設定
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('ステップ数上限');
    expect(result.snapshots.length).toBe(50);
  });

  it('5. ユーザーコードに try...except Exception: があっても上限ガードを突破して停止すること', () => {
    const code = `
i = 0
while True:
    try:
        i += 1
    except Exception as e:
        pass
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 30);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('ステップ数上限');
    expect(result.snapshots.length).toBe(30);
  });

  it('6. NaN, Infinity, -Infinity が JavaScript 適合文字列 ("NaN", "Infinity", "-Infinity") にサニタイズされること', () => {
    const code = `
import math
nan_val = float('nan')
inf_val = float('inf')
ninf_val = float('-inf')
list_val = [nan_val, inf_val, ninf_val]
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    const lastSnap = result.snapshots[result.snapshots.length - 1];
    expect(lastSnap.globals.nan_val).toBe('NaN');
    expect(lastSnap.globals.inf_val).toBe('Infinity');
    expect(lastSnap.globals.ninf_val).toBe('-Infinity');
    expect(lastSnap.globals.list_val).toEqual(['NaN', 'Infinity', '-Infinity']);
  });

  it('7. 循環参照オブジェクトが検出され _safe_repr フォールバックで安全にキャプチャされること', () => {
    const code = `
a = []
a.append(a)
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    const lastSnap = result.snapshots[result.snapshots.length - 1];
    expect(lastSnap.globals.a).toBeDefined();
    expect(Array.isArray(lastSnap.globals.a)).toBe(true);
    expect(lastSnap.globals.a[0]).toContain('[[...]]');
  });

  it('8. stdoutDelta と stdoutCumulative が各ステップで正確に収集されること', () => {
    const code = `
print("Hello")
x = 10
print("World")
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    expect(result.stdout).toBe('Hello\nWorld\n');

    // print("Hello") の直後のデルタと累積を確認
    const helloSnap = result.snapshots.find((s: any) => s.stdoutDelta === 'Hello\n');
    expect(helloSnap).toBeDefined();
    expect(helloSnap.stdoutCumulative).toBe('Hello\n');

    // print("World") の直後のデルタと累積を確認
    const worldSnap = result.snapshots.find((s: any) => s.stdoutDelta === 'World\n');
    expect(worldSnap).toBeDefined();
    expect(worldSnap.stdoutCumulative).toBe('Hello\nWorld\n');
  });

  it('9. 各ステップにおける changedVars が自動検知されること', () => {
    const code = `
a = 1
b = 2
a = 5
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    const a5Snap = result.snapshots.find((s: any) => s.globals.a === 5);
    expect(a5Snap).toBeDefined();
    expect(a5Snap.changedVars).toContain('a');
    expect(a5Snap.changedVars).not.toContain('b');
  });

  it('10. スクリプト完了時に event: "end" の最終スナップショットが追加されること', () => {
    const code = `
x = 10
y = 20
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    const lastSnap = result.snapshots[result.snapshots.length - 1];
    expect(lastSnap.event).toBe('end');
    expect(lastSnap.globals.x).toBe(10);
    expect(lastSnap.globals.y).toBe(20);
  });

  it('11. 同名のグローバル変数とローカル変数が独立してスコープごとに変更検知されること', () => {
    const code = `
x = 5
def foo():
    x = 10
    return x
foo()
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    const funcSnap = result.snapshots.find((s: any) => s.functionName === 'foo' && s.locals.x === 10);
    expect(funcSnap).toBeDefined();
    expect(funcSnap.locals.x).toBe(10);
    expect(funcSnap.globals.x).toBe(5);
  });
});

describe('useTraceEngine React フックと Web Worker 通信のテスト (MockWorker)', () => {
  class MockWorker {
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onerror: ((ev: ErrorEvent) => void) | null = null;

    postMessage = vi.fn((msg: any) => {
      if (msg.type === 'INIT') {
        setTimeout(() => {
          this.onmessage?.({ data: { type: 'INIT_COMPLETE' } } as MessageEvent);
        }, 10);
      } else if (msg.type === 'RUN_TRACE') {
        if (msg.code.includes('ERROR_CASE')) {
          setTimeout(() => {
            this.onmessage?.({
              data: { type: 'TRACE_ERROR', error: '構文エラーが発生しました。' },
            } as MessageEvent);
          }, 10);
        } else {
          setTimeout(() => {
            this.onmessage?.({
              data: {
                type: 'TRACE_SUCCESS',
                result: {
                  snapshots: [
                    {
                      stepIndex: 0,
                      line: 1,
                      event: 'line',
                      globals: { x: 5 },
                      locals: {},
                      changedVars: ['x'],
                      stdoutDelta: '',
                      stdoutCumulative: '',
                    },
                  ],
                  totalSteps: 1,
                  stdout: '',
                },
              },
            } as MessageEvent);
          }, 10);
        }
      }
    });

    terminate = vi.fn();
  }

  beforeAll(() => {
    vi.stubGlobal('Worker', MockWorker);
  });

  it('初期状態から INIT_COMPLETE 受信時に isInitializing が false になること', async () => {
    const { result } = renderHook(() => useTraceEngine());
    expect(result.current.isInitializing).toBe(true);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(result.current.isInitializing).toBe(false);
    expect(result.current.initError).toBeNull();
  });

  it('runTrace 呼び出しにより成功レスポンスが返却されること', async () => {
    const { result } = renderHook(() => useTraceEngine());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    let traceRes: any;
    await act(async () => {
      traceRes = await result.current.runTrace('x = 5');
    });

    expect(traceRes).toBeDefined();
    expect(traceRes.totalSteps).toBe(1);
    expect(result.current.traceResult).toBeDefined();
    expect(result.current.error).toBeNull();
  });

  it('runTrace でエラーが返却された場合に error state にエラーメッセージが設定されること', async () => {
    const { result } = renderHook(() => useTraceEngine());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    await act(async () => {
      try {
        await result.current.runTrace('ERROR_CASE');
      } catch (err: any) {
        expect(err.message).toBe('構文エラーが発生しました。');
      }
    });

    expect(result.current.error).toBe('構文エラーが発生しました。');
  });

  it('resetTrace を呼ぶと traceResult と error がクリアされること', async () => {
    const { result } = renderHook(() => useTraceEngine());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    await act(async () => {
      await result.current.runTrace('x = 5');
    });

    expect(result.current.traceResult).not.toBeNull();

    act(() => {
      result.current.resetTrace();
    });

    expect(result.current.traceResult).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('truncated: true を含むトレース結果受信時に error state にメッセージがセットされスナップショットが保持されること', async () => {
    class TruncatedMockWorker extends MockWorker {
      postMessage = vi.fn((msg: any) => {
        if (msg.type === 'INIT') {
          setTimeout(() => {
            this.onmessage?.({ data: { type: 'INIT_COMPLETE' } } as MessageEvent);
          }, 10);
        } else if (msg.type === 'RUN_TRACE') {
          setTimeout(() => {
            this.onmessage?.({
              data: {
                type: 'TRACE_SUCCESS',
                result: {
                  snapshots: [
                    { stepIndex: 0, line: 1, event: 'line', globals: { i: 1 }, locals: {}, changedVars: ['i'], stdoutDelta: '', stdoutCumulative: '' },
                  ],
                  totalSteps: 1,
                  stdout: '',
                  truncated: true,
                  error: 'ステップ数上限 (10000) を超過しました。',
                },
              },
            } as MessageEvent);
          }, 10);
        }
      });
    }

    vi.stubGlobal('Worker', TruncatedMockWorker);

    const { result } = renderHook(() => useTraceEngine());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    let res: any;
    await act(async () => {
      res = await result.current.runTrace('while True: pass');
    });

    expect(res.truncated).toBe(true);
    expect(res.snapshots.length).toBe(1);
    expect(result.current.traceResult).toBeDefined();
    expect(result.current.traceResult?.truncated).toBe(true);
    expect(result.current.error).toContain('ステップ数上限');
  });
});
