import React from 'react';
import { FlowchartNode, FlowchartEdge } from '../types/flowchart';

export interface RenderOptions {
  width?: number;
  height?: number;
  activeLine?: number;
  activeNodeId?: string;
  edges?: FlowchartEdge[];
}

/** ノードが現在アクティブか判定 */
export function isNodeActive(
  node: FlowchartNode,
  activeLine?: number,
  activeNodeId?: string
): boolean {
  if (activeNodeId && node.id === activeNodeId) return true;
  if (node.type === 'terminal' || node.id.includes('loop-end')) return false;
  if (
    activeLine !== undefined &&
    node.lineRange &&
    node.lineRange[0] <= node.lineRange[1] &&
    activeLine >= node.lineRange[0] &&
    activeLine <= node.lineRange[1]
  ) return true;
  return false;
}

/** 端子ノード (Terminal Node) の描画 */
export function renderTerminalNode(
  node: FlowchartNode,
  x: number,
  y: number,
  width: number,
  height: number,
  isActive: boolean,
  commonProps: React.HTMLAttributes<SVGGElement>,
  textElement: React.ReactNode
): React.ReactNode {
  const isFuncTerminal = node.subType === 'function-terminal' || node.label.startsWith('def ') || node.label.startsWith('return');
  const fill = isActive ? '#dbeafe' : isFuncTerminal ? '#ecfdf5' : '#f1f5f9';
  const stroke = isActive ? '#2563eb' : isFuncTerminal ? '#059669' : '#64748b';
  return (
    <g key={node.id} {...commonProps} className={`flowchart-node ${isActive ? 'active' : ''}`}>
      <rect x={x} y={y} width={width} height={height} rx={22} ry={22} fill={fill} stroke={stroke} strokeWidth={isActive ? 3 : 2} />
      {textElement}
    </g>
  );
}

/** 処理ノード (Process Node) の描画 */
export function renderProcessNode(
  node: FlowchartNode,
  x: number,
  y: number,
  width: number,
  height: number,
  isActive: boolean,
  commonProps: React.HTMLAttributes<SVGGElement>,
  textElement: React.ReactNode
): React.ReactNode {
  const isFuncCallReturn = node.subType === 'function-call-return';
  const fill = isActive ? '#eff6ff' : '#ffffff';
  const stroke = isActive ? '#2563eb' : isFuncCallReturn ? '#059669' : '#3b82f6';
  return (
    <g key={node.id} {...commonProps} className={`flowchart-node ${isActive ? 'active' : ''}`}>
      <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill={fill} stroke={stroke} strokeWidth={isActive ? 3 : 2} />
      {textElement}
    </g>
  );
}

/** 判断ノード (Decision Node) の描画 */
export function renderDecisionNode(
  node: FlowchartNode,
  x: number,
  y: number,
  width: number,
  height: number,
  isActive: boolean,
  commonProps: React.HTMLAttributes<SVGGElement>,
  textElement: React.ReactNode,
  cx: number,
  cy: number
): React.ReactNode {
  const points = `${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}`;
  return (
    <g key={node.id} {...commonProps} className={`flowchart-node ${isActive ? 'active' : ''}`}>
      <polygon points={points} fill={isActive ? '#fef3c7' : '#fffbeb'} stroke={isActive ? '#d97706' : '#f59e0b'} strokeWidth={isActive ? 3 : 2} />
      {textElement}
    </g>
  );
}

/** ループノード (Loop Node) の描画 (JIS X 0121 規格: 開始は上部角カット、終了は下部角カット) */
export function renderLoopNode(
  node: FlowchartNode,
  x: number,
  y: number,
  width: number,
  height: number,
  isActive: boolean,
  commonProps: React.HTMLAttributes<SVGGElement>,
  textElement: React.ReactNode,
  _cy: number
): React.ReactNode {
  const offsetX = 18;
  const cutY = 14;
  const isLoopEnd = node.id.includes('loop-end');

  let points: string;
  if (isLoopEnd) {
    // ループ終了（下部左右の角を斜めにカット）
    points = `${x},${y} ${x + width},${y} ${x + width},${y + height - cutY} ${x + width - offsetX},${y + height} ${x + offsetX},${y + height} ${x},${y + height - cutY}`;
  } else {
    // ループ開始（上部左右の角を斜めにカット）
    points = `${x + offsetX},${y} ${x + width - offsetX},${y} ${x + width},${y + cutY} ${x + width},${y + height} ${x},${y + height} ${x},${y + cutY}`;
  }

  return (
    <g key={node.id} {...commonProps} className={`flowchart-node ${isActive ? 'active' : ''}`}>
      <polygon points={points} fill={isActive ? '#f3e8ff' : '#faf5ff'} stroke={isActive ? '#9333ea' : '#a855f7'} strokeWidth={isActive ? 3 : 2} />
      {textElement}
    </g>
  );
}

