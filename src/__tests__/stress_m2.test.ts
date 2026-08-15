import { describe, it, expect, beforeAll } from 'vitest';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { PYTHON_TRACER_SCRIPT } from '../worker/pythonTracer';
import path from 'path';

describe('Challenger Stress Tests for Pyodide Trace Engine (stress_m2.test.ts)', () => {
  let pyodide: PyodideInterface;

  beforeAll(async () => {
    const pyodidePath = path.resolve(process.cwd(), 'node_modules/pyodide');
    pyodide = await loadPyodide({ indexURL: pyodidePath });
    await pyodide.runPythonAsync(PYTHON_TRACER_SCRIPT);
  }, 30000);

  describe('1. 無限ループおよび例外ハンドリングのストレステスト', () => {
    it('1.1 while True + try...except Exception で 10,000ステップ上限が発動し TRACE_ERROR (success: false) が返ること', () => {
      const code = `
i = 0
while True:
    try:
        i += 1
    except Exception as e:
        i += 100
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 100);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ステップ数上限');
      expect(result.snapshots.length).toBe(100);
    });

    it('1.2 try...except 内でのステップ数上限ガードの挙動検証', () => {
      const code = `
i = 0
for _ in range(500):
    try:
        i += 1
    except Exception:
        pass
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 100);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ステップ数上限');
      expect(result.snapshots.length).toBe(100);
    });

    it('1.3 再帰深さ超過 (RecursionError) を含むコードのハンドリング', () => {
      const code = `
def recurse():
    try:
        recurse()
    except Exception:
        pass
recurse()
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 500);
      const result = JSON.parse(resultJson);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('2. 特殊浮動小数点数および複雑な循環参照のストレステスト', () => {
    it('2.1 ネストされた dict, list, set, tuple 内の float("nan"), float("inf"), float("-inf")', () => {
      const code = `
import math
data = {
    "nan": float('nan'),
    "inf": float('inf'),
    "ninf": float('-inf'),
    "nested_list": [[float('nan'), float('inf')]],
    "nested_tuple": (float('-inf'),),
    "set_val": {float('nan')}
}
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);

      // JSON.parse がクラッシュしないこと
      expect(() => JSON.parse(resultJson)).not.toThrow();
      const result = JSON.parse(resultJson);
      expect(result.success).toBe(true);

      const lastSnap = result.snapshots[result.snapshots.length - 1];
      expect(lastSnap.globals.data.nan).toBe('NaN');
      expect(lastSnap.globals.data.inf).toBe('Infinity');
      expect(lastSnap.globals.data.ninf).toBe('-Infinity');
      expect(lastSnap.globals.data.nested_list).toEqual([['NaN', 'Infinity']]);
      expect(lastSnap.globals.data.nested_tuple).toEqual(['-Infinity']);
    });

    it('2.2 リストおよび辞書の直接・間接循環参照 (a = []; a.append(a), d = {}; d["self"] = d)', () => {
      const code = `
a = []
a.append(a)

d = {}
d["self"] = d

x = []
y = [x]
x.append(y)
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);

      expect(() => JSON.parse(resultJson)).not.toThrow();
      const result = JSON.parse(resultJson);
      expect(result.success).toBe(true);

      const lastSnap = result.snapshots[result.snapshots.length - 1];
      expect(lastSnap.globals.a).toBeDefined();
      expect(lastSnap.globals.d).toBeDefined();
      expect(lastSnap.globals.x).toBeDefined();
    });

    it('2.3 repr() で例外を送出するクラスインスタンスの安全キャプチャ', () => {
      const code = `
class BadRepr:
    def __repr__(self):
        raise RuntimeError("repr error!")

b = BadRepr()
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);

      expect(() => JSON.parse(resultJson)).not.toThrow();
      const result = JSON.parse(resultJson);
      expect(result.success).toBe(true);
      const lastSnap = result.snapshots[result.snapshots.length - 1];
      expect(lastSnap.globals.b).toBeDefined();
      expect(typeof lastSnap.globals.b).toBe('string');
    });
  });

  describe('3. print() の連続・改行なし・多重呼び出しの stdout 差分/累積テスト', () => {
    it('3.1 end="" による改行なし連続 print() の差分と累積の推移検証', () => {
      const code = `
print("A", end="")
print("B", end="")
print("C", end="\\n")
print("D")
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('ABC\nD\n');
    });

    it('3.2 ループ内での多重 print() 呼び出し時の各ステップでの累積値保持', () => {
      const code = `
for i in range(3):
    print(f"Step {i}: ", end="")
    print("OK")
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('Step 0: OK\nStep 1: OK\nStep 2: OK\n');
    });

    it('3.3 最終行での print() 出力が snapshots または最終 stdout に正しく反映されるかの検証', () => {
      const code = `
x = 10
print("FINAL OUTPUT", end="")
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('FINAL OUTPUT');
    });
  });
});
