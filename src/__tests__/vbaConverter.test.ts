import { describe, it, expect } from 'vitest';
import { pythonToVba, vbaToPython } from '../services/vbaConverter';

describe('vbaConverter - pythonToVba', () => {
  it('converts basic variable assignment and arithmetic operations', () => {
    const py = 'a = 10\nb = 20\nc = a + b * 2\nd = a % 3\ne = a ** 2';
    const result = pythonToVba(py);
    expect(result.code).toContain('a = 10');
    expect(result.code).toContain('b = 20');
    expect(result.code).toContain('c = a + b * 2');
    expect(result.code).toContain('d = a Mod 3');
    expect(result.code).toContain('e = a ^ 2');
    expect(result.lineMap[1]).toBe(1);
    expect(result.lineMap[2]).toBe(2);
  });

  it('converts print to MsgBox', () => {
    const py = 'print("Hello, world!")\nprint(123)';
    const result = pythonToVba(py);
    expect(result.code).toContain('MsgBox "Hello, world!"');
    expect(result.code).toContain('MsgBox 123');
  });

  it('converts if / elif / else conditionals with correct End If', () => {
    const py = `if x > 10:
    print("big")
elif x == 10:
    print("equal")
else:
    print("small")`;
    const result = pythonToVba(py);
    expect(result.code).toContain('If x > 10 Then');
    expect(result.code).toContain('ElseIf x = 10 Then');
    expect(result.code).toContain('Else');
    expect(result.code).toContain('End If');
  });

  it('converts while loops with correct Loop', () => {
    const py = `i = 0
while i < 5:
    print(i)
    i += 1`;
    const result = pythonToVba(py);
    expect(result.code).toContain('Do While i < 5');
    expect(result.code).toContain('i = i + 1');
    expect(result.code).toContain('Loop');
  });

  it('converts for range loops with correct Next', () => {
    const py = `for i in range(5):
    print(i)`;
    const result = pythonToVba(py);
    expect(result.code).toContain('For i = 0 To 5 - 1');
    expect(result.code).toContain('Next i');
  });

  it('converts functions with return (Function) and without return (Sub)', () => {
    const py = `def add(a, b):
    return a + b

def greet(name):
    print("Hello " + name)`;
    const result = pythonToVba(py);
    expect(result.code).toContain('Function add(a, b)');
    expect(result.code).toContain('add = a + b');
    expect(result.code).toContain('End Function');
    expect(result.code).toContain('Sub greet(name)');
    expect(result.code).toContain('End Sub');
  });
});

describe('vbaConverter - vbaToPython', () => {
  it('converts basic assignments and operators', () => {
    const vba = `a = 10
b = 20
c = a + b * 2
d = a Mod 3
e = a ^ 2`;
    const result = vbaToPython(vba);
    expect(result.code).toContain('a = 10');
    expect(result.code).toContain('b = 20');
    expect(result.code).toContain('c = a + b * 2');
    expect(result.code).toContain('d = a % 3');
    expect(result.code).toContain('e = a ** 2');
  });

  it('converts MsgBox and Debug.Print to print', () => {
    const vba = `MsgBox "Hello, world!"
Debug.Print 123`;
    const result = vbaToPython(vba);
    expect(result.code).toContain('print("Hello, world!")');
    expect(result.code).toContain('print(123)');
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
    MsgBox i
Next i

Do While i < 10
    i = i + 1
Loop`;
    const result = vbaToPython(vba);
    expect(result.code).toContain('for i in range(4 + 1):');
    expect(result.code).toContain('while i < 10:');
  });

  it('converts Function and Sub to def with proper return and indentation', () => {
    const vba = `Function add(a, b)
    add = a + b
End Function

Sub greet(name)
    MsgBox "Hello " & name
End Sub`;
    const result = vbaToPython(vba);
    expect(result.code).toContain('def add(a, b):');
    expect(result.code).toContain('    return a + b');
    expect(result.code).toContain('def greet(name):');
    expect(result.code).toContain('    print("Hello " + name)');
  });
});
