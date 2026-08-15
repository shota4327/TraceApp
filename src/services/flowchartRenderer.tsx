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

interface NodeBox { x: number; y: number; w: number; h: number; index: number }

function getNodeBox(
  nodeId: string,
  nodes: FlowchartNode[],
  x: number,
  nodeWidth: number,
  nodeHeight: number,
  verticalGap: number,
  paddingY: number
): NodeBox | null {
  const index = nodes.findIndex((n) => n.id === nodeId);
  if (index < 0) return null;
  return {
    x,
    y: paddingY + index * (nodeHeight + verticalGap),
    w: nodeWidth,
    h: nodeHeight,
    index,
  };
}

/** エッジの線色を取得 helper */
function getEdgeStyleProps(label?: string, isActive = false) {
  if (label === 'True') return { stroke: isActive ? '#2563eb' : '#16a34a' };
  if (label === 'False') return { stroke: isActive ? '#2563eb' : '#d97706' };
  if (label === 'Loop') return { stroke: isActive ? '#2563eb' : '#9333ea' };
  return { stroke: isActive ? '#2563eb' : '#64748b' };
}

/** False 分岐エッジ描画 helper (True 側ノード下端よりも十分下の縦線隙間中央に合流) */
function renderFalseEdgeElement(
  id: string,
  src: NodeBox,
  tgt: NodeBox,
  stroke: string,
  isActive: boolean,
  verticalGap: number
): React.ReactNode {
  const startX = src.x + src.w;
  const startY = src.y + src.h / 2;
  const rightX = Math.max(src.x + src.w, tgt.x + tgt.w) + 50;
  // 合流先 tgt の上端と直前ノード下端の間にある縦線の中央位置
  const mergeY = tgt.y - verticalGap / 2;
  const mergeX = tgt.x + tgt.w / 2;
  const pathD = `M ${startX} ${startY} H ${rightX} V ${mergeY} H ${mergeX}`;

  return (
    <g key={id} className="flowchart-edge edge-false">
      <path d={pathD} fill="none" stroke={stroke} strokeWidth={isActive ? 3 : 2} />
      <text x={startX + 8} y={startY - 8} textAnchor="start" dominantBaseline="central" fill={stroke} fontSize={11} fontWeight={600}>False</text>
    </g>
  );
}

/** 単一エッジ (接続直線) の描画 */
function renderSingleEdge(
  edge: FlowchartEdge,
  nodes: FlowchartNode[],
  activeFlags: boolean[],
  x: number,
  nodeWidth: number,
  nodeHeight: number,
  verticalGap: number,
  paddingY: number
): React.ReactNode {
  // ループ記号に付随する Loop 迂回エッジ・ループ脱出エッジは描画しない（JIS 規格の直列反復表現）
  if (edge.label === 'Loop' || edge.id.includes('loopback') || edge.id.includes('loop-exit')) {
    return null;
  }

  const src = getNodeBox(edge.sourceId, nodes, x, nodeWidth, nodeHeight, verticalGap, paddingY);
  const tgt = getNodeBox(edge.targetId, nodes, x, nodeWidth, nodeHeight, verticalGap, paddingY);
  if (!src || !tgt) return null;

  const isActive = activeFlags[src.index]! && activeFlags[tgt.index]!;
  const { stroke } = getEdgeStyleProps(edge.label, isActive);

  if (edge.label === 'False') return renderFalseEdgeElement(edge.id, src, tgt, stroke, isActive, verticalGap);

  const startX = src.x + src.w / 2;
  const startY = src.y + src.h;
  return (
    <g key={edge.id} className={`flowchart-edge edge-${edge.label || 'next'}`}>
      <line x1={startX} y1={startY} x2={tgt.x + tgt.w / 2} y2={tgt.y} stroke={stroke} strokeWidth={isActive ? 3 : 2} />
      {edge.label === 'True' && <text x={startX + 8} y={(startY + tgt.y) / 2} textAnchor="start" dominantBaseline="central" fill={stroke} fontSize={11} fontWeight={600}>True</text>}
    </g>
  );
}

/** エッジ群の描画 */
function renderFlowchartEdges(
  edges: FlowchartEdge[],
  nodes: FlowchartNode[],
  activeFlags: boolean[],
  x: number,
  nodeWidth: number,
  nodeHeight: number,
  verticalGap: number,
  paddingY: number
): React.ReactNode[] {
  return edges
    .map((e) => renderSingleEdge(e, nodes, activeFlags, x, nodeWidth, nodeHeight, verticalGap, paddingY))
    .filter(Boolean);
}

/** 接続線（フォールバック）の描画 */
function renderFlowchartConnections(
  nodes: FlowchartNode[],
  activeFlags: boolean[],
  x: number,
  nodeWidth: number,
  nodeHeight: number,
  verticalGap: number,
  paddingY: number
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const node = nodes[i]!;
    const currentY = paddingY + i * (nodeHeight + verticalGap);
    const nextY = paddingY + (i + 1) * (nodeHeight + verticalGap);
    const lineIsActive = activeFlags[i]! && activeFlags[i + 1]!;
    const startX = x + nodeWidth / 2;
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
  activeFlags: boolean[],
  x: number,
  nodeWidth: number,
  nodeHeight: number,
  verticalGap: number,
  paddingY: number
): React.ReactNode[] {
  return nodes.map((node, i) => {
    const y = paddingY + i * (nodeHeight + verticalGap);
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
  const verticalGap = 50;
  const paddingX = 80;
  const paddingY = 40;

  const totalWidth = nodeWidth + paddingX * 2 + 60;
  const totalHeight = nodes.length * (nodeHeight + verticalGap) - verticalGap + paddingY * 2;
  const x = paddingX;

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
        ? renderFlowchartEdges(edges, nodes, activeFlags, x, nodeWidth, nodeHeight, verticalGap, paddingY)
        : renderFlowchartConnections(nodes, activeFlags, x, nodeWidth, nodeHeight, verticalGap, paddingY)}
      {renderFlowchartNodeList(nodes, activeFlags, x, nodeWidth, nodeHeight, verticalGap, paddingY)}
    </svg>
  );
}
