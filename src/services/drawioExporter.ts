import { FlowchartNode, FlowchartEdge } from '../types/flowchart';
import { getMxStyleForNode } from './flowchartGenerator';
import { calculateNodeLayouts } from './flowchartRenderer';

/**
 * 特殊文字を XML エスケープ
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\n/g, '&#xa;');
}

/** 頂点（ノードとコメント）の XML セル配列を生成 */
function buildDrawIoVertexXmls(nodes: FlowchartNode[], layout: ReturnType<typeof calculateNodeLayouts>): string[] {
  const nodeWidth = 180;
  const vertexXmls: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const x = layout.nodeXs[i] ?? 100;
    const y = layout.nodeYs[i] ?? 20;
    const height = layout.nodeHeights[i] ?? 50;
    const style = getMxStyleForNode(node);
    const escapedValue = escapeXml(node.label);

    vertexXmls.push(
      `<mxCell id="${node.id}" value="${escapedValue}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${nodeWidth}" height="${height}" as="geometry"/></mxCell>`
    );

    if (node.comment) {
      const commentX = x + nodeWidth + 12;
      const commentY = y + (height - 30) / 2;
      const escapedComment = escapeXml(node.comment);
      vertexXmls.push(
        `<mxCell id="comment-${node.id}" value="${escapedComment}" style="text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontColor=#64748b;fontSize=12;" vertex="1" parent="1"><mxGeometry x="${commentX}" y="${commentY}" width="120" height="30" as="geometry"/></mxCell>`
      );
    }
  }
  return vertexXmls;
}

/** 描画に必要なエッジの XML セル配列を生成（不要な制御線・重複を除外しアンカー指定） */
function buildDrawIoEdgeXmls(edges: FlowchartEdge[], nodeMap: Map<string, FlowchartNode>): string[] {
  const validEdges = edges.filter((e) => !e.id.includes('loop-exit') && !e.id.includes('loopback') && e.label !== 'Loop');
  const uniqueEdges: FlowchartEdge[] = [];
  const seenPairs = new Set<string>();

  for (const edge of validEdges) {
    const pairKey = `${edge.sourceId}->${edge.targetId}`;
    if (!seenPairs.has(pairKey)) {
      seenPairs.add(pairKey);
      uniqueEdges.push(edge);
    }
  }

  return uniqueEdges.map((edge) => {
    const srcNode = nodeMap.get(edge.sourceId);
    const isFalseBranch = (edge.label === 'False' || edge.label === 'No' || edge.id.includes('edge-false-')) && srcNode?.type === 'decision';
    const exitAnchor = isFalseBranch ? 'exitX=1;exitY=0.5;' : 'exitX=0.5;exitY=1;';
    const defaultStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;${exitAnchor}exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;endArrow=none;endFill=0;strokeColor=#64748b;`;
    const styleStr = edge.style || defaultStyle;
    return `<mxCell id="${edge.id}" value="" style="${styleStr}" edge="1" parent="1" source="${edge.sourceId}" target="${edge.targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
  });
}

/**
 * draw.io (diagrams.net) で直接編集可能な完全な mxfile XML 文字列を生成
 * - 画面レンダラーと完全に一致した X, Y 座標・幅・高さを反映
 * - loopLimit (flipV=0 / flipV=1), 平行四辺形, はじめ/おわり, 直線接続線を反映
 * - 重複エッジ・不要なループ内部制御エッジ（loop-exit, loopback）を除外
 * - アンカーポイント（exitX/exitY, entryX/entryY）を明示し、エッジを先に出力してブロック重なりを解消
 */
export function generateFullDrawIoXml(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[]
): string {
  const layout = calculateNodeLayouts(nodes, edges);
  const nodeMap = new Map<string, FlowchartNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const vertexXmls = buildDrawIoVertexXmls(nodes, layout);
  const edgeXmls = buildDrawIoEdgeXmls(edges, nodeMap);

  // レイヤー順序: エッジ（線）を先、頂点（ブロック）を後に配置することで、線がブロックを突き抜けないようにする
  const allCells = [...edgeXmls, ...vertexXmls].join('\n    ');
  const timestamp = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${timestamp}" agent="PyTrace" version="21.0.0" type="device">
  <diagram id="flowchart-diagram" name="流れ図">
    <mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${allCells}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

/**
 * draw.io ファイルの保存ダイアログを表示して保存
 * ※ ファイル名は初期状態で空白とし、ユーザーに入力させます
 */
export async function saveDrawIoFile(xmlContent: string): Promise<void> {
  // 1. File System Access API (モダンブラウザ)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        types: [
          {
            description: 'draw.io 図面ファイル (*.drawio)',
            accept: {
              'application/vnd.jgraph.mxfile': ['.drawio'],
              'application/xml': ['.xml'],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(xmlContent);
      await writable.close();
      return;
    } catch (err: any) {
      // ユーザーが保存ダイアログをキャンセルした場合は何もせず終了
      if (err.name === 'AbortError') {
        return;
      }
      console.warn('showSaveFilePicker failed, falling back to download:', err);
    }
  }

  // 2. フォールバック (非対応ブラウザ / prompt によるファイル名入力)
  let inputName = '';
  if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
    const promptRes = window.prompt('保存するファイル名を入力してください（拡張子不要）:');
    if (promptRes === null) {
      // キャンセル
      return;
    }
    inputName = (promptRes || '').trim();
  }

  const filename = inputName
    ? inputName.endsWith('.drawio') || inputName.endsWith('.xml')
      ? inputName
      : `${inputName}.drawio`
    : 'flowchart.drawio';

  const blob = new Blob([xmlContent], { type: 'application/vnd.jgraph.mxfile;charset=utf-8' });
  if (typeof window !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }
}
