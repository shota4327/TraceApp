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
 * 1行のコードからインラインコメント（#...）を分離する
 * （# 直後の空白構造をそのまま保持する）
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
        commentPart: line.slice(i + 1), // 空白を含めてそのまま保持
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
  type: 'if' | 'for' | 'while';
  indent: number;
  loopVar?: string;
}

interface VarDeclarationInfo {
  name: string;
  typeStr: 'Integer' | 'Double' | 'String';
  arraySize?: number | null; // null: 動的配列 (), number: 固定サイズ (N-1)
}

/**
 * 式から型を推論する
 */
function inferTypeFromExpr(
  expr: string,
  knownVarMap?: Map<string, 'Integer' | 'Double' | 'String'>
): 'Integer' | 'Double' | 'String' {
  const trimmed = expr.trim();
  if (/^["'].*["']$/.test(trimmed) || /^str\(.*\)$/.test(trimmed)) {
    return 'String';
  }
  if (/\d+\.\d+/.test(trimmed) || /^float\(.*\)$/.test(trimmed) || /\//.test(trimmed)) {
    return 'Double';
  }
  if (knownVarMap && knownVarMap.has(trimmed)) {
    return knownVarMap.get(trimmed)!;
  }
  return 'Integer';
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
    const indent = codePart.search(/\S/);

    if (indent === -1 || !trimmed) continue;

    // 1. for loopVar in ...
    const forMatch = trimmed.match(/^for\s+([a-zA-Z_]\w*)\s+in\s+/);
    if (forMatch && forMatch[1]) {
      const varName = forMatch[1];
      if (!builtInKeywords.has(varName) && !excludeNames.has(varName) && !varMap.has(varName)) {
        varMap.set(varName, { name: varName, typeStr: 'Integer' });
      }
    }

    // 2. 代入文: var = expr または var += expr
    const assignMatch = trimmed.match(/^([a-zA-Z_]\w*)(?:\[.*?\])?\s*([+\-*/%]=|=)\s*(.*)$/);
    if (assignMatch && assignMatch[1] && assignMatch[3] !== undefined) {
      const varName = assignMatch[1];
      const rightExpr = assignMatch[3].trim();

      if (!builtInKeywords.has(varName) && !excludeNames.has(varName)) {
        let typeStr: 'Integer' | 'Double' | 'String' = 'Integer';
        let arraySize: number | null | undefined = undefined;

        // リスト/配列判定: [0]*N, [1, 2, 3], [] 等
        if (rightExpr.startsWith('[') && (rightExpr.endsWith(']') || rightExpr.includes('*'))) {
          const repeatMatch = rightExpr.match(/^\[.*?\]\s*\*\s*(\d+)$/);
          if (repeatMatch && repeatMatch[1]) {
            const count = parseInt(repeatMatch[1], 10);
            arraySize = Math.max(0, count - 1);
          } else if (rightExpr.startsWith('[') && rightExpr.endsWith(']')) {
            const inner = rightExpr.slice(1, -1).trim();
            if (!inner) {
              arraySize = null;
            } else {
              const elements = inner.split(',').filter((s) => s.trim() !== '');
              arraySize = Math.max(0, elements.length - 1);
            }
          } else {
            arraySize = null;
          }
        } else {
          typeStr = inferTypeFromExpr(rightExpr);
        }

        if (!varMap.has(varName)) {
          varMap.set(varName, { name: varName, typeStr, arraySize });
        } else {
          const existing = varMap.get(varName)!;
          if (typeStr === 'String') existing.typeStr = 'String';
          else if (typeStr === 'Double' && existing.typeStr === 'Integer') existing.typeStr = 'Double';
          if (arraySize !== undefined && existing.arraySize === undefined) existing.arraySize = arraySize;
        }
      }
    }
  }

  return Array.from(varMap.values());
}

interface ParsedParam {
  name: string;
  typeStr: 'Integer' | 'Double' | 'String';
}

interface ParsedLine {
  pyLineNum: number;
  rawLine: string;
}

interface ParsedFunction {
  funcName: string;
  params: ParsedParam[];
  hasReturn: boolean;
  returnTypeStr?: 'Integer' | 'Double' | 'String';
  defLine: ParsedLine;
  bodyLines: ParsedLine[];
}

