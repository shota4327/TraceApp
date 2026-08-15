import { describe, it, expect, beforeAll, vi } from 'vitest';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { PYTHON_TRACER_SCRIPT } from '../worker/pythonTracer';
import { renderHook, act } from '@testing-library/react';
import { useTraceEngine } from '../hooks/useTraceEngine';
import path from 'path';

/**
 * Milestone 1 対立的検証テスト (challenger_m1_adversarial.test.ts)
 * 
 * 検証対象:
 * - src/worker/pythonTracer.ts
 * - src/worker/pyodideWorker.ts
 * - src/hooks/useTraceEngine.ts
 * 
 * テスト観点:
 * 1. ネストされた関数・クロージャ・フレーム遷移の正確性
 * 2. 深層再帰および Python RecursionError 時の安全なエラー回収
 * 3. グローバル・ローカル・クロージャ変数における同名変数の隠蔽 (Shadowing)
 * 4. 10,000ステップ上限到達および限界超えループの動作・パフォーマンス
 * 5. NaN, Infinity, 循環参照, repr例外オブジェクト等の極端なデータ型サニタイズ
 * 6. ビルトイン上書きや空コード・コメントコード等の環境境界値
 * 7. useTraceEngine フックの非同期・限界ストレス・並行制御・アンマウント動作
 */