/** サブルーチンノード (Subroutine Node) の描画 */
export function renderSubroutineNode(
  node: FlowchartNode,
  x: number,
  y: number,
  width: number,
  height: number,
  isActive: boolean,
  commonProps: React.HTMLAttributes<SVGGElement>,
  textElement: React.ReactNode
): React.ReactNode {
  return (
    <g key={node.id} {...commonProps} className={`flowchart-node ${isActive ? 'active' : ''}`}>
      <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill={isActive ? '#ecfdf5' : '#f0fdf4'} stroke={isActive ? '#059669' : '#10b981'} strokeWidth={isActive ? 3 : 2} />
      <line x1={x + 16} y1={y} x2={x + 16} y2={y + height} stroke={isActive ? '#059669' : '#10b981'} strokeWidth={2} />
      <line x1={x + width - 16} y1={y} x2={x + width - 16} y2={y + height} stroke={isActive ? '#059669' : '#10b981'} strokeWidth={2} />
      {textElement}
    </g>
  );
}

/** デフォルトノード描画 */
export function renderDefaultNode(
  node: FlowchartNode,
  x: number,
  y: number,
  width: number,
  height: number,
  isActive: boolean,
  commonProps: React.HTMLAttributes<SVGGElement>,
  textElement: React.ReactNode
): React.ReactNode {
  return (
    <g key={node.id} {...commonProps} className={`flowchart-node ${isActive ? 'active' : ''}`}>
      <rect x={x} y={y} width={width} height={height} fill="#ffffff" stroke="#94a3b8" strokeWidth={1} />
      {textElement}
    </g>
  );
}

/** トークンの表示幅ユニット（全角=1.0, 半角=0.55）を算出 */
function calcTokenUnits(token: string): number {
  let units = 0;
  for (let i = 0; i < token.length; i++) {
    units += token.charCodeAt(i) <= 0x7e ? 0.55 : 1.0;
  }
  return units;
}

/** 文字列を変数名・数値・演算子・記号・空白のトークン列に分割 */
function tokenizeLabel(text: string): string[] {
  const matches = text.match(/[a-zA-Z_][a-zA-Z0-9_]*|\d+(?:\.\d+)?|→|＝|＋|－|×|÷|\^|％|≠|≦|≧|[=+\-*/%^<>!]+|\s+|[^\s\w]/gu);
  return matches ? Array.from(matches) : [text];
}

/** トークン列を行幅制限（maxUnitsPerLine）に収まるよう行分割 */
function wrapTokensIntoLines(tokens: string[], maxUnitsPerLine: number): string[] {
  const lines: string[] = [];
  let currentLine = '';
  let currentUnits = 0;

  for (const token of tokens) {
    const isSpace = /^\s+$/.test(token);
    const tokenUnits = calcTokenUnits(token);

    if (currentLine.length === 0) {
      if (isSpace) continue;
      currentLine = token;
      currentUnits = tokenUnits;
    } else if (currentUnits + tokenUnits <= maxUnitsPerLine) {
      currentLine += token;
      currentUnits += tokenUnits;
    } else {
      lines.push(currentLine.trimEnd());
      if (isSpace) {
        currentLine = '';
        currentUnits = 0;
      } else {
        currentLine = token;
        currentUnits = tokenUnits;
      }
    }
  }
  if (currentLine.trimEnd().length > 0) {
    lines.push(currentLine.trimEnd());
  }
  return lines.length > 0 ? lines : [''];
}

/** 改行コードおよびトークン単位（単語・記号区切り）に基づき行分割 */
export function wrapProcessLabel(text: string, maxUnitsPerLine = 9.5): string[] {
  if (!text) return [''];
  const rawLines = text.split('\n');
  const allLines: string[] = [];

  for (const rawLine of rawLines) {
    if (!rawLine.trim()) {
      allLines.push('');
      continue;
    }
    const tokens = tokenizeLabel(rawLine);
    const wrapped = wrapTokensIntoLines(tokens, maxUnitsPerLine);
    allLines.push(...wrapped);
  }
  return allLines;
}

/** ノードの必要高さを計算（複数行の場合は高さを自動拡大） */
export function calculateNodeHeight(node: FlowchartNode, baseHeight = 50): number {
  if (node.type === 'process' || node.type === 'loop' || node.label.includes('\n')) {
    const lines = wrapProcessLabel(node.label);
    if (lines.length > 1) {
      return Math.max(baseHeight, 16 + lines.length * 20);
    }
  }
  return baseHeight;
}

