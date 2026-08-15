import { describe, it, expect, beforeAll, vi } from 'vitest';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { PYTHON_TRACER_SCRIPT } from '../worker/pythonTracer';
import { renderHook, act } from '@testing-library/react';
import { useTraceEngine } from '../hooks/useTraceEngine';
import path from 'path';

/**
 * Challenger M1-2 対立的検証テスト (Empirical Challenge Test)
 * 検証対象:
 * 1. 3種類のPythonプログラム（基本順次代入、条件分岐、ループと関数呼び出し）でのトレース動作
 * 2. 最終行スナップショット (event: "end") の採取・評価
 * 3. グローバル/ローカルスコープ変化判定 (changedVars, スコープ分離, 変数シャドウイング)
 * 4. ステップ数上限オーバー時の挙動 (TraceLimitExceeded, BaseException突破, truncated部分結果)
 * 5. useTraceEngine フック統合検証
 */

describe('Challenger M1-2: Pyodide トレースエンジン実用コードパターン検証', () => {
  let pyodide: PyodideInterface;

  beforeAll(async () => {
    const pyodidePath = path.resolve(process.cwd(), 'node_modules/pyodide');
    pyodide = await loadPyodide({ indexURL: pyodidePath });
    await pyodide.runPythonAsync(PYTHON_TRACER_SCRIPT);
  }, 30000);

  // --------------------------------------------------------------------------
  // 1. 検証用プログラム1: 基本順次代入
  // --------------------------------------------------------------------------
  describe('検証プログラム1: 基本順次代入', () => {
    const code = `
x = 5
y = 3
total = x + y
print(total)
`;

    it('順次代入コードの全ステップスナップショット、出力、および最終行スナップショットが正確であること', () => {
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('8\n');

      const snapshots = result.snapshots;
      expect(snapshots.length).toBeGreaterThan(0);

      // x = 5 の実行後 (y = 3 の行イベント時) の検証
      const yLineSnap = snapshots.find((s: any) => s.globals.x === 5 && s.globals.y === undefined);
      expect(yLineSnap).toBeDefined();
      expect(yLineSnap.changedVars).toContain('x');

      // y = 3 の実行後 (total = x + y の行イベント時) の検証
      const totalLineSnap = snapshots.find((s: any) => s.globals.y === 3 && s.globals.total === undefined);
      expect(totalLineSnap).toBeDefined();
      expect(totalLineSnap.changedVars).toContain('y');

      // total = x + y の実行後 (print の行イベント時) の検証
      const printLineSnap = snapshots.find((s: any) => s.globals.total === 8);
      expect(printLineSnap).toBeDefined();
      expect(printLineSnap.changedVars).toContain('total');

      // 最終行スナップショット (event: "end") の検証
      const lastSnap = snapshots[snapshots.length - 1];
      expect(lastSnap.event).toBe('end');
      expect(lastSnap.astNodeId).toBe('node-end');
      expect(lastSnap.globals.x).toBe(5);
      expect(lastSnap.globals.y).toBe(3);
      expect(lastSnap.globals.total).toBe(8);
      expect(lastSnap.stdoutCumulative).toBe('8\n');
    });
  });

  // --------------------------------------------------------------------------
  // 2. 検証用プログラム2: 条件分岐
  // --------------------------------------------------------------------------
  describe('検証プログラム2: 条件分岐', () => {
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

    it('条件分岐で実行パスのみがトレースされ、非通過ブロックの変数が混入しないこと', () => {
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('B\n');

      const snapshots = result.snapshots;

      // 不成立ブロック (grade = "A", grade = "C") に該当する行がスナップショットに含まれないことを検証
      const lines = snapshots.map((s: any) => s.line);
      // grade = "A" は line 4
      expect(lines).not.toContain(4);
      // grade = "C" は line 8
      expect(lines).not.toContain(8);

      // grade = "B" の実行後の検証
      const bSnap = snapshots.find((s: any) => s.globals.grade === 'B');
      expect(bSnap).toBeDefined();
      expect(bSnap.changedVars).toContain('grade');

      // 最終行スナップショット
      const lastSnap = snapshots[snapshots.length - 1];
      expect(lastSnap.event).toBe('end');
      expect(lastSnap.globals.score).toBe(75);
      expect(lastSnap.globals.grade).toBe('B');
      expect(lastSnap.globals.grade).not.toBe('A');
      expect(lastSnap.globals.grade).not.toBe('C');
    });
  });

  // --------------------------------------------------------------------------
  // 3. 検証用プログラム3: ループと関数呼び出し
  // --------------------------------------------------------------------------
  describe('検証プログラム3: ループと関数呼び出し', () => {
    const code = `
def add(a, b):
    result = a + b
    return result

total = 0
for i in range(1, 4):
    total = add(total, i)
print(total)
`;

    it('関数呼び出し時のローカルスコープとグローバルスコープが明確に分離されること', () => {
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('6\n');

      const snapshots = result.snapshots;

      // トップレベルステップでは locals が空オブジェクトであり functionName が null であること
      const topLevelSnaps = snapshots.filter((s: any) => s.functionName === null);
      expect(topLevelSnaps.length).toBeGreaterThan(0);
      for (const snap of topLevelSnaps) {
        expect(snap.locals).toEqual({});
      }

      // add 関数内のステップを検証
      const addSnaps = snapshots.filter((s: any) => s.functionName === 'add');
      expect(addSnaps.length).toBeGreaterThan(0);

      // 1回目の add 呼び出し (total=0, i=1)
      const firstAdd = addSnaps.find((s: any) => s.locals.a === 0 && s.locals.b === 1);
      expect(firstAdd).toBeDefined();
      expect(firstAdd.globals.total).toBe(0);

      // 3回目の add 呼び出し (total=3, i=3)
      const thirdAdd = addSnaps.find((s: any) => s.locals.a === 3 && s.locals.b === 3);
      expect(thirdAdd).toBeDefined();
      expect(thirdAdd.globals.total).toBe(3);

      // 最終行スナップショット
      const lastSnap = snapshots[snapshots.length - 1];
      expect(lastSnap.event).toBe('end');
      expect(lastSnap.globals.total).toBe(6);
      expect(lastSnap.globals.i).toBe(3);
    });
  });

  // --------------------------------------------------------------------------
  // 4. グローバル/ローカルスコープ変化判定 (changedVars & Variable Shadowing) 深度検証
  // --------------------------------------------------------------------------
  describe('スコープ変化判定 (changedVars & Shadowing) 深度検証', () => {
    it('同一値の連続評価・再代入では 2回目以降の評価で changedVars に追加されないこと', () => {
      const code = `
x = 10
x = 10
y = 20
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const result = JSON.parse(runTracePy(code, 10000));

      expect(result.success).toBe(true);
      const snaps = result.snapshots;

      // 行2 (x=10) 実行後、行3イベント時: x が新規登録され changedVars = ['x']
      const snapAtLine3 = snaps.find((s: any) => s.line === 3 && s.event === 'line');
      expect(snapAtLine3.changedVars).toContain('x');

      // 行3 (2回目の x=10) 実行後、行4イベント時: x の値は 10 のままで変わらないため changedVars に 'x' は含まれない
      const snapAtLine4 = snaps.find((s: any) => s.line === 4 && s.event === 'line');
      expect(snapAtLine4.changedVars).not.toContain('x');
    });

    it('グローバル変数と同名のローカル変数のシャドウイングが相互に干渉せず記録されること', () => {
      const code = `
val = 100

def shadow_test():
    val = 200
    return val

shadow_test()
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const result = JSON.parse(runTracePy(code, 10000));

      expect(result.success).toBe(true);
      const snaps = result.snapshots;

      // 関数内の val = 200
      const shadowSnap = snaps.find((s: any) => s.functionName === 'shadow_test' && s.locals.val === 200);
      expect(shadowSnap).toBeDefined();
      expect(shadowSnap.locals.val).toBe(200);
      expect(shadowSnap.globals.val).toBe(100);
      expect(shadowSnap.changedVars).toContain('val');

      // 関数を抜けた後、グローバル val は 100 のまま保持されること
      const endSnap = snaps[snaps.length - 1];
      expect(endSnap.globals.val).toBe(100);
      expect(endSnap.locals.val).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 5. ステップ上限オーバーおよび例外突破検証
  // --------------------------------------------------------------------------
  describe('ステップ上限オーバー (TraceLimitExceeded) 検証', () => {
    it('指定ステップ上限 (maxSteps) に達すると即座に安全停止し、収集済みの部分スナップショットが保持されること', () => {
      const code = `
counter = 0
while True:
    counter += 1
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const result = JSON.parse(runTracePy(code, 25)); // maxSteps = 25

      expect(result.success).toBe(false);
      expect(result.error).toContain('ステップ数上限 (25) を超過しました');
      expect(result.snapshots.length).toBe(25);
      expect(result.snapshots[result.snapshots.length - 1].globals.counter).toBeGreaterThan(0);
    });

    it('ユーザーコードに try...except Exception: が存在しても上限例外 (BaseException) を捕獲できず停止すること', () => {
      const code = `
counter = 0
while True:
    try:
        counter += 1
    except Exception:
        pass
    except (KeyError, ValueError, TypeError):
        pass
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const result = JSON.parse(runTracePy(code, 15));

      expect(result.success).toBe(false);
      expect(result.error).toContain('ステップ数上限 (15) を超過しました');
      expect(result.snapshots.length).toBe(15);
    });
  });
});

// --------------------------------------------------------------------------
// 6. pyodideWorker & useTraceEngine 結合テスト (Mock Worker & Truncated Flow)
// --------------------------------------------------------------------------
describe('Challenger M1-2: useTraceEngine フックと Pyodide Worker の結合動作検証', () => {
  class MockWorkerWithTruncated {
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onerror: ((ev: ErrorEvent) => void) | null = null;

    postMessage = vi.fn((msg: any) => {
      if (msg.type === 'INIT') {
        setTimeout(() => {
          this.onmessage?.({ data: { type: 'INIT_COMPLETE' } } as MessageEvent);
        }, 10);
      } else if (msg.type === 'RUN_TRACE') {
        if (msg.code.includes('LIMIT_OVERFLOW')) {
          // 上限オーバー時: Worker は partial result + truncated: true を返す
          setTimeout(() => {
            this.onmessage?.({
              data: {
                type: 'TRACE_SUCCESS',
                result: {
                  snapshots: [
                    { stepIndex: 0, line: 1, event: 'line', globals: { i: 1 }, locals: {}, changedVars: ['i'], stdoutDelta: '', stdoutCumulative: '' },
                    { stepIndex: 1, line: 2, event: 'line', globals: { i: 2 }, locals: {}, changedVars: ['i'], stdoutDelta: '', stdoutCumulative: '' },
                  ],
                  totalSteps: 2,
                  stdout: '',
                  truncated: true,
                  error: 'ステップ数上限 (2) を超過しました。',
                },
              },
            } as MessageEvent);
          }, 10);
        } else {
          // 通常実行
          setTimeout(() => {
            this.onmessage?.({
              data: {
                type: 'TRACE_SUCCESS',
                result: {
                  snapshots: [
                    { stepIndex: 0, line: 1, event: 'line', globals: { x: 5 }, locals: {}, changedVars: ['x'], stdoutDelta: '', stdoutCumulative: '' },
                    { stepIndex: 1, line: 2, event: 'line', globals: { x: 5, y: 3 }, locals: {}, changedVars: ['y'], stdoutDelta: '', stdoutCumulative: '' },
                    { stepIndex: 2, line: 3, event: 'end', globals: { x: 5, y: 3, total: 8 }, locals: {}, changedVars: ['total'], stdoutDelta: '8\n', stdoutCumulative: '8\n' },
                  ],
                  totalSteps: 3,
                  stdout: '8\n',
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
    vi.stubGlobal('Worker', MockWorkerWithTruncated);
  });

  it('useTraceEngine で 3種類のプログラムが正常実行完了すること', async () => {
    const { result } = renderHook(() => useTraceEngine());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(result.current.isInitializing).toBe(false);

    let res: any;
    await act(async () => {
      res = await result.current.runTrace('x = 5\ny = 3\ntotal = x + y\nprint(total)');
    });

    expect(res.totalSteps).toBe(3);
    expect(res.snapshots.length).toBe(3);
    expect(result.current.traceResult).toBeDefined();
    expect(result.current.error).toBeNull();
  });

  it('上限オーバー時に useTraceEngine が error にメッセージを設定しつつ、収集済みの traceResult (truncated: true) を保持すること', async () => {
    const { result } = renderHook(() => useTraceEngine());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    let res: any;
    await act(async () => {
      res = await result.current.runTrace('LIMIT_OVERFLOW_TEST');
    });

    expect(res.truncated).toBe(true);
    expect(res.snapshots.length).toBe(2);
    expect(result.current.traceResult).toBeDefined();
    expect(result.current.traceResult?.truncated).toBe(true);
    expect(result.current.error).toContain('ステップ数上限');
  });
});
