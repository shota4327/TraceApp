import React, { useState, useMemo } from 'react';
import { MonacoEditor } from './MonacoEditor';
import { FlowchartViewer } from './FlowchartViewer';
import { StepNavigation } from './StepNavigation';
import { FlowchartNode, FlowchartEdge } from '../types/flowchart';
import { generateFlowchartGraph } from '../services/flowchartGenerator';

interface LeftPanelProps {
  code: string;
  onChangeCode: (code: string) => void;
  currentStep: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
  onReset: () => void;
  onRun?: () => void;
  onLast?: () => void;
  activeLine?: number;
  activeNodeId?: string;
  flowchartNodes?: FlowchartNode[];
  flowchartEdges?: FlowchartEdge[];
  isTracing?: boolean;
  executionStatus?: 'not_started' | 'running' | 'ended';
}

/** 左パネルのコード/流れ図タブバー */
const LeftPanelTabBar: React.FC<{
  activeTab: 'code' | 'flowchart';
  onSelectTab: (tab: 'code' | 'flowchart') => void;
}> = ({ activeTab, onSelectTab }) => (
  <div style={tabContainerStyle} role="tablist" aria-label="表示モード切り替え">
    <button
      id="tab-code"
      data-testid="tab-code"
      role="tab"
      aria-selected={activeTab === 'code'}
      aria-controls="panel-code"
      onClick={() => onSelectTab('code')}
      style={activeTab === 'code' ? activeTabStyle : tabStyle}
    >
      コード
    </button>
    <button
      id="tab-flowchart"
      data-testid="tab-flowchart"
      role="tab"
      aria-selected={activeTab === 'flowchart'}
      aria-controls="flowchart-viewer"
      onClick={() => onSelectTab('flowchart')}
      style={activeTab === 'flowchart' ? activeTabStyle : tabStyle}
    >
      流れ図
    </button>
  </div>
);

/**
 * 左パネルコンポーネント
 * コード/流れ図のタブ切り替えおよびステップナビゲーションを統括
 */
export const LeftPanel: React.FC<LeftPanelProps> = ({
  code,
  onChangeCode,
  currentStep,
  totalSteps,
  onStepChange,
  onReset,
  onRun,
  onLast,
  activeLine,
  activeNodeId,
  flowchartNodes,
  flowchartEdges,
  isTracing = false,
  executionStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'flowchart'>('code');

  const memoizedGraph = useMemo(() => {
    if (flowchartNodes && flowchartNodes.length > 0) {
      return { nodes: flowchartNodes, edges: flowchartEdges || [] };
    }
    return generateFlowchartGraph(code);
  }, [flowchartNodes, flowchartEdges, code]);

  return (
    <div style={containerStyle}>
      <LeftPanelTabBar activeTab={activeTab} onSelectTab={setActiveTab} />
      <div style={contentStyle}>
        <div id="panel-code" role="tabpanel" aria-labelledby="tab-code" style={{ height: '100%', display: activeTab === 'code' ? 'block' : 'none' }}>
          <MonacoEditor code={code} onChange={onChangeCode} highlightLine={activeLine} executionStatus={executionStatus} />
        </div>
        <div style={{ height: '100%', display: activeTab === 'flowchart' ? 'block' : 'none' }}>
          <FlowchartViewer nodes={memoizedGraph.nodes} edges={memoizedGraph.edges} activeLine={activeLine} activeNodeId={activeNodeId} code={code} />
        </div>
      </div>
      <StepNavigation
        currentStep={currentStep}
        totalSteps={totalSteps}
        onStepChange={onStepChange}
        onReset={onReset}
        onRun={onRun}
        onLast={onLast}
        isTracing={isTracing}
      />
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  borderRight: '1px solid #e2e8f0',
  backgroundColor: '#ffffff',
};

const tabContainerStyle: React.CSSProperties = {
  display: 'flex',
  backgroundColor: '#f1f5f9',
  borderBottom: '1px solid #e2e8f0',
};

const tabStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  borderBottom: '2px solid transparent',
  backgroundColor: 'transparent',
  color: '#64748b',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  backgroundColor: '#ffffff',
  color: '#2563eb',
  borderBottom: '2px solid #2563eb',
  fontWeight: 600,
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
};