/** ノードのテキスト要素（単一行／複数行）を生成 */
function createNodeTextElement(
  node: FlowchartNode,
  cx: number,
  cy: number,
  isActive: boolean
): React.ReactNode {
  const fontStyle = {
    pointerEvents: 'none' as const,
    userSelect: 'none' as const,
    fontFamily: '"BIZ UDPGothic", "BIZ UDPゴシック", sans-serif',
  };
  const fill = isActive ? '#1e293b' : '#334155';
  const fontWeight = isActive ? 700 : 500;

  if (node.type === 'process' || node.type === 'loop' || node.label.includes('\n')) {
    const lines = wrapProcessLabel(node.label);
    if (lines.length > 1) {
      const lineHeight = 20;
      const startY = cy - ((lines.length - 1) * lineHeight) / 2;
      return (
        <text x={cx} y={startY} textAnchor="middle" dominantBaseline="central" fill={fill} fontSize={16} fontWeight={fontWeight} style={fontStyle}>
          {lines.map((line, idx) => (
            <tspan key={idx} x={cx} dy={idx === 0 ? 0 : lineHeight}>
              {line}
            </tspan>
          ))}
        </text>
      );
    }
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={fill} fontSize={16} fontWeight={fontWeight} style={fontStyle}>
        {lines[0] || node.label}
      </text>
    );
  }

  const labelText = node.label.length > 24 ? node.label.slice(0, 22) + '...' : node.label;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={fill} fontSize={16} fontWeight={fontWeight} style={fontStyle}>
      {labelText}
    </text>
  );
}

/** 各ノードのコメント注釈テキスト要素を生成 */
function createNodeCommentElement(
  node: FlowchartNode,
  x: number,
  y: number,
  width: number,
  height: number
): React.ReactNode {
  if (!node.comment) return null;
  const commentX = x + width + 10;
  const isDecision = node.type === 'decision';
  const commentY = isDecision ? y + height - 6 : y + height / 2;

  return (
    <text
      x={commentX}
      y={commentY}
      textAnchor="start"
      dominantBaseline="central"
      fill="#475569"
      fontSize={14}
      fontWeight={600}
      className="flowchart-comment"
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: '"BIZ UDPGothic", "BIZ UDPゴシック", sans-serif',
      }}
    >
      {node.comment}
    </text>
  );
}

/** 各ノードタイプに応じた SVG 要素の描画振り分けメイン関数 */
export function renderNodeShape(
  node: FlowchartNode,
  x: number,
  y: number,
  width: number,
  height: number,
  isActive: boolean
): React.ReactNode {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const commonProps = {
    'data-testid': `flowchart-node-${node.type}`,
    'data-node-id': node.id,
    'data-active': isActive ? 'true' : 'false',
    role: 'graphics-symbol',
    'aria-label': `ノード ${node.label} (${node.type})`,
  };
  const textElement = createNodeTextElement(node, cx, cy, isActive);
  const commentElement = createNodeCommentElement(node, x, y, width, height);

  let shapeElement: React.ReactNode;
  switch (node.type) {
    case 'terminal': shapeElement = renderTerminalNode(node, x, y, width, height, isActive, commonProps, textElement); break;
    case 'process': shapeElement = renderProcessNode(node, x, y, width, height, isActive, commonProps, textElement); break;
    case 'decision': shapeElement = renderDecisionNode(node, x, y, width, height, isActive, commonProps, textElement, cx, cy); break;
    case 'loop': shapeElement = renderLoopNode(node, x, y, width, height, isActive, commonProps, textElement, cy); break;
    case 'subroutine': shapeElement = renderSubroutineNode(node, x, y, width, height, isActive, commonProps, textElement); break;
    default: shapeElement = renderDefaultNode(node, x, y, width, height, isActive, commonProps, textElement); break;
  }

  if (!commentElement) return shapeElement;
  return (
    <g key={`node-group-${node.id}`}>
      {shapeElement}
      {commentElement}
    </g>
  );
}

/** SVG の defs 定義描画 */
function renderSvgDefs(): React.ReactNode {
  return (
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#64748b" /></marker>
      <marker id="arrowhead-active" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#2563eb" /></marker>
      <marker id="arrowhead-true" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#16a34a" /></marker>
      <marker id="arrowhead-false" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#d97706" /></marker>
      <marker id="arrowhead-loop" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#9333ea" /></marker>
    </defs>
  );
}

interface NodeBox { x: number; y: number; w: number; h: number; col: number; index: number }

/** ノード群をメイン処理と各関数ブロックに分割 */
function partitionNodeGroups(nodes: FlowchartNode[]): FlowchartNode[][] {
  const groups: FlowchartNode[][] = [];
  let currentGroup: FlowchartNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    // node-start はメイングループの開始
    if (node.id === 'node-start') {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [node];
    } else if (node.subType === 'function-terminal' && (node.id.includes('def') || (!node.label.startsWith('return') && node.label !== '終了'))) {
      // 関数開始端子は新規関数グループの開始
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [node];
    } else {
      currentGroup.push(node);
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);
  return groups;
}

