import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { FlowchartNode, FlowchartEdge } from '../types/flowchart';
import { renderFlowchartSvg } from '../services/flowchartRenderer';
import { generateFlowchartGraph } from '../services/flowchartGenerator';

interface FlowchartViewerProps {
  nodes?: FlowchartNode[];
  edges?: FlowchartEdge[];
  activeLine?: number;
  activeNodeId?: string;
  code?: string;
  zoom?: number;
}

/** アクティブノードが表示領域外の場合にスムーズスクロールするフック */
function useFlowchartAutoScroll(
  containerRef: React.RefObject<HTMLDivElement>,
  activeNodeId?: string,
  activeLine?: number
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeElement = container.querySelector('.flowchart-node.active') as HTMLElement | SVGElement | null;
    if (!activeElement || typeof activeElement.getBoundingClientRect !== 'function') return;

    const containerRect = typeof container.getBoundingClientRect === 'function'
      ? container.getBoundingClientRect()
      : { top: 0, bottom: 1000, left: 0, right: 1000 };
    const elementRect = activeElement.getBoundingClientRect();

    const isOutsideVertical = elementRect.top < containerRect.top + 20 || elementRect.bottom > containerRect.bottom - 20;
    const isOutsideHorizontal = elementRect.left < containerRect.left + 20 || elementRect.right > containerRect.right - 20;

    if (isOutsideVertical || isOutsideHorizontal) {
      if (typeof activeElement.scrollIntoView === 'function') {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      }
    }
  }, [activeNodeId, activeLine, containerRef]);
}

/** マウスドラッグによる上下左右パン操作を管理するフック */
function useFlowchartPan(containerRef: React.RefObject<HTMLDivElement>) {
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    setIsPanning(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: containerRef.current.scrollLeft || 0,
      scrollTop: containerRef.current.scrollTop || 0,
    };
    if (typeof (e.currentTarget as HTMLElement).setPointerCapture === 'function') {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  }, [containerRef]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || !containerRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    containerRef.current.scrollLeft = dragStartRef.current.scrollLeft - dx;
    containerRef.current.scrollTop = dragStartRef.current.scrollTop - dy;
  }, [isPanning, containerRef]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setIsPanning(false);
    if (typeof (e.currentTarget as HTMLElement).releasePointerCapture === 'function') {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  }, []);

  return { isPanning, handlePointerDown, handlePointerMove, handlePointerUp };
}

/**
 * 流れ図（フローチャート）表示コンポーネント
 * SVG レンダラー、拡大率（ズーム）、マウスドラッグパン、およびアクティブノード自動追従を提供
 */
export const FlowchartViewer: React.FC<FlowchartViewerProps> = ({
  nodes,
  edges,
  activeLine,
  activeNodeId,
  code = '',
  zoom = 100,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  useFlowchartAutoScroll(containerRef, activeNodeId, activeLine);
  const { isPanning, handlePointerDown, handlePointerMove, handlePointerUp } = useFlowchartPan(containerRef);

  const scale = zoom / 100;
  const svgWidth = (React.isValidElement(svgContent) ? Number(svgContent.props.width) : 0) || 300;
  const svgHeight = (React.isValidElement(svgContent) ? Number(svgContent.props.height) : 0) || 500;

  return (
    <div
      id="flowchart-viewer"
      data-testid="flowchart-viewer"
      role="tabpanel"
      aria-labelledby="tab-flowchart"
      style={containerStyle}
    >
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          ...contentStyle,
          cursor: isPanning ? 'grabbing' : 'grab',
          userSelect: isPanning ? 'none' : 'auto',
        }}
      >
        <div style={scrollContentWrapperStyle}>
          <div
            style={{
              width: svgWidth * scale,
              height: svgHeight * scale,
              position: 'relative',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                transition: 'transform 0.15s ease',
                width: svgWidth,
                height: svgHeight,
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            >
              {svgContent}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#ffffff',
  overflow: 'hidden',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  width: '100%',
  position: 'relative',
  padding: '24px 20px',
  boxSizing: 'border-box',
};

const scrollContentWrapperStyle: React.CSSProperties = {
  minWidth: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  width: 'max-content',
  boxSizing: 'border-box',
};
