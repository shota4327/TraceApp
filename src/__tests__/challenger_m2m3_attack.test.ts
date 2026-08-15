import { describe, it, expect, beforeAll } from 'vitest';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { PYTHON_TRACER_SCRIPT } from '../worker/pythonTracer';
import path from 'path';

describe('Challenger M2/M3 Attack & Boundary Tests', () => {
  let pyodide: PyodideInterface;

  beforeAll(async () => {
    const pyodidePath = path.resolve(process.cwd(), 'node_modules/pyodide');
    pyodide = await loadPyodide({ indexURL: pyodidePath });
    await pyodide.runPythonAsync(PYTHON_TRACER_SCRIPT);
  }, 30000);

  describe('1. 可変オブジェクト (List, Dict) の内部変更に対する changedVars 検出検証', () => {
    it('1.1. リストの append や要素更新で changedVars に変数名が含まれるか', () => {
      const code = `
lst = [1, 2]
lst.append(3)
lst[0] = 99
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);

      const step2 = result.snapshots.find((s: any) => s.line === 3);
      const step3 = result.snapshots.find((s: any) => s.line === 4);

      expect(step2?.changedVars).toContain('lst');
      expect(step3?.changedVars).toContain('lst');
    });

    it('1.2. 辞書のキー追加や値更新で changedVars に変数名が含まれるか', () => {
      const code = `
d = {"a": 1}
d["b"] = 2
d["a"] = 100
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);

      const step2 = result.snapshots.find((s: any) => s.line === 3);
      const step3 = result.snapshots.find((s: any) => s.line === 4);

      expect(step2?.changedVars).toContain('d');
      expect(step3?.changedVars).toContain('d');
    });
  });

  describe('2. Unicode / 日本語変数名・文字列の境界テスト', () => {
    it('2.1. 日本語変数名（CJK識別子）の代入・評価・シリアライズ', () => {
      const code = `
変数 = 100
果物 = "りんご"
合計 = 変数 + 50
print(果物, 合計)
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);
      const lastSnap = result.snapshots[result.snapshots.length - 1];
      expect(lastSnap.globals['変数']).toBe(100);
      expect(lastSnap.globals['果物']).toBe('りんご');
      expect(lastSnap.globals['合計']).toBe(150);
      expect(result.stdout).toBe('りんご 150\n');
    });

    it('2.2. 絵文字等の非識別子文字を含む場合の SyntaxError 捕捉', () => {
      const code = `🍎 = "りんご"`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(false);
      expect(result.error).toContain('SyntaxError');
    });
  });

  describe('3. 構文エラー・空コード・コメントコード等の限界テスト', () => {
    it('3.1. 空文字列のコード実行で例外が発生せず終了すること', () => {
      const code = ``;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.snapshots)).toBe(true);
    });

    it('3.2. コメントのみのコード実行で例外が発生せず終了すること', () => {
      const code = `# This is a comment\n# Another comment`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.snapshots)).toBe(true);
    });

    it('3.3. SyntaxError を含むコード実行', () => {
      const code = `x = (`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(false);
      expect(result.error).toContain('SyntaxError');
    });

    it('3.4. IndentationError を含むコード実行', () => {
      const code = `def foo():\npass`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(false);
      expect(result.error).toContain('IndentationError');
    });
  });

  describe('4. 巨大数値・データ型境界値のテスト', () => {
    it('4.1. 超巨大整数 (Arbitrary Precision Integer) の処理', () => {
      const code = `big_int = 10 ** 100`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);
      const lastSnap = result.snapshots[result.snapshots.length - 1];
      expect(lastSnap.globals['big_int']).toBe(1e+100);
    });

    it('4.2. 特殊な float 値 (NaN, Inf, -Inf) の表現変換', () => {
      const code = `
nan_val = float('nan')
inf_val = float('inf')
ninf_val = float('-inf')
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(true);
      const lastSnap = result.snapshots[result.snapshots.length - 1];
      expect(lastSnap.globals['nan_val']).toBe('NaN');
      expect(lastSnap.globals['inf_val']).toBe('Infinity');
      expect(lastSnap.globals['ninf_val']).toBe('-Infinity');
    });
  });

  describe('5. 実行時例外 (Runtime Exceptions) 発生時のスナップショット保存テスト', () => {
    it('5.1. ZeroDivisionError 発生時の前ステップ保存とエラー返却', () => {
      const code = `
a = 10
b = 0
c = a / b
d = 100
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 10000);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ZeroDivisionError');
      expect(result.snapshots.length).toBeGreaterThanOrEqual(2);
      const lastSnap = result.snapshots[result.snapshots.length - 1];
      expect(lastSnap.globals.a).toBe(10);
      expect(lastSnap.globals.b).toBe(0);
    });

    it('5.2. RecursionError 発生時の安全な停止とエラー返却', () => {
      const code = `
def foo(n):
    return foo(n + 1)
foo(1)
`;
      const runTracePy = pyodide.globals.get('run_trace');
      const resultJson = runTracePy(code, 200);
      const result = JSON.parse(resultJson);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
