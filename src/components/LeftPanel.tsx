import React, { useState, useMemo } from 'react';
import { MonacoEditor } from './MonacoEditor';
import { FlowchartViewer } from './FlowchartViewer';
import { StepNavigation } from './StepNavigation';
import { FlowchartNode, FlowchartEdge } from '../types/flowchart';
import { generateFlowchartGraph } from '../services/flowchartGenerator';

export type LeftPanelTab = 'code' | 'vba' | 'flowchart';

interface LeftPanelProps {
  code: string;
  onChangeCode: (code: string) => void;
  vbaCode?: string;
  onChangeVbaCode?: (vbaCode: string) => void;
  onConvertToVba?: () => void;
  onConvertToPython?: () => void;
  currentStep: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
  onReset: () => void;
  onRun?: () => void;
  onLast?: () => void;
  activeLine?: number;
  activeVbaLine?: number;
  activeNodeId?: string;
  flowchartNodes?: FlowchartNode[];
  flowchartEdges?: FlowchartEdge[];
  isTracing?: boolean;
  isCodeDirty?: boolean;
  executionStatus?: 'not_started' | 'running' | 'ended';
  activeTab?: LeftPanelTab;
  onChangeTab?: (tab: LeftPanelTab) => void;
}

/** ステップスライダー＆カウンターサブコンポーネント */
const TabBarStepControl: React.FC<{
  currentStep: number;
  totalSteps: number;
  isTracing: boolean;
  isCodeDirty?: boolean;
  onStepChange: (step: number) => void;
}> = ({ currentStep, totalSteps, isTracing, isCodeDirty, onStepChange }) => {
  const maxStep = Math.max(0, totalSteps - 1);
  const isSliderDisabled = totalSteps <= 0 || isTracing || !!isCodeDirty;

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
        disabled={isSliderDisabled}
        style={isSliderDisabled ? disabledStepSliderStyle : stepSliderStyle}
        aria-label="ステップ進行スライダー"
      />
    </div>
  );
};