/** 単一グループ内のノード所属カラムを算出 */
function calculateGroupColumns(groupNodes: FlowchartNode[], edges?: FlowchartEdge[]): number[] {
  const cols = new Array(groupNodes.length).fill(0);
  if (!edges || edges.length === 0) return cols;

  for (let i = 0; i < groupNodes.length; i++) {
    const node = groupNodes[i]!;
    if (node.id === 'node-end' || node.id.includes('loop-end') || node.label.includes('終了')) continue;

    // False / No エッジで入ってくるノード (elif または else)
    const inFalse = edges.find(
      (e) => e.targetId === node.id && !e.id.includes('loop-exit') && (e.label === 'False' || e.label === 'No' || e.id.includes('edge-false-'))
    );
    if (inFalse) {
      const srcIdx = groupNodes.findIndex((n) => n.id === inFalse.sourceId);
      if (srcIdx >= 0) {
        const isMergeTarget = edges.some(
          (e) => e.targetId === node.id && (e.id.includes('merge') || e.id.includes('join'))
        );
        if (!isMergeTarget || node.type === 'decision' || node.label.startsWith('elif ') || node.label.startsWith('else')) {
          cols[i] = cols[srcIdx]! + 1;
        }
      }
    }
  }

  for (let i = 1; i < groupNodes.length; i++) {
    const node = groupNodes[i]!;
    if (cols[i] === 0 && !node.label.includes('終了') && node.id !== 'node-end' && !node.id.includes('loop-end')) {
      const inTrue = edges.find((e) => e.targetId === node.id && (e.label === 'True' || e.label === 'Yes'));
      if (inTrue) {
        const srcIdx = groupNodes.findIndex((n) => n.id === inTrue.sourceId);
        if (srcIdx >= 0 && cols[srcIdx]! > 0) cols[i] = cols[srcIdx]!;
      } else {
        const inNext = edges.find(
          (e) => e.targetId === node.id && (e.label === 'Next' || !e.label) && !e.id.includes('merge') && !e.id.includes('join')
        );
        if (inNext) {
          const srcIdx = groupNodes.findIndex((n) => n.id === inNext.sourceId);
          if (srcIdx >= 0 && cols[srcIdx]! > 0 && !edges.some((e) => e.id.includes('merge') && e.targetId === node.id)) {
            cols[i] = cols[srcIdx]!;
          }
        }
      }
    }
  }

  return cols;
}

/** 分岐チェーン内の elif ひし形と各処理ブロックを探索する helper */
function collectBranchNodes(
  startDecisionId: string,
  nodes: FlowchartNode[],
  nodeCols: number[],
  edges: FlowchartEdge[] | undefined,
  nodeYs: number[],
  decisionY: number,
  stepY: number
): { firstProcessIndices: number[]; maxDecisionY: number } {
  const firstProcessIndices: number[] = [];
  let currentDecisionId = startDecisionId;
  let branchDepth = 0;
  let maxDecisionY = decisionY;

  while (true) {
    const falseEdge = edges?.find(
      (e) => e.sourceId === currentDecisionId && (e.label === 'False' || e.label === 'No' || e.id.includes('edge-false-'))
    );
    if (!falseEdge) break;
    const tgtIdx = nodes.findIndex((n) => n.id === falseEdge.targetId);
    if (tgtIdx < 0 || nodeCols[tgtIdx] === 0) break;

    const tgtNode = nodes[tgtIdx]!;
    branchDepth++;

    if (tgtNode.type === 'decision') {
      const thisDecisionY = decisionY + branchDepth * stepY;
      nodeYs[tgtIdx] = thisDecisionY;
      maxDecisionY = Math.max(maxDecisionY, thisDecisionY);
      currentDecisionId = tgtNode.id;

      const elifTrue = edges?.find((e) => e.sourceId === tgtNode.id && (e.label === 'True' || e.label === 'Yes'));
      if (elifTrue) {
        const etIdx = nodes.findIndex((n) => n.id === elifTrue.targetId);
        if (etIdx >= 0) firstProcessIndices.push(etIdx);
      }
    } else {
      firstProcessIndices.push(tgtIdx);
      break;
    }
  }

  return { firstProcessIndices, maxDecisionY };
}

/** 単一カラム内の 2つ目以降の処理ブロックを縦に順次配置する helper */
function layoutColumnBlocks(
  firstIdx: number,
  col: number,
  processY: number,
  nodes: FlowchartNode[],
  nodeCols: number[],
  nodeHeights: number[],
  edges: FlowchartEdge[] | undefined,
  nodeYs: number[],
  defaultGap: number
): number {
  let currentBlockIdx = firstIdx;
  let currentY = processY + (nodeHeights[firstIdx] ?? 50);

  while (true) {
    const nextEdge = edges?.find(
      (e) =>
        e.sourceId === nodes[currentBlockIdx]!.id &&
        (e.label === 'Next' || !e.label) &&
        !e.id.includes('merge') &&
        !e.id.includes('join')
    );
    if (!nextEdge) break;
    const nextIdx = nodes.findIndex((n) => n.id === nextEdge.targetId);
    if (nextIdx < 0) break;
    if (nodeCols[nextIdx] !== col || edges?.some((e) => e.targetId === nodes[nextIdx]!.id && e.id.includes('merge'))) {
      break;
    }

    currentY += defaultGap;
    nodeYs[nextIdx] = currentY;
    currentY += (nodeHeights[nextIdx] ?? 50);
    currentBlockIdx = nextIdx;
  }
  return currentY;
}

