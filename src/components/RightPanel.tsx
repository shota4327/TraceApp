import React, { useState } from 'react';
import { VariableTable } from './VariableTable';
import { OutputConsole } from './OutputConsole';
import { StepSnapshot } from '../types/trace';
import { useVerticalResize } from '../hooks/useVerticalResize';

interface RightPanelProps {
  snapshots?: StepSnapshot[];
  currentStepIndex?: number;
  stdout?: string;
}

/**
 * 右パネルコンポーネント
 * 変数履歴表と標準出力コンソールを保持し、ドラッグで上下比率を変更可能
 */
export const RightPanel: React.FC<RightPanelProps> = ({
  snapshots = [],
  currentStepIndex = 0,
  stdout = '',
}) => {
  const { containerRef, topRatio, isDragging, handlePointerDown } = useVerticalResize({
    initialRatio: 0.8,
    minRatio: 0.2,
    maxRatio: 0.8,
  });
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const topPercent = `calc(${topRatio * 100}% - 4px)`;
  const bottomPercent = `calc(${(1 - topRatio) * 100}% - 4px)`;

  return (
    <div
      ref={containerRef}
      id="right-panel"
      data-testid="right-panel"
      style={{
        ...containerStyle,
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      <div style={{ ...topPanelStyle, flex: `0 0 ${topPercent}`, height: topPercent }}>
        <VariableTable snapshots={snapshots} currentStepIndex={currentStepIndex} />
      </div>

      <div
        id="right-panel-resizer"
        data-testid="right-panel-resizer"
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={handlePointerDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          ...resizerStyle,
          backgroundColor: isDragging || isHovered ? '#3b82f6' : '#e2e8f0',
        }}
      >
        <div style={handleKnobStyle} />
      </div>

      <div style={{ ...bottomPanelStyle, flex: `0 0 ${bottomPercent}`, height: bottomPercent }}>
        <OutputConsole stdout={stdout} />
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#ffffff',
  position: 'relative',
};

const topPanelStyle: React.CSSProperties = {
  overflow: 'hidden',
};

const bottomPanelStyle: React.CSSProperties = {
  overflow: 'hidden',
};

const resizerStyle: React.CSSProperties = {
  height: '8px',
  cursor: 'row-resize',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.15s ease',
  zIndex: 10,
  flexShrink: 0,
};

const handleKnobStyle: React.CSSProperties = {
  width: '32px',
  height: '3px',
  borderRadius: '2px',
  backgroundColor: '#94a3b8',
  pointerEvents: 'none',
};
