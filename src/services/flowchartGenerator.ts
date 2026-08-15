import { FlowchartNode, FlowchartNodeType, FlowchartEdge, FlowchartGraph } from '../types/flowchart';

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

/** 1行のコード文字列からノード種別とラベルを決定 */
function classifyLine(trimmed: string): { type: FlowchartNodeType; label: string } {
  if (trimmed.startsWith('def ')) {
    return { type: 'subroutine', label: trimmed.replace(/:$/, '') };
  }
  if (trimmed.startsWith('if ') || trimmed.startsWith('elif ')) {
    return { type: 'decision', label: trimmed.replace(/:$/, '') };
  }
  if (trimmed.startsWith('else:')) {
    return { type: 'decision', label: 'else' };
  }
  if (trimmed.startsWith('for ') || trimmed.startsWith('while ')) {
    return { type: 'loop', label: trimmed.replace(/:$/, '') };
  }
  return { type: 'process', label: trimmed };
}

/** 1行から FlowchartNode を生成 */
function createNodeForLine(trimmed: string, lineNo: number, yPos: number): FlowchartNode {
  const { type, label } = classifyLine(trimmed);
  const id = `node-${lineNo}`;
  const xmlStyle = getMxStyleForType(type);
  const escaped = escapeXml(label);
  const xmlSnippet = `<mxCell id="${id}" value="${escaped}" style="${xmlStyle}" vertex="1" parent="1"><mxGeometry x="100" y="${yPos}" width="180" height="50" as="geometry"/></mxCell>`;

  return {
    id,
    type,
    label,
    lineRange: [lineNo, lineNo],
    x: 100,
    y: yPos,
    width: 180,
    height: 50,
    xmlSnippet,
  };
}

interface ParsedLineInfo {
  text: string;
  lineNo: number;
  indent: number;
}

/** コード文字列を解析用行配列に分解 */
function parseValidLines(code: string): ParsedLineInfo[] {
  const rawLines = code.split('\n');
  const validLines: ParsedLineInfo[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const text = rawLines[i] || '';
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = text.search(/\S/);
    validLines.push({ text: trimmed, lineNo: i + 1, indent: indent >= 0 ? indent : 0 });
  }
  return validLines;
}

/** ループ終了ノードを生成 */
function createLoopEndNode(headerId: string, yPos: number): FlowchartNode {
  const id = `node-loop-end-${headerId}`;
  const label = 'ループ終了';
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
}

/** ループブロック終了時のノードおよびエッジ生成 helper */
function processPoppedLoopBlock(
  popped: BlockContext,
  targetId: string,
  edges: FlowchartEdge[],
  nodes: FlowchartNode[]
): string {
  const loopEndNode = createLoopEndNode(popped.headerId, nodes.length * 60 + 20);
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
  for (const srcId of popped.mergeTargets) {
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
  inheritedMergeTargets: string[] = []
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
    blockStack.push({ type: 'loop', headerId: node.id, indent: lineIndent, mergeTargets: [] });
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
): { inheritedMergeTargets: string[]; lastPoppedId?: string } {
  const isElif = line.text.startsWith('elif ');
  const isElse = line.text.startsWith('else:');
  const isIfChainContinuation = isElif || isElse;
  let inheritedMergeTargets: string[] = [];
  let lastPoppedId: string | undefined;

  while (blockStack.length > 0 && line.indent <= blockStack[blockStack.length - 1]!.indent) {
    const top = blockStack[blockStack.length - 1]!;
    if (isIfChainContinuation && top.type === 'if' && line.indent === top.indent) {
      const popped = blockStack.pop()!;
      if (!edges.some((e) => e.sourceId === popped.headerId && e.label === 'False')) {
        edges.push({
          id: `edge-false-${popped.headerId}-${nodeId}`,
          sourceId: popped.headerId,
          targetId: nodeId,
          label: 'False',
        });
      }
      inheritedMergeTargets = [...popped.mergeTargets];
      break;
    } else {
      lastPoppedId = processPoppedBlock(blockStack.pop()!, nodeId, edges, nodes);
    }
  }
  return { inheritedMergeTargets, lastPoppedId };
}

/** 終了端子ノードの追加と残存ブロックの合流処理 */
function finalizeFlowchartGraph(
  code: string,
  nodes: FlowchartNode[],
  edges: FlowchartEdge[],
  blockStack: BlockContext[],
  prevNodeId: string
): void {
  const endNode = createTerminalNode('node-end', '終了', code.split('\n').length, nodes.length * 60 + 20);

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

/**
 * Pythonコードから FlowchartGraph (ノード・エッジ構造) を自動生成
 */
export function generateFlowchartGraph(code: string): FlowchartGraph {
  if (!code || !code.trim()) return buildDefaultGraph();

  const validLines = parseValidLines(code);
  const nodes: FlowchartNode[] = [];
  const edges: FlowchartEdge[] = [];
  const startNode = createTerminalNode('node-start', '開始', 1, 20);
  nodes.push(startNode);

  let prevNodeId = startNode.id;
  const blockStack: BlockContext[] = [];

  for (let i = 0; i < validLines.length; i++) {
    const line = validLines[i]!;
    const nodeId = `node-${line.lineNo}`;

    const { inheritedMergeTargets, lastPoppedId } = handleBlockStackUnwind(line, nodeId, blockStack, edges, nodes);
    if (lastPoppedId) prevNodeId = lastPoppedId;

    const node = createNodeForLine(line.text, line.lineNo, nodes.length * 60 + 20);
    nodes.push(node);

    processLineNodeEdge(node, prevNodeId, startNode.id, validLines[i + 1], line.indent, blockStack, edges, inheritedMergeTargets);

    if (blockStack.length > 0) {
      const top = blockStack[blockStack.length - 1]!;
      top.bodyLastId = node.id;
      if (top.type === 'if' && node.type !== 'decision' && !top.mergeTargets.includes(node.id)) {
        top.mergeTargets.push(node.id);
      }
    }
    prevNodeId = node.id;
  }

  finalizeFlowchartGraph(code, nodes, edges, blockStack, prevNodeId);
  return { nodes, edges };
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