/** if-elif-else 分岐チェーンのひし形を階段状にし、各分岐の処理ブロック群を縦に整列する helper */
function layoutBranchChain(
  ifIdx: number,
  nodes: FlowchartNode[],
  nodeCols: number[],
  nodeHeights: number[],
  edges: FlowchartEdge[] | undefined,
  nodeYs: number[],
  decisionY: number,
  decisionGap: number,
  defaultGap = 12,
  stepY = 35
): number {
  const ifNode = nodes[ifIdx]!;
  nodeYs[ifIdx] = decisionY;

  const trueEdge = edges?.find((e) => e.sourceId === ifNode.id && (e.label === 'True' || e.label === 'Yes'));
  const firstProcessIdx = trueEdge ? nodes.findIndex((n) => n.id === trueEdge.targetId) : -1;

  const { firstProcessIndices, maxDecisionY } = collectBranchNodes(
    ifNode.id,
    nodes,
    nodeCols,
    edges,
    nodeYs,
    decisionY,
    stepY
  );
  if (firstProcessIdx >= 0 && nodeCols[firstProcessIdx] === 0) {
    firstProcessIndices.unshift(firstProcessIdx);
  }

  const decisionH = nodeHeights[ifIdx] ?? 50;
  const processY = maxDecisionY + decisionH + decisionGap;
  let maxBranchBottom = processY;

  for (const pIdx of firstProcessIndices) {
    nodeYs[pIdx] = processY;
  }

  for (const pIdx of firstProcessIndices) {
    const col = nodeCols[pIdx]!;
    const colBottom = layoutColumnBlocks(pIdx, col, processY, nodes, nodeCols, nodeHeights, edges, nodeYs, defaultGap);
    if (colBottom > maxBranchBottom) maxBranchBottom = colBottom;
  }

  return maxBranchBottom;
}

/** 単一グループのノード Y 座標を上端から順次配置 */
function populateGroupYPositions(
  groupNodes: FlowchartNode[],
  groupIndices: number[],
  allNodes: FlowchartNode[],
  nodeCols: number[],
  nodeHeights: number[],
  edges: FlowchartEdge[] | undefined,
  nodeYs: number[],
  paddingY: number,
  defaultGap: number,
  mergeGap: number,
  decisionGap: number
): number {
  let currentY = paddingY;

  for (let localIdx = 0; localIdx < groupNodes.length; localIdx++) {
    const globalIdx = groupIndices[localIdx]!;
    if (nodeYs[globalIdx] !== 0) continue;

    const node = groupNodes[localIdx]!;
    const col = nodeCols[globalIdx]!;
    const h = nodeHeights[globalIdx] ?? 50;

    if (node.type === 'decision' && col === nodeCols[groupIndices[0]!] && edges?.some((e) => e.sourceId === node.id && (e.label === 'False' || e.id.includes('edge-false-')) && nodeCols[allNodes.findIndex((n) => n.id === e.targetId)]! > col)) {
      if (localIdx > 0) currentY += defaultGap;
      currentY = layoutBranchChain(globalIdx, allNodes, nodeCols, nodeHeights, edges, nodeYs, currentY, decisionGap);
    } else {
      const isPrevDecision = localIdx > 0 && groupNodes[localIdx - 1]?.type === 'decision';
      const isMerge =
        !node.id.includes('loop-end') &&
        !node.label.includes('ループ終了') &&
        edges?.some(
          (e) =>
            e.targetId === node.id &&
            !e.id.includes('loop-exit') &&
            (e.id.includes('merge') || e.id.includes('join') || (e.label === 'False' && !e.id.includes('loop')))
        );
      const gap = isMerge ? mergeGap : isPrevDecision ? decisionGap : defaultGap;
      if (localIdx > 0) currentY += gap;
      nodeYs[globalIdx] = currentY;
      currentY += h;
    }
  }
  return currentY;
}

/** 全ノードグループのカラムおよびY座標を順次レイアウト */
function layoutAllNodeGroups(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[] | undefined,
  nodeCols: number[],
  nodeHeights: number[],
  nodeYs: number[],
  paddingY: number,
  defaultGap: number,
  mergeGap: number,
  decisionGap: number
): number {
  const groups = partitionNodeGroups(nodes);
  let currentColOffset = 0;
  let maxGroupHeight = paddingY;

  for (const group of groups) {
    const groupIndices = group.map((gn) => nodes.findIndex((n) => n.id === gn.id));
    const localCols = calculateGroupColumns(group, edges);
    for (let i = 0; i < group.length; i++) {
      nodeCols[groupIndices[i]!] = currentColOffset + localCols[i]!;
    }

    const groupFinalY = populateGroupYPositions(
      group,
      groupIndices,
      nodes,
      nodeCols,
      nodeHeights,
      edges,
      nodeYs,
      paddingY,
      defaultGap,
      mergeGap,
      decisionGap
    );
    maxGroupHeight = Math.max(maxGroupHeight, groupFinalY);
    const groupMaxLocalCol = Math.max(0, ...localCols);
    currentColOffset += groupMaxLocalCol + 1;
  }
  return maxGroupHeight;
}

