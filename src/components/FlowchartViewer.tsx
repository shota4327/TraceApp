import React, { useMemo } from 'react';
import { FlowchartNode, FlowchartEdge } from '../types/flowchart';
import { renderFlowchartSvg } from '../services/flowchartRenderer';
import { generateFlowchartGraph } from '../services/flowchartGenerator';

interface FlowchartViewerProps {
  nodes?: FlowchartNode[];
  edges?: FlowchartEdge[];
  activeLine?: number;
  activeNodeId?: string;
  code?: string;
}

/**
 * 流れ図（フローチャート）表示コンポーネント
 * SVG レンダラーを用いてノードおよび CFG エッジを描画し、現在のアクティブノードを強調表示
 */
export const FlowchartViewer: React.FC<FlowchartViewerProps> = ({
  nodes,
  edges,
  activeLine,
  activeNodeId,
  code = '',
}) => {
  const displayGraph = useMemo(() => {
    if (nodes && nodes.length > 0) return { nodes, edges: edges || [] };
    if (code && code.trim()) return generateFlowchartGraph(code);
    return {
      nodes: [
        { id: 'node-start', type: 'terminal' as const, label: '開始', lineRange: [1, 1] as [number, number] },
        { id: 'node-end', type: 'terminal' as const, label: '終了', lineRange: [1, 1] as [number, number] },
      ],
      edges: [{ id: 'edge-start-end', sourceId: 'node-start', targetId: 'node-end', label: 'Next' as const }],
    };
  }, [nodes, edges, code]);

  const svgContent = useMemo(() => {
    return renderFlowchartSvg(displayGraph.nodes, { activeLine, activeNodeId, edges: displayGraph.edges });
  }, [displayGraph, activeLine, activeNodeId]);

  return (
    <div id="flowchart-viewer" data-testid="flowchart-viewer" role="tabpanel" aria-labelledby="tab-flowchart" style={containerStyle}>
      <div style={contentStyle}>{svgContent}</div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#ffffff',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-start',
  alignItems: 'center',
  padding: '16px',
  overflowY: 'auto',
};
