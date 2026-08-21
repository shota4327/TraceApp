import React, { useState, useMemo } from 'react';
import { MonacoEditor } from './MonacoEditor';
import { FlowchartViewer } from './FlowchartViewer';
import { ZoomSlider } from './StepNavigation';
import { FlowchartNode, FlowchartEdge } from '../types/flowchart';
import { generateFlowchartGraph } from '../services/flowchartGenerator';
import { SAMPLE_PROGRAMS } from '../services/samplePrograms';

export type LeftPanelTab = 'code' | 'vba' | 'flowchart';

interface LeftPanelProps {
  code: string;
  onChangeCode: (code: string) => void;
  vbaCode?: string;
  onChangeVbaCode?: (vbaCode: string) => void;
  onConvertToVba?: () => void;
  onConvertToPython?: () => void;
  activeLine?: number;
  activeVbaLine?: number;
  activeNodeId?: string;
  flowchartNodes?: FlowchartNode[];
  flowchartEdges?: FlowchartEdge[];
  activeTab?: LeftPanelTab;
  onChangeTab?: (tab: LeftPanelTab) => void;
  selectedSampleId?: string;
  onSelectSample?: (id: string) => void;
  onFileUpload?: (code: string) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  currentStep?: number;
  totalSteps?: number;
  onStepChange?: (step: number) => void;
  onReset?: () => void;
  onRun?: () => void;
  onLast?: () => void;
  isTracing?: boolean;
  isCodeDirty?: boolean;
  executionStatus?: 'not_started' | 'running' | 'ended';
}

