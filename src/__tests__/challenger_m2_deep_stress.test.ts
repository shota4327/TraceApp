import { describe, it, expect, beforeAll, vi } from 'vitest';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { PYTHON_TRACER_SCRIPT } from '../worker/pythonTracer';
import { renderHook, act } from '@testing-library/react';
import { useTraceEngine } from '../hooks/useTraceEngine';
import path from 'path';

describe('Challenger Deep Stress Verification (challenger_m2_4)', () => {
  let pyodide: PyodideInterface;

  beforeAll(async () => {
    const pyodidePath = path.resolve(process.cwd(), 'node_modules/pyodide');
    pyodide = await loadPyodide({ indexURL: pyodidePath });
    await pyodide.runPythonAsync(PYTHON_TRACER_SCRIPT);
  }, 30000);

  describe('1. ユーザーコードによるシステム妨害・防御破りのストレス検証', () => {
    it('1.1. sys.settrace(None) によるトレーサー無効化試行の挙動', () => {
      const code = `
import sys
x = 1
sys.settrace(None)
y = 2
z = 3
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);
      // sys.settrace(None) の後、トレースステップが記録されなくなるか、または安全に終了するか
      expect(result.snapshots.length).toBeGreaterThan(0);
      
      // 次のコード実行でトレーサーが正常に機能するか (リセット復帰検証)
      const res2 = JSON.parse(runTracePy('a = 10', 10000));
      expect(res2.success).toBe(true);
      expect(res2.snapshots[res2.snapshots.length - 1].globals.a).toBe(10);
    });

    it('1.2. ユーザーコード内での sys.stdout 横取り・削除試行時の復帰検証', () => {
      const code = `
import sys, io
sys.stdout = io.StringIO()
print("Hijacked output")
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);

      // tracer 側の run_trace の finally 節により sys.stdout が元に戻り、次の実行で正常 print がキャプチャできるか
      const res2 = JSON.parse(runTracePy('print("Restored output")', 10000));
      expect(res2.success).toBe(true);
      expect(res2.stdout).toBe('Restored output\n');
    });

    it('1.3. ユーザーコードによる TraceLimitExceeded / BaseException の握りつぶしと有限ステップでの停止', () => {
      // note: Python 側で TraceLimitExceeded が発生したとき limit_exceeded=True になり毎回例外を投げるが、
      // bare except はそれを捕獲して無限ループになる懸念をチェックする。
      // max_steps を小規模 (50) に設定し、無限ループにならないか確認。
      // Python の sys.settrace は例外処理時にも trace イベントを発生させる。
      const code = `
i = 0
for _ in range(200):
    try:
        i += 1
    except BaseException:
        i += 10
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 50);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ステップ数上限');
    });

    it('1.4. 内部スコープ・変数の動的削除・破壊試行', () => {
      const code = `
x = 10
del x
globals().clear()
`;
      const runTracePy = pyodide.globals.get('run_trace');
      expect(() => runTracePy(code, 10000)).not.toThrow();
      const result = JSON.parse(runTracePy(code, 10000));
      expect(result).toBeDefined();
    });
  });

  describe('2. サニタイズ・極限データ構造のストレス検証', () => {
    it('2.1. 非標準データ型 (complex, bytes, bytearray, generator, lambda, module) の安全変換', () => {
      const code = `
import math
c_num = 1 + 2j
b_data = b'hello binary'
ba_data = bytearray(b'bytearray')
gen_exp = (i for i in range(5))
lam_fn = lambda x: x * 2
import json as json_mod
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      
      expect(() => JSON.parse(resultJson)).not.toThrow();
      const result = JSON.parse(resultJson);
      expect(result.success).toBe(true);

      const lastSnap = result.snapshots[result.snapshots.length - 1];
      expect(lastSnap.globals.c_num).toBe('(1+2j)');
      expect(lastSnap.globals.b_data).toBe("b'hello binary'");
      expect(lastSnap.globals.gen_exp).toContain('generator');
    });

    it('2.2. 非文字列キー辞書 ({ (1,2): "tuple", None: "none", 3.14: "pi" }) の JSON シリアライズ適合性', () => {
      const code = `
d = { (1, 2): "tuple_key", None: "none_key", 3.14: "pi_key" }
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);

      expect(() => JSON.parse(resultJson)).not.toThrow();
      const result = JSON.parse(resultJson);
      expect(result.success).toBe(true);

      const lastSnap = result.snapshots[result.snapshots.length - 1];
      expect(lastSnap.globals.d['(1, 2)']).toBe('tuple_key');
      expect(lastSnap.globals.d['None']).toBe('none_key');
    });

    it('2.3. ネスト深さ限界突破 (10 階層のネスト) 時の _safe_repr フォールバック', () => {
      const code = `
d = {}
cur = d
for i in range(15):
    cur["next"] = {}
    cur = cur["next"]
cur["val"] = "deep"
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);

      expect(() => JSON.parse(resultJson)).not.toThrow();
      const result = JSON.parse(resultJson);
      expect(result.success).toBe(true);
    });

    it('2.4. 巨大文字列・大容量配列の出力・処理パフォーマンス', () => {
      const code = `
large_str = "A" * 10000
large_list = list(range(1000))
print("BULK_PRINT_" + "X" * 1000)
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);

      expect(() => JSON.parse(resultJson)).not.toThrow();
      const result = JSON.parse(resultJson);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('BULK_PRINT_');
    });
  });

  describe('3. React Hook (useTraceEngine) の超連打・初期化失敗・エッジケースストレス検証', () => {
    class ControlledMockWorker {
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onerror: ((ev: ErrorEvent) => void) | null = null;
      shouldFailInit = false;

      postMessage = vi.fn((msg: any) => {
        if (msg.type === 'INIT') {
          setTimeout(() => {
            if (this.shouldFailInit) {
              this.onmessage?.({ data: { type: 'INIT_ERROR', error: 'CDN Network Error' } } as MessageEvent);
            } else {
              this.onmessage?.({ data: { type: 'INIT_COMPLETE' } } as MessageEvent);
            }
          }, 10);
        } else if (msg.type === 'RUN_TRACE') {
          setTimeout(() => {
            this.onmessage?.({
              data: {
                type: 'TRACE_SUCCESS',
                result: {
                  snapshots: [],
                  totalSteps: 0,
                  stdout: `done_${msg.code}`,
                },
              },
            } as MessageEvent);
          }, 20);
        }
      });

      terminate = vi.fn();
    }

    it('3.1. 100回連続で runTrace を呼び出した際、1回目のみ成功し残りの99回がすべて即座に Reject されるか', async () => {
      vi.stubGlobal('Worker', ControlledMockWorker);
      const { result } = renderHook(() => useTraceEngine());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      const promises: Promise<any>[] = [];
      act(() => {
        for (let i = 0; i < 100; i++) {
          promises.push(result.current.runTrace(`code_${i}`));
        }
      });

      let rejectedCount = 0;
      let fulfilledCount = 0;

      const results = await Promise.allSettled(promises);
      results.forEach((res) => {
        if (res.status === 'rejected') rejectedCount++;
        if (res.status === 'fulfilled') fulfilledCount++;
      });

      expect(fulfilledCount).toBe(1);
      expect(rejectedCount).toBe(99);
    });

    it('3.2. Worker 初期化失敗 (INIT_ERROR) 発生時に runTrace を呼ぶと適切なエラーメッセージで Reject されるか', async () => {
      class FailingWorker extends ControlledMockWorker {
        constructor() {
          super();
          this.shouldFailInit = true;
        }
      }
      vi.stubGlobal('Worker', FailingWorker);

      const { result } = renderHook(() => useTraceEngine());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(result.current.isInitializing).toBe(false);
      expect(result.current.initError).toBe('CDN Network Error');

      await act(async () => {
        await expect(result.current.runTrace('code')).rejects.toThrow('Pyodide初期化エラー: CDN Network Error');
      });
    });
  });
});
