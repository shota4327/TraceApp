import { FlowchartNode, FlowchartEdge } from '../types/flowchart';

/**
 * エッジの幾何経路データ構造
 */
export interface EdgePathGeometry {
  edgeId: string;
  sourceId: string;
  targetId: string;
  type: 'straight' | 'branch-elif' | 'branch-merge' | 'merge';
  start: { x: number; y: number };
  points: { x: number; y: number }[]; // 中継屈折点（ウェイポイント）
  end: { x: number; y: number };
  label?: string;
  labelPos?: { x: number; y: number };
}

/**
 * ノード配置レイアウト結果構造体
 */
export interface NodeLayoutResult {
  nodeXs: number[];
  nodeYs: number[];
  nodeHeights: number[];
  nodeCols: number[];
  totalWidth: number;
  totalHeight: number;
}

/** トークンの表示幅ユニット（全角=1.0, 半角=0.55）を算出 */
export function calcTokenUnits(token: string): number {
  let units = 0;
  for (let i = 0; i < token.length; i++) {
    units += token.charCodeAt(i) <= 0x7e ? 0.55 : 1.0;
  }
  return units;
}

/** 文字列を変数名・数値・演算子・記号・空白のトークン列に分割 */
export function tokenizeLabel(text: string): string[] {
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

const labelWrapCache = new Map<string, string[]>();

/** 改行コードおよびトークン単位（単語・記号区切り）に基づき行分割 */
export function wrapProcessLabel(text: string, maxUnitsPerLine = 9.5): string[] {
  if (!text) return [''];
  const cacheKey = `${maxUnitsPerLine}:${text}`;
  const cached = labelWrapCache.get(cacheKey);
  if (cached) return cached;

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
  if (labelWrapCache.size > 2000) labelWrapCache.clear();
  labelWrapCache.set(cacheKey, allLines);
  return allLines;
}

/** ノードの表示高さを文字数・行数から動的計算（複数行や長文の場合は自動拡大） */
export function calculateNodeHeight(node: FlowchartNode, baseHeight = 50): number {
  if (node.height && node.height > baseHeight) return node.height;

  const lines = wrapProcessLabel(node.label || '', 9.5);
  if (lines.length > 1) {
    return Math.max(baseHeight, 16 + lines.length * 20);
  }
  return baseHeight;
}

/** ノード群をメイン処理と各関数ブロックに分割 */
export function partitionNodeGroups(nodes: FlowchartNode[]): FlowchartNode[][] {
  const groups: FlowchartNode[][] = [];
  let currentGroup: FlowchartNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.id === 'node-start') {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [node];
    } else if (node.subType === 'function-terminal' && (node.id.includes('def') || (!node.label.startsWith('return') && node.label !== '終了' && node.label !== 'おわり'))) {
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
export function calculateGroupColumns(groupNodes: FlowchartNode[], edges?: FlowchartEdge[]): number[] {
  const cols = new Array(groupNodes.length).fill(0);
  if (!edges || edges.length === 0) return cols;

  for (let i = 0; i < groupNodes.length; i++) {
    const node = groupNodes[i]!;
    if (node.id === 'node-end' || node.id.includes('loop-end') || node.label.includes('終了') || node.label.includes('おわり')) continue;

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
    if (cols[i] === 0 && !node.label.includes('終了') && !node.label.includes('おわり') && node.id !== 'node-end' && !node.id.includes('loop-end')) {
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

/** 特定カラムとY方向で重なる左側カラムノードの最大コメント幅を算出 */
function calcOverlapCommentWidth(
  col: number,
  nodes: FlowchartNode[],
  nodeCols: number[],
  nodeYs: number[],
  nodeHeights: number[]
): number {
  const nodesInCol = nodes.map((_, i) => i).filter((i) => nodeCols[i] === col);
  let maxOverlapW = 0;

  for (const tgtIdx of nodesInCol) {
    const tgtY = nodeYs[tgtIdx]!;
    const tgtH = nodeHeights[tgtIdx] ?? 50;

    for (let srcIdx = 0; srcIdx < nodes.length; srcIdx++) {
      if (nodeCols[srcIdx] === col - 1) {
        const srcY = nodeYs[srcIdx]!;
        const srcH = nodeHeights[srcIdx] ?? 50;
        if (srcY + srcH >= tgtY - 20 && srcY <= tgtY + tgtH + 20) {
          const cw = calcCommentWidth(nodes[srcIdx]?.comment);
          if (cw > maxOverlapW) maxOverlapW = cw;
        }
      }
    }
  }
  return maxOverlapW;
}

/** カラムごとの開始 X 座標配列を算出（Y方向で重なる左側ノードのコメント幅のみを考慮） */
function computeColumnStartX(
  nodes: FlowchartNode[],
  nodeCols: number[],
  nodeYs: number[],
  nodeHeights: number[],
  nodeWidth: number,
  baseColGap: number,
  paddingX: number
): number[] {
  const maxCol = Math.max(0, ...nodeCols);
  const colStartX = new Array<number>(maxCol + 1).fill(paddingX);

  for (let c = 1; c <= maxCol; c++) {
    const maxOverlapW = calcOverlapCommentWidth(c, nodes, nodeCols, nodeYs, nodeHeights);
    const effectiveGap = Math.max(baseColGap, maxOverlapW + 16);
    colStartX[c] = colStartX[c - 1]! + nodeWidth + effectiveGap;
  }
  return colStartX;
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
  const colStartX = computeColumnStartX(nodes, nodeCols, nodeYs, nodeHeights, nodeWidth, colGap, paddingX);
  const nodeXs = nodeCols.map((col) => colStartX[col]!);
  const maxCol = Math.max(0, ...nodeCols);

  const hasBranchOrMerge = edges?.some(
    (e) =>
      !e.id.includes('loop-exit') &&
      !e.id.includes('loopback') &&
      e.label !== 'Loop' &&
      (e.label === 'False' || e.label === 'No' || e.id.includes('merge') || e.id.includes('edge-false-'))
  );
  const baseExtraRight = hasBranchOrMerge ? 48 : 16;
  let maxRightEdge = colStartX[maxCol]! + nodeWidth + baseExtraRight;

  for (let i = 0; i < nodes.length; i++) {
    const x = nodeXs[i]!;
    const cw = calcCommentWidth(nodes[i]?.comment);
    const rightEdge = x + nodeWidth + (cw > 0 ? cw + 24 : 0);
    if (rightEdge > maxRightEdge) maxRightEdge = rightEdge;
  }

  const totalWidth = maxRightEdge;
  const maxYWithHeight = Math.max(...nodeYs.map((y, idx) => y + (nodeHeights[idx] ?? baseNodeHeight)));
  const totalHeight = Math.max(maxGroupHeight + paddingY, maxYWithHeight + paddingY);

  return { nodeXs, totalWidth, totalHeight };
}

/** 各ノードの X, Y 座標と全体のサイズを算出 */
export function calculateNodeLayouts(
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
): NodeLayoutResult {
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

/** 合流先ノード (tgtIndex) の直前にある分岐ブロックの最下部 Y 座標を取得 */
export function getBranchMaxBottomY(tgtIndex: number, layout: NodeLayoutResult): number {
  let maxBottom = 0;
  for (let i = 0; i < tgtIndex; i++) {
    const b = (layout.nodeYs[i] ?? 0) + (layout.nodeHeights[i] ?? 50);
    if (b > maxBottom) maxBottom = b;
  }
  return maxBottom;
}

/** 単一エッジの幾何経路（始点・中継屈折点・終点）を計算 */
function computeSingleEdgeGeometry(
  edge: FlowchartEdge,
  srcIdx: number,
  tgtIdx: number,
  nodes: FlowchartNode[],
  layout: NodeLayoutResult,
  nodeWidth: number
): EdgePathGeometry {
  const srcNode = nodes[srcIdx]!;
  const srcX = layout.nodeXs[srcIdx] ?? 100;
  const srcY = layout.nodeYs[srcIdx] ?? 20;
  const srcH = layout.nodeHeights[srcIdx] ?? 50;
  const srcCol = layout.nodeCols[srcIdx] ?? 0;

  const tgtX = layout.nodeXs[tgtIdx] ?? 100;
  const tgtY = layout.nodeYs[tgtIdx] ?? 20;
  const tgtCol = layout.nodeCols[tgtIdx] ?? 0;

  const isFalse = (edge.label === 'False' || edge.label === 'No' || edge.id.includes('edge-false-')) && srcNode.type === 'decision';
  const isMerge = (srcCol > tgtCol) || (edge.id.includes('merge') && srcCol > 0);

  if (isFalse) {
    if (tgtCol > srcCol) {
      const tgtCenterX = tgtX + nodeWidth / 2;
      const startY = srcY + srcH / 2;
      return {
        edgeId: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        type: 'branch-elif',
        start: { x: srcX + nodeWidth, y: startY },
        points: [{ x: tgtCenterX, y: startY }],
        end: { x: tgtCenterX, y: tgtY },
        label: 'No',
        labelPos: { x: srcX + nodeWidth + 8, y: startY - 8 },
      };
    }
    const rightX = srcX + nodeWidth + 40;
    const branchBottom = getBranchMaxBottomY(tgtIdx, layout);
    const prevBottom = branchBottom > 0 ? branchBottom : (srcY + srcH);
    const mergeY = prevBottom + (tgtY - prevBottom) / 2;
    const mergeX = tgtX + nodeWidth / 2;
    const startY = srcY + srcH / 2;
    return {
      edgeId: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      type: 'branch-merge',
      start: { x: srcX + nodeWidth, y: startY },
      points: [
        { x: rightX, y: startY },
        { x: rightX, y: mergeY },
      ],
      end: { x: mergeX, y: mergeY },
      label: 'No',
      labelPos: { x: srcX + nodeWidth + 8, y: startY - 8 },
    };
  }

  if (isMerge) {
    const startX = srcX + nodeWidth / 2;
    const startY = srcY + srcH;
    const branchBottom = Math.max(getBranchMaxBottomY(tgtIdx, layout), startY);
    const mergeY = branchBottom + (tgtY - branchBottom) / 2;
    const mergeX = tgtX + nodeWidth / 2;
    return {
      edgeId: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      type: 'merge',
      start: { x: startX, y: startY },
      points: [{ x: startX, y: mergeY }],
      end: { x: mergeX, y: mergeY },
    };
  }

  const isYes = (edge.label === 'True' || edge.label === 'Yes') && srcNode.type === 'decision';
  const startX = srcX + nodeWidth / 2;
  const startY = srcY + srcH;

  return {
    edgeId: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    type: 'straight',
    start: { x: startX, y: startY },
    points: [],
    end: { x: tgtX + nodeWidth / 2, y: tgtY },
    label: isYes ? 'Yes' : edge.label,
    labelPos: isYes ? { x: startX + 8, y: startY + 10 } : undefined,
  };
}

/**
 * 全エッジの幾何経路配列を計算（不要なループ制御線・重複を除外した純粋幾何データ）
 */
export function computeEdgeGeometries(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[],
  layout: NodeLayoutResult,
  nodeWidth = 180
): EdgePathGeometry[] {
  const validEdges = edges.filter((e) => !e.id.includes('loop-exit') && !e.id.includes('loopback') && e.label !== 'Loop');
  const uniqueEdges: FlowchartEdge[] = [];
  const seenPairs = new Set<string>();
  const nodeIndexMap = new Map<string, number>();
  nodes.forEach((n, idx) => nodeIndexMap.set(n.id, idx));

  for (const edge of validEdges) {
    const pairKey = `${edge.sourceId}->${edge.targetId}`;
    if (!seenPairs.has(pairKey)) {
      seenPairs.add(pairKey);
      uniqueEdges.push(edge);
    }
  }

  const geometries: EdgePathGeometry[] = [];
  for (const edge of uniqueEdges) {
    const srcIdx = nodeIndexMap.get(edge.sourceId);
    const tgtIdx = nodeIndexMap.get(edge.targetId);
    if (srcIdx !== undefined && tgtIdx !== undefined) {
      geometries.push(computeSingleEdgeGeometry(edge, srcIdx, tgtIdx, nodes, layout, nodeWidth));
    }
  }
  return geometries;
}