describe('M1 Adversarial Tests: pythonTracer (Pyodide実機)', () => {
  let pyodide: PyodideInterface;

  beforeAll(async () => {
    const pyodidePath = path.resolve(process.cwd(), 'node_modules/pyodide');
    pyodide = await loadPyodide({ indexURL: pyodidePath });
    await pyodide.runPythonAsync(PYTHON_TRACER_SCRIPT);
  }, 30000);

  it('1.1 ネストされた関数 (3階層) とクロージャ変数のトレースが正確にフレーム追跡されること', () => {
    const code = `
def outer(a):
    x = a * 2
    def middle(b):
        y = x + b
        def inner(c):
            z = y + c
            return z
        return inner(b * 2)
    return middle(a + 1)

res = outer(3)
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    expect(result.snapshots.length).toBeGreaterThan(0);

    // outer, middle, inner の各関数フレームが存在すること
    const funcNames = result.snapshots.map((s: any) => s.functionName).filter(Boolean);
    expect(funcNames).toContain('outer');
    expect(funcNames).toContain('middle');
    expect(funcNames).toContain('inner');

    // 最終的な計算結果 (outer(3) -> x=6, middle(4) -> y=10, inner(8) -> z=18)
    const endSnap = result.snapshots[result.snapshots.length - 1];
    expect(endSnap.globals.res).toBe(18);
  });

  it('1.2 深層再帰関数および RecursionError 発生時にトレーサーが安全に例外をハンドリングし復帰できること', () => {
    const code = `
def infinite_recurse(n):
    return infinite_recurse(n + 1)

infinite_recurse(1)
`;
    const runTracePy = pyodide.globals.get('run_trace');
    // ステップ上限を 5000 に設定して Python の最大再帰深度エラー (RecursionError) または ステップ上限ガードに引っかかるか検証
    const resultJson = runTracePy(code, 5000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    // RecursionError または TraceLimitExceeded のいずれかで安全に捕捉されていること
    const isRecursionOrLimit = result.error.includes('RecursionError') || result.error.includes('ステップ数上限');
    expect(isRecursionOrLimit).toBe(true);

    // 直後に正常コードを実行してもトレーサーが正常動作すること
    const recoveryJson = runTracePy('ok = True', 100);
    const recovery = JSON.parse(recoveryJson);
    expect(recovery.success).toBe(true);
    expect(recovery.snapshots[recovery.snapshots.length - 1].globals.ok).toBe(true);
  });

  it('1.3 変数の隠蔽 (Shadowing: グローバル x, outer x, inner x) がスコープごとに独立して分離されること', () => {
    const code = `
x = "global_x"

def outer():
    x = "outer_x"
    def inner():
        x = "inner_x"
        return x
    inner()
    return x

res = outer()
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);

    // inner 実行中の locals.x が "inner_x" であること
    const innerSnap = result.snapshots.find((s: any) => s.functionName === 'inner' && s.locals.x === 'inner_x');
    expect(innerSnap).toBeDefined();
    expect(innerSnap.globals.x).toBe('global_x');

    // outer 実行中の locals.x が "outer_x" であること
    const outerSnap = result.snapshots.find((s: any) => s.functionName === 'outer' && s.locals.x === 'outer_x');
    expect(outerSnap).toBeDefined();
    expect(outerSnap.globals.x).toBe('global_x');

    // 全体終了時の globals.x が "global_x", res が "outer_x" であること
    const endSnap = result.snapshots[result.snapshots.length - 1];
    expect(endSnap.globals.x).toBe('global_x');
    expect(endSnap.globals.res).toBe('outer_x');
  });

  it('1.4 1万回ステップループにおける厳密な上限判定 (max_steps=10000 で 10001 ステップ以上実行時)', () => {
    const code = `
count = 0
for i in range(15000):
    count += 1
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('ステップ数上限 (10000) を超過しました');
    expect(result.snapshots.length).toBe(10000);
    expect(result.totalSteps).toBe(10000);
  });

  it('1.5 境界値ステップ数 (max_steps=1000 で正好1000ステップ以下のループ)', () => {
    const code = `
total = 0
for i in range(100):
    total += i
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 1000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    expect(result.snapshots.length).toBeLessThanOrEqual(1000);
    expect(result.snapshots[result.snapshots.length - 1].globals.total).toBe(4950);
  });

  it('1.6 極端なデータ型: NaN / Infinity, 相互循環参照, repr例外オブジェクトの安全なサニタイズ', () => {
    const code = `
import math

class BuggyRepr:
    def __repr__(self):
        raise RuntimeError("Custom repr crash!")

class CircularNode:
    def __init__(self, name):
        self.name = name
        self.ref = None

node1 = CircularNode("A")
node2 = CircularNode("B")
node1.ref = node2
node2.ref = node1

bad_obj = BuggyRepr()

complex_data = {
    "nan": float('nan'),
    "inf": float('inf'),
    "ninf": float('-inf'),
    "buggy": bad_obj,
    "nodes": [node1, node2]
}
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);

    const endSnap = result.snapshots[result.snapshots.length - 1];
    const data = endSnap.globals.complex_data;

    expect(data.nan).toBe('NaN');
    expect(data.inf).toBe('Infinity');
    expect(data.ninf).toBe('-Infinity');
    // __repr__ が例外を投げるオブジェクトは safe_repr により文字列表現へ変換されること
    expect(data.buggy).toContain('BuggyRepr object at');

    // 循環参照ノードがクラッシュせずに文字列表現されること
    expect(data.nodes[0]).toContain('CircularNode object at');
  });

  it('1.7 ビルトイン関数の上書き・タプルキー辞書・空コード等のエッジケース', () => {
    const runTracePy = pyodide.globals.get('run_trace');

    // ビルトイン print の上書き
    const codePrintOverride = `
print = "overridden"
x = 42
`;
    const resPrint = JSON.parse(runTracePy(codePrintOverride, 10000));
    expect(resPrint.success).toBe(true);
    expect(resPrint.snapshots[resPrint.snapshots.length - 1].globals.print).toBe('overridden');

    // タプルキーを持つ辞書のサニタイズ (キーが str(k) で文字列化されること)
    const codeTupleKey = `
d = {(1, 2): "tuple_key"}
`;
    const resTuple = JSON.parse(runTracePy(codeTupleKey, 10000));
    expect(resTuple.success).toBe(true);
    expect(resTuple.snapshots[resTuple.snapshots.length - 1].globals.d).toEqual({ "(1, 2)": "tuple_key" });

    // 空コード・コメントのみのコード
    const resEmpty = JSON.parse(runTracePy('# only comment\n', 10000));
    expect(resEmpty.success).toBe(true);
    expect(resEmpty.snapshots.length).toBeGreaterThan(0);
  });
});

describe('M1 Adversarial Tests: pyodideWorker & useTraceEngine Hook (モックおよび統合検証)', () => {
  class MockWorker {
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onerror: ((ev: ErrorEvent) => void) | null = null;
    pendingTimeouts: any[] = [];

    postMessage = vi.fn((msg: any) => {
      if (msg.type === 'INIT') {
        const tid = setTimeout(() => {
          this.onmessage?.({ data: { type: 'INIT_COMPLETE' } } as MessageEvent);
        }, 10);
        this.pendingTimeouts.push(tid);
      } else if (msg.type === 'RUN_TRACE') {
        const delay = msg.delay || 20;
        const tid = setTimeout(() => {
          if (msg.code === 'TRUNCATED_CASE') {
            this.onmessage?.({
              data: {
                type: 'TRACE_SUCCESS',
                result: {
                  snapshots: [
                    { stepIndex: 0, line: 1, event: 'line', globals: { i: 1 }, locals: {}, changedVars: ['i'], stdoutDelta: '', stdoutCumulative: '' },
                  ],
                  totalSteps: 10000,
                  stdout: '',
                  truncated: true,
                  error: 'ステップ数上限 (10000) を超過しました。',
                },
              },
            } as MessageEvent);
          } else if (msg.code === 'CRASH_CASE') {
            this.onmessage?.({
              data: { type: 'TRACE_ERROR', error: 'Python execution crashed unexpectedly' },
            } as MessageEvent);
          } else {
            this.onmessage?.({
              data: {
                type: 'TRACE_SUCCESS',
                result: {
                  snapshots: [
                    { stepIndex: 0, line: 1, event: 'line', globals: { val: 100 }, locals: {}, changedVars: ['val'], stdoutDelta: '', stdoutCumulative: '' },
                  ],
                  totalSteps: 1,
                  stdout: 'ok',
                },
              },
            } as MessageEvent);
          }
        }, delay);
        this.pendingTimeouts.push(tid);
      }
    });

    terminate = vi.fn(() => {
      this.pendingTimeouts.forEach((t) => clearTimeout(t));
    });
  }

  beforeAll(() => {
    vi.stubGlobal('Worker', MockWorker);
  });

  it('2.1 初期化前に runTrace を呼び出すと即座にエラーメッセージで Reject されること', async () => {
    const { result } = renderHook(() => useTraceEngine());
    // まだ isInitializing === true の状態

    let err: any;
    try {
      await result.current.runTrace('x = 1');
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err.message).toContain('Pyodideの初期化中です');
  });

  it('2.2 truncated: true のレスポンスを受信した際、traceResult に partial スナップショットが保存され error にメッセージが設定されること', async () => {
    const { result } = renderHook(() => useTraceEngine());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    let traceRes: any;
    await act(async () => {
      traceRes = await result.current.runTrace('TRUNCATED_CASE');
    });

    expect(traceRes.truncated).toBe(true);
    expect(traceRes.snapshots.length).toBe(1);
    expect(result.current.traceResult?.truncated).toBe(true);
    expect(result.current.error).toContain('ステップ数上限');
  });

  it('2.3 ワーカーエラー発生後の復帰: TRACE_ERROR 発生後に再度 runTrace を行うと正常に実行できること', async () => {
    const { result } = renderHook(() => useTraceEngine());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // CRASH_CASE を実行
    await act(async () => {
      try {
        await result.current.runTrace('CRASH_CASE');
      } catch (err: any) {
        expect(err.message).toContain('Python execution crashed');
      }
    });

    expect(result.current.error).toContain('Python execution crashed');
    expect(result.current.isTracing).toBe(false);

    // 正常ケースを実行
    let successRes: any;
    await act(async () => {
      successRes = await result.current.runTrace('NORMAL_CASE');
    });

    expect(successRes.stdout).toBe('ok');
    expect(result.current.error).toBeNull();
    expect(result.current.traceResult).toBeDefined();
  });
});
