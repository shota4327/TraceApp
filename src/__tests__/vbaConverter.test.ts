import { describe, it, expect } from 'vitest';
import { pythonToVba, vbaToPython } from '../services/vbaConverter';

describe('vbaConverter - pythonToVba', () => {
  it('wraps code in Sub Program() ... End Sub with Dim declarations and blank line', () => {
    const py = 'a = 10\nb = 20\nc = a + b * 2\nd = a % 3\ne = a ** 2';
    const result = pythonToVba(py);
    
    expect(result.code).toContain('Sub Program()');
    expect(result.code).toContain('    Dim a As Integer');
    expect(result.code).toContain('    Dim b As Integer');
    expect(result.code).toContain('    Dim c As Integer');
    expect(result.code).toContain('    Dim d As Integer');
    expect(result.code).toContain('    Dim e As Integer');
    expect(result.code).toContain('    a = 10');
    expect(result.code).toContain('    b = 20');
    expect(result.code).toContain('    c = a + b * 2');
    expect(result.code).toContain('    d = a Mod 3');
    expect(result.code).toContain('    e = a ^ 2');
    expect(result.code).toContain('End Sub');

    // Dim宣言の後に空白行が存在することを確認
    const lines = result.code.split('\n');
    const lastDimIdx = lines.findIndex((l) => l.includes('Dim e As Integer'));
    expect(lines[lastDimIdx + 1]).toBe('');
  });

  it('infers variable types properly (Integer, Double, String, Array)', () => {
    const py = `x = 10
msg = "hello"
pi = 3.14
arr = [0] * 5
dyn = []`;
    const result = pythonToVba(py);
    expect(result.code).toContain('Dim x As Integer');
    expect(result.code).toContain('Dim msg As String');
    expect(result.code).toContain('Dim pi As Double');
    expect(result.code).toContain('Dim arr(4) As Integer');
    expect(result.code).toContain('Dim dyn() As Integer');
  });

  it('converts print to MsgBox with space before parentheses MsgBox (...)', () => {
    const py = 'print("Hello, world!")\nprint(123)';
    const result = pythonToVba(py);
    expect(result.code).toContain('MsgBox ("Hello, world!")');
    expect(result.code).toContain('MsgBox (123)');
  });

  it('converts inline and standalone comments preserving spacing after hash (#)', () => {
    const py = `x = 10  # 初期値設定
y = 20  #空白なしコメント
# 単独のスペースあり
#単独のスペースなし
print(x) # 出力`;
    const result = pythonToVba(py);
    expect(result.code).toContain("x = 10 ' 初期値設定");
    expect(result.code).toContain("y = 20 '空白なしコメント");
    expect(result.code).toContain("' 単独のスペースあり");
    expect(result.code).toContain("'単独のスペースなし");
    expect(result.code).toContain("MsgBox (x) ' 出力");
  });

  it('converts if / elif / else conditionals with correct End If and indentation', () => {
    const py = `if x > 10:
    print("big")
elif x == 10:
    print("equal")
else:
    print("small")`;
    const result = pythonToVba(py);
    expect(result.code).toContain('    If x > 10 Then');
    expect(result.code).toContain('        MsgBox ("big")');
    expect(result.code).toContain('    ElseIf x = 10 Then');
    expect(result.code).toContain('        MsgBox ("equal")');
    expect(result.code).toContain('    Else');
    expect(result.code).toContain('        MsgBox ("small")');
    expect(result.code).toContain('    End If');
  });

  it('converts while loops to Do While ... Loop with proper indentation', () => {
    const py = `i = 0
while i < 5:
    print(i)
    i += 1`;
    const result = pythonToVba(py);
    expect(result.code).toContain('    Do While i < 5');
    expect(result.code).toContain('    Loop');
  });

  it('converts for range loops with correct Next and loop variable Dim', () => {
    const py = `for i in range(5):
    print(i)`;
    const result = pythonToVba(py);
    expect(result.code).toContain('    Dim i As Integer');
    expect(result.code).toContain('    For i = 0 To 5 - 1');
    expect(result.code).toContain('        MsgBox (i)');
    expect(result.code).toContain('    Next i');
  });

  it('places def functions outside of Sub Program() properly (Sample 3 test)', () => {
    const py = `def add(a, b):
    result = a + b
    return result

total = 0
for i in range(1, 4):
    total = add(total, i)
print(total)`;
    const result = pythonToVba(py);

    // Function add が Sub Program() の外側（手前）に配置されていること
    expect(result.code).toMatch(/^Function add\(a As Integer, b As Integer\) As Integer[\s\S]*End Function\s*\n\s*Sub Program\(\)/);
    
    // Function add 内の引数型、戻り値型、ローカル変数 result の Dim 宣言
    expect(result.code).toContain('Function add(a As Integer, b As Integer) As Integer');
    expect(result.code).toContain('    Dim result As Integer');
    expect(result.code).toContain('    result = a + b');
    expect(result.code).toContain('    add = result');
    expect(result.code).not.toContain('Exit Function');
    expect(result.code).toContain('End Function');

    // Sub Program() 側の変数と処理
    expect(result.code).toContain('Sub Program()');
    expect(result.code).toContain('    Dim total As Integer');
    expect(result.code).toContain('    Dim i As Integer');
    expect(result.code).toContain('    total = 0');
    expect(result.code).toContain('    For i = 1 To 4 - 1');
    expect(result.code).toContain('        total = add(total, i)');
    expect(result.code).toContain('    Next i');
    expect(result.code).toContain('    MsgBox (total)');
    expect(result.code).toContain('End Sub');
  });

  it('converts function without return to Sub with param types', () => {
    const py = `def greet(name: str):
    print("Hello " + name)`;
    const result = pythonToVba(py);
    expect(result.code).toContain('Sub greet(name As String)');
    expect(result.code).toContain('    MsgBox ("Hello " + name)');
    expect(result.code).toContain('End Sub');
    expect(result.code).not.toContain('Sub Program');
  });
});