/**
 * Pythonの型名（str, float, int 等）を VBA型名にマッピング
 */
function mapPythonTypeToVba(typeHint?: string): 'Integer' | 'Double' | 'String' {
  if (!typeHint) return 'Integer';
  const lower = typeHint.toLowerCase().trim();
  if (lower === 'str' || lower === 'string') return 'String';
  if (lower === 'float' || lower === 'double') return 'Double';
  return 'Integer';
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

  // Pythonコードを行ごとに走査し、関数ブロックとメインブロックに分割
  const functions: ParsedFunction[] = [];
  const mainLines: ParsedLine[] = [];

  let currentFunc: ParsedFunction | null = null;
  let defBaseIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const pyLineNum = i + 1;
    const rawLine = lines[i] ?? '';
    const { codePart } = splitInlineComment(rawLine);
    const trimmed = codePart.trim();
    const indent = codePart.search(/\S/);

    if (trimmed.startsWith('def ')) {
      const match = trimmed.match(/^def\s+([a-zA-Z_]\w*)\s*\((.*?)\)(?:\s*->\s*([a-zA-Z_]\w*))?\s*:/);
      if (match && match[1]) {
        if (currentFunc) {
          while (
            currentFunc.bodyLines.length > 0 &&
            currentFunc.bodyLines[currentFunc.bodyLines.length - 1]?.rawLine.trim() === ''
          ) {
            currentFunc.bodyLines.pop();
          }
          functions.push(currentFunc);
        }
        const funcName = match[1];
        const rawParams = (match[2] ?? '')
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);

        const params: ParsedParam[] = rawParams.map((p) => {
          const colonMatch = p.match(/^([a-zA-Z_]\w*)\s*(?::\s*([a-zA-Z_]\w*))?/);
          const pName = colonMatch && colonMatch[1] ? colonMatch[1] : p;
          const pTypeHint = colonMatch && colonMatch[2] ? colonMatch[2] : undefined;
          return {
            name: pName,
            typeStr: mapPythonTypeToVba(pTypeHint),
          };
        });

        const returnTypeHint = match[3];

        currentFunc = {
          funcName,
          params,
          hasReturn: false,
          returnTypeStr: returnTypeHint ? mapPythonTypeToVba(returnTypeHint) : undefined,
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
          if (!currentFunc.returnTypeStr) {
            currentFunc.returnTypeStr = inferTypeFromExpr(retExpr);
          }
        }
      } else {
        while (
          currentFunc.bodyLines.length > 0 &&
          currentFunc.bodyLines[currentFunc.bodyLines.length - 1]?.rawLine.trim() === ''
        ) {
          currentFunc.bodyLines.pop();
        }
        functions.push(currentFunc);
        currentFunc = null;
        mainLines.push({ pyLineNum, rawLine });
      }
    } else {
      mainLines.push({ pyLineNum, rawLine });
    }
  }

  if (currentFunc) {
    while (
      currentFunc.bodyLines.length > 0 &&
      currentFunc.bodyLines[currentFunc.bodyLines.length - 1]?.rawLine.trim() === ''
    ) {
      currentFunc.bodyLines.pop();
    }
    functions.push(currentFunc);
  }

  /**
   * 一連のブロックコード行（関数本体またはメインコード）を変換して vbaLines に追加するヘルパー
   */
  const convertBlockLines = (
    blockLines: ParsedLine[],
    baseIndentOffset: number,
    enclosingFunc?: { name: string; isFunction: boolean }
  ) => {
    const blockStack: BlockContext[] = [];

    const closeBlocksUpTo = (targetIndent: number) => {
      while (blockStack.length > 0) {
        const top = blockStack[blockStack.length - 1];
        if (top && top.indent >= targetIndent) {
          blockStack.pop();
          const indentStr = ' '.repeat(top.indent + baseIndentOffset);
          if (top.type === 'if') {
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

    for (const item of blockLines) {
      const { pyLineNum, rawLine } = item;

      // 空行
      if (!rawLine.trim()) {
        vbaLines.push('');
        lineMap[pyLineNum] = vbaLines.length;
        continue;
      }

      // コメント行とインラインコメントの分離
      const { codePart, commentPart } = splitInlineComment(rawLine);
      const rawIndent = codePart.search(/\S/);

      // 単独コメント行
      if (rawIndent === -1 || !codePart.trim()) {
        const hashIdx = rawLine.indexOf('#');
        const leadingSpace = hashIdx >= 0 ? rawLine.slice(0, hashIdx) : '';
        const commentText = hashIdx >= 0 ? rawLine.slice(hashIdx + 1) : '';
        closeBlocksUpTo(leadingSpace.length);
        const indentStr = ' '.repeat(leadingSpace.length + baseIndentOffset);
        vbaLines.push(`${indentStr}'${commentText}`.trimEnd());
        lineMap[pyLineNum] = vbaLines.length;
        continue;
      }

      const trimmed = codePart.trim();
      const indentStr = ' '.repeat(rawIndent + baseIndentOffset);
      const inlineCommentSuffix = commentPart !== undefined ? ` '${commentPart}` : '';

      // インデントの戻りに応じたブロック終了処理
      if (!trimmed.startsWith('elif ') && !trimmed.startsWith('else:')) {
        closeBlocksUpTo(rawIndent);
      }

      // 1. return 文
      if (trimmed.startsWith('return')) {
        const returnExpr = trimmed.replace(/^return\s*/, '').trim();
        if (enclosingFunc && enclosingFunc.isFunction) {
          if (returnExpr) {
            const vbaExpr = convertPythonExprToVba(returnExpr);
            vbaLines.push(`${indentStr}${enclosingFunc.name} = ${vbaExpr}${inlineCommentSuffix}`);
          }
        } else if (enclosingFunc && !enclosingFunc.isFunction) {
          vbaLines.push(`${indentStr}Exit Sub${inlineCommentSuffix}`);
        } else {
          if (returnExpr) {
            vbaLines.push(`${indentStr}' return ${convertPythonExprToVba(returnExpr)}${inlineCommentSuffix}`);
          }
        }
        lineMap[pyLineNum] = vbaLines.length;
        continue;
      }

      // 2. if / elif / else 分岐
      const ifMatch = trimmed.match(/^if\s+(.*?)\s*:/);
      if (ifMatch && ifMatch[1]) {
        const cond = convertPythonExprToVba(ifMatch[1].trim());
        vbaLines.push(`${indentStr}If ${cond} Then${inlineCommentSuffix}`);
        blockStack.push({ type: 'if', indent: rawIndent });
        lineMap[pyLineNum] = vbaLines.length;
        continue;
      }

      const elifMatch = trimmed.match(/^elif\s+(.*?)\s*:/);
      if (elifMatch && elifMatch[1]) {
        const cond = convertPythonExprToVba(elifMatch[1].trim());
        vbaLines.push(`${indentStr}ElseIf ${cond} Then${inlineCommentSuffix}`);
        lineMap[pyLineNum] = vbaLines.length;
        continue;
      }

      if (trimmed === 'else:') {
        vbaLines.push(`${indentStr}Else${inlineCommentSuffix}`);
        lineMap[pyLineNum] = vbaLines.length;
        continue;
      }

      // 3. for ループ: for var in range(...)
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

        vbaLines.push(`${indentStr}${forClause}${inlineCommentSuffix}`);
        blockStack.push({ type: 'for', indent: rawIndent, loopVar });
        lineMap[pyLineNum] = vbaLines.length;
        continue;
      }

      // 4. while ループ: while cond:
      const whileMatch = trimmed.match(/^while\s+(.*?)\s*:/);
      if (whileMatch && whileMatch[1]) {
        const cond = convertPythonExprToVba(whileMatch[1].trim());
        vbaLines.push(`${indentStr}Do While ${cond}${inlineCommentSuffix}`);
        blockStack.push({ type: 'while', indent: rawIndent });
        lineMap[pyLineNum] = vbaLines.length;
        continue;
      }

      // 5. 出力処理: print(...) -> MsgBox (...)
      const printMatch = trimmed.match(/^print\((.*)\)$/);
      if (printMatch && printMatch[1] !== undefined) {
        const content = printMatch[1].trim();
        const vbaContent = convertPythonExprToVba(content);
        vbaLines.push(`${indentStr}MsgBox (${vbaContent})${inlineCommentSuffix}`);
        lineMap[pyLineNum] = vbaLines.length;
        continue;
      }

      // 6. 代入文・一般文
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
        vbaLines.push(`${indentStr}${vbaAssign}${inlineCommentSuffix}`);
        lineMap[pyLineNum] = vbaLines.length;
        continue;
      }

      // その他汎用式・関数呼び出し
      const generalVba = convertPythonExprToVba(trimmed);
      vbaLines.push(`${indentStr}${generalVba}${inlineCommentSuffix}`);
      lineMap[pyLineNum] = vbaLines.length;
    }

    closeBlocksUpTo(0);
  };

  // --- 1. 独立した関数定義（Sub / Function）の出力 ---
  for (const fn of functions) {
    const { commentPart } = splitInlineComment(fn.defLine.rawLine);
    const inlineCommentSuffix = commentPart !== undefined ? ` '${commentPart}` : '';
    const decl = fn.hasReturn ? 'Function' : 'Sub';

    // 引数の型宣言（例: a As Integer, b As Integer）
    const paramNames = fn.params.map((p) => p.name);
    const excludeSet = new Set([...paramNames, fn.funcName]);
    const funcBodyRawLines = fn.bodyLines.map((b) => b.rawLine);
    const funcLocalVars = extractVariablesAndTypes(funcBodyRawLines, excludeSet);

    // 引数型が未確定の場合は、関数内ローカル変数やデフォルト Integer
    const localMap = new Map(funcLocalVars.map((v) => [v.name, v.typeStr]));
    const paramsStr = fn.params
      .map((p) => {
        const finalType = p.typeStr !== 'Integer' ? p.typeStr : (localMap.get(p.name) ?? 'Integer');
        return `${p.name} As ${finalType}`;
      })
      .join(', ');

    // 戻り値の型宣言（例: Function add(...) As Integer）
    let returnTypeClause = '';
    if (fn.hasReturn) {
      const retType = fn.returnTypeStr ?? 'Integer';
      returnTypeClause = ` As ${retType}`;
    }

    vbaLines.push(`${decl} ${fn.funcName}(${paramsStr})${returnTypeClause}${inlineCommentSuffix}`);
    lineMap[fn.defLine.pyLineNum] = vbaLines.length;

    // 関数内 Dim 宣言 (4スペースインデント)
    for (const v of funcLocalVars) {
      if (v.arraySize !== undefined) {
        if (v.arraySize !== null) {
          vbaLines.push(`    Dim ${v.name}(${v.arraySize}) As ${v.typeStr}`);
        } else {
          vbaLines.push(`    Dim ${v.name}() As ${v.typeStr}`);
        }
      } else {
        vbaLines.push(`    Dim ${v.name} As ${v.typeStr}`);
      }
    }
    if (funcLocalVars.length > 0) {
      vbaLines.push('');
    }

    // 関数本体の変換（Python側ですでに4スペースインデントされているので offset は 0）
    convertBlockLines(fn.bodyLines, 0, { name: fn.funcName, isFunction: fn.hasReturn });

    vbaLines.push(`End ${decl}`);
    vbaLines.push(''); // 関数間の空行
  }

  // --- 2. メイン処理 (Sub Program() ... End Sub) の出力 ---
  const hasExecutableMain = mainLines.some((m) => {
    const { codePart } = splitInlineComment(m.rawLine);
    return codePart.trim().length > 0;
  });

  if (hasExecutableMain || functions.length === 0) {
    const mainRawLines = mainLines.map((m) => m.rawLine);
    // メイン変数から定義済み関数名を除外
    const funcNamesSet = new Set(functions.map((f) => f.funcName));
    const mainVariables = extractVariablesAndTypes(mainRawLines, funcNamesSet);

    vbaLines.push('Sub Program()');

    // メイン変数の Dim 宣言 (4スペースインデント)
    for (const v of mainVariables) {
      if (v.arraySize !== undefined) {
        if (v.arraySize !== null) {
          vbaLines.push(`    Dim ${v.name}(${v.arraySize}) As ${v.typeStr}`);
        } else {
          vbaLines.push(`    Dim ${v.name}() As ${v.typeStr}`);
        }
      } else {
        vbaLines.push(`    Dim ${v.name} As ${v.typeStr}`);
      }
    }

    // Dim 宣言後の空白行
    if (mainVariables.length > 0) {
      vbaLines.push('');
    }

    // メイン処理の変換（Python側でインデント0なので offset は 4）
    convertBlockLines(mainLines, 4);

    vbaLines.push('End Sub');
  }

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
  let hasHandledReturnInFunc = false;

  for (let vbaIdx = 0; vbaIdx < lines.length; vbaIdx++) {
    const vbaLineNum = vbaIdx + 1;
    const rawLine = lines[vbaIdx] ?? '';

    // コメント・インラインコメントの分離
    let commentPart: string | undefined = undefined;
    let codePart = rawLine;

    const quoteIdx = rawLine.indexOf("'");
    if (quoteIdx >= 0) {
      codePart = rawLine.slice(0, quoteIdx);
      commentPart = rawLine.slice(quoteIdx + 1); // ' 直後の空白構造をそのまま保持
    }

    const trimmed = codePart.trim();
    const inlineCommentSuffix = commentPart !== undefined ? ` #${commentPart}` : '';

    if (!trimmed) {
      if (commentPart !== undefined) {
        pyLines.push(`${'    '.repeat(indentLevel)}#${commentPart}`.trimEnd());
        lineMap[vbaLineNum] = pyLines.length;
      } else {
        pyLines.push('');
        lineMap[vbaLineNum] = pyLines.length;
      }
      continue;
    }

    // 0. Sub Program() / End Sub はメインラッパーなのでスキップ
    if (/^Sub\s+Program\s*\(\s*\)/i.test(trimmed)) {
      lineMap[vbaLineNum] = pyLines.length + 1;
      continue;
    }
    if (/^End\s+Sub$/i.test(trimmed) && !currentFunc) {
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 1. 変数宣言 Dim / ReDim はPythonでは型宣言不要のためスキップ
    if (/^(Dim|ReDim|Const)\b/i.test(trimmed)) {
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    const indentStr = '    '.repeat(indentLevel);

    // 2. ブロック終了: End Sub / End Function / End If / Next / Loop / Wend
    if (/^End\s+(Sub|Function)\b/i.test(trimmed)) {
      if (indentLevel > 0) indentLevel--;
      currentFunc = null;
      hasHandledReturnInFunc = false;
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

    // 3. 関数定義: Sub / Function (Program 以外)
    const funcMatch = trimmed.match(/^(?:Public\s+|Private\s+)?(Sub|Function)\s+([a-zA-Z_]\w*)\s*\((.*?)\)(?:\s+As\s+[a-zA-Z_]\w*)?/i);
    if (funcMatch && funcMatch[2] && funcMatch[3] !== undefined && funcMatch[2].toLowerCase() !== 'program') {
      const name = funcMatch[2];
      const params = funcMatch[3]
        .split(',')
        .map((p) => p.trim().replace(/^ByVal\s+|^ByRef\s+/i, '').split(/\s+As\s+/i)[0]?.trim() ?? '')
        .filter(Boolean)
        .join(', ');

      pyLines.push(`${'    '.repeat(indentLevel)}def ${name}(${params}):${inlineCommentSuffix}`);
      currentFunc = name;
      hasHandledReturnInFunc = false;
      indentLevel++;
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 4. If / ElseIf / Else
    const ifMatch = trimmed.match(/^If\s+(.*?)\s+Then$/i);
    if (ifMatch && ifMatch[1]) {
      const cond = convertVbaExprToPython(ifMatch[1].trim());
      pyLines.push(`${indentStr}if ${cond}:${inlineCommentSuffix}`);
      indentLevel++;
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    const elseIfMatch = trimmed.match(/^ElseIf\s+(.*?)\s+Then$/i);
    if (elseIfMatch && elseIfMatch[1]) {
      const prevIndent = Math.max(0, indentLevel - 1);
      const cond = convertVbaExprToPython(elseIfMatch[1].trim());
      pyLines.push(`${'    '.repeat(prevIndent)}elif ${cond}:${inlineCommentSuffix}`);
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    if (/^Else$/i.test(trimmed)) {
      const prevIndent = Math.max(0, indentLevel - 1);
      pyLines.push(`${'    '.repeat(prevIndent)}else:${inlineCommentSuffix}`);
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 5. For ループ: For i = start To stop [Step step]
    const forMatch = trimmed.match(/^For\s+([a-zA-Z_]\w*)\s*=\s*(.*?)\s+To\s+(.*?)(?:\s+Step\s+(.*?))?$/i);
    if (forMatch && forMatch[1] && forMatch[2] && forMatch[3]) {
      const loopVar = forMatch[1];
      const start = convertVbaExprToPython(forMatch[2].trim());
      const rawStop = forMatch[3].trim();
      const step = forMatch[4] ? convertVbaExprToPython(forMatch[4].trim()) : null;

      // "X - 1" の場合は X に復元、それ以外は "stop + 1"
      let stop = '';
      const minusOneMatch = rawStop.match(/^(.*?)\s*-\s*1$/);
      if (minusOneMatch && minusOneMatch[1]) {
        stop = convertVbaExprToPython(minusOneMatch[1].trim());
      } else {
        stop = `${convertVbaExprToPython(rawStop)} + 1`;
      }

      let rangeStr = '';
      if (start === '0' && !step) {
        rangeStr = `range(${stop})`;
      } else if (!step) {
        rangeStr = `range(${start}, ${stop})`;
      } else {
        rangeStr = `range(${start}, ${stop}, ${step})`;
      }

      pyLines.push(`${indentStr}for ${loopVar} in ${rangeStr}:${inlineCommentSuffix}`);
      indentLevel++;
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 6. Do While / While ループ
    const whileMatch = trimmed.match(/^(?:Do\s+While|While)\s+(.*)$/i);
    if (whileMatch && whileMatch[1]) {
      const cond = convertVbaExprToPython(whileMatch[1].trim());
      pyLines.push(`${indentStr}while ${cond}:${inlineCommentSuffix}`);
      indentLevel++;
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 7. 出力文: MsgBox / Debug.Print
    const msgBoxMatch = trimmed.match(/^(?:MsgBox|Debug\.Print)\s*(?:\((.*)\)|(.*))$/i);
    if (msgBoxMatch) {
      const expr = (msgBoxMatch[1] || msgBoxMatch[2] || '').trim();
      const pyExpr = convertVbaExprToPython(expr);
      pyLines.push(`${indentStr}print(${pyExpr})${inlineCommentSuffix}`);
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 8. 戻り値代入 (Function 内での funcName = expr)
    if (currentFunc) {
      const retAssignMatch = trimmed.match(new RegExp(`^${currentFunc}\\s*=\\s*(.*)$`, 'i'));
      if (retAssignMatch && retAssignMatch[1] !== undefined) {
        const retExpr = convertVbaExprToPython(retAssignMatch[1].trim());
        pyLines.push(`${indentStr}return ${retExpr}${inlineCommentSuffix}`);
        hasHandledReturnInFunc = true;
        lineMap[vbaLineNum] = pyLines.length;
        continue;
      }
    }

    // Exit Function / Exit Sub
    if (/^Exit\s+(Function|Sub)\b/i.test(trimmed)) {
      if (!hasHandledReturnInFunc) {
        pyLines.push(`${indentStr}return${inlineCommentSuffix}`);
      }
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // 9. 代入文
    const assignMatch = trimmed.match(/^([a-zA-Z_]\w*(?:\(.*?\)|\[.*?\])?)\s*=\s*(.*)$/);
    if (assignMatch && assignMatch[1] && assignMatch[2] !== undefined) {
      const target = assignMatch[1];
      const val = convertVbaExprToPython(assignMatch[2].trim());
      pyLines.push(`${indentStr}${target} = ${val}${inlineCommentSuffix}`);
      lineMap[vbaLineNum] = pyLines.length;
      continue;
    }

    // その他汎用
    const generalPy = convertVbaExprToPython(trimmed);
    pyLines.push(`${indentStr}${generalPy}${inlineCommentSuffix}`);
    lineMap[vbaLineNum] = pyLines.length;
  }

  // 不要な連続空行を整理しつつトリム
  const cleanedLines: string[] = [];
  let prevEmpty = false;
  for (const line of pyLines) {
    if (line.trim() === '') {
      if (!prevEmpty && cleanedLines.length > 0) {
        cleanedLines.push('');
      }
      prevEmpty = true;
    } else {
      cleanedLines.push(line);
      prevEmpty = false;
    }
  }

  while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1]?.trim() === '') {
    cleanedLines.pop();
  }

  return {
    code: cleanedLines.join('\n'),
    lineMap,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
