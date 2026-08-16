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

/** ステップスライダー＆カウンターサブコンポーネント */
const TabBarStepControl: React.FC<{
  currentStep: number;
  totalSteps: number;
  isTracing: boolean;
  onStepChange: (step: number) => void;
}> = ({ currentStep, totalSteps, isTracing, onStepChange }) => {
  const maxStep = Math.max(0, totalSteps - 1);
  return (
    <div style={stepControlWrapperStyle}>
      <span id="step-counter" data-testid="step-counter" style={stepCounterStyle}>
        {totalSteps > 0 ? `ステップ ${currentStep} / ${maxStep}` : 'ステップ 0 / 0'}
      </span>
      <input
        id="step-slider"
        data-testid="step-slider"
        type="range"
        min={0}
        max={maxStep}
        value={currentStep}
        onChange={(e) => onStepChange(Number(e.target.value))}
        disabled={totalSteps <= 0 || isTracing}
        style={stepSliderStyle}
        aria-label="ステップ進行スライダー"
      />
    </div>
  );
};

/** 左パネルのコード/流れ図タブバー */
const LeftPanelTabBar: React.FC<{
  activeTab: 'code' | 'flowchart';
  onSelectTab: (tab: 'code' | 'flowchart') => void;
  activeLine?: number;
  executionStatus?: 'not_started' | 'running' | 'ended';
  currentStep: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
  isTracing: boolean;
}> = ({
  activeTab,
  onSelectTab,
  activeLine,
  executionStatus,
  currentStep,
  totalSteps,
  onStepChange,
  isTracing,
}) => {
  let badgeText = '実行行: (未実行)';
  if (executionStatus === 'ended') {
    badgeText = '実行行: (実行終了)';
  } else if (executionStatus === 'running' || (activeLine !== undefined && activeLine > 0)) {
    badgeText = `実行行: Line ${activeLine}`;
  }

  return (
    <div style={tabContainerStyle} role="tablist" aria-label="表示モード切り替え">
      <div style={tabButtonGroupStyle}>
        <button
          id="tab-code"
          data-testid="tab-code"
          role="tab"
          aria-selected={activeTab === 'code'}
          aria-controls="panel-code"
          onClick={() => onSelectTab('code')}
          style={activeTab === 'code' ? activeTabStyle : tabStyle}
        >
          コード(Python)
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
      <div style={tabBarRightAreaStyle}>
        <TabBarStepControl
          currentStep={currentStep}
          totalSteps={totalSteps}
          isTracing={isTracing}
          onStepChange={onStepChange}
        />
        <span id="active-line-badge" data-testid="active-line-badge" style={highlightBadgeStyle}>
          {badgeText}
        </span>
      </div>
    </div>
  );
};

/**
 * 左パネルコンポーネント
 * コード/流れ図のタブ切り替え、ステップナビゲーション、ズーム倍率管理を統括
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
  const [zoom, setZoom] = useState<number>(100);

  const memoizedGraph = useMemo(() => {
    if (flowchartNodes && flowchartNodes.length > 0) {
      return { nodes: flowchartNodes, edges: flowchartEdges || [] };
    }
    return generateFlowchartGraph(code);
  }, [flowchartNodes, flowchartEdges, code]);

  return (
    <div style={containerStyle}>
      <LeftPanelTabBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeLine={activeLine}
        executionStatus={executionStatus}
        currentStep={currentStep}
        totalSteps={totalSteps}
        onStepChange={onStepChange}
        isTracing={isTracing}
      />
      <div style={contentStyle}>
        <div id="panel-code" role="tabpanel" aria-labelledby="tab-code" style={{ height: '100%', display: activeTab === 'code' ? 'block' : 'none' }}>
          <MonacoEditor code={code} onChange={onChangeCode} highlightLine={activeLine} zoom={zoom} />
        </div>
        <div style={{ height: '100%', display: activeTab === 'flowchart' ? 'block' : 'none' }}>
          <FlowchartViewer nodes={memoizedGraph.nodes} edges={memoizedGraph.edges} activeLine={activeLine} activeNodeId={activeNodeId} code={code} zoom={zoom} />
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
        zoom={zoom}
        onZoomChange={setZoom}
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
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#f1f5f9',
  borderBottom: '1px solid #e2e8f0',
  paddingRight: '12px',
};

const tabButtonGroupStyle: React.CSSProperties = {
  display: 'flex',
};

const tabBarRightAreaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexShrink: 0,
};

const stepControlWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexShrink: 0,
};

const stepCounterStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#475569',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  minWidth: '85px',
  textAlign: 'right',
  flexShrink: 0,
};

const stepSliderStyle: React.CSSProperties = {
  width: '100px',
  cursor: 'pointer',
  flexShrink: 0,
};

const highlightBadgeStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  padding: '3px 8px',
  borderRadius: '4px',
  backgroundColor: '#fef08a',
  color: '#854d0e',
  border: '1px solid #fde047',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  width: '130px',
  display: 'inline-flex',
  justifyContent: 'center',
  alignItems: 'center',
  textAlign: 'center',
  flexShrink: 0,
  boxSizing: 'border-box',
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