/** 左パネルのコード/マクロ言語/流れ図タブバー */
const LeftPanelTabBar: React.FC<{
  activeTab: LeftPanelTab;
  onSelectTab: (tab: LeftPanelTab) => void;
  activeLine?: number;
  activeVbaLine?: number;
  executionStatus?: 'not_started' | 'running' | 'ended';
  currentStep: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
  isTracing: boolean;
  isCodeDirty?: boolean;
}> = ({
  activeTab,
  onSelectTab,
  activeLine,
  activeVbaLine,
  executionStatus,
  currentStep,
  totalSteps,
  onStepChange,
  isTracing,
  isCodeDirty,
}) => {
  const currentLine = activeTab === 'vba' ? (activeVbaLine ?? activeLine) : activeLine;
  let badgeText = '実行行: (未実行)';
  if (executionStatus === 'ended') {
    badgeText = '実行行: (実行終了)';
  } else if (executionStatus === 'running' || (currentLine !== undefined && currentLine > 0)) {
    badgeText = `実行行: Line ${currentLine}`;
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
          id="tab-vba"
          data-testid="tab-vba"
          role="tab"
          aria-selected={activeTab === 'vba'}
          aria-controls="panel-vba"
          onClick={() => onSelectTab('vba')}
          style={activeTab === 'vba' ? activeTabStyle : tabStyle}
        >
          コード(マクロ言語)
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
          isCodeDirty={isCodeDirty}
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
 * Python/VBA/流れ図のタブ切り替え、ステップナビゲーション、ズーム倍率管理、相互変換を統括
 */
export const LeftPanel: React.FC<LeftPanelProps> = ({
  code,
  onChangeCode,
  vbaCode = '',
  onChangeVbaCode = () => {},
  onConvertToVba,
  onConvertToPython,
  currentStep,
  totalSteps,
  onStepChange,
  onReset,
  onRun,
  onLast,
  activeLine,
  activeVbaLine,
  activeNodeId,
  flowchartNodes,
  flowchartEdges,
  isTracing = false,
  isCodeDirty = false,
  executionStatus,
  activeTab: externalActiveTab,
  onChangeTab: externalOnChangeTab,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<LeftPanelTab>('code');
  const [zoom, setZoom] = useState<number>(100);

  const activeTab = externalActiveTab ?? internalActiveTab;
  const setActiveTab = externalOnChangeTab ?? setInternalActiveTab;

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
        activeVbaLine={activeVbaLine}
        executionStatus={executionStatus}
        currentStep={currentStep}
        totalSteps={totalSteps}
        onStepChange={onStepChange}
        isTracing={isTracing}
        isCodeDirty={isCodeDirty}
      />
      <div style={contentStyle}>
        {/* Python コードエディタパネル */}
        <div
          id="panel-code"
          data-testid="panel-code"
          role="tabpanel"
          aria-labelledby="tab-code"
          aria-label="コード(Python)"
          style={{ height: '100%', position: 'relative', display: activeTab === 'code' ? 'block' : 'none' }}
        >
          {onConvertToVba && (
            <button
              id="btn-convert-to-vba"
              data-testid="btn-convert-to-vba"
              onClick={onConvertToVba}
              style={floatingConvertButtonStyle}
              title="Pythonコードをマクロ言語(VBA)コードに変換します"
            >
              マクロ言語へ変換 ➔
            </button>
          )}
          <MonacoEditor code={code} onChange={onChangeCode} highlightLine={activeLine} zoom={zoom} language="python" />
        </div>

        {/* VBA マクロ言語エディタパネル */}
        <div
          id="panel-vba"
          data-testid="panel-vba"
          role="tabpanel"
          aria-labelledby="tab-vba"
          aria-label="コード(マクロ言語)"
          style={{ height: '100%', position: 'relative', display: activeTab === 'vba' ? 'block' : 'none' }}
        >
          {onConvertToPython && (
            <button
              id="btn-convert-to-py"
              data-testid="btn-convert-to-py"
              onClick={onConvertToPython}
              style={floatingConvertButtonStyle}
              title="VBA(マクロ言語)コードをPythonコードに変換します"
            >
              ⬅ Pythonへ変換
            </button>
          )}
          <MonacoEditor
            code={vbaCode}
            onChange={onChangeVbaCode}
            highlightLine={activeVbaLine}
            zoom={zoom}
            language="vba"
            id="monaco-editor-vba"
            testId="monaco-editor-vba"
          />
        </div>

        {/* 流れ図ビューアパネル */}
        <div style={{ height: '100%', display: activeTab === 'flowchart' ? 'block' : 'none' }}>
          <FlowchartViewer
            nodes={memoizedGraph.nodes}
            edges={memoizedGraph.edges}
            activeLine={activeLine}
            activeNodeId={activeNodeId}
            code={code}
            zoom={zoom}
          />
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
        isCodeDirty={isCodeDirty}
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
  height: '38px',
  minHeight: '38px',
  boxSizing: 'border-box',
};

const tabButtonGroupStyle: React.CSSProperties = {
  display: 'flex',
  height: '100%',
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
  opacity: 1,
};

const disabledStepSliderStyle: React.CSSProperties = {
  ...stepSliderStyle,
  cursor: 'not-allowed',
  opacity: 0.35,
};

const highlightBadgeStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  padding: '3px 4px',
  borderRadius: '4px',
  backgroundColor: '#fef08a',
  color: '#854d0e',
  border: '1px solid #fde047',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  width: '120px',
  display: 'inline-flex',
  justifyContent: 'center',
  alignItems: 'center',
  textAlign: 'center',
  flexShrink: 0,
  boxSizing: 'border-box',
};

const tabStyle: React.CSSProperties = {
  padding: '0 16px',
  height: '100%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  borderBottom: '2px solid transparent',
  backgroundColor: 'transparent',
  color: '#64748b',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 500,
  boxSizing: 'border-box',
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  backgroundColor: '#ffffff',
  color: '#2563eb',
  borderBottom: '2px solid #2563eb',
  fontWeight: 600,
};

const floatingConvertButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '8px',
  right: '22px',
  zIndex: 10,
  padding: '4px 10px',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: '#2563eb',
  backgroundColor: 'rgba(239, 246, 255, 0.92)',
  backdropFilter: 'blur(4px)',
  border: '1px solid #bfdbfe',
  borderRadius: '6px',
  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.08)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  transition: 'all 0.15s ease',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
};