/** コメント文字列の表示幅（px）を概算 */
function calcCommentWidth(comment?: string): number {
  if (!comment) return 0;
  let w = 10;
  for (let i = 0; i < comment.length; i++) {
    w += comment.charCodeAt(i) <= 0x7e ? 8 : 14;
  }
  return w;
}

/** カラムごとの開始 X 座標配列を算出 */
function computeColumnStartX(
  nodes: FlowchartNode[],
  nodeCols: number[],
  nodeWidth: number,
  baseColGap: number,
  paddingX: number
): { colStartX: number[]; extraCommentRight: number } {
  const maxCol = Math.max(0, ...nodeCols);
  const colCommentWidths = new Array<number>(maxCol + 1).fill(0);

  for (let i = 0; i < nodes.length; i++) {
    const col = nodeCols[i]!;
    const cw = calcCommentWidth(nodes[i]?.comment);
    if (cw > colCommentWidths[col]!) {
      colCommentWidths[col] = cw;
    }
  }

  const colStartX = new Array<number>(maxCol + 1).fill(paddingX);
  for (let c = 1; c <= maxCol; c++) {
    const prevCommentW = colCommentWidths[c - 1]!;
    const effectiveGap = Math.max(baseColGap, prevCommentW + 16);
    colStartX[c] = colStartX[c - 1]! + nodeWidth + effectiveGap;
  }

  const lastCol = maxCol;
  const lastCommentW = colCommentWidths[lastCol] ?? 0;
  const extraCommentRight = lastCommentW > 0 ? lastCommentW + 16 : 0;

  return { colStartX, extraCommentRight };
}

/** 最終的な SVG 幅と高さを計算 */
function computeLayoutDimensions(
  nodes: FlowchartNode[],
  nodeCols: number[],
  nodeYs: number[],
  nodeHeights: number[],
  edges: FlowchartEdge[] | undefined,
  maxGroupHeight: number,
  nodeWidth: number,
  baseNodeHeight: number,
  colGap: number,
  paddingX: number,
  paddingY: number
): { nodeXs: number[]; totalWidth: number; totalHeight: number } {
  const { colStartX, extraCommentRight } = computeColumnStartX(nodes, nodeCols, nodeWidth, colGap, paddingX);
  const nodeXs = nodeCols.map((col) => colStartX[col]!);
  const maxCol = Math.max(0, ...nodeCols);

  const hasBranchOrMerge = edges?.some(
    (e) =>
      !e.id.includes('loop-exit') &&
      !e.id.includes('loopback') &&
      e.label !== 'Loop' &&
      (e.label === 'False' || e.label === 'No' || e.id.includes('merge') || e.id.includes('edge-false-'))
  );
  const extraRightMargin = Math.max(hasBranchOrMerge ? 48 : 16, extraCommentRight);
  const totalWidth = colStartX[maxCol]! + nodeWidth + extraRightMargin;
  const maxYWithHeight = Math.max(...nodeYs.map((y, idx) => y + (nodeHeights[idx] ?? baseNodeHeight)));
  const totalHeight = Math.max(maxGroupHeight + paddingY, maxYWithHeight + paddingY);

  return { nodeXs, totalWidth, totalHeight };
}

/** 各ノードの X, Y 座標と全体のサイズを算出 */
function calculateNodeLayouts(
  nodes: FlowchartNode[],
  edges?: FlowchartEdge[],
  defaultGap = 14,
  mergeGap = 45,
  decisionGap = 24,
  nodeWidth = 180,
  baseNodeHeight = 50,
  colGap = 40,
  paddingX = 16,
  paddingY = 40
): { nodeXs: number[]; nodeYs: number[]; nodeHeights: number[]; nodeCols: number[]; totalWidth: number; totalHeight: number } {
  const nodeHeights = nodes.map((node) => calculateNodeHeight(node, baseNodeHeight));
  const nodeCols = new Array<number>(nodes.length).fill(0);
  const nodeYs = new Array<number>(nodes.length).fill(0);

  const maxGroupHeight = layoutAllNodeGroups(
    nodes,
    edges,
    nodeCols,
    nodeHeights,
    nodeYs,
    paddingY,
    defaultGap,
    mergeGap,
    decisionGap
  );

  const { nodeXs, totalWidth, totalHeight } = computeLayoutDimensions(
    nodes,
    nodeCols,
    nodeYs,
    nodeHeights,
    edges,
    maxGroupHeight,
    nodeWidth,
    baseNodeHeight,
    colGap,
    paddingX,
    paddingY
  );

  return { nodeXs, nodeYs, nodeHeights, nodeCols, totalWidth, totalHeight };
}