describe('vbaConverter - vbaToPython', () => {
  it('converts Sub Program() and strips Dim declarations cleanly', () => {
    const vba = `Sub Program()
    Dim a As Integer
    Dim b As Integer

    a = 10
    b = 20
    MsgBox (a + b)
End Sub`;
    const result = vbaToPython(vba);
    expect(result.code).not.toContain('Sub Program');
    expect(result.code).not.toContain('End Sub');
    expect(result.code).not.toContain('Dim a');
    expect(result.code).toContain('a = 10');
    expect(result.code).toContain('b = 20');
    expect(result.code).toContain('print(a + b)');
  });

  it('converts MsgBox with space and parentheses to print', () => {
    const vba = `MsgBox ("Hello, world!")
MsgBox(123)
MsgBox 456
Debug.Print (789)`;
    const result = vbaToPython(vba);
    expect(result.code).toContain('print("Hello, world!")');
    expect(result.code).toContain('print(123)');
    expect(result.code).toContain('print(456)');
    expect(result.code).toContain('print(789)');
  });

  it('converts inline comments back to python comments (#) preserving spacing', () => {
    const vba = `a = 10 ' 初期値
b = 20 '空白なし
' 単独コメント
'単独空白なし
MsgBox (a) ' 表示`;
    const result = vbaToPython(vba);
    expect(result.code).toContain('a = 10 # 初期値');
    expect(result.code).toContain('b = 20 #空白なし');
    expect(result.code).toContain('# 単独コメント');
    expect(result.code).toContain('#単独空白なし');
    expect(result.code).toContain('print(a) # 表示');
  });

  it('converts If / ElseIf / Else / End If to Python if / elif / else with proper indentation', () => {
    const vba = `If x > 10 Then
    MsgBox "big"
ElseIf x = 10 Then
    MsgBox "equal"
Else
    MsgBox "small"
End If`;
    const result = vbaToPython(vba);
    expect(result.code).toContain('if x > 10:');
    expect(result.code).toContain('    print("big")');
    expect(result.code).toContain('elif x == 10:');
    expect(result.code).toContain('    print("equal")');
    expect(result.code).toContain('else:');
    expect(result.code).toContain('    print("small")');
  });

  it('converts For loops and Do While loops', () => {
    const vba = `For i = 0 To 4
    MsgBox (i)
Next i

Do While i < 10
    i = i + 1
Loop`;
    const result = vbaToPython(vba);
    expect(result.code).toContain('for i in range(4 + 1):');
    expect(result.code).toContain('while i < 10:');
  });

  it('converts Function and Sub to def with proper return and indentation', () => {
    const vba = `Function add(a As Integer, b As Integer) As Integer
    Dim result As Integer
    result = a + b
    add = result
End Function

Sub Program()
    Dim total As Integer
    Dim i As Integer

    total = 0
    For i = 1 To 4 - 1
        total = add(total, i)
    Next i
    MsgBox (total)
End Sub`;
    const result = vbaToPython(vba);
    expect(result.code).toContain('def add(a, b):');
    expect(result.code).toContain('    result = a + b');
    expect(result.code).toContain('    return result');
    expect(result.code).toContain('total = 0');
    expect(result.code).toContain('for i in range(1, 4):');
    expect(result.code).toContain('    total = add(total, i)');
    expect(result.code).toContain('print(total)');
    expect(result.code).not.toContain('Sub Program');
    expect(result.code).not.toContain('Dim total');
  });
});
