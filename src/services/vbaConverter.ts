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
        if (current) parts.push(replacer(current));
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
        if (current) parts.push(replacer(current));
        current = char;
        inSingleQuote = true;
      }
    } else {
      current += char;
    }
  }

  if (current) {
    if (inSingleQuote || inDoubleQuote) parts.push(current);
    else parts.push(replacer(current));
  }

  return parts.join('');
}

/**
 * 1行のコードからインラインコメント（#...）を分離する
 */
function splitInlineComment(line: string): { codePart: string; commentPart?: string } {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i] ?? '';
    const prevChar = i > 0 ? (line[i - 1] ?? '') : '';

    if (char === '"' && !inSingleQuote && prevChar !== '\\') {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === "'" && !inDoubleQuote && prevChar !== '\\') {
      inSingleQuote = !inSingleQuote;
    } else if (char === '#' && !inSingleQuote && !inDoubleQuote) {
      return {
        codePart: line.slice(0, i).trimEnd(),
        commentPart: line.slice(i + 1),
      };
    }
  }

  return { codePart: line };
}

/**
 * Python式をVBA式に変換
 */
function convertPythonExprToVba(expr: string): string {
  return replaceOutsideStrings(expr, (text) => {
    let res = text;
    res = res.replace(/\bTrue\b/g, 'True');
    res = res.replace(/\bFalse\b/g, 'False');
    res = res.replace(/\bNone\b/g, 'Null');
    res = res.replace(/\band\b/g, 'And');
    res = res.replace(/\bor\b/g, 'Or');
    res = res.replace(/\bnot\b/g, 'Not');
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
    res = res.replace(/(?<=[^=<>!+*/%^&|~]|^)\s*=\s*(?=[^=])/g, ' == ');
    return res;
  });
}

/**
 * stop 値から 1 引いた式または数値を生成
 */
function computeVbaStopExpr(stopExpr: string): string {
  const vbaStop = convertPythonExprToVba(stopExpr);
  if (/^-?\d+$/.test(vbaStop.trim())) {
    const num = parseInt(vbaStop.trim(), 10);
    return (num - 1).toString();
  }
  return `${vbaStop} - 1`;
}

/**
 * stop 値に 1 加算した式または数値を生成
 */
function computePyStopExpr(rawStop: string): string {
  const trimmed = rawStop.trim();
  const minusOneMatch = trimmed.match(/^(.*?)\s*-\s*1$/);
  if (minusOneMatch && minusOneMatch[1]) {
    return convertVbaExprToPython(minusOneMatch[1].trim());
  }
  if (/^-?\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    return (num + 1).toString();
  }
  return `${convertVbaExprToPython(trimmed)} + 1`;
}

interface BlockContext {
  type: 'if' | 'for' | 'while';
  indent: number;
  loopVar?: string;
}

interface VarDeclarationInfo {
  name: string;
  typeStr: 'Long' | 'Double' | 'String';
  arraySize?: number | null;
}

interface ParsedParam {
  name: string;
  typeStr: 'Long' | 'Double' | 'String';
}

interface ParsedLine {
  pyLineNum: number;
  rawLine: string;
}

interface ParsedFunction {
  funcName: string;
  params: ParsedParam[];
  hasReturn: boolean;
  returnTypeStr?: 'Long' | 'Double' | 'String';
  defLine: ParsedLine;
  bodyLines: ParsedLine[];
}

/**
 * 式から型を推論する
 */
