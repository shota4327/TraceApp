import { FlowchartNode, FlowchartNodeType, FlowchartEdge, FlowchartGraph } from '../types/flowchart';
import { splitLineComment } from './commentExtractor';

/**
 * ノード種別ごとの draw.io mxGraph スタイル文字列を返却
 */
function getMxStyleForType(type: FlowchartNodeType): string {
  switch (type) {
    case 'terminal':
      return 'rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#e2e8f0;strokeColor=#475569;';
    case 'process':
      return 'rounded=0;whiteSpace=wrap;html=1;fillColor=#eff6ff;strokeColor=#2563eb;';
    case 'decision':
      return 'rhombus;whiteSpace=wrap;html=1;fillColor=#fef3c7;strokeColor=#d97706;';
    case 'loop':
      return 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fixedSize=1;fillColor=#f3e8ff;strokeColor=#9333ea;';
    case 'subroutine':
      return 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;fillColor=#ecfdf5;strokeColor=#059669;';
    default:
      return 'whiteSpace=wrap;html=1;';
  }
}

/**
 * 特殊文字を XML エスケープ
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 端子ノード（開始・終了）の作成 helper */
function createTerminalNode(id: string, label: string, lineNo: number, yPos: number): FlowchartNode {
  const xmlStyle = getMxStyleForType('terminal');
  const escaped = escapeXml(label);
  return {
    id,
    type: 'terminal',
    label,
    lineRange: [lineNo, lineNo],
    x: 100,
    y: yPos,
    width: 180,
    height: 50,
    xmlSnippet: `<mxCell id="${id}" value="${escaped}" style="${xmlStyle}" vertex="1" parent="1"><mxGeometry x="100" y="${yPos}" width="180" height="50" as="geometry"/></mxCell>`,
  };
}

