export interface SampleProgram {
  id: string;
  name: string;
  description: string;
  code: string;
  language?: 'python' | 'vba';
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
  {
    id: 'zensho-2-73-4-1-2',
    name: '２級 第73回【４】(１)(２)',
    description: '全商情報処理検定 ２級 第73回【４】(１)(２) トレース演習',
    code: `a = 3
b = 1
e = a + b
if a > b:
    e = e + 1
    f = a + b
else:
    f = a - b
e = e * e
f = f * f
g = e - f
h = 1
j = 1
while g > j:
    h = h + 1
    j = h * h #(ア)
print(h) #(イ)`,
  },
  {
    id: 'zensho-2-73-4-3-4',
    name: '２級 第73回【４】(３)(４)',
    description: '全商情報処理検定 ２級 第73回【４】(３)(４) トレース演習',
    code: `a = 4
b = 9
e = a + b
if a > b:
    e = e + 1
    f = a + b
else:
    f = a - b
e = e * e
f = f * f
g = e - f
h = 1
j = 1
while g > j:
    h = h + 1
    j = h * h #(ア)
print(h) #(イ)`,
  },
  {
    id: 'zensho-2-74-4-1-2',
    name: '２級 第74回【４】(１)(２)',
    description: '全商情報処理検定 ２級 第74回【４】(１)(２) トレース演習',
    code: `a = 4
b = a
c = 1
while b >= c:
    b = b - c
    c = c + 2
e = a
f = 2
while e >= f:
    e = e - f
    f = f + 2
g = b - e
h = g * g
print(h)`,
  },
  {
    id: 'zensho-2-74-4-3-4',
    name: '２級 第74回【４】(３)(４)',
    description: '全商情報処理検定 ２級 第74回【４】(３)(４) トレース演習',
    code: `a = 32
b = a
c = 1
while b >= c:
    b = b - c
    c = c + 2
e = a
f = 2
while e >= f:
    e = e - f
    f = f + 2
g = b - e
h = g * g
print(h)`,
  },
  {
    id: 'zensho-2-74-4-1-2-vba',
    name: '2級 第74回【4】(1)(2)',
    language: 'vba',
    description: '全商情報処理検定 2級 第74回【4】(1)(2) マクロ言語トレース演習',
    code: `Sub Program()
    Dim a As Long
    Dim b As Long
    Dim c As Long
    Dim e As Long
    Dim f As Long
    Dim g As Long
    Dim h As Long
    a = 4
    b = a
    c = 1
    Do While b >= c
        b = b - c '(ア)
        c = c + 2
    Loop
    e = a
    f = 2
    Do While e >= f
        e = e - f
        f = f + 2
    Loop
    g = b - e
    h = g * g
    MsgBox (h) '(イ)
End Sub`,
  },
];

/**
 * 初期選択されるデフォルトサンプルプログラム
 */
export const DEFAULT_SAMPLE: SampleProgram = SAMPLE_PROGRAMS[0]!;