function getNodeBox(
  nodeId: string,
  nodes: FlowchartNode[],
  nodeXs: number[],
  nodeYs: number[],
  nodeHeights: number[],
  nodeCols: number[],
  nodeWidth: number
): NodeBox | null {
  const index = nodes.findIndex((n) => n.id === nodeId);
  if (index < 0) return null;
  return {
    x: nodeXs[index] ?? 0,
    y: nodeYs[index] ?? 0,
    w: nodeWidth,
    h: nodeHeights[index] ?? 50,
    col: nodeCols[index] ?? 0,
    index,
  };
}

/** エッジの線色を取得 helper */
function getEdgeStyleProps(label?: string, isActive = false) {
  if (label === 'True' || label === 'Yes') return { stroke: isActive ? '#2563eb' : '#16a34a' };
  if (label === 'False' || label === 'No') return { stroke: isActive ? '#2563eb' : '#d97706' };
  if (label === 'Loop') return { stroke: isActive ? '#2563eb' : '#9333ea' };
  return { stroke: isActive ? '#2563eb' : '#64748b' };
}

/** 合流先ノード (tgt) の直前にある全分岐ブロックの最下部 Y 座標を取得 */
function getBranchMaxBottom(
  tgtIndex: number,
  nodeYs: number[],
  nodeHeights: number[]
): number {
  let maxBottom = 0;
  for (let i = 0; i < tgtIndex; i++) {
    const b = nodeYs[i]! + (nodeHeights[i] ?? 50);
    if (b > maxBottom) maxBottom = b;
  }
  return maxBottom;
}

/** False / No 分岐エッジ描画 helper */
function renderFalseEdgeElement(
  id: string,
  src: NodeBox,
  tgt: NodeBox,
  nodeYs: number[],
  nodeHeights: number[],
  stroke: string,
  isActive: boolean
): React.ReactNode {
  const startX = src.x + src.w;
  const startY = src.y + src.h / 2;

  // 右カラム (elif) へ分岐する場合
  if (tgt.col > src.col) {
    const tgtCenterX = tgt.x + tgt.w / 2;
    const pathD = `M ${startX} ${startY} H ${tgtCenterX} V ${tgt.y}`;
    return (
      <g key={id} className="flowchart-edge edge-false edge-no">
        <path d={pathD} fill="none" stroke={stroke} strokeWidth={isActive ? 3 : 2} />
        <text x={startX + 8} y={startY - 8} textAnchor="start" dominantBaseline="central" fill={stroke} fontSize={13} fontWeight={600}>No</text>
      </g>
    );
  }

  // 同一カラムまたはメインラインへの合流の場合（単一 if 等）
  const rightX = src.x + src.w + 40;
  const branchBottom = getBranchMaxBottom(tgt.index, nodeYs, nodeHeights);
  const prevBottom = branchBottom > 0 ? branchBottom : (src.y + src.h);
  const mergeY = prevBottom + (tgt.y - prevBottom) / 2;
  const mergeX = tgt.x + tgt.w / 2;
  const pathD = `M ${startX} ${startY} H ${rightX} V ${mergeY} H ${mergeX}`;

  return (
    <g key={id} className="flowchart-edge edge-false edge-no">
      <path d={pathD} fill="none" stroke={stroke} strokeWidth={isActive ? 3 : 2} markerEnd={isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead-false)'} />
      <text x={startX + 8} y={startY - 8} textAnchor="start" dominantBaseline="central" fill={stroke} fontSize={13} fontWeight={600}>No</text>
    </g>
  );
}

/** 右カラムからメインラインへの合流エッジ描画 helper */
function renderMergeEdgeElement(
  id: string,
  src: NodeBox,
  tgt: NodeBox,
  nodeYs: number[],
  nodeHeights: number[],
  stroke: string,
  isActive: boolean
): React.ReactNode {
  const startX = src.x + src.w / 2;
  const startY = src.y + src.h;
  const branchBottom = getBranchMaxBottom(tgt.index, nodeYs, nodeHeights);
  const prevBottom = Math.max(branchBottom, startY);
  const mergeY = prevBottom + (tgt.y - prevBottom) / 2;
  const mergeX = tgt.x + tgt.w / 2;
  const pathD = `M ${startX} ${startY} V ${mergeY} H ${mergeX}`;

  return (
    <g key={id} className="flowchart-edge edge-merge edge-next">
      <path d={pathD} fill="none" stroke={stroke} strokeWidth={isActive ? 3 : 2} markerEnd={isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)'} />
    </g>
  );
}