/** サンプル選択・ファイル読込・ズームコントロールサブコンポーネント */
const TabBarControls: React.FC<{
  selectedSampleId?: string;
  onSelectSample?: (id: string) => void;
  onFileUpload?: (code: string) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}> = ({ selectedSampleId, onSelectSample, onFileUpload, zoom, onZoomChange }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content && onFileUpload) onFileUpload(content);
    };
    reader.readAsText(file);
  };

  return (
    <div style={tabBarRightAreaStyle}>
      {onSelectSample && (
        <div style={sampleSelectWrapperStyle}>
          <label style={controlLabelStyle} htmlFor="preset-select">
            サンプル:
          </label>
          <select
            id="preset-select"
            data-testid="preset-select"
            value={selectedSampleId}
            onChange={(e) => onSelectSample(e.target.value)}
            style={selectStyle}
          >
            {SAMPLE_PROGRAMS.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {onFileUpload && (
        <label style={uploadButtonStyle}>
          .py 読込
          <input
            id="file-upload-input"
            data-testid="file-upload-input"
            type="file"
            accept=".py"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>
      )}
      <ZoomSlider zoom={zoom} onZoomChange={onZoomChange} />
    </div>
  );
};

/** 左パネルのトグル式タブバー */
const LeftPanelTabBar: React.FC<{
  activeTab: LeftPanelTab;
  onSelectTab: (tab: LeftPanelTab) => void;
  selectedSampleId?: string;
  onSelectSample?: (id: string) => void;
  onFileUpload?: (code: string) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}> = ({
  activeTab,
  onSelectTab,
  selectedSampleId,
  onSelectSample,
  onFileUpload,
  zoom,
  onZoomChange,
}) => {
  const isCodeActive = activeTab === 'code' || activeTab === 'vba';

  return (
    <div style={tabContainerStyle} role="tablist" aria-label="表示モード切り替え">
      <div style={tabButtonGroupStyle}>
        {/* コードタブ（下線付きタブ枠内に Python | マクロ言語 のトグルピルを埋め込み） */}
        <div
          style={isCodeActive ? activeTabUnderlineStyle : baseTabStyle}
          onClick={() => !isCodeActive && onSelectTab('code')}
        >
          <span style={{ fontSize: '0.84rem' }}>コード:</span>
          <div style={togglePillContainerStyle}>
            <button
              id="tab-code"
              data-testid="tab-code"
              role="tab"
              aria-selected={activeTab === 'code'}
              aria-controls="panel-code"
              onClick={(e) => {
                e.stopPropagation();
                onSelectTab('code');
              }}
              style={activeTab === 'code' ? activeTogglePillItemStyle : togglePillItemStyle}
            >
              Python
            </button>
            <button
              id="tab-vba"
              data-testid="tab-vba"
              role="tab"
              aria-selected={activeTab === 'vba'}
              aria-controls="panel-vba"
              onClick={(e) => {
                e.stopPropagation();
                onSelectTab('vba');
              }}
              style={activeTab === 'vba' ? activeTogglePillItemStyle : togglePillItemStyle}
            >
              マクロ言語
            </button>
          </div>
        </div>

        {/* 流れ図タブボタン（以前と同様の下線付きタブ） */}
        <button
          id="tab-flowchart"
          data-testid="tab-flowchart"
          role="tab"
          aria-selected={activeTab === 'flowchart'}
          aria-controls="flowchart-viewer"
          onClick={() => onSelectTab('flowchart')}
          style={activeTab === 'flowchart' ? activeTabUnderlineStyle : baseTabStyle}
        >
          流れ図
        </button>
      </div>

      <TabBarControls
        selectedSampleId={selectedSampleId}
        onSelectSample={onSelectSample}
        onFileUpload={onFileUpload}
        zoom={zoom}
        onZoomChange={onZoomChange}
      />
    </div>
  );
};

/**
 * 左パネルコンポーネント
 * Python/VBA/流れ図のトグル表示、サンプル選択、ファイル読込、ズーム連動エディタを統括
 */
export const LeftPanel: React.FC<LeftPanelProps> = ({
  code,
  onChangeCode,
  vbaCode = '',
  onChangeVbaCode = () => {},
  onConvertToVba,
  onConvertToPython,
  activeLine,
  activeVbaLine,
  activeNodeId,
  flowchartNodes,
  flowchartEdges,
  activeTab: externalActiveTab,
  onChangeTab: externalOnChangeTab,
  selectedSampleId,
  onSelectSample,
  onFileUpload,
  zoom: externalZoom,
  onZoomChange: externalOnZoomChange,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<LeftPanelTab>('code');
  const [internalZoom, setInternalZoom] = useState<number>(100);

  const activeTab = externalActiveTab ?? internalActiveTab;
  const setActiveTab = externalOnChangeTab ?? setInternalActiveTab;
  const zoom = externalZoom ?? internalZoom;
  const setZoom = externalOnZoomChange ?? setInternalZoom;

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
        selectedSampleId={selectedSampleId}
        onSelectSample={onSelectSample}
        onFileUpload={onFileUpload}
        zoom={zoom}
        onZoomChange={setZoom}
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

const baseTabStyle: React.CSSProperties = {
  padding: '0 14px',
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
  transition: 'all 0.15s ease',
  gap: '8px',
};

const activeTabUnderlineStyle: React.CSSProperties = {
  ...baseTabStyle,
  backgroundColor: '#ffffff',
  color: '#2563eb',
  borderBottom: '2px solid #2563eb',
  fontWeight: 600,
};

const togglePillContainerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  backgroundColor: '#e2e8f0',
  borderRadius: '4px',
  padding: '2px',
  gap: '2px',
};

const togglePillItemStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: '3px',
  border: 'none',
  backgroundColor: 'transparent',
  color: '#475569',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontWeight: 500,
  transition: 'all 0.15s ease',
};

const activeTogglePillItemStyle: React.CSSProperties = {
  ...togglePillItemStyle,
  backgroundColor: '#2563eb',
  color: '#ffffff',
  fontWeight: 600,
  boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
};

const tabBarRightAreaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexShrink: 0,
};

const sampleSelectWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

const controlLabelStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#64748b',
  whiteSpace: 'nowrap',
};

const selectStyle: React.CSSProperties = {
  padding: '3px 6px',
  borderRadius: '4px',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  fontSize: '0.78rem',
  cursor: 'pointer',
  maxWidth: '140px',
};

const uploadButtonStyle: React.CSSProperties = {
  padding: '3px 8px',
  borderRadius: '4px',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  fontSize: '0.78rem',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
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