function inferTypeFromExpr(
  expr: string,
  knownVarMap?: Map<string, 'Long' | 'Double' | 'String'>
): 'Long' | 'Double' | 'String' {
  const trimmed = expr.trim();
  if (/^["'].*["']$/.test(trimmed) || /^str\(.*\)$/.test(trimmed)) return 'String';
  if (/\d+\.\d+/.test(trimmed) || /^float\(.*\)$/.test(trimmed) || /\//.test(trimmed)) return 'Double';
  if (knownVarMap && knownVarMap.has(trimmed)) return knownVarMap.get(trimmed)!;
  return 'Long';
}

/**
 * 配列要素数の推論ヘルパー
 */
function inferArraySize(rightExpr: string): number | null | undefined {
  if (!rightExpr.startsWith('[') || (!rightExpr.endsWith(']') && !rightExpr.includes('*'))) {
    return undefined;
  }
  const repeatMatch = rightExpr.match(/^\[.*?\]\s*\*\s*(\d+)$/);
  if (repeatMatch && repeatMatch[1]) {
    return Math.max(0, parseInt(repeatMatch[1], 10) - 1);
  }
  if (rightExpr.startsWith('[') && rightExpr.endsWith(']')) {
    const inner = rightExpr.slice(1, -1).trim();
    if (!inner) return null;
    const elements = inner.split(',').filter((s) => s.trim() !== '');
    return Math.max(0, elements.length - 1);
  }
  return null;
}

/**
 * コード行リストから変数と型を推論・抽出
 */
function extractVariablesAndTypes(lines: string[], excludeNames: Set<string> = new Set()): VarDeclarationInfo[] {
  const varMap = new Map<string, VarDeclarationInfo>();
  const builtInKeywords = new Set([
    'print', 'range', 'len', 'int', 'str', 'float', 'input', 'list', 'dict', 'set',
    'if', 'elif', 'else', 'for', 'while', 'in', 'def', 'return', 'and', 'or', 'not',
    'True', 'False', 'None', 'math', 'sys', 'os', 'min', 'max', 'sum', 'abs'
  ]);

  for (const rawLine of lines) {
    const { codePart } = splitInlineComment(rawLine);
    const trimmed = codePart.trim();
    if (!trimmed) continue;

    // for loopVar in ...
    const forMatch = trimmed.match(/^for\s+([a-zA-Z_]\w*)\s+in\s+/);
    if (forMatch && forMatch[1]) {
      const varName = forMatch[1];
      if (!builtInKeywords.has(varName) && !excludeNames.has(varName) && !varMap.has(varName)) {
        varMap.set(varName, { name: varName, typeStr: 'Long' });
      }
    }

    // 代入文: var = expr または var += expr
    const assignMatch = trimmed.match(/^([a-zA-Z_]\w*)(?:\[.*?\])?\s*([+\-*/%]=|=)\s*(.*)$/);
    if (assignMatch && assignMatch[1] && assignMatch[3] !== undefined) {
      const varName = assignMatch[1];
      const rightExpr = assignMatch[3].trim();

      if (!builtInKeywords.has(varName) && !excludeNames.has(varName)) {
        const arraySize = inferArraySize(rightExpr);
        const typeStr = arraySize !== undefined ? 'Long' : inferTypeFromExpr(rightExpr);

        if (!varMap.has(varName)) {
          varMap.set(varName, { name: varName, typeStr, arraySize });
        } else {
          const existing = varMap.get(varName)!;
          if (typeStr === 'String') existing.typeStr = 'String';
          else if (typeStr === 'Double' && existing.typeStr === 'Long') existing.typeStr = 'Double';
          if (arraySize !== undefined && existing.arraySize === undefined) existing.arraySize = arraySize;
        }
      }
    }
  }

  return Array.from(varMap.values());
}

/**
 * Pythonの型名（str, float, int 等）を VBA型名にマッピング
 */
function mapPythonTypeToVba(typeHint?: string): 'Long' | 'Double' | 'String' {
  if (!typeHint) return 'Long';
  const lower = typeHint.toLowerCase().trim();
  if (lower === 'str' || lower === 'string') return 'String';
  if (lower === 'float' || lower === 'double') return 'Double';
  return 'Long';
}

/**
 * Pythonコードを関数定義とメイン処理行に構造解析
 */
function parsePythonStructure(lines: string[]): { functions: ParsedFunction[]; mainLines: ParsedLine[] } {
  const functions: ParsedFunction[] = [];
  const mainLines: ParsedLine[] = [];
  let currentFunc: ParsedFunction | null = null;
  let defBaseIndent = 0;

  const pushCompletedFunc = () => {
    if (!currentFunc) return;
    while (
      currentFunc.bodyLines.length > 0 &&
      currentFunc.bodyLines[currentFunc.bodyLines.length - 1]?.rawLine.trim() === ''
    ) {
      currentFunc.bodyLines.pop();
    }
    functions.push(currentFunc);
    currentFunc = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const pyLineNum = i + 1;
    const rawLine = lines[i] ?? '';
    const { codePart } = splitInlineComment(rawLine);
    const trimmed = codePart.trim();
    const indent = codePart.search(/\S/);

    if (trimmed.startsWith('def ')) {
      const match = trimmed.match(/^def\s+([a-zA-Z_]\w*)\s*\((.*?)\)(?:\s*->\s*([a-zA-Z_]\w*))?\s*:/);
      if (match && match[1]) {
        pushCompletedFunc();
        const rawParams = (match[2] ?? '').split(',').map((p) => p.trim()).filter(Boolean);
        const params: ParsedParam[] = rawParams.map((p) => {
          const colonMatch = p.match(/^([a-zA-Z_]\w*)\s*(?::\s*([a-zA-Z_]\w*))?/);
          return {
            name: colonMatch && colonMatch[1] ? colonMatch[1] : p,
            typeStr: mapPythonTypeToVba(colonMatch && colonMatch[2] ? colonMatch[2] : undefined),
          };
        });

        currentFunc = {
          funcName: match[1],
          params,
          hasReturn: false,
          returnTypeStr: match[3] ? mapPythonTypeToVba(match[3]) : undefined,
          defLine: { pyLineNum, rawLine },
          bodyLines: [],
        };
        defBaseIndent = indent >= 0 ? indent : 0;
        continue;
      }
    }

    if (currentFunc) {
      if (indent > defBaseIndent || (indent === -1 && rawLine.trim() === '')) {
        currentFunc.bodyLines.push({ pyLineNum, rawLine });
        if (trimmed.startsWith('return ') && trimmed !== 'return') {
          currentFunc.hasReturn = true;
          const retExpr = trimmed.replace(/^return\s*/, '').trim();
          if (!currentFunc.returnTypeStr) currentFunc.returnTypeStr = inferTypeFromExpr(retExpr);
        }
      } else {
        pushCompletedFunc();
        mainLines.push({ pyLineNum, rawLine });
      }
    } else {
      mainLines.push({ pyLineNum, rawLine });
    }
  }

  pushCompletedFunc();
  return { functions, mainLines };
}

/**
 * 1行のPython制御文または式をVBA文に変換
 */
function translatePythonStatement(
  trimmed: string,
  enclosingFunc?: { name: string; isFunction: boolean }
): { vbaText: string; newBlock?: BlockContext } {
  // return 文
  if (trimmed.startsWith('return')) {
    const returnExpr = trimmed.replace(/^return\s*/, '').trim();
    if (enclosingFunc && enclosingFunc.isFunction) {
      return { vbaText: returnExpr ? `${enclosingFunc.name} = ${convertPythonExprToVba(returnExpr)}` : '' };
    }
    if (enclosingFunc && !enclosingFunc.isFunction) {
      return { vbaText: 'Exit Sub' };
    }
    return { vbaText: returnExpr ? `' return ${convertPythonExprToVba(returnExpr)}` : '' };
  }

  // if / elif / else 分岐
  const ifMatch = trimmed.match(/^if\s+(.*?)\s*:/);
  if (ifMatch && ifMatch[1]) {
    return { vbaText: `If ${convertPythonExprToVba(ifMatch[1].trim())} Then`, newBlock: { type: 'if', indent: 0 } };
  }
  const elifMatch = trimmed.match(/^elif\s+(.*?)\s*:/);
  if (elifMatch && elifMatch[1]) {
    return { vbaText: `ElseIf ${convertPythonExprToVba(elifMatch[1].trim())} Then` };
  }
  if (trimmed === 'else:') {
    return { vbaText: 'Else' };
  }

  // for ループ: for var in range(...)
  const forRangeMatch = trimmed.match(/^for\s+([a-zA-Z_]\w*)\s+in\s+range\((.*?)\)\s*:/);
  if (forRangeMatch && forRangeMatch[1] && forRangeMatch[2]) {
    const loopVar = forRangeMatch[1];
    const args = forRangeMatch[2].split(',').map((s) => s.trim());
    let forClause = '';
    if (args.length === 1 && args[0]) {
      forClause = `For ${loopVar} = 0 To ${computeVbaStopExpr(args[0])}`;
    } else if (args.length === 2 && args[0] && args[1]) {
      forClause = `For ${loopVar} = ${convertPythonExprToVba(args[0])} To ${computeVbaStopExpr(args[1])}`;
    } else if (args.length >= 3 && args[0] && args[1] && args[2]) {
      forClause = `For ${loopVar} = ${convertPythonExprToVba(args[0])} To ${computeVbaStopExpr(args[1])} Step ${convertPythonExprToVba(args[2])}`;
    }
    return { vbaText: forClause, newBlock: { type: 'for', indent: 0, loopVar } };
  }

  // while ループ
  const whileMatch = trimmed.match(/^while\s+(.*?)\s*:/);
  if (whileMatch && whileMatch[1]) {
    return { vbaText: `Do While ${convertPythonExprToVba(whileMatch[1].trim())}`, newBlock: { type: 'while', indent: 0 } };
  }

  // print 出力
  const printMatch = trimmed.match(/^print\((.*)\)$/);
  if (printMatch && printMatch[1] !== undefined) {
    return { vbaText: `MsgBox (${convertPythonExprToVba(printMatch[1].trim())})` };
  }

  // 代入文
  const assignMatch = trimmed.match(/^([a-zA-Z_]\w*(?:\[.*?\])?)\s*([+\-*/%]=|=)\s*(.*)$/);
  if (assignMatch && assignMatch[1] && assignMatch[2] && assignMatch[3] !== undefined) {
    const [target, op, right] = [assignMatch[1], assignMatch[2], assignMatch[3]];
    if (op === '=') {
      return { vbaText: `${target} = ${convertPythonExprToVba(right)}` };
    }
    const pureOp = op.slice(0, -1);
    return { vbaText: `${target} = ${target} ${convertPythonExprToVba(pureOp)} ${convertPythonExprToVba(right)}` };
  }

  return { vbaText: convertPythonExprToVba(trimmed) };
}

/**
 * 一連のPythonコードブロック行をVBA行に変換
 */
function convertBlockLines(
  blockLines: ParsedLine[],
  baseIndentOffset: number,
  vbaLines: string[],
  lineMap: Record<number, number>,
  enclosingFunc?: { name: string; isFunction: boolean }
): void {
  const blockStack: BlockContext[] = [];

  const closeBlocksUpTo = (targetIndent: number) => {
    while (blockStack.length > 0) {
      const top = blockStack[blockStack.length - 1];
      if (top && top.indent >= targetIndent) {
        blockStack.pop();
        const indentStr = ' '.repeat(top.indent + baseIndentOffset);
        if (top.type === 'if') vbaLines.push(`${indentStr}End If`);
        else if (top.type === 'for') vbaLines.push(`${indentStr}Next ${top.loopVar || ''}`.trimEnd());
        else if (top.type === 'while') vbaLines.push(`${indentStr}Loop`);
      } else {
        break;
      }
    }
  };

  for (const item of blockLines) {
    const { pyLineNum, rawLine } = item;
    if (!rawLine.trim()) {
      vbaLines.push('');
      lineMap[pyLineNum] = vbaLines.length;
      continue;
    }

    const { codePart, commentPart } = splitInlineComment(rawLine);
    const rawIndent = codePart.search(/\S/);

    // 単独コメント行
    if (rawIndent === -1 || !codePart.trim()) {
      const hashIdx = rawLine.indexOf('#');
      const leadingSpace = hashIdx >= 0 ? rawLine.slice(0, hashIdx) : '';
      const commentText = hashIdx >= 0 ? rawLine.slice(hashIdx + 1) : '';
      closeBlocksUpTo(leadingSpace.length);
      vbaLines.push(`${' '.repeat(leadingSpace.length + baseIndentOffset)}'${commentText}`.trimEnd());
      lineMap[pyLineNum] = vbaLines.length;
      continue;
    }

    const trimmed = codePart.trim();
    const indentStr = ' '.repeat(rawIndent + baseIndentOffset);
    const inlineCommentSuffix = commentPart !== undefined ? ` '${commentPart}` : '';

    if (!trimmed.startsWith('elif ') && !trimmed.startsWith('else:')) {
      closeBlocksUpTo(rawIndent);
    }

    const { vbaText, newBlock } = translatePythonStatement(trimmed, enclosingFunc);
    if (vbaText) {
      vbaLines.push(`${indentStr}${vbaText}${inlineCommentSuffix}`);
    }
    if (newBlock) {
      blockStack.push({ ...newBlock, indent: rawIndent });
    }
    lineMap[pyLineNum] = vbaLines.length;
  }

  closeBlocksUpTo(0);
}

/**
 * 1つの独立した関数定義（Function / Sub）をVBA形式で生成
 */
function formatVbaFunction(
  fn: ParsedFunction,
  vbaLines: string[],
  lineMap: Record<number, number>
): void {
  const { commentPart } = splitInlineComment(fn.defLine.rawLine);
  const inlineCommentSuffix = commentPart !== undefined ? ` '${commentPart}` : '';
  const decl = fn.hasReturn ? 'Function' : 'Sub';

  const paramNames = fn.params.map((p) => p.name);
  const funcLocalVars = extractVariablesAndTypes(
    fn.bodyLines.map((b) => b.rawLine),
    new Set([...paramNames, fn.funcName])
  );

  const localMap = new Map(funcLocalVars.map((v) => [v.name, v.typeStr]));
  const paramsStr = fn.params
    .map((p) => `${p.name} As ${p.typeStr !== 'Long' ? p.typeStr : (localMap.get(p.name) ?? 'Long')}`)
    .join(', ');

  const returnTypeClause = fn.hasReturn ? ` As ${fn.returnTypeStr ?? 'Long'}` : '';
  vbaLines.push(`${decl} ${fn.funcName}(${paramsStr})${returnTypeClause}${inlineCommentSuffix}`);
  lineMap[fn.defLine.pyLineNum] = vbaLines.length;

  for (const v of funcLocalVars) {
    const arrClause = v.arraySize !== undefined ? (v.arraySize !== null ? `(${v.arraySize})` : '()') : '';
    vbaLines.push(`    Dim ${v.name}${arrClause} As ${v.typeStr}`);
  }
  if (funcLocalVars.length > 0) vbaLines.push('');

  convertBlockLines(fn.bodyLines, 0, vbaLines, lineMap, { name: fn.funcName, isFunction: fn.hasReturn });
  vbaLines.push(`End ${decl}`);
  vbaLines.push('');
}

/**
 * メイン処理（Sub Program() ... End Sub）をVBA形式で生成
 */
function formatVbaMain(
  mainLines: ParsedLine[],
  functions: ParsedFunction[],
  vbaLines: string[],
  lineMap: Record<number, number>
): void {
  const hasExecutableMain = mainLines.some((m) => splitInlineComment(m.rawLine).codePart.trim().length > 0);
  if (!hasExecutableMain && functions.length > 0) return;

  const funcNamesSet = new Set(functions.map((f) => f.funcName));
  const mainVariables = extractVariablesAndTypes(mainLines.map((m) => m.rawLine), funcNamesSet);

  vbaLines.push('Sub Program()');
  for (const v of mainVariables) {
    const arrClause = v.arraySize !== undefined ? (v.arraySize !== null ? `(${v.arraySize})` : '()') : '';
    vbaLines.push(`    Dim ${v.name}${arrClause} As ${v.typeStr}`);
  }
  if (mainVariables.length > 0) vbaLines.push('');

  convertBlockLines(mainLines, 4, vbaLines, lineMap);
  vbaLines.push('End Sub');
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

  const { functions, mainLines } = parsePythonStructure(lines);

  for (const fn of functions) {
    formatVbaFunction(fn, vbaLines, lineMap);
  }

  formatVbaMain(mainLines, functions, vbaLines, lineMap);

  return { code: vbaLines.join('\n'), lineMap };
}

/**
 * 1行のVBA構文をPython構文に変換
 */
function translateVbaStatement(
  trimmed: string,
  indentLevel: number,
  currentFunc: string | null
): { pyText?: string; indentDelta?: number; newFunc?: string | null; isReturnHandled?: boolean } {
  const indentStr = '    '.repeat(indentLevel);

  // 関数定義: Sub / Function (Program 以外)
  const funcMatch = trimmed.match(/^(?:Public\s+|Private\s+)?(Sub|Function)\s+([a-zA-Z_]\w*)\s*\((.*?)\)(?:\s+As\s+[a-zA-Z_]\w*)?/i);
  if (funcMatch && funcMatch[2] && funcMatch[3] !== undefined && funcMatch[2].toLowerCase() !== 'program') {
    const name = funcMatch[2];
    const params = funcMatch[3]
      .split(',')
      .map((p) => p.trim().replace(/^ByVal\s+|^ByRef\s+/i, '').split(/\s+As\s+/i)[0]?.trim() ?? '')
      .filter(Boolean)
      .join(', ');
    return { pyText: `${indentStr}def ${name}(${params}):`, indentDelta: 1, newFunc: name };
  }

  // If / ElseIf / Else
  const ifMatch = trimmed.match(/^If\s+(.*?)\s+Then$/i);
  if (ifMatch && ifMatch[1]) {
    return { pyText: `${indentStr}if ${convertVbaExprToPython(ifMatch[1].trim())}:`, indentDelta: 1 };
  }
  const elseIfMatch = trimmed.match(/^ElseIf\s+(.*?)\s+Then$/i);
  if (elseIfMatch && elseIfMatch[1]) {
    return { pyText: `${'    '.repeat(Math.max(0, indentLevel - 1))}elif ${convertVbaExprToPython(elseIfMatch[1].trim())}:` };
  }
  if (/^Else$/i.test(trimmed)) {
    return { pyText: `${'    '.repeat(Math.max(0, indentLevel - 1))}else:` };
  }

  // For ループ
  const forMatch = trimmed.match(/^For\s+([a-zA-Z_]\w*)\s*=\s*(.*?)\s+To\s+(.*?)(?:\s+Step\s+(.*?))?$/i);
  if (forMatch && forMatch[1] && forMatch[2] && forMatch[3]) {
    const [loopVar, start, rawStop, step] = [forMatch[1], convertVbaExprToPython(forMatch[2].trim()), forMatch[3].trim(), forMatch[4] ? convertVbaExprToPython(forMatch[4].trim()) : null];
    const stop = computePyStopExpr(rawStop);
    const rangeStr = start === '0' && !step ? `range(${stop})` : !step ? `range(${start}, ${stop})` : `range(${start}, ${stop}, ${step})`;
    return { pyText: `${indentStr}for ${loopVar} in ${rangeStr}:`, indentDelta: 1 };
  }

  // While ループ
  const whileMatch = trimmed.match(/^(?:Do\s+While|While)\s+(.*)$/i);
  if (whileMatch && whileMatch[1]) {
    return { pyText: `${indentStr}while ${convertVbaExprToPython(whileMatch[1].trim())}:`, indentDelta: 1 };
  }

  // MsgBox 出力
  const msgBoxMatch = trimmed.match(/^(?:MsgBox|Debug\.Print)\s*(?:\((.*)\)|(.*))$/i);
  if (msgBoxMatch) {
    const expr = (msgBoxMatch[1] || msgBoxMatch[2] || '').trim();
    return { pyText: `${indentStr}print(${convertVbaExprToPython(expr)})` };
  }

  // 戻り値代入 / Exit
  if (currentFunc) {
    const retAssignMatch = trimmed.match(new RegExp(`^${currentFunc}\\s*=\\s*(.*)$`, 'i'));
    if (retAssignMatch && retAssignMatch[1] !== undefined) {
      return { pyText: `${indentStr}return ${convertVbaExprToPython(retAssignMatch[1].trim())}`, isReturnHandled: true };
    }
  }

  // 代入文
  const assignMatch = trimmed.match(/^([a-zA-Z_]\w*(?:\(.*?\)|\[.*?\])?)\s*=\s*(.*)$/);
  if (assignMatch && assignMatch[1] && assignMatch[2] !== undefined) {
    return { pyText: `${indentStr}${assignMatch[1]} = ${convertVbaExprToPython(assignMatch[2].trim())}` };
  }

  return { pyText: `${indentStr}${convertVbaExprToPython(trimmed)}` };
}

/**
 * 連続する空行を整理
 */
function cleanEmptyLines(lines: string[]): string[] {
  const result: string[] = [];
  let prevEmpty = false;
  for (const line of lines) {
    if (line.trim() === '') {
      if (!prevEmpty && result.length > 0) result.push('');
      prevEmpty = true;
    } else {
      result.push(line);
      prevEmpty = false;
    }
  }
  while (result.length > 0 && result[result.length - 1]?.trim() === '') {
    result.pop();
  }
  return result;
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

  let indentLevel = 0;
  let currentFunc: string | null = null;
  let hasHandledReturnInFunc = false;

  for (let vbaIdx = 0; vbaIdx < lines.length; vbaIdx++) {
    const vbaLineNum = vbaIdx + 1;
    const rawLine = lines[vbaIdx] ?? '';

    let commentPart: string | undefined = undefined;
    let codePart = rawLine;
    const quoteIdx = rawLine.indexOf("'");
    if (quoteIdx >= 0) {
      codePart = rawLine.slice(0, quoteIdx);
      commentPart = rawLine.slice(quoteIdx + 1);
    }

    const trimmed = codePart.trim();
    const inlineCommentSuffix = commentPart !== undefined ? ` #${commentPart}` : '';

    if (!trimmed) {
      pyLines.push(commentPart !== undefined ? `${'    '.repeat(indentLevel)}#${commentPart}`.trimEnd() : '');
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // メインラッパーおよび変数宣言のスキップ
    if (/^Sub\s+Program\s*\(\s*\)/i.test(trimmed)) {
      lineMap[vbaLineNum] = pyLines.length + 1;
      continue;
    }
    if ((/^End\s+Sub$/i.test(trimmed) && !currentFunc) || /^(Dim|ReDim|Const)\b/i.test(trimmed)) {
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // ブロック終了キーワードのデデント
    if (/^End\s+(Sub|Function)\b/i.test(trimmed) || /^End\s+If\b/i.test(trimmed) || /^Next(\s+[a-zA-Z_]\w*)?/i.test(trimmed) || /^(Loop|Wend)\b/i.test(trimmed)) {
      if (indentLevel > 0) indentLevel--;
      if (/^End\s+(Sub|Function)\b/i.test(trimmed)) {
        currentFunc = null;
        hasHandledReturnInFunc = false;
      }
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    if (/^Exit\s+(Function|Sub)\b/i.test(trimmed)) {
      if (!hasHandledReturnInFunc) pyLines.push(`${'    '.repeat(indentLevel)}return${inlineCommentSuffix}`);
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    const { pyText, indentDelta, newFunc, isReturnHandled } = translateVbaStatement(trimmed, indentLevel, currentFunc);
    if (pyText !== undefined) {
      pyLines.push(`${pyText}${inlineCommentSuffix}`);
    }
    if (indentDelta) indentLevel += indentDelta;
    if (newFunc !== undefined) {
      currentFunc = newFunc;
      hasHandledReturnInFunc = false;
    }
    if (isReturnHandled) hasHandledReturnInFunc = true;

    lineMap[vbaLineNum] = pyLines.length;
  }

  return { code: cleanEmptyLines(pyLines).join('\n'), lineMap };
}
