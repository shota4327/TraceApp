import { ConversionResult, VbaConverterOptions } from '../types/vba';

/**
 * 文字列リテラルを保護しながら演算子やキーワードを置換するヘルパー
 */
function replaceOutsideStrings(
  line: string,
  replacer: (text: string) => string
): string {
  const parts: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i] ?? '';
    const prevChar = i > 0 ? (line[i - 1] ?? '') : '';

    if (char === '"' && !inSingleQuote && prevChar !== '\\') {
      if (inDoubleQuote) {
        current += char;
        parts.push(current);
        current = '';
        inDoubleQuote = false;
      } else {
        if (current) {
          parts.push(replacer(current));
          current = '';
        }
        current = char;
        inDoubleQuote = true;
      }
    } else if (char === "'" && !inDoubleQuote && prevChar !== '\\') {
      if (inSingleQuote) {
        current += char;
        parts.push(current);
        current = '';
        inSingleQuote = false;
      } else {
        if (current) {
          parts.push(replacer(current));
          current = '';
        }
        current = char;
        inSingleQuote = true;
      }
    } else {
      current += char;
    }
  }

  if (current) {
    if (inSingleQuote || inDoubleQuote) {
      parts.push(current);
    } else {
      parts.push(replacer(current));
    }
  }

  return parts.join('');
}

/**
 * Python式をVBA式に変換
 */