/** 単一エッジ (接続直線・折れ線) の描画 */
function renderSingleEdge(
  edge: FlowchartEdge,
  nodes: FlowchartNode[],
  nodeXs: number[],
  nodeYs: number[],
  nodeHeights: number[],
  nodeCols: number[],
  activeFlags: boolean[],
  nodeWidth: number
): React.ReactNode {
  if (edge.label === 'Loop' || edge.id.includes('loopback') || edge.id.includes('loop-exit')) {
    return null;
  }

  const src = getNodeBox(edge.sourceId, nodes, nodeXs, nodeYs, nodeHeights, nodeCols, nodeWidth);
  const tgt = getNodeBox(edge.targetId, nodes, nodeXs, nodeYs, nodeHeights, nodeCols, nodeWidth);
  if (!src || !tgt) return null;

  const isActive = activeFlags[src.index]! && activeFlags[tgt.index]!;
  const { stroke } = getEdgeStyleProps(edge.label, isActive);

  if (edge.label === 'False' || edge.label === 'No' || edge.id.includes('edge-false-')) {
    return renderFalseEdgeElement(edge.id, src, tgt, nodeYs, nodeHeights, stroke, isActive);
  }

  if (src.col > tgt.col || (edge.id.includes('merge') && src.col > 0)) {
    return renderMergeEdgeElement(edge.id, src, tgt, nodeYs, nodeHeights, stroke, isActive);
  }

  const isYes = edge.label === 'True' || edge.label === 'Yes';
  const startX = src.x + src.w / 2;
  const startY = src.y + src.h;
  const labelY = startY + (tgt.y - startY) / 2;
  return (
    <g key={edge.id} className={`flowchart-edge ${isYes ? 'edge-true edge-yes' : 'edge-next'}`}>
      <line x1={startX} y1={startY} x2={tgt.x + tgt.w / 2} y2={tgt.y} stroke={stroke} strokeWidth={isActive ? 3 : 2} />
      {isYes && <text x={startX + 8} y={labelY} textAnchor="start" dominantBaseline="central" fill={stroke} fontSize={13} fontWeight={600}>Yes</text>}
    </g>
  );
}

/** エッジ群の描画 */
function renderFlowchartEdges(
  edges: FlowchartEdge[],
  nodes: FlowchartNode[],
  nodeXs: number[],
  nodeYs: number[],
  nodeHeights: number[],
  nodeCols: number[],
  activeFlags: boolean[],
  nodeWidth: number
): React.ReactNode[] {
  return edges
    .map((e) => renderSingleEdge(e, nodes, nodeXs, nodeYs, nodeHeights, nodeCols, activeFlags, nodeWidth))
    .filter(Boolean);
}

/** 接続線（フォールバック）の描画 */
function renderFlowchartConnections(
  nodes: FlowchartNode[],
  nodeXs: number[],
  nodeYs: number[],
  nodeHeights: number[],
  activeFlags: boolean[],
  nodeWidth: number
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const node = nodes[i]!;
    const currentY = nodeYs[i]!;
    const nextY = nodeYs[i + 1]!;
    const h = nodeHeights[i] ?? 50;
    const lineIsActive = activeFlags[i]! && activeFlags[i + 1]!;
    const startX = nodeXs[i]! + nodeWidth / 2;
    elements.push(
      <line
        key={`line-${node.id}-${i}`}
        x1={startX}
        y1={currentY + h}
        x2={startX}
        y2={nextY}
        stroke={lineIsActive ? '#2563eb' : '#94a3b8'}
        strokeWidth={lineIsActive ? 3 : 2}
      />
    );
  }
  return elements;
}

/** ノード群の描画 */
function renderFlowchartNodeList(
  nodes: FlowchartNode[],
  nodeXs: number[],
  nodeYs: number[],
  nodeHeights: number[],
  activeFlags: boolean[],
  nodeWidth: number
): React.ReactNode[] {
  return nodes.map((node, i) => {
    const x = nodeXs[i]!;
    const y = nodeYs[i]!;
    const h = nodeHeights[i] ?? 50;
    return renderNodeShape(node, x, y, nodeWidth, h, activeFlags[i]!);
  });
}

/** 流れ図全体の SVG を生成するメイン関数 */
export function renderFlowchartSvg(
  nodes: FlowchartNode[],
  options: RenderOptions = {}
): React.ReactNode {
  const { activeLine, activeNodeId, edges } = options;
  const nodeWidth = 180;
  const baseNodeHeight = 50;
  const colGap = 40;
  const paddingX = 16;
  const paddingY = 40;

  const { nodeXs, nodeYs, nodeHeights, nodeCols, totalWidth, totalHeight } = calculateNodeLayouts(
    nodes,
    edges,
    12,
    45,
    20,
    nodeWidth,
    baseNodeHeight,
    colGap,
    paddingX,
    paddingY
  );

  const activeFlags = nodes.map((n) => isNodeActive(n, activeLine, activeNodeId));

  return (
    <svg
      role="img"
      aria-label="アルゴリズム流れ図"
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      style={{ display: 'block', margin: '0 auto', flexShrink: 0 }}
    >
      {renderSvgDefs()}
      {edges && edges.length > 0
        ? renderFlowchartEdges(edges, nodes, nodeXs, nodeYs, nodeHeights, nodeCols, activeFlags, nodeWidth)
        : renderFlowchartConnections(nodes, nodeXs, nodeYs, nodeHeights, activeFlags, nodeWidth)}
      {renderFlowchartNodeList(nodes, nodeXs, nodeYs, nodeHeights, activeFlags, nodeWidth)}
    </svg>
  );
}