/** print文の引数をクォートや括弧を考慮して分割 */
function splitPrintArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let parenDepth = 0;

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i]!;
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
    } else if (!inSingleQuote && !inDoubleQuote) {
      if (char === '(' || char === '[' || char === '{') {
        parenDepth++;
      } else if (char === ')' || char === ']' || char === '}') {
        parenDepth--;
      } else if (char === ',' && parenDepth === 0) {
        if (current.trim()) args.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    } else {
      current += char;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

/** print文のラベル生成（例: print("数値", a) → "数値"とaを表示） */
export function formatPrintLabel(trimmed: string): string | null {
  const printMatch = trimmed.match(/^print\s*\(([\s\S]*)\)$/);
  if (!printMatch) return null;
  const content = printMatch[1]?.trim() || '';
  if (!content) return '表示';
  const args = splitPrintArgs(content);
  if (args.length === 0) return '表示';
  return `${args.join('と')}を表示`;
}

/**
 * 比較演算子・四則演算子を教科書的な全角数学記号に置換
 * - 比較: <= → ≦, >= → ≧, != → ≠, == → =
 * - 四則演算: + → ＋, - → －, * → ×, / → ÷
 * (文字列リテラル "..." / '...' の内部は置換対象外として保護)
 */
export function replaceMathOperators(expr: string): string {
  const stringLiterals: string[] = [];
  const placeholderPrefix = '__STR_LITERAL_';
  let tokenized = expr.replace(/(["'])(?:(?=(\\?))\2[\s\S])*?\1/g, (match) => {
    const idx = stringLiterals.length;
    stringLiterals.push(match);
    return `${placeholderPrefix}${idx}__`;
  });

  // 1. 比較演算子の置換
  tokenized = tokenized
    .replace(/<=/g, '≦')
    .replace(/>=/g, '≧')
    .replace(/!=/g, '≠')
    .replace(/==/g, '=');

  // 2. 四則演算子の置換 (+, -, *, /)
  tokenized = tokenized
    .replace(/\/\//g, '÷')
    .replace(/\//g, '÷')
    .replace(/\*\*/g, '^')
    .replace(/\*/g, '×')
    .replace(/\+/g, '＋')
    .replace(/-/g, '－');

  // 文字列リテラルの復元
  return tokenized.replace(new RegExp(`${placeholderPrefix}(\\d+)__`, 'g'), (_, idx) => {
    return stringLiterals[Number(idx)] || '';
  });
}

/**
 * 処理ブロックのラベル生成
 * 1. print文（例: print(grade)）→ 「gradeを表示」
 * 2. 累加代入文（例: a += 2）→ 「a ＋ 2 → a」
 * 3. 単純代入文（例: a = 4）→ 「4 → a」
 */
export function formatProcessLabel(trimmed: string): string {
  const printLabel = formatPrintLabel(trimmed);
  if (printLabel !== null) return printLabel;

  // 累加代入文 (+=, -=, *=, /=, //=, %=, **= 等)
  const augAssignMatch = trimmed.match(/^([^=<>!+\-*/%^&|]+?)\s*(\/\/|\*\*|[+\-*/%^&|]|<<|>>)=\s*(.+)$/);
  if (augAssignMatch && augAssignMatch[1] && augAssignMatch[2] && augAssignMatch[3]) {
    const lhsRaw = augAssignMatch[1].trim();
    const op = augAssignMatch[2].trim();
    const rhsRaw = augAssignMatch[3].trim();
    const lhs = replaceMathOperators(lhsRaw);
    const expandedRhs = replaceMathOperators(`${lhsRaw} ${op} ${rhsRaw}`);
    return `${expandedRhs} → ${lhs}`;
  }

  // 単純代入文 (=)
  const assignMatch = trimmed.match(/^([^=<>!+\-*/%^&|]+?)\s*=\s*([^=].*)$/);
  if (assignMatch && assignMatch[1] && assignMatch[2]) {
    const lhs = replaceMathOperators(assignMatch[1].trim());
    const rhs = replaceMathOperators(assignMatch[2].trim());
    return `${rhs} → ${lhs}`;
  }
  return replaceMathOperators(trimmed);
}

/** while文のラベル整形 */
function formatWhileLabel(trimmed: string, loopTitle = 'ループ'): string {
  const cond = trimmed.replace(/^while\s+/, '').replace(/:$/, '').trim();
  const mathCond = replaceMathOperators(cond);
  return `${loopTitle}\n${mathCond}の間`;
}

/** for文のrange引数解析とラベル整形 */
function formatForRange(varName: string, rangeContent: string, loopTitle = 'ループ'): string {
  const args = rangeContent.split(',').map((s) => s.trim()).filter(Boolean);
  const startStr = args.length >= 2 ? args[0]! : '0';
  const stopStr = args.length === 1 ? args[0]! : (args[1] || '0');
  const stepStr = args.length >= 3 ? args[2]! : '1';

  const stopNum = Number(stopStr);
  const stepNum = Number(stepStr);

  if (!isNaN(stopNum)) {
    if (!isNaN(stepNum) && stepNum < 0) {
      const actualEnd = stopNum + 1;
      const absStep = Math.abs(stepNum);
      return `${loopTitle}\n${varName}は${startStr}から${absStep}ずつ減らして${varName}≧${actualEnd}の間`;
    }
    const actualEnd = stopNum - 1;
    const stepVal = !isNaN(stepNum) ? stepNum : stepStr;
    return `${loopTitle}\n${varName}は${startStr}から${stepVal}ずつ増やして${varName}≦${actualEnd}の間`;
  }
  const stopFormatted = replaceMathOperators(`${stopStr}-1`);
  return `${loopTitle}\n${varName}は${startStr}から${stepStr}ずつ増やして${varName}≦${stopFormatted}の間`;
}

/** for文のラベル整形 */
function formatForLabel(trimmed: string, loopTitle = 'ループ'): string {
  const forMatch = trimmed.match(/^for\s+([a-zA-Z_]\w*)\s+in\s+range\s*\(([\s\S]*)\)\s*:?$/);
  if (forMatch && forMatch[1] && forMatch[2] !== undefined) {
    return formatForRange(forMatch[1], forMatch[2].trim(), loopTitle);
  }
  const genericMatch = trimmed.match(/^for\s+([a-zA-Z_]\w*)\s+in\s+([^:]+):?$/);
  if (genericMatch && genericMatch[1] && genericMatch[2]) {
    return `${loopTitle}\n${genericMatch[1]}を${genericMatch[2].trim()}から順に取り出す間`;
  }
  const raw = trimmed.replace(/:$/, '').trim();
  return `${loopTitle}\n${raw}の間`;
}

/** ループ文（for / while）のラベル生成 */
export function formatLoopLabel(trimmed: string, loopNumber?: number, totalLoops = 1): string {
  const loopTitle = totalLoops > 1 && loopNumber !== undefined ? `ループ${loopNumber}` : 'ループ';
  if (trimmed.startsWith('while ')) {
    return formatWhileLabel(trimmed, loopTitle);
  }
  if (trimmed.startsWith('for ')) {
    return formatForLabel(trimmed, loopTitle);
  }
  return trimmed;
}

interface ParsedLineInfo {
  text: string;
  lineNo: number;
  indent: number;
  comment?: string;
}

/** コード内のループ行番号と通し番号 (1, 2, ...) のマップを構築 */
export function analyzeLoopInfo(validLines: ParsedLineInfo[]): {
  totalLoops: number;
  loopNumberByLine: Map<number, number>;
} {
  const loopNumberByLine = new Map<number, number>();
  let count = 0;
  for (const line of validLines) {
    if (line.text.startsWith('for ') || line.text.startsWith('while ')) {
      count++;
      loopNumberByLine.set(line.lineNo, count);
    }
  }
  return { totalLoops: count, loopNumberByLine };
}

/** コード文字列を解析用行配列に分解 */
function parseValidLines(code: string): ParsedLineInfo[] {
  const rawLines = code.split('\n');
  const validLines: ParsedLineInfo[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const text = rawLines[i] || '';
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const { codePart, comment } = splitLineComment(trimmed);
    if (!codePart) continue;
    const indent = text.search(/\S/);
    validLines.push({ text: codePart, lineNo: i + 1, indent: indent >= 0 ? indent : 0, comment });
  }
  return validLines;
}

/** ループ終了ノードを生成 */
function createLoopEndNode(
  headerId: string,
  yPos: number,
  loopNumber?: number,
  totalLoops = 1
): FlowchartNode {
  const id = `node-loop-end-${headerId}`;
  const label = totalLoops > 1 && loopNumber !== undefined ? `ループ${loopNumber}` : 'ループ';
  const xmlStyle = getMxStyleForType('loop');
  const escaped = escapeXml(label);
  const xmlSnippet = `<mxCell id="${id}" value="${escaped}" style="${xmlStyle}" vertex="1" parent="1"><mxGeometry x="100" y="${yPos}" width="180" height="50" as="geometry"/></mxCell>`;

  return {
    id,
    type: 'loop',
    label,
    lineRange: [1, 1],
    x: 100,
    y: yPos,
    width: 180,
    height: 50,
    xmlSnippet,
  };
}

interface BlockContext {
  type: 'if' | 'loop';
  headerId: string;
  indent: number;
  mergeTargets: string[];
  bodyLastId?: string;
  isElse?: boolean;
  loopNumber?: number;
  totalLoops?: number;
}

/** ループブロック終了時のノードおよびエッジ生成 helper */
function processPoppedLoopBlock(
  popped: BlockContext,
  targetId: string,
  edges: FlowchartEdge[],
  nodes: FlowchartNode[]
): string {
  const loopEndNode = createLoopEndNode(popped.headerId, nodes.length * 60 + 20, popped.loopNumber, popped.totalLoops);
  nodes.push(loopEndNode);

  if (popped.bodyLastId) {
    if (!edges.some((e) => e.sourceId === popped.bodyLastId && e.targetId === loopEndNode.id)) {
      edges.push({
        id: `edge-${popped.bodyLastId}-${loopEndNode.id}`,
        sourceId: popped.bodyLastId,
        targetId: loopEndNode.id,
        label: 'Next',
      });
    }
    edges.push({
      id: `edge-loopback-${popped.bodyLastId}-${popped.headerId}`,
      sourceId: popped.bodyLastId,
      targetId: popped.headerId,
      label: 'Loop',
    });
  }
  edges.push({
    id: `edge-loop-exit-${popped.headerId}-${loopEndNode.id}`,
    sourceId: popped.headerId,
    targetId: loopEndNode.id,
    label: 'False',
  });

  if (targetId && targetId !== loopEndNode.id && !edges.some((e) => e.sourceId === loopEndNode.id && e.targetId === targetId)) {
    edges.push({
      id: `edge-${loopEndNode.id}-${targetId}`,
      sourceId: loopEndNode.id,
      targetId,
      label: 'Next',
    });
  }
  return loopEndNode.id;
}

/** ifブロック終了時のエッジ生成 helper */
function processPoppedIfBlock(
  popped: BlockContext,
  targetId: string,
  edges: FlowchartEdge[]
): void {
  if (!popped.isElse && !edges.some((e) => e.sourceId === popped.headerId && (e.label === 'False' || e.label === 'Next'))) {
    edges.push({
      id: `edge-false-${popped.headerId}-${targetId}`,
      sourceId: popped.headerId,
      targetId,
      label: 'False',
    });
  }
  const allMergeTargets = [...popped.mergeTargets];
  if (popped.bodyLastId && !allMergeTargets.includes(popped.bodyLastId)) {
    allMergeTargets.push(popped.bodyLastId);
  }
  for (const srcId of allMergeTargets) {
    if (srcId !== targetId && !edges.some((e) => e.sourceId === srcId && e.targetId === targetId)) {
      edges.push({
        id: `edge-if-merge-${srcId}-${targetId}`,
        sourceId: srcId,
        targetId,
        label: 'Next',
      });
    }
  }
}

/** ブロック終了時のエッジ生成処理 helper */
function processPoppedBlock(
  popped: BlockContext,
  targetId: string,
  edges: FlowchartEdge[],
  nodes: FlowchartNode[]
): string {
  if (popped.type === 'loop') {
    return processPoppedLoopBlock(popped, targetId, edges, nodes);
  }
  if (popped.type === 'if') {
    processPoppedIfBlock(popped, targetId, edges);
  }
  return targetId;
}

/** 単一ノードの制御分岐エッジ生成 helper */
function processLineNodeEdge(
  node: FlowchartNode,
  prevNodeId: string,
  startNodeId: string,
  nextLine: ParsedLineInfo | undefined,
  lineIndent: number,
  blockStack: BlockContext[],
  edges: FlowchartEdge[],
  inheritedMergeTargets: string[] = [],
  loopNumber?: number,
  totalLoops = 1
): void {
  const nextNodeId = nextLine ? `node-${nextLine.lineNo}` : 'node-end';
  const isElse = node.label === 'else';
  const isElif = node.label.startsWith('elif ');

  if (node.type === 'decision') {
    edges.push({ id: `edge-true-${node.id}-${nextNodeId}`, sourceId: node.id, targetId: nextNodeId, label: 'True' });
    if (!isElif && !isElse && prevNodeId !== startNodeId && !edges.some((e) => e.targetId === node.id)) {
      edges.push({ id: `edge-${prevNodeId}-${node.id}`, sourceId: prevNodeId, targetId: node.id, label: 'Next' });
    }
    blockStack.push({
      type: 'if',
      headerId: node.id,
      indent: lineIndent,
      mergeTargets: inheritedMergeTargets,
      isElse,
    });
  } else if (node.type === 'loop') {
    edges.push({ id: `edge-loop-body-${node.id}-${nextNodeId}`, sourceId: node.id, targetId: nextNodeId, label: 'Next' });
    if (prevNodeId !== startNodeId && !edges.some((e) => e.targetId === node.id)) {
      edges.push({ id: `edge-${prevNodeId}-${node.id}`, sourceId: prevNodeId, targetId: node.id, label: 'Next' });
    }
    blockStack.push({
      type: 'loop',
      headerId: node.id,
      indent: lineIndent,
      mergeTargets: [],
      loopNumber,
      totalLoops,
    });
  } else {
    if (prevNodeId && !edges.some((e) => e.sourceId === prevNodeId && e.targetId === node.id) && !edges.some((e) => e.targetId === node.id && (e.label === 'True' || e.label === 'False'))) {
      edges.push({ id: `edge-${prevNodeId}-${node.id}`, sourceId: prevNodeId, targetId: node.id, label: 'Next' });
    }
  }
}

/** 空のコード時のデフォルトグラフレイアウト */
function buildDefaultGraph(): FlowchartGraph {
  const startNode = createTerminalNode('node-start', '開始', 1, 20);
  const endNode = createTerminalNode('node-end', '終了', 1, 80);
  const defaultEdge: FlowchartEdge = {
    id: 'edge-start-end',
    sourceId: 'node-start',
    targetId: 'node-end',
    label: 'Next',
  };
  return { nodes: [startNode, endNode], edges: [defaultEdge] };
}

/** インデント減少時のブロックスタック巻き戻し処理 */
function handleBlockStackUnwind(
  line: ParsedLineInfo,
  nodeId: string,
  blockStack: BlockContext[],
  edges: FlowchartEdge[],
  nodes: FlowchartNode[]
): { inheritedMergeTargets: string[]; lastPoppedId?: string; poppedHeaderId?: string } {
  const isElif = line.text.startsWith('elif ');
  const isElse = line.text.startsWith('else:');
  const isIfChainContinuation = isElif || isElse;
  let inheritedMergeTargets: string[] = [];
  let lastPoppedId: string | undefined;
  let poppedHeaderId: string | undefined;

  while (blockStack.length > 0 && line.indent <= blockStack[blockStack.length - 1]!.indent) {
    const top = blockStack[blockStack.length - 1]!;
    if (isIfChainContinuation && top.type === 'if' && line.indent === top.indent) {
      const popped = blockStack.pop()!;
      poppedHeaderId = popped.headerId;
      if (!edges.some((e) => e.sourceId === popped.headerId && e.label === 'False')) {
        edges.push({
          id: `edge-false-${popped.headerId}-${nodeId}`,
          sourceId: popped.headerId,
          targetId: nodeId,
          label: 'False',
        });
      }
      const updatedMergeTargets = [...popped.mergeTargets];
      if (popped.bodyLastId && !updatedMergeTargets.includes(popped.bodyLastId)) {
        updatedMergeTargets.push(popped.bodyLastId);
      }
      inheritedMergeTargets = updatedMergeTargets;
      break;
    } else {
      lastPoppedId = processPoppedBlock(blockStack.pop()!, nodeId, edges, nodes);
    }
  }
  return { inheritedMergeTargets, lastPoppedId, poppedHeaderId };
}

/** else行の処理 helper */
function handleElseLine(
  line: ParsedLineInfo,
  nextLine: ParsedLineInfo | undefined,
  blockStack: BlockContext[],
  edges: FlowchartEdge[],
  nodes: FlowchartNode[]
): void {
  const nextTargetId = nextLine ? `node-${nextLine.lineNo}` : 'node-end';
  const { inheritedMergeTargets, poppedHeaderId } = handleBlockStackUnwind(line, nextTargetId, blockStack, edges, nodes);
  if (poppedHeaderId) {
    blockStack.push({
      type: 'if',
      headerId: poppedHeaderId,
      indent: line.indent,
      mergeTargets: inheritedMergeTargets,
      isElse: true,
    });
  }
}

interface FunctionBlockInfo {
  name: string;
  defLine: ParsedLineInfo;
  bodyLines: ParsedLineInfo[];
}

/** コード全体から定義されている関数ブロックとメイン行を分離 */
function partitionCodeLines(validLines: ParsedLineInfo[]): {
  functionBlocks: FunctionBlockInfo[];
  mainLines: ParsedLineInfo[];
  definedFuncNames: Set<string>;
} {
  const functionBlocks: FunctionBlockInfo[] = [];
  const mainLines: ParsedLineInfo[] = [];
  const definedFuncNames = new Set<string>();

  let i = 0;
  while (i < validLines.length) {
    const line = validLines[i]!;
    const defMatch = line.indent === 0 ? line.text.match(/^def\s+([a-zA-Z_]\w*)\s*\(/) : null;
    if (defMatch) {
      const funcName = defMatch[1]!;
      definedFuncNames.add(funcName);
      const bodyLines: ParsedLineInfo[] = [];
      let j = i + 1;
      while (j < validLines.length && validLines[j]!.indent > 0) {
        bodyLines.push(validLines[j]!);
        j++;
      }
      functionBlocks.push({ name: funcName, defLine: line, bodyLines });
      i = j;
    } else {
      mainLines.push(line);
      i++;
    }
  }

  return { functionBlocks, mainLines, definedFuncNames };
}

/** 関数呼び出し（返り値なし vs 返り値あり）の判定 helper */
function classifyFunctionCall(
  trimmed: string,
  definedFuncNames?: Set<string>
): { type: FlowchartNodeType; label: string; subType?: 'function-terminal' | 'function-call-return' } | null {
  if (definedFuncNames) {
    for (const fn of definedFuncNames) {
      if (new RegExp(`^${fn}\\s*\\(`).test(trimmed)) {
        return { type: 'subroutine', label: formatProcessLabel(trimmed) };
      }
      if (new RegExp(`^[a-zA-Z_]\\w*\\s*=\\s*.*\\b${fn}\\s*\\(`).test(trimmed)) {
        return { type: 'process', subType: 'function-call-return', label: formatProcessLabel(trimmed) };
      }
    }
  }
  // 未登録関数でも print 以外の単体呼び出し (例: reset(), draw(x, y))
  const directCall = trimmed.match(/^([a-zA-Z_]\w*)\s*\([^)]*\)$/);
  if (directCall && directCall[1] !== 'print') {
    return { type: 'subroutine', label: formatProcessLabel(trimmed) };
  }
  return null;
}

/** 1行のコード文字列からノード種別とラベルを決定 */
function classifyLine(
  trimmed: string,
  loopNumber?: number,
  totalLoops = 1,
  definedFuncNames?: Set<string>
): { type: FlowchartNodeType; label: string; subType?: 'function-terminal' | 'function-call-return' } {
  if (trimmed.startsWith('def ')) {
    return { type: 'terminal', subType: 'function-terminal', label: trimmed.replace(/^def\s+/, '').replace(/:$/, '').trim() };
  }
  if (trimmed.startsWith('return ') || trimmed === 'return') {
    return { type: 'terminal', subType: 'function-terminal', label: trimmed };
  }
  if (trimmed.startsWith('if ')) {
    return { type: 'decision', label: replaceMathOperators(trimmed.replace(/^if\s+/, '').replace(/:$/, '').trim()) };
  }
  if (trimmed.startsWith('elif ')) {
    return { type: 'decision', label: replaceMathOperators(trimmed.replace(/^elif\s+/, '').replace(/:$/, '').trim()) };
  }
  if (trimmed.startsWith('else:')) {
    return { type: 'decision', label: 'else' };
  }
  if (trimmed.startsWith('for ') || trimmed.startsWith('while ')) {
    return { type: 'loop', label: formatLoopLabel(trimmed, loopNumber, totalLoops) };
  }
  const callResult = classifyFunctionCall(trimmed, definedFuncNames);
  if (callResult) return callResult;

  return { type: 'process', label: formatProcessLabel(trimmed) };
}

/** 1行から FlowchartNode を生成 */
function createNodeForLine(
  trimmed: string,
  lineNo: number,
  yPos: number,
  loopNumber?: number,
  totalLoops = 1,
  definedFuncNames?: Set<string>,
  comment?: string
): FlowchartNode {
  const { type, label, subType } = classifyLine(trimmed, loopNumber, totalLoops, definedFuncNames);
  const id = `node-${lineNo}`;
  const xmlStyle = getMxStyleForType(type);
  const escaped = escapeXml(label);
  const xmlSnippet = `<mxCell id="${id}" value="${escaped}" style="${xmlStyle}" vertex="1" parent="1"><mxGeometry x="100" y="${yPos}" width="180" height="50" as="geometry"/></mxCell>`;

  return {
    id,
    type,
    label,
    subType,
    comment,
    lineRange: [lineNo, lineNo],
    x: 100,
    y: yPos,
    width: 180,
    height: 50,
    xmlSnippet,
  };
}

/** 単一の一連の行群（メインまたは関数ブロック）をグラフ化 */
function buildLinearGraph(
  lines: ParsedLineInfo[],
  startNode: FlowchartNode,
  endNode: FlowchartNode | null,
  loopNumberByLine: Map<number, number>,
  totalLoops: number,
  definedFuncNames: Set<string>
): { nodes: FlowchartNode[]; edges: FlowchartEdge[] } {
  const nodes: FlowchartNode[] = [startNode];
  const edges: FlowchartEdge[] = [];
  let prevNodeId = startNode.id;
  const blockStack: BlockContext[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.text.startsWith('else:')) {
      handleElseLine(line, lines[i + 1], blockStack, edges, nodes);
    } else {
      const loopNumber = loopNumberByLine.get(line.lineNo);
      const { inheritedMergeTargets, lastPoppedId } = handleBlockStackUnwind(line, `node-${line.lineNo}`, blockStack, edges, nodes);
      const effectivePrevId = lastPoppedId || prevNodeId;
      const node = createNodeForLine(line.text, line.lineNo, nodes.length * 60 + 20, loopNumber, totalLoops, definedFuncNames, line.comment);
      nodes.push(node);
      processLineNodeEdge(node, effectivePrevId, startNode.id, lines[i + 1], line.indent, blockStack, edges, inheritedMergeTargets, loopNumber, totalLoops);

      if (blockStack.length > 0) {
        const top = blockStack[blockStack.length - 1]!;
        top.bodyLastId = node.id;
      }
      prevNodeId = node.id;
    }
  }

  if (endNode) {
    let lastPoppedId: string | undefined;
    while (blockStack.length > 0) {
      lastPoppedId = processPoppedBlock(blockStack.pop()!, endNode.id, edges, nodes);
    }
    nodes.push(endNode);
    const effectivePrevId = lastPoppedId || prevNodeId;
    if (!edges.some((e) => e.targetId === endNode.id) && effectivePrevId && effectivePrevId !== endNode.id) {
      edges.push({ id: `edge-${effectivePrevId}-${endNode.id}`, sourceId: effectivePrevId, targetId: endNode.id, label: 'Next' });
    }
  }

  return { nodes, edges };
}

/** 各関数ブロックのグラフを構築する helper */
function buildFunctionGraphs(
  functionBlocks: FunctionBlockInfo[],
  loopNumberByLine: Map<number, number>,
  totalLoops: number,
  definedFuncNames: Set<string>
): { nodes: FlowchartNode[]; edges: FlowchartEdge[] } {
  const allNodes: FlowchartNode[] = [];
  const allEdges: FlowchartEdge[] = [];

  for (const fn of functionBlocks) {
    const defNode = createNodeForLine(fn.defLine.text, fn.defLine.lineNo, 20, undefined, totalLoops, definedFuncNames, fn.defLine.comment);
    const lastBodyLine = fn.bodyLines[fn.bodyLines.length - 1];
    const hasReturnAtEnd = lastBodyLine && (lastBodyLine.text.startsWith('return ') || lastBodyLine.text === 'return');

    let funcEndNode: FlowchartNode | null = null;
    let bodyLinesToProcess = fn.bodyLines;

    if (hasReturnAtEnd) {
      bodyLinesToProcess = fn.bodyLines.slice(0, -1);
      funcEndNode = createNodeForLine(lastBodyLine.text, lastBodyLine.lineNo, 80, undefined, totalLoops, definedFuncNames);
    } else {
      const endLineNo = lastBodyLine?.lineNo || fn.defLine.lineNo;
      funcEndNode = {
        id: `node-func-end-${fn.defLine.lineNo}`,
        type: 'terminal',
        subType: 'function-terminal',
        label: '終了',
        lineRange: [endLineNo, endLineNo],
        x: 100,
        y: 80,
        width: 180,
        height: 50,
      };
    }

    const funcGraph = buildLinearGraph(bodyLinesToProcess, defNode, funcEndNode, loopNumberByLine, totalLoops, definedFuncNames);
    allNodes.push(...funcGraph.nodes);
    allEdges.push(...funcGraph.edges);
  }

  return { nodes: allNodes, edges: allEdges };
}

/**
 * Pythonコードから FlowchartGraph (ノード・エッジ構造) を自動生成
 * - メイン処理: 「開始」から「終了」
 * - 関数: 右側に独立した列として「def ...」から「return ...」（または「終了」）
 */
export function generateFlowchartGraph(code: string): FlowchartGraph {
  if (!code || !code.trim()) return buildDefaultGraph();

  const validLines = parseValidLines(code);
  const { totalLoops, loopNumberByLine } = analyzeLoopInfo(validLines);
  const { functionBlocks, mainLines, definedFuncNames } = partitionCodeLines(validLines);

  const mainStartNode = createTerminalNode('node-start', '開始', mainLines[0]?.lineNo || 1, 20);
  const mainEndNode = createTerminalNode('node-end', '終了', validLines[validLines.length - 1]?.lineNo || 1, 80);
  const mainGraph = buildLinearGraph(mainLines, mainStartNode, mainEndNode, loopNumberByLine, totalLoops, definedFuncNames);

  const funcGraphs = buildFunctionGraphs(functionBlocks, loopNumberByLine, totalLoops, definedFuncNames);

  return {
    nodes: [...mainGraph.nodes, ...funcGraphs.nodes],
    edges: [...mainGraph.edges, ...funcGraphs.edges],
  };
}

/** Pythonコードから FlowchartNode[] 配列を生成 */
export function generateFlowchartNodes(code: string): FlowchartNode[] {
  return generateFlowchartGraph(code).nodes;
}

/** FlowchartNode[] および FlowchartEdge[] から draw.io mxGraph XML を自動作成 */
export function generateDrawIoXml(
  nodesOrGraph: FlowchartNode[] | FlowchartGraph,
  edgesParam?: FlowchartEdge[]
): string {
  const nodes = Array.isArray(nodesOrGraph) ? nodesOrGraph : nodesOrGraph.nodes;
  const edges = Array.isArray(nodesOrGraph) ? edgesParam || [] : nodesOrGraph.edges;

  const vertexXmls = nodes
    .map(
      (node) =>
        node.xmlSnippet ||
        `<mxCell id="${node.id}" value="${escapeXml(node.label)}" style="${getMxStyleForType(
          node.type
        )}" vertex="1" parent="1"><mxGeometry x="${node.x || 100}" y="${node.y || 20}" width="${
          node.width || 180
        }" height="${node.height || 50}" as="geometry"/></mxCell>`
    )
    .join('\n    ');

  const edgeXmls = edges
    .map((edge) => {
      const valStr = edge.label ? ` value="${escapeXml(edge.label)}"` : '';
      const styleStr = edge.style || 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;';
      return `<mxCell id="${edge.id}"${valStr} style="${styleStr}" edge="1" parent="1" source="${edge.sourceId}" target="${edge.targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
    })
    .join('\n    ');

  const allCells = edgeXmls ? `${vertexXmls}\n    ${edgeXmls}` : vertexXmls;

  return `<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    ${allCells}
  </root>
</mxGraphModel>`;
}