function convertPythonExprToVba(expr: string): string {
  return replaceOutsideStrings(expr, (text) => {
    let res = text;
    // 論理演算子・ブール値
    res = res.replace(/\bTrue\b/g, 'True');
    res = res.replace(/\bFalse\b/g, 'False');
    res = res.replace(/\bNone\b/g, 'Null');
    res = res.replace(/\band\b/g, 'And');
    res = res.replace(/\bor\b/g, 'Or');
    res = res.replace(/\bnot\b/g, 'Not');

    // 比較・算術演算子
    res = res.replace(/==/g, '=');
    res = res.replace(/!=/g, '<>');
    res = res.replace(/\/\//g, '\\');
    res = res.replace(/\*\*/g, '^');
    res = res.replace(/\s*%\s*/g, ' Mod ');

    return res;
  });
}

/**
 * VBA式をPython式に変換
 */
function convertVbaExprToPython(expr: string): string {
  return replaceOutsideStrings(expr, (text) => {
    let res = text;
    // 比較演算子・ブール値
    res = res.replace(/\bTrue\b/gi, 'True');
    res = res.replace(/\bFalse\b/gi, 'False');
    res = res.replace(/\bNull\b/gi, 'None');
    res = res.replace(/\bNothing\b/gi, 'None');
    res = res.replace(/\bAnd\b/gi, 'and');
    res = res.replace(/\bOr\b/gi, 'or');
    res = res.replace(/\bNot\b/gi, 'not');

    res = res.replace(/<>/g, '!=');
    res = res.replace(/\bMod\b/gi, '%');
    res = res.replace(/\^/g, '**');
    res = res.replace(/\\/g, '//');
    res = res.replace(/&/g, '+');

    // 単一イコール（比較文脈のイコール）
    res = res.replace(/(?<=[^=<>!+*/%^&|~]|^)\s*=\s*(?=[^=])/g, ' == ');

    return res;
  });
}

interface BlockContext {
  type: 'def' | 'if' | 'for' | 'while';
  indent: number;
  funcName?: string;
  isFunction?: boolean;
  loopVar?: string;
}

/**
 * PythonコードをVBAコードに変換
 */
export function pythonToVba(
  pythonCode: string,
  _options?: VbaConverterOptions
): ConversionResult {
  const lines = pythonCode.split('\n');
  const vbaLines: string[] = [];
  const lineMap: Record<number, number> = {};
  const warnings: string[] = [];

  const blockStack: BlockContext[] = [];

  // まず関数が戻り値を持つか（Function vs Sub）を事前走査
  const funcHasReturnMap = new Map<string, boolean>();
  let currentScanFunc: string | null = null;
  let scanIndent = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const indent = rawLine.search(/\S/);
    if (indent === -1 || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('def ')) {
      const match = trimmed.match(/^def\s+([a-zA-Z_]\w*)\s*\(/);
      if (match && match[1]) {
        currentScanFunc = match[1];
        scanIndent = indent;
        funcHasReturnMap.set(currentScanFunc, false);
      }
    } else if (currentScanFunc && indent <= scanIndent) {
      currentScanFunc = null;
    } else if (currentScanFunc && trimmed.startsWith('return ') && trimmed !== 'return') {
      funcHasReturnMap.set(currentScanFunc, true);
    }
  }

  const closeBlocksUpTo = (targetIndent: number) => {
    while (blockStack.length > 0) {
      const top = blockStack[blockStack.length - 1];
      if (top && top.indent >= targetIndent) {
        blockStack.pop();
        const indentStr = ' '.repeat(top.indent);
        if (top.type === 'def') {
          vbaLines.push(`${indentStr}End ${top.isFunction ? 'Function' : 'Sub'}`);
        } else if (top.type === 'if') {
          vbaLines.push(`${indentStr}End If`);
        } else if (top.type === 'for') {
          vbaLines.push(`${indentStr}Next ${top.loopVar || ''}`.trimEnd());
        } else if (top.type === 'while') {
          vbaLines.push(`${indentStr}Loop`);
        }
      } else {
        break;
      }
    }
  };

  for (let pyIdx = 0; pyIdx < lines.length; pyIdx++) {
    const pyLineNum = pyIdx + 1;
    const rawLine = lines[pyIdx] ?? '';
    const indent = rawLine.search(/\S/);

    if (indent === -1) {
      // 空行
      vbaLines.push('');
      lineMap[pyLineNum] = vbaLines.length;
      continue;
    }

    const trimmed = rawLine.trim();
    const indentStr = ' '.repeat(indent);

    // コメント行
    if (trimmed.startsWith('#')) {
      closeBlocksUpTo(indent);
      const commentContent = trimmed.slice(1).trimStart();
      vbaLines.push(`${indentStr}' ${commentContent}`.trimEnd());
      lineMap[pyLineNum] = vbaLines.length;
      continue;
    }

    // インデントの戻りに応じたブロック終了処理 (elif / else の場合は後続でハンドリング)
    if (!trimmed.startsWith('elif ') && !trimmed.startsWith('else:')) {
      closeBlocksUpTo(indent);
    }

    // 1. 関数定義: def func(a, b):
    const defMatch = trimmed.match(/^def\s+([a-zA-Z_]\w*)\s*\((.*?)\)\s*:/);
    if (defMatch && defMatch[1]) {
      const funcName = defMatch[1];
      const params = (defMatch[2] ?? '').trim();
      const hasReturn = funcHasReturnMap.get(funcName) ?? false;
      const decl = hasReturn ? `Function ${funcName}(${params})` : `Sub ${funcName}(${params})`;
      vbaLines.push(`${indentStr}${decl}`);
      blockStack.push({ type: 'def', indent, funcName, isFunction: hasReturn });
      lineMap[pyLineNum] = vbaLines.length;
      continue;
    }

    // 2. return 文
    if (trimmed.startsWith('return')) {
      const returnExpr = trimmed.replace(/^return\s*/, '').trim();
      const currentFunc = [...blockStack].reverse().find((b) => b.type === 'def');
      if (currentFunc && currentFunc.isFunction && currentFunc.funcName) {
        if (returnExpr) {
          const vbaExpr = convertPythonExprToVba(returnExpr);
          vbaLines.push(`${indentStr}${currentFunc.funcName} = ${vbaExpr}`);
        }
        vbaLines.push(`${indentStr}Exit Function`);
      } else if (currentFunc && !currentFunc.isFunction) {
        vbaLines.push(`${indentStr}Exit Sub`);
      } else {
        if (returnExpr) {
          vbaLines.push(`${indentStr}' return ${convertPythonExprToVba(returnExpr)}`);
        }
      }
      lineMap[pyLineNum] = vbaLines.length;
      continue;
    }

    // 3. if / elif / else 分岐
    const ifMatch = trimmed.match(/^if\s+(.*?)\s*:/);
    if (ifMatch && ifMatch[1]) {
      const cond = convertPythonExprToVba(ifMatch[1].trim());
      vbaLines.push(`${indentStr}If ${cond} Then`);
      blockStack.push({ type: 'if', indent });
      lineMap[pyLineNum] = vbaLines.length;
      continue;
    }

    const elifMatch = trimmed.match(/^elif\s+(.*?)\s*:/);
    if (elifMatch && elifMatch[1]) {
      const cond = convertPythonExprToVba(elifMatch[1].trim());
      vbaLines.push(`${indentStr}ElseIf ${cond} Then`);
      lineMap[pyLineNum] = vbaLines.length;
      continue;
    }

    if (trimmed === 'else:') {
      vbaLines.push(`${indentStr}Else`);
      lineMap[pyLineNum] = vbaLines.length;
      continue;
    }

    // 4. for ループ: for var in range(...)
    const forRangeMatch = trimmed.match(/^for\s+([a-zA-Z_]\w*)\s+in\s+range\((.*?)\)\s*:/);
    if (forRangeMatch && forRangeMatch[1] && forRangeMatch[2]) {
      const loopVar = forRangeMatch[1];
      const args = forRangeMatch[2].split(',').map((s) => s.trim());
      let forClause = '';

      if (args.length === 1 && args[0]) {
        const n = convertPythonExprToVba(args[0]);
        forClause = `For ${loopVar} = 0 To ${n} - 1`;
      } else if (args.length === 2 && args[0] && args[1]) {
        const start = convertPythonExprToVba(args[0]);
        const stop = convertPythonExprToVba(args[1]);
        forClause = `For ${loopVar} = ${start} To ${stop} - 1`;
      } else if (args.length >= 3 && args[0] && args[1] && args[2]) {
        const start = convertPythonExprToVba(args[0]);
        const stop = convertPythonExprToVba(args[1]);
        const step = convertPythonExprToVba(args[2]);
        forClause = `For ${loopVar} = ${start} To ${stop} - 1 Step ${step}`;
      }

      vbaLines.push(`${indentStr}${forClause}`);
      blockStack.push({ type: 'for', indent, loopVar });
      lineMap[pyLineNum] = vbaLines.length;
      continue;
    }

    // 5. while ループ: while cond:
    const whileMatch = trimmed.match(/^while\s+(.*?)\s*:/);
    if (whileMatch && whileMatch[1]) {
      const cond = convertPythonExprToVba(whileMatch[1].trim());
      vbaLines.push(`${indentStr}Do While ${cond}`);
      blockStack.push({ type: 'while', indent });
      lineMap[pyLineNum] = vbaLines.length;
      continue;
    }

    // 6. 出力処理: print(...) -> MsgBox ...
    const printMatch = trimmed.match(/^print\((.*)\)$/);
    if (printMatch && printMatch[1] !== undefined) {
      const content = printMatch[1].trim();
      const vbaContent = convertPythonExprToVba(content);
      vbaLines.push(`${indentStr}MsgBox ${vbaContent}`);
      lineMap[pyLineNum] = vbaLines.length;
      continue;
    }

    // 7. 代入文・一般文
    const assignMatch = trimmed.match(/^([a-zA-Z_]\w*(?:\[.*?\])?)\s*([+\-*/%]=|=)\s*(.*)$/);
    if (assignMatch && assignMatch[1] && assignMatch[2] && assignMatch[3] !== undefined) {
      const target = assignMatch[1];
      const op = assignMatch[2];
      const right = assignMatch[3];

      let vbaAssign = '';
      if (op === '=') {
        vbaAssign = `${target} = ${convertPythonExprToVba(right)}`;
      } else {
        const pureOp = op.slice(0, -1);
        vbaAssign = `${target} = ${target} ${convertPythonExprToVba(pureOp)} ${convertPythonExprToVba(right)}`;
      }
      vbaLines.push(`${indentStr}${vbaAssign}`);
      lineMap[pyLineNum] = vbaLines.length;
      continue;
    }

    // その他汎用式・関数呼び出し
    const generalVba = convertPythonExprToVba(trimmed);
    vbaLines.push(`${indentStr}${generalVba}`);
    lineMap[pyLineNum] = vbaLines.length;
  }

  // 残存ブロックのクローズ
  closeBlocksUpTo(0);

  return {
    code: vbaLines.join('\n'),
    lineMap,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * VBAコードをPythonコードに変換
 */
export function vbaToPython(
  vbaCode: string,
  _options?: VbaConverterOptions
): ConversionResult {
  const lines = vbaCode.split('\n');
  const pyLines: string[] = [];
  const lineMap: Record<number, number> = {};
  const warnings: string[] = [];

  let indentLevel = 0;
  let currentFunc: string | null = null;

  for (let vbaIdx = 0; vbaIdx < lines.length; vbaIdx++) {
    const vbaLineNum = vbaIdx + 1;
    const rawLine = lines[vbaIdx] ?? '';
    const trimmed = rawLine.trim();

    if (!trimmed) {
      pyLines.push('');
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    const indentStr = '    '.repeat(indentLevel);

    // コメント: ' ... または Rem ...
    if (trimmed.startsWith("'") || /^Rem\b/i.test(trimmed)) {
      const commentText = trimmed.replace(/^('|Rem\b\s*)/i, '').trimStart();
      pyLines.push(`${indentStr}# ${commentText}`.trimEnd());
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 1. 変数宣言 Dim / ReDim (Pythonでは型宣言不要のためコメント化)
    if (/^(Dim|ReDim|Const)\b/i.test(trimmed)) {
      pyLines.push(`${indentStr}# ${trimmed}`);
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 2. ブロック終了: End Sub / End Function / End If / Next / Loop / Wend
    if (/^End\s+(Sub|Function)\b/i.test(trimmed)) {
      if (indentLevel > 0) indentLevel--;
      currentFunc = null;
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }
    if (/^End\s+If\b/i.test(trimmed)) {
      if (indentLevel > 0) indentLevel--;
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }
    if (/^Next(\s+[a-zA-Z_]\w*)?/i.test(trimmed)) {
      if (indentLevel > 0) indentLevel--;
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }
    if (/^(Loop|Wend)\b/i.test(trimmed)) {
      if (indentLevel > 0) indentLevel--;
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 3. 関数定義: Sub / Function
    const funcMatch = trimmed.match(/^(?:Public\s+|Private\s+)?(Sub|Function)\s+([a-zA-Z_]\w*)\s*\((.*?)\)/i);
    if (funcMatch && funcMatch[2] && funcMatch[3] !== undefined) {
      const name = funcMatch[2];
      const params = funcMatch[3]
        .split(',')
        .map((p) => p.trim().replace(/^ByVal\s+|^ByRef\s+/i, '').split(/\s+As\s+/i)[0]?.trim() ?? '')
        .filter(Boolean)
        .join(', ');

      pyLines.push(`${'    '.repeat(indentLevel)}def ${name}(${params}):`);
      currentFunc = name;
      indentLevel++;
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 4. If / ElseIf / Else
    const ifMatch = trimmed.match(/^If\s+(.*?)\s+Then$/i);
    if (ifMatch && ifMatch[1]) {
      const cond = convertVbaExprToPython(ifMatch[1].trim());
      pyLines.push(`${indentStr}if ${cond}:`);
      indentLevel++;
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    const elseIfMatch = trimmed.match(/^ElseIf\s+(.*?)\s+Then$/i);
    if (elseIfMatch && elseIfMatch[1]) {
      const prevIndent = Math.max(0, indentLevel - 1);
      const cond = convertVbaExprToPython(elseIfMatch[1].trim());
      pyLines.push(`${'    '.repeat(prevIndent)}elif ${cond}:`);
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    if (/^Else$/i.test(trimmed)) {
      const prevIndent = Math.max(0, indentLevel - 1);
      pyLines.push(`${'    '.repeat(prevIndent)}else:`);
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 5. For ループ: For i = start To stop [Step step]
    const forMatch = trimmed.match(/^For\s+([a-zA-Z_]\w*)\s*=\s*(.*?)\s+To\s+(.*?)(?:\s+Step\s+(.*?))?$/i);
    if (forMatch && forMatch[1] && forMatch[2] && forMatch[3]) {
      const loopVar = forMatch[1];
      const start = convertVbaExprToPython(forMatch[2].trim());
      const stop = convertVbaExprToPython(forMatch[3].trim());
      const step = forMatch[4] ? convertVbaExprToPython(forMatch[4].trim()) : null;

      let rangeStr = '';
      if (start === '0' && !step) {
        rangeStr = `range(${stop} + 1)`;
      } else if (!step) {
        rangeStr = `range(${start}, ${stop} + 1)`;
      } else {
        rangeStr = `range(${start}, ${stop} + 1, ${step})`;
      }

      pyLines.push(`${indentStr}for ${loopVar} in ${rangeStr}:`);
      indentLevel++;
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 6. Do While / While ループ
    const whileMatch = trimmed.match(/^(?:Do\s+While|While)\s+(.*)$/i);
    if (whileMatch && whileMatch[1]) {
      const cond = convertVbaExprToPython(whileMatch[1].trim());
      pyLines.push(`${indentStr}while ${cond}:`);
      indentLevel++;
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 7. 出力文: MsgBox / Debug.Print
    const msgBoxMatch = trimmed.match(/^(?:MsgBox|Debug\.Print)\s*(?:\((.*)\)|(.*))$/i);
    if (msgBoxMatch) {
      const expr = (msgBoxMatch[1] || msgBoxMatch[2] || '').trim();
      const pyExpr = convertVbaExprToPython(expr);
      pyLines.push(`${indentStr}print(${pyExpr})`);
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 8. 戻り値代入 (Function 内での funcName = expr)
    if (currentFunc) {
      const retAssignMatch = trimmed.match(new RegExp(`^${currentFunc}\\s*=\\s*(.*)$`, 'i'));
      if (retAssignMatch && retAssignMatch[1] !== undefined) {
        const retExpr = convertVbaExprToPython(retAssignMatch[1].trim());
        pyLines.push(`${indentStr}return ${retExpr}`);
        lineMap[vbaLineNum] = pyLines.length;
        continue;
      }
    }

    // Exit Function / Exit Sub
    if (/^Exit\s+(Function|Sub)\b/i.test(trimmed)) {
      pyLines.push(`${indentStr}return`);
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 9. 代入文
    const assignMatch = trimmed.match(/^([a-zA-Z_]\w*(?:\(.*?\)|\[.*?\])?)\s*=\s*(.*)$/);
    if (assignMatch && assignMatch[1] && assignMatch[2] !== undefined) {
      const target = assignMatch[1];
      const val = convertVbaExprToPython(assignMatch[2].trim());
      pyLines.push(`${indentStr}${target} = ${val}`);
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // その他汎用
    const generalPy = convertVbaExprToPython(trimmed);
    pyLines.push(`${indentStr}${generalPy}`);
    lineMap[vbaLineNum] = pyLines.length;
  }

  return {
    code: pyLines.join('\n'),
    lineMap,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
