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
  {
    id: 'zensho-2-73-4-1-2-vba',
    name: '2級 第73回【4】(1)(2)',
    language: 'vba',
    description: '全商情報処理検定 2級 第73回【4】(1)(2) マクロ言語トレース演習',
    code: `Sub Program()
    Dim a As Long
    Dim b As Long
    Dim e As Long
    Dim f As Long
    Dim g As Long
    Dim h As Long
    Dim j As Long
    a = 3
    b = 1
    e = a + b
    If a > b Then
        e = e + 1
        f = a + b
    Else
        f = a - b
    End If
    e = e * e
    f = f * f
    g = e - f
    h = 1
    j = 1
    Do While g > j
        h = h + 1
        j = h * h '(ア)
    Loop
    MsgBox (h) '(イ)
End Sub`,
  },
  {
    id: 'zensho-2-72-4-1-2-vba',
    name: '2級 第72回【4】(1)(2)',
    language: 'vba',
    description: '全商情報処理検定 2級 第72回【4】(1)(2) マクロ言語トレース演習',
    code: `Sub Program()
    Dim a As Long
    Dim b As Long
    Dim c As Long
    Dim e As Long
    Dim f As Long
    Dim g As Long
    Dim h As Long
    Dim i As Long
    a = 2
    b = 36
    c = 0
    e = 5
    f = a * a
    g = f * 2
    Do While b > 0
        c = c + a
        f = c * c
        h = f * 10 '(ア)
        i = h / g
        b = b - i
        MsgBox (c & "," & b) '(イ)
        If c >= e Then
            e = e + 5 '(ウ)
        End If
    Loop
End Sub`,
  },
  {
    id: 'zensho-2-71-4-1-2-vba',
    name: '2級 第71回【4】(1)(2)',
    language: 'vba',
    description: '全商情報処理検定 2級 第71回【4】(1)(2) マクロ言語トレース演習',
    code: `Sub Program()
    Dim a As Long
    Dim b As Long
    Dim c As Long
    Dim e As Long
    Dim f As Long
    Dim g As Long
    a = 6
    b = 3
    c = b
    Do While a > 1
        e = Int(c / 2) '(ア)
        f = e * 2
        If c = f Then
            MsgBox (c) '(イ)
        End If
        g = b + c
        b = c
        c = g
        a = a - 1
    Loop
End Sub`,
  },
  {
    id: 'zensho-2-70-4-1-2-vba',
    name: '2級 第70回【4】(1)(2)',
    language: 'vba',
    description: '全商情報処理検定 2級 第70回【4】(1)(2) マクロ言語トレース演習',
    code: `Sub Program()
    Dim x As Long
    Dim y As Long
    Dim a As Long
    Dim b As Long
    Dim c As Long
    Dim e As Long
    Dim f As Long
    Dim g As Long
    Dim h As Long
    x = 5
    y = 40
    a = 0
    b = 0
    c = 0
    Do While a < 10
        a = a + 1
        If a > b Then
            b = b + 2
            c = c + x '(ア)
        End If
    Loop
    e = 0
    f = 0
    g = 0
    Do While e < x
        e = e + 1
        f = f + c
        g = g + y
    Loop
    h = f + g
    MsgBox (h) '(イ)
End Sub`,
  },
];

/**
 * 初期選択されるデフォルトサンプルプログラム
 */
export const DEFAULT_SAMPLE: SampleProgram = SAMPLE_PROGRAMS[0]!;
