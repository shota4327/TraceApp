/**
 * サンプルプログラム定義インターフェース
 */
export interface SampleProgram {
  id: string;
  name: string;
  description: string;
  code: string;
}

/**
 * トレース検証用のプリセットサンプルプログラム 4 種
 */
export const SAMPLE_PROGRAMS: SampleProgram[] = [
  {
    id: 'seq',
    name: '1. 基本的な順次・代入',
    description: '変数の代入と四則演算、計算結果の出力',
    code: `x = 5
y = 3
total = x + y
print(total)`,
  },
  {
    id: 'branch',
    name: '2. 条件分岐',
    description: 'if / elif / else による数値評価と条件分岐',
    code: `score = 75
if score >= 80:
    grade = "A"
elif score >= 60:
    grade = "B"
else:
    grade = "C"
print(grade)`,
  },
  {
    id: 'loop',
    name: '3. ループと関数',
    description: '関数定義・呼び出しと for ループによる累積処理',
    code: `def add(a, b):
    result = a + b
    return result

total = 0
for i in range(1, 4):
    total = add(total, i)
print(total)`,
  },
  {
    id: 'print',
    name: '4. print 出力テスト',
    description: '段階的な print 出力テスト',
    code: `print("Hello TraceApp!")
print("Pyodide stdout capture test")`,
  },
];

/**
 * 初期選択されるデフォルトサンプルプログラム
 */
export const DEFAULT_SAMPLE: SampleProgram = SAMPLE_PROGRAMS[0]!;
