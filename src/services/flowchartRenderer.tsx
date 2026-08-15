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
  if (node.type === 'terminal' || node.label === 'ループ終了' || node.label.includes('ループ終了')) return false;
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
  return (
    <g key={node.id} {...commonProps} className={`flowchart-node ${isActive ? 'active' : ''}`}>
      <rect x={x} y={y} width={width} height={height} rx={22} ry={22} fill={isActive ? '#dbeafe' : '#f1f5f9'} stroke={isActive ? '#2563eb' : '#64748b'} strokeWidth={isActive ? 3 : 2} />
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
  return (
    <g key={node.id} {...commonProps} className={`flowchart-node ${isActive ? 'active' : ''}`}>
      <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill={isActive ? '#eff6ff' : '#ffffff'} stroke={isActive ? '#2563eb' : '#3b82f6'} strokeWidth={isActive ? 3 : 2} />
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
  const isLoopEnd = node.label.includes('ループ終了') || node.id.includes('loop-end');

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
  const labelText = node.label.length > 24 ? node.label.slice(0, 22) + '...' : node.label;
  const commonProps = {
    'data-testid': `flowchart-node-${node.type}`,
    'data-node-id': node.id,
    'data-active': isActive ? 'true' : 'false',
    role: 'graphics-symbol',
    'aria-label': `ノード ${node.label} (${node.type})`,
  };
  const textElement = (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={isActive ? '#1e293b' : '#334155'} fontSize={13} fontWeight={isActive ? 700 : 500} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      {labelText}
    </text>
  );

  switch (node.type) {
    case 'terminal': return renderTerminalNode(node, x, y, width, height, isActive, commonProps, textElement);
    case 'process': return renderProcessNode(node, x, y, width, height, isActive, commonProps, textElement);
    case 'decision': return renderDecisionNode(node, x, y, width, height, isActive, commonProps, textElement, cx, cy);
    case 'loop': return renderLoopNode(node, x, y, width, height, isActive, commonProps, textElement, cy);
    case 'subroutine': return renderSubroutineNode(node, x, y, width, height, isActive, commonProps, textElement);
    default: return renderDefaultNode(node, x, y, width, height, isActive, commonProps, textElement);
  }
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

/** 各ノードの所属カラム (0: メイン, 1: elif1/else, 2: elif2/else...) を算出 */
function calculateNodeColumns(nodes: FlowchartNode[], edges?: FlowchartEdge[]): number[] {
  const cols = new Array(nodes.length).fill(0);
  if (!edges || edges.length === 0) return cols;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.id === 'node-end' || node.label.includes('終了')) continue;

    // False / No エッジで入ってくるノード (elif または else)
    const inFalse = edges.find(
      (e) => e.targetId === node.id && (e.label === 'False' || e.label === 'No' || e.id.includes('edge-false-'))
    );
    if (inFalse) {
      const srcIdx = nodes.findIndex((n) => n.id === inFalse.sourceId);
      if (srcIdx >= 0) {
        // True側の末尾からもこのノードに合流エッジが入っている場合は、else ではなく単一 if の合流先 (col=0)
        const isMergeTarget = edges.some(
          (e) => e.targetId === node.id && (e.id.includes('merge') || e.id.includes('join'))
        );
        if (!isMergeTarget || node.type === 'decision' || node.label.startsWith('elif ') || node.label.startsWith('else')) {
          cols[i] = cols[srcIdx]! + 1;
        }
      }
    }
  }

  // elif / else 配下のノードにカラムを伝播
  for (let i = 1; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (cols[i] === 0 && !node.label.includes('終了') && node.id !== 'node-end') {
      const inTrue = edges.find((e) => e.targetId === node.id && (e.label === 'True' || e.label === 'Yes'));
      if (inTrue) {
        const srcIdx = nodes.findIndex((n) => n.id === inTrue.sourceId);
        if (srcIdx >= 0 && cols[srcIdx]! > 0) cols[i] = cols[srcIdx]!;
      } else {
        const inNext = edges.find(
          (e) => e.targetId === node.id && (e.label === 'Next' || !e.label) && !e.id.includes('merge') && !e.id.includes('join')
        );
        if (inNext) {
          const srcIdx = nodes.findIndex((n) => n.id === inNext.sourceId);
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
): { processIndices: number[]; maxDecisionY: number } {
  const processIndices: number[] = [];
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
        if (etIdx >= 0) processIndices.push(etIdx);
      }
    } else {
      processIndices.push(tgtIdx);
      break;
    }
  }

  return { processIndices, maxDecisionY };
}

/** if-elif-else 分岐チェーンのひし形を階段状にし、処理ブロックを横並び整列する helper */
function layoutBranchChain(
  ifIdx: number,
  nodes: FlowchartNode[],
  nodeCols: number[],
  edges: FlowchartEdge[] | undefined,
  nodeYs: number[],
  decisionY: number,
  nodeHeight: number,
  decisionGap: number,
  stepY = 35
): number {
  const ifNode = nodes[ifIdx]!;
  nodeYs[ifIdx] = decisionY;

  const trueEdge = edges?.find((e) => e.sourceId === ifNode.id && (e.label === 'True' || e.label === 'Yes'));
  const firstProcessIdx = trueEdge ? nodes.findIndex((n) => n.id === trueEdge.targetId) : -1;

  const { processIndices, maxDecisionY } = collectBranchNodes(
    ifNode.id,
    nodes,
    nodeCols,
    edges,
    nodeYs,
    decisionY,
    stepY
  );
  if (firstProcessIdx >= 0 && nodeCols[firstProcessIdx] === 0) {
    processIndices.unshift(firstProcessIdx);
  }

  const processY = maxDecisionY + nodeHeight + decisionGap;
  for (const pIdx of processIndices) {
    nodeYs[pIdx] = processY;
  }
  return processY + nodeHeight;
}

/** 各ノードの X, Y 座標と全体のサイズを算出 */
function calculateNodeLayouts(
  nodes: FlowchartNode[],
  edges?: FlowchartEdge[],
  defaultGap = 10,
  mergeGap = 45,
  decisionGap = 20,
  nodeWidth = 180,
  nodeHeight = 50,
  colGap = 50,
  paddingX = 80,
  paddingY = 40
): { nodeXs: number[]; nodeYs: number[]; nodeCols: number[]; totalWidth: number; totalHeight: number } {
  const nodeCols = calculateNodeColumns(nodes, edges);
  const nodeXs = nodeCols.map((col) => paddingX + col * (nodeWidth + colGap));
  const nodeYs = new Array<number>(nodes.length).fill(0);
  let currentY = paddingY;

  for (let i = 0; i < nodes.length; i++) {
    if (nodeYs[i] !== 0) continue;

    const node = nodes[i]!;
    const col = nodeCols[i]!;

    if (node.type === 'decision' && col === 0 && edges?.some((e) => e.sourceId === node.id && (e.label === 'False' || e.id.includes('edge-false-')) && nodeCols[nodes.findIndex((n) => n.id === e.targetId)]! > 0)) {
      if (i > 0) currentY += defaultGap;
      currentY = layoutBranchChain(i, nodes, nodeCols, edges, nodeYs, currentY, nodeHeight, decisionGap);
    } else {
      const isMerge =
        !node.id.includes('loop-end') &&
        !node.label.includes('ループ終了') &&
        edges?.some(
          (e) =>
            e.targetId === node.id &&
            !e.id.includes('loop-exit') &&
            (e.id.includes('merge') || e.id.includes('join') || (e.label === 'False' && !e.id.includes('loop')))
        );
      if (i > 0) {
        currentY += isMerge ? mergeGap : defaultGap;
      }
      nodeYs[i] = currentY;
      currentY += nodeHeight;
    }
  }

  const maxCol = Math.max(0, ...nodeCols);
  const totalWidth = Math.max((maxCol + 1) * (nodeWidth + colGap) - colGap + paddingX * 2 + 40, nodeWidth + paddingX * 2 + 60);
  const totalHeight = Math.max(currentY + paddingY, Math.max(...nodeYs) + nodeHeight + paddingY);

  return { nodeXs, nodeYs, nodeCols, totalWidth, totalHeight };
}

function getNodeBox(
  nodeId: string,
  nodes: FlowchartNode[],
  nodeXs: number[],
  nodeYs: number[],
  nodeCols: number[],
  nodeWidth: number,
  nodeHeight: number
): NodeBox | null {
  const index = nodes.findIndex((n) => n.id === nodeId);
  if (index < 0) return null;
  return {
    x: nodeXs[index] ?? 0,
    y: nodeYs[index] ?? 0,
    w: nodeWidth,
    h: nodeHeight,
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

/** False / No 分岐エッジ描画 helper */
function renderFalseEdgeElement(
  id: string,
  src: NodeBox,
  tgt: NodeBox,
  nodeYs: number[],
  nodeHeight: number,
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
        <text x={startX + 8} y={startY - 8} textAnchor="start" dominantBaseline="central" fill={stroke} fontSize={11} fontWeight={600}>No</text>
      </g>
    );
  }

  // 同一カラムまたはメインラインへの合流の場合（単一 if 等）
  const rightX = src.x + src.w + 40;
  const prevBottom = tgt.index > 0 ? (nodeYs[tgt.index - 1]! + nodeHeight) : (src.y + src.h);
  const mergeY = prevBottom + (tgt.y - prevBottom) / 2;
  const mergeX = tgt.x + tgt.w / 2;
  const pathD = `M ${startX} ${startY} H ${rightX} V ${mergeY} H ${mergeX}`;

  return (
    <g key={id} className="flowchart-edge edge-false edge-no">
      <path d={pathD} fill="none" stroke={stroke} strokeWidth={isActive ? 3 : 2} markerEnd={isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead-false)'} />
      <text x={startX + 8} y={startY - 8} textAnchor="start" dominantBaseline="central" fill={stroke} fontSize={11} fontWeight={600}>No</text>
    </g>
  );
}

/** 右カラムからメインラインへの合流エッジ描画 helper */
function renderMergeEdgeElement(
  id: string,
  src: NodeBox,
  tgt: NodeBox,
  nodeYs: number[],
  nodeHeight: number,
  stroke: string,
  isActive: boolean
): React.ReactNode {
  const startX = src.x + src.w / 2;
  const startY = src.y + src.h;
  const prevBottom = tgt.index > 0 ? (nodeYs[tgt.index - 1]! + nodeHeight) : startY;
  const mergeY = Math.max(startY + 15, prevBottom + (tgt.y - prevBottom) / 2);
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
  nodeCols: number[],
  activeFlags: boolean[],
  nodeWidth: number,
  nodeHeight: number
): React.ReactNode {
  if (edge.label === 'Loop' || edge.id.includes('loopback') || edge.id.includes('loop-exit')) {
    return null;
  }

  const src = getNodeBox(edge.sourceId, nodes, nodeXs, nodeYs, nodeCols, nodeWidth, nodeHeight);
  const tgt = getNodeBox(edge.targetId, nodes, nodeXs, nodeYs, nodeCols, nodeWidth, nodeHeight);
  if (!src || !tgt) return null;

  const isActive = activeFlags[src.index]! && activeFlags[tgt.index]!;
  const { stroke } = getEdgeStyleProps(edge.label, isActive);

  if (edge.label === 'False' || edge.label === 'No' || edge.id.includes('edge-false-')) {
    return renderFalseEdgeElement(edge.id, src, tgt, nodeYs, nodeHeight, stroke, isActive);
  }

  if (src.col > tgt.col || (edge.id.includes('merge') && src.col > 0)) {
    return renderMergeEdgeElement(edge.id, src, tgt, nodeYs, nodeHeight, stroke, isActive);
  }

  const isYes = edge.label === 'True' || edge.label === 'Yes';
  const startX = src.x + src.w / 2;
  const startY = src.y + src.h;
  return (
    <g key={edge.id} className={`flowchart-edge ${isYes ? 'edge-true edge-yes' : 'edge-next'}`}>
      <line x1={startX} y1={startY} x2={tgt.x + tgt.w / 2} y2={tgt.y} stroke={stroke} strokeWidth={isActive ? 3 : 2} />
      {isYes && <text x={startX + 8} y={startY + 10} textAnchor="start" dominantBaseline="central" fill={stroke} fontSize={11} fontWeight={600}>Yes</text>}
    </g>
  );
}

/** エッジ群の描画 */
function renderFlowchartEdges(
  edges: FlowchartEdge[],
  nodes: FlowchartNode[],
  nodeXs: number[],
  nodeYs: number[],
  nodeCols: number[],
  activeFlags: boolean[],
  nodeWidth: number,
  nodeHeight: number
): React.ReactNode[] {
  return edges
    .map((e) => renderSingleEdge(e, nodes, nodeXs, nodeYs, nodeCols, activeFlags, nodeWidth, nodeHeight))
    .filter(Boolean);
}

/** 接続線（フォールバック）の描画 */
function renderFlowchartConnections(
  nodes: FlowchartNode[],
  nodeXs: number[],
  nodeYs: number[],
  activeFlags: boolean[],
  nodeWidth: number,
  nodeHeight: number
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const node = nodes[i]!;
    const currentY = nodeYs[i]!;
    const nextY = nodeYs[i + 1]!;
    const lineIsActive = activeFlags[i]! && activeFlags[i + 1]!;
    const startX = nodeXs[i]! + nodeWidth / 2;
    elements.push(
      <line
        key={`line-${node.id}-${i}`}
        x1={startX}
        y1={currentY + nodeHeight}
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
  activeFlags: boolean[],
  nodeWidth: number,
  nodeHeight: number
): React.ReactNode[] {
  return nodes.map((node, i) => {
    const x = nodeXs[i]!;
    const y = nodeYs[i]!;
    return renderNodeShape(node, x, y, nodeWidth, nodeHeight, activeFlags[i]!);
  });
}

/** 流れ図全体の SVG を生成するメイン関数 */
export function renderFlowchartSvg(
  nodes: FlowchartNode[],
  options: RenderOptions = {}
): React.ReactNode {
  const { activeLine, activeNodeId, edges } = options;
  const nodeWidth = 180;
  const nodeHeight = 50;
  const colGap = 50;
  const paddingX = 80;
  const paddingY = 40;

  const { nodeXs, nodeYs, nodeCols, totalWidth, totalHeight } = calculateNodeLayouts(
    nodes,
    edges,
    10,
    45,
    20,
    nodeWidth,
    nodeHeight,
    colGap,
    paddingX,
    paddingY
  );

  const activeFlags = nodes.map((n) => isNodeActive(n, activeLine, activeNodeId));

  return (
    <svg
      role="img"
      aria-label="アルゴリズム流れ図"
      width="100%"
      height={Math.max(totalHeight, 400)}
      viewBox={`0 0 ${totalWidth} ${Math.max(totalHeight, 400)}`}
      style={{ overflow: 'visible' }}
    >
      {renderSvgDefs()}
      {edges && edges.length > 0
        ? renderFlowchartEdges(edges, nodes, nodeXs, nodeYs, nodeCols, activeFlags, nodeWidth, nodeHeight)
        : renderFlowchartConnections(nodes, nodeXs, nodeYs, activeFlags, nodeWidth, nodeHeight)}
      {renderFlowchartNodeList(nodes, nodeXs, nodeYs, activeFlags, nodeWidth, nodeHeight)}
    </svg>
  );
}
