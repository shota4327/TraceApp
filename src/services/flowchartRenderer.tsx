import React from 'react';
import { FlowchartNode, FlowchartEdge } from '../types/flowchart';
import {
  calculateNodeLayouts,
  calculateNodeHeight,
  computeEdgeGeometries,
  wrapProcessLabel,
  EdgePathGeometry,
  NodeLayoutResult as GeometryLayoutResult,
} from './flowchartLayout';

export { calculateNodeLayouts, calculateNodeHeight, wrapProcessLabel };

interface CachedLayoutResult extends GeometryLayoutResult {
  inactiveNodes: React.ReactNode[];
  activeNodes: React.ReactNode[];
  inactiveConnections: React.ReactNode[];
  activeConnections: React.ReactNode[];
}

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

/** 入出力ノード (IO / Parallelogram Node: print文等) の描画 */
export function renderIoNode(
  node: FlowchartNode,
  x: number,
  y: number,
  width: number,
  height: number,
  isActive: boolean,
  commonProps: React.HTMLAttributes<SVGGElement>,
  textElement: React.ReactNode
): React.ReactNode {
  const fill = isActive ? '#eff6ff' : '#ffffff';
  const stroke = isActive ? '#2563eb' : '#3b82f6';
  const skew = 14;
  const points = `${x + skew},${y} ${x + width},${y} ${x + width - skew},${y + height} ${x},${y + height}`;
  return (
    <g key={node.id} {...commonProps} className={`flowchart-node ${isActive ? 'active' : ''}`}>
      <polygon points={points} fill={fill} stroke={stroke} strokeWidth={isActive ? 3 : 2} strokeLinejoin="round" />
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

  if (node.type === 'process' || node.type === 'loop' || node.subType === 'io' || (node.label && node.label.includes('\n'))) {
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
  if (node.subType === 'io') {
    shapeElement = renderIoNode(node, x, y, width, height, isActive, commonProps, textElement);
  } else {
    switch (node.type) {
      case 'terminal': shapeElement = renderTerminalNode(node, x, y, width, height, isActive, commonProps, textElement); break;
      case 'process': shapeElement = renderProcessNode(node, x, y, width, height, isActive, commonProps, textElement); break;
      case 'decision': shapeElement = renderDecisionNode(node, x, y, width, height, isActive, commonProps, textElement, cx, cy); break;
      case 'loop': shapeElement = renderLoopNode(node, x, y, width, height, isActive, commonProps, textElement, cy); break;
      case 'subroutine': shapeElement = renderSubroutineNode(node, x, y, width, height, isActive, commonProps, textElement); break;
      default: shapeElement = renderDefaultNode(node, x, y, width, height, isActive, commonProps, textElement); break;
    }
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

const layoutCache = new WeakMap<FlowchartNode[], Map<FlowchartEdge[] | undefined, CachedLayoutResult>>();

function buildCachedLayoutResult(
  nodes: FlowchartNode[],
  edges?: FlowchartEdge[],
  defaultGap = 12,
  mergeGap = 45,
  decisionGap = 20,
  nodeWidth = 180,
  baseNodeHeight = 50,
  colGap = 40,
  paddingX = 16,
  paddingY = 40
): CachedLayoutResult {
  const layout = calculateNodeLayouts(
    nodes,
    edges,
    defaultGap,
    mergeGap,
    decisionGap,
    nodeWidth,
    baseNodeHeight,
    colGap,
    paddingX,
    paddingY
  );

  const inactiveNodes = nodes.map((node, i) =>
    renderNodeShape(node, layout.nodeXs[i]!, layout.nodeYs[i]!, nodeWidth, layout.nodeHeights[i] ?? 50, false)
  );
  const activeNodes = nodes.map((node, i) =>
    renderNodeShape(node, layout.nodeXs[i]!, layout.nodeYs[i]!, nodeWidth, layout.nodeHeights[i] ?? 50, true)
  );

  const inactiveConnections: React.ReactNode[] = [];
  const activeConnections: React.ReactNode[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const node = nodes[i]!;
    const currentY = layout.nodeYs[i]!;
    const nextY = layout.nodeYs[i + 1]!;
    const h = layout.nodeHeights[i] ?? 50;
    const startX = layout.nodeXs[i]! + nodeWidth / 2;
    inactiveConnections.push(
      <line key={`line-${node.id}-${i}`} x1={startX} y1={currentY + h} x2={startX} y2={nextY} stroke="#94a3b8" strokeWidth={2} />
    );
    activeConnections.push(
      <line key={`line-${node.id}-${i}`} x1={startX} y1={currentY + h} x2={startX} y2={nextY} stroke="#2563eb" strokeWidth={3} />
    );
  }

  return { ...layout, inactiveNodes, activeNodes, inactiveConnections, activeConnections };
}

function getCachedNodeLayouts(
  nodes: FlowchartNode[],
  edges?: FlowchartEdge[],
  defaultGap = 12,
  mergeGap = 45,
  decisionGap = 20,
  nodeWidth = 180,
  baseNodeHeight = 50,
  colGap = 40,
  paddingX = 16,
  paddingY = 40
): CachedLayoutResult {
  let edgeMap = layoutCache.get(nodes);
  if (!edgeMap) {
    edgeMap = new Map();
    layoutCache.set(nodes, edgeMap);
  }
  let cached = edgeMap.get(edges);
  if (!cached) {
    cached = buildCachedLayoutResult(
      nodes,
      edges,
      defaultGap,
      mergeGap,
      decisionGap,
      nodeWidth,
      baseNodeHeight,
      colGap,
      paddingX,
      paddingY
    );
    edgeMap.set(edges, cached);
  }
  return cached;
}

/** エッジの線色を取得 helper */
function getEdgeStyleProps(label?: string, isActive = false) {
  if (label === 'True' || label === 'Yes') return { stroke: isActive ? '#2563eb' : '#16a34a' };
  if (label === 'False' || label === 'No') return { stroke: isActive ? '#2563eb' : '#d97706' };
  if (label === 'Loop') return { stroke: isActive ? '#2563eb' : '#9333ea' };
  return { stroke: isActive ? '#2563eb' : '#64748b' };
}

/** 始点・ウェイポイント・終点から直交 SVG path d 文字列を生成 */
function formatSvgOrthogonalPath(
  start: { x: number; y: number },
  points: { x: number; y: number }[],
  end: { x: number; y: number }
): string {
  let curr = start;
  let d = `M ${start.x} ${start.y}`;
  const allTargets = [...points, end];

  for (const next of allTargets) {
    if (next.y === curr.y) {
      d += ` H ${next.x}`;
    } else if (next.x === curr.x) {
      d += ` V ${next.y}`;
    } else {
      d += ` L ${next.x} ${next.y}`;
    }
    curr = next;
  }
  return d;
}

/** 幾何パスデータから SVG エッジ要素を描画 */
function renderEdgeGeometry(
  geom: EdgePathGeometry,
  activeFlags: boolean[],
  nodes: FlowchartNode[]
): React.ReactNode {
  const srcIdx = nodes.findIndex((n) => n.id === geom.sourceId);
  const tgtIdx = nodes.findIndex((n) => n.id === geom.targetId);
  const isActive = srcIdx >= 0 && tgtIdx >= 0 ? activeFlags[srcIdx]! && activeFlags[tgtIdx]! : false;
  const { stroke } = getEdgeStyleProps(geom.label, isActive);

  if (geom.type === 'straight') {
    const isYes = geom.label === 'True' || geom.label === 'Yes';
    const labelY = geom.start.y + (geom.end.y - geom.start.y) / 2;
    return (
      <g key={geom.edgeId} className={`flowchart-edge ${isYes ? 'edge-true edge-yes' : 'edge-next'}`}>
        <line x1={geom.start.x} y1={geom.start.y} x2={geom.end.x} y2={geom.end.y} stroke={stroke} strokeWidth={isActive ? 3 : 2} />
        {isYes && <text x={geom.start.x + 8} y={labelY} textAnchor="start" dominantBaseline="central" fill={stroke} fontSize={13} fontWeight={600}>Yes</text>}
      </g>
    );
  }

  const pathD = formatSvgOrthogonalPath(geom.start, geom.points, geom.end);
  const isBranchNo = geom.type === 'branch-elif' || geom.type === 'branch-merge';
  const marker = geom.type === 'branch-merge' ? (isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead-false)') : geom.type === 'merge' ? (isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)') : undefined;

  return (
    <g key={geom.edgeId} className={`flowchart-edge ${isBranchNo ? 'edge-false edge-no' : 'edge-merge edge-next'}`}>
      <path d={pathD} fill="none" stroke={stroke} strokeWidth={isActive ? 3 : 2} markerEnd={marker} />
      {geom.label && geom.labelPos && (
        <text x={geom.labelPos.x} y={geom.labelPos.y} textAnchor="start" dominantBaseline="central" fill={stroke} fontSize={13} fontWeight={600}>{geom.label}</text>
      )}
    </g>
  );
}

/** エッジ群の描画 */
function renderFlowchartEdges(
  edges: FlowchartEdge[],
  nodes: FlowchartNode[],
  layout: CachedLayoutResult,
  activeFlags: boolean[],
  nodeWidth: number
): React.ReactNode[] {
  const geometries = computeEdgeGeometries(nodes, edges, layout, nodeWidth);
  return geometries.map((geom) => renderEdgeGeometry(geom, activeFlags, nodes));
}

/** 接続線（フォールバック）の描画 */
function renderFlowchartConnections(
  cachedLayout: CachedLayoutResult,
  activeFlags: boolean[]
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const len = cachedLayout.inactiveConnections.length;
  for (let i = 0; i < len; i++) {
    const lineIsActive = activeFlags[i]! && activeFlags[i + 1]!;
    elements.push(lineIsActive ? cachedLayout.activeConnections[i] : cachedLayout.inactiveConnections[i]);
  }
  return elements;
}

/** ノード群の描画 */
function renderFlowchartNodeList(
  cachedLayout: CachedLayoutResult,
  activeFlags: boolean[]
): React.ReactNode[] {
  return activeFlags.map((isActive, i) => (isActive ? cachedLayout.activeNodes[i] : cachedLayout.inactiveNodes[i]));
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

  const cached = getCachedNodeLayouts(
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
      width={cached.totalWidth}
      height={cached.totalHeight}
      viewBox={`0 0 ${cached.totalWidth} ${cached.totalHeight}`}
      style={{ display: 'block', margin: '0 auto', flexShrink: 0 }}
    >
      {renderSvgDefs()}
      {edges && edges.length > 0
        ? renderFlowchartEdges(edges, nodes, cached, activeFlags, nodeWidth)
        : renderFlowchartConnections(cached, activeFlags)}
      {renderFlowchartNodeList(cached, activeFlags)}
    </svg>
  );
}


