import { describe, it, expect, beforeAll, vi } from 'vitest';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { PYTHON_TRACER_SCRIPT } from '../worker/pythonTracer';
import { renderHook, act } from '@testing-library/react';
import { useTraceEngine } from '../hooks/useTraceEngine';
import path from 'path';

describe('Challenger Stress Test 1: Pythonエラーハンドリングと復帰検証 (Pyodide実機)', () => {
  let pyodide: PyodideInterface;

  beforeAll(async () => {
    const pyodidePath = path.resolve(process.cwd(), 'node_modules/pyodide');
    pyodide = await loadPyodide({ indexURL: pyodidePath });
    await pyodide.runPythonAsync(PYTHON_TRACER_SCRIPT);
  }, 30000);

  it('1.1. Pythonの構文エラー (SyntaxError) 発生時に適切にエラーが返却され復帰可能か', () => {
    const code = `
def invalid_func(:
    pass
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('SyntaxError');

    // 正常なコードが直後に実行できるか (エンジンがクラッシュ・ハングしていないか)
    const validResultJson = runTracePy('x = 100', 10000);
    const validResult = JSON.parse(validResultJson);
    expect(validResult.success).toBe(true);
    expect(validResult.snapshots[validResult.snapshots.length - 1].globals.x).toBe(100);
  });

  it('1.2. ゼロ除算エラー (ZeroDivisionError) 発生時に途中までのスナップショットとエラーが返却され復帰可能か', () => {
    const code = `
a = 10
b = 0
c = a / b
`;
    const runTracePy = pyodide.globals.get('run_trace');
    const resultJson = runTracePy(code, 10000);
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('ZeroDivisionError');
    // エラー発生前のスナップショット (a=10, b=0) が記録されているか
    expect(result.snapshots.length).toBeGreaterThan(0);
    const lastSnap = result.snapshots[result.snapshots.length - 1];
    expect(lastSnap.globals.a).toBe(10);
    expect(lastSnap.globals.b).toBe(0);

    // 復帰確認
    const validResultJson = runTracePy('y = 200', 10000);
    const validResult = JSON.parse(validResultJson);
    expect(validResult.success).toBe(true);
  });

  it('1.3. 未定義変数参照 (NameError) やインデントエラー (IndentationError) のハンドリング', () => {
    const runTracePy = pyodide.globals.get('run_trace');

    // NameError
    const resNameErr = JSON.parse(runTracePy('a = b + 1', 10000));
    expect(resNameErr.success).toBe(false);
    expect(resNameErr.error).toContain('NameError');

    // IndentationError
    const resIndentErr = JSON.parse(runTracePy('def foo():\nx = 1', 10000));
    expect(resIndentErr.success).toBe(false);
    expect(resIndentErr.error).toContain('IndentationError');
  });
});

describe('Challenger Stress Test 2: React Hook (useTraceEngine) 非同期通信・状態・ガード検証', () => {
  class MockWorker {
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onerror: ((ev: ErrorEvent) => void) | null = null;
    pendingTimeouts: any[] = [];

    postMessage = vi.fn((msg: any) => {
      if (msg.type === 'INIT') {
        setTimeout(() => {
          this.onmessage?.({ data: { type: 'INIT_COMPLETE' } } as MessageEvent);
        }, 10);
      } else if (msg.type === 'RUN_TRACE') {
        const delay = msg.delay || 30;
        const tid = setTimeout(() => {
          if (msg.code.includes('SYNTAX_ERROR')) {
            this.onmessage?.({
              data: { type: 'TRACE_ERROR', error: 'SyntaxError: invalid syntax' },
            } as MessageEvent);
          } else if (msg.code.includes('ZERO_DIVISION')) {
            this.onmessage?.({
              data: { type: 'TRACE_ERROR', error: 'ZeroDivisionError: division by zero' },
            } as MessageEvent);
          } else {
            this.onmessage?.({
              data: {
                type: 'TRACE_SUCCESS',
                result: {
                  snapshots: [{ stepIndex: 0, line: 1, event: 'line', globals: { code: msg.code }, locals: {}, changedVars: [], stdoutDelta: '', stdoutCumulative: '' }],
                  totalSteps: 1,
                  stdout: `output_${msg.code}`,
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

  it('2.1a. [BUG DETECTED] ガード検証: runTrace 実行中に同期連続呼び出しをした場合、2回目の呼び出しが即時 Reject されるか', async () => {
    const { result } = renderHook(() => useTraceEngine());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.isInitializing).toBe(false);

    let promise1: Promise<any>;
    let promise2: Promise<any>;

    act(() => {
      promise1 = result.current.runTrace('code1');
      promise2 = result.current.runTrace('code2');
    });

    // 2回目は「現在トレースを実行中です」エラーで Reject されるべき
    await expect(promise2!).rejects.toThrow('現在トレースを実行中です');

    let res1: any;
    await act(async () => {
      res1 = await promise1;
    });
    expect(res1.stdout).toBe('output_code1');
    expect(result.current.isTracing).toBe(false);
  });

  it('2.1b. ガード検証: React 再描画後 (isTracing === true) に 2回目の runTrace を呼んだ場合のガード動作', async () => {
    const { result } = renderHook(() => useTraceEngine());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    let promise1: Promise<any>;
    act(() => {
      promise1 = result.current.runTrace('code1');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(result.current.isTracing).toBe(true);

    let promise2: Promise<any>;
    act(() => {
      promise2 = result.current.runTrace('code2');
    });

    await expect(promise2!).rejects.toThrow('現在トレースを実行中です');

    await act(async () => {
      await promise1;
    });
    expect(result.current.isTracing).toBe(false);
  });

  it('2.1c. [STRESS TEST] 同期連打検証: runTrace を 10 回連続で同時実行した場合、1回目が正常処理され 2~10 回目が即時 Reject されるか', async () => {
    const { result } = renderHook(() => useTraceEngine());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const promises: Promise<any>[] = [];
    act(() => {
      for (let i = 0; i < 10; i++) {
        promises.push(result.current.runTrace(`burst_code_${i}`));
      }
    });

    // 2回目以降 (インデックス 1～9) はすべて即時 Reject される
    for (let i = 1; i < 10; i++) {
      await expect(promises[i]).rejects.toThrow('現在トレースを実行中です');
    }

    // 1回目 (インデックス 0) は正常に処理される
    let res0: any;
    await act(async () => {
      res0 = await promises[0];
    });
    expect(res0.stdout).toBe('output_burst_code_0');
    expect(result.current.isTracing).toBe(false);
  });


  it('2.2. Error Test: SyntaxError / ZeroDivisionError 発生時の UI エラー状態更新と次実行の正常性', async () => {
    const { result } = renderHook(() => useTraceEngine());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // SyntaxError の呼び出し
    await act(async () => {
      try {
        await result.current.runTrace('SYNTAX_ERROR');
      } catch (err: any) {
        expect(err.message).toContain('SyntaxError');
      }
    });

    expect(result.current.isTracing).toBe(false);
    expect(result.current.error).toContain('SyntaxError');

    // ZeroDivisionError の呼び出し
    await act(async () => {
      try {
        await result.current.runTrace('ZERO_DIVISION');
      } catch (err: any) {
        expect(err.message).toContain('ZeroDivisionError');
      }
    });

    expect(result.current.isTracing).toBe(false);
    expect(result.current.error).toContain('ZeroDivisionError');

    // 次の正常なコードが正しく実行できること
    let validRes: any;
    await act(async () => {
      validRes = await result.current.runTrace('valid_code');
    });

    expect(result.current.isTracing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(validRes.stdout).toBe('output_valid_code');
  });

  it('2.3. Reset Test: 高速 resetTrace 実行時の安全性', async () => {
    const { result } = renderHook(() => useTraceEngine());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // 成功するトレースを実行
    await act(async () => {
      await result.current.runTrace('code_test');
    });
    expect(result.current.traceResult).not.toBeNull();

    // 高速で resetTrace 呼び出し
    act(() => {
      result.current.resetTrace();
    });
    expect(result.current.traceResult).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('2.4. Unmount Test: トレース実行中のコンポーネントアンマウント時の Worker terminate と Pending Promise Reject', async () => {
    const { result, unmount } = renderHook(() => useTraceEngine());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    let runPromise: Promise<any>;
    act(() => {
      runPromise = result.current.runTrace('slow_code');
    });

    // 実行中にコンポーネントをアンマウント
    act(() => {
      unmount();
    });

    // Pending Promise が「アンマウントされました」で Reject されるか検証
    await expect(runPromise!).rejects.toThrow('コンポーネントがアンマウントされました。');
  });
});
