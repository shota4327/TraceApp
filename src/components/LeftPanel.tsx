import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MonacoEditor } from './MonacoEditor';
import { FlowchartViewer } from './FlowchartViewer';
import { ZoomSlider } from './ZoomSlider';
import { FlowchartNode, FlowchartEdge } from '../types/flowchart';
import { generateFlowchartGraph } from '../services/flowchartGenerator';
import { generateFullDrawIoXml, saveDrawIoFile } from '../services/drawioExporter';
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

const getBadgeStyle = (isVba: boolean): React.CSSProperties => ({
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '0.70rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  color: isVba ? '#15803d' : '#1d4ed8',
  backgroundColor: isVba ? '#f0fdf4' : '#eff6ff',
  border: `1px solid ${isVba ? '#bbf7d0' : '#bfdbfe'}`,
  flexShrink: 0,
});

/** サンプル選択カスタムドロップダウンコンポーネント */
const SampleSelectDropdown: React.FC<{
  selectedSampleId?: string;
  onSelectSample: (id: string) => void;
}> = ({ selectedSampleId, onSelectSample }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const currentSample = SAMPLE_PROGRAMS.find((s) => s.id === selectedSampleId) || SAMPLE_PROGRAMS[0]!;
  const currentIsVba = (currentSample.language || 'python') === 'vba';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={dropdownContainerStyle}>
      {/* 隠しselect: E2Eテスト(selectOption)およびアクセシビリティ用 */}
      <select
        id="preset-select"
        data-testid="preset-select"
        value={selectedSampleId}
        onChange={(e) => onSelectSample(e.target.value)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '20px',
          height: '20px',
          opacity: 0.01,
          pointerEvents: 'none',
          zIndex: 0,
        }}
        aria-label="サンプルプログラム選択"
        tabIndex={-1}
      >
        {SAMPLE_PROGRAMS.map((sample) => (
          <option key={sample.id} value={sample.id}>
            {sample.name}
          </option>
        ))}
      </select>

      {/* トリガーボタン */}
      <button
        type="button"
        id="preset-select-button"
        data-testid="preset-select-button"
        onClick={() => setIsOpen(!isOpen)}
        style={dropdownTriggerStyle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          id="badge-sample-language"
          data-testid="badge-sample-language"
          style={getBadgeStyle(currentIsVba)}
        >
          {currentIsVba ? 'マクロ言語' : 'Python'}
        </span>
        <span style={triggerLabelStyle}>{currentSample.name}</span>
        <span style={arrowIconStyle}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <div style={dropdownMenuStyle} role="listbox" data-testid="sample-select-menu">
          {SAMPLE_PROGRAMS.map((sample) => {
            const isVba = (sample.language || 'python') === 'vba';
            const isSelected = sample.id === selectedSampleId;
            return (
              <div
                key={sample.id}
                role="option"
                aria-selected={isSelected}
                data-testid={`sample-item-${sample.id}`}
                onClick={() => {
                  onSelectSample(sample.id);
                  setIsOpen(false);
                }}
                style={isSelected ? selectedMenuItemStyle : menuItemStyle}
              >
                <span style={getBadgeStyle(isVba)}>
                  {isVba ? 'マクロ言語' : 'Python'}
                </span>
                <span style={menuItemTextStyle}>{sample.name}</span>
                {isSelected && <span style={checkMarkStyle}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** サンプル選択・ズームコントロールサブコンポーネント */
const TabBarControls: React.FC<{
  selectedSampleId?: string;
  onSelectSample?: (id: string) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}> = ({ selectedSampleId, onSelectSample, zoom, onZoomChange }) => {
  return (
    <div style={tabBarRightAreaStyle}>
      {onSelectSample && (
        <SampleSelectDropdown
          selectedSampleId={selectedSampleId}
          onSelectSample={onSelectSample}
        />
      )}
      <ZoomSlider zoom={zoom} onZoomChange={onZoomChange} />
    </div>
  );
};

/** 言語切り替えスライドスイッチサブコンポーネント */
const LanguageSlideSwitch: React.FC<{
  activeTab: LeftPanelTab;
  isCodeActive: boolean;
  onSelectLanguage: (lang: 'code' | 'vba') => void;
}> = ({ activeTab, isCodeActive, onSelectLanguage }) => {
  const isVba = activeTab === 'vba';

  return (
    <div
      style={slideSwitchTrackStyle}
      onClick={(e) => {
        if (isCodeActive) {
          e.stopPropagation();
          onSelectLanguage(isVba ? 'code' : 'vba');
        }
      }}
      title="クリックでPythonとマクロ言語を切り替えます"
    >
      {/* スライドするピル背景インジケーター（Python: 青 / マクロ言語: 緑） */}
      {isCodeActive && (
        <div
          data-testid="tab-slide-indicator"
          style={{
            ...slideSwitchIndicatorStyle,
            backgroundColor: isVba ? '#16a34a' : '#2563eb',
            transform: isVba ? 'translateX(100%)' : 'translateX(0%)',
          }}
        />
      )}
      <button
        id="tab-code"
        data-testid="tab-code"
        role="tab"
        aria-selected={activeTab === 'code'}
        aria-controls="panel-code"
        onClick={(e) => {
          if (isCodeActive) {
            e.stopPropagation();
            onSelectLanguage('code');
          }
        }}
        style={activeTab === 'code' && isCodeActive ? activeSlideLabelStyle : slideLabelStyle}
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
          if (isCodeActive) {
            e.stopPropagation();
            onSelectLanguage('vba');
          }
        }}
        style={activeTab === 'vba' && isCodeActive ? activeSlideLabelStyle : slideLabelStyle}
      >
        マクロ言語
      </button>
    </div>
  );
};

/** 左パネルのトグル式タブバー */
const LeftPanelTabBar: React.FC<{
  activeTab: LeftPanelTab;
  onSelectTab: (tab: LeftPanelTab) => void;
  selectedSampleId?: string;
  onSelectSample?: (id: string) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}> = ({
  activeTab,
  onSelectTab,
  selectedSampleId,
  onSelectSample,
  zoom,
  onZoomChange,
}) => {
  const isCodeActive = activeTab === 'code' || activeTab === 'vba';
  const [lastCodeTab, setLastCodeTab] = useState<'code' | 'vba'>('code');

  React.useEffect(() => {
    if (activeTab === 'code' || activeTab === 'vba') {
      setLastCodeTab(activeTab);
    }
  }, [activeTab]);

  const handleCodeTabContainerClick = () => {
    if (!isCodeActive) {
      onSelectTab(lastCodeTab);
    }
  };

  const handleSelectLanguage = (lang: 'code' | 'vba') => {
    setLastCodeTab(lang);
    onSelectTab(lang);
  };

  return (
    <div style={tabContainerStyle} role="tablist" aria-label="表示モード切り替え">
      <div style={tabButtonGroupStyle}>
        {/* コードタブ（下線付きタブ枠内にスライドスイッチを埋め込み） */}
        <div
          style={isCodeActive ? activeTabUnderlineStyle : baseTabStyle}
          onClick={handleCodeTabContainerClick}
        >
          <span style={{ fontSize: '0.84rem' }}>コード</span>
          <LanguageSlideSwitch
            activeTab={activeTab}
            isCodeActive={isCodeActive}
            onSelectLanguage={handleSelectLanguage}
          />
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content && onFileUpload) onFileUpload(content);
    };
    reader.readAsText(file);
    // 同じファイルを再選択できるようにリセット
    e.target.value = '';
  };

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
          {onFileUpload && (
            <label
              id="file-upload-label"
              data-testid="file-upload-label"
              style={floatingUploadButtonStyle}
              title=".pyファイルを読み込みます"
            >
              📁 .py 読込
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
        <div
          id="panel-flowchart"
          data-testid="panel-flowchart"
          style={{ height: '100%', position: 'relative', display: activeTab === 'flowchart' ? 'block' : 'none' }}
        >
          <button
            id="btn-export-drawio"
            data-testid="btn-export-drawio"
            onClick={() => saveDrawIoFile(generateFullDrawIoXml(memoizedGraph.nodes, memoizedGraph.edges))}
            style={floatingExportButtonStyle}
            title="現在の流れ図をdraw.io形式(.drawio)で書き出します"
          >
            💾 draw.io形式で書き出し
          </button>
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

const slideSwitchTrackStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  backgroundColor: '#e2e8f0',
  borderRadius: '14px',
  padding: '2px',
  cursor: 'pointer',
  userSelect: 'none',
  width: '154px',
  height: '24px',
  boxSizing: 'border-box',
  flexShrink: 0,
};

const slideSwitchIndicatorStyle: React.CSSProperties = {
  position: 'absolute',
  top: '2px',
  left: '2px',
  width: 'calc(50% - 2px)',
  height: 'calc(100% - 4px)',
  backgroundColor: '#2563eb',
  borderRadius: '12px',
  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
  pointerEvents: 'none',
  zIndex: 1,
};

const slideLabelStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
  flex: 1,
  height: '100%',
  border: 'none',
  backgroundColor: 'transparent',
  color: '#64748b',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 6px',
  whiteSpace: 'nowrap',
  transition: 'color 0.15s ease',
};

const activeSlideLabelStyle: React.CSSProperties = {
  ...slideLabelStyle,
  color: '#ffffff',
  fontWeight: 600,
};

const tabBarRightAreaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexShrink: 0,
};

const dropdownContainerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
};

const dropdownTriggerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '3px 8px',
  borderRadius: '4px',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  fontSize: '0.78rem',
  cursor: 'pointer',
  minWidth: '220px',
  maxWidth: '260px',
  boxSizing: 'border-box',
  userSelect: 'none',
  transition: 'border-color 0.15s ease',
};

const triggerLabelStyle: React.CSSProperties = {
  flex: 1,
  textAlign: 'left',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: '#1e293b',
  fontWeight: 500,
};

const arrowIconStyle: React.CSSProperties = {
  fontSize: '0.60rem',
  color: '#64748b',
  marginLeft: 'auto',
  flexShrink: 0,
};

const dropdownMenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  zIndex: 100,
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
  minWidth: '260px',
  maxHeight: '320px',
  overflowY: 'auto',
  padding: '4px 0',
};

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 12px',
  fontSize: '0.78rem',
  color: '#334155',
  cursor: 'pointer',
  transition: 'background-color 0.1s ease',
};

const selectedMenuItemStyle: React.CSSProperties = {
  ...menuItemStyle,
  backgroundColor: '#f8fafc',
  fontWeight: 600,
  color: '#2563eb',
};

const menuItemTextStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const checkMarkStyle: React.CSSProperties = {
  fontSize: '0.80rem',
  color: '#2563eb',
  marginLeft: '4px',
};

const floatingUploadButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '8px',
  right: '20px',
  zIndex: 10,
  padding: '4px 10px',
  fontSize: '0.78rem',
  fontWeight: 500,
  color: '#2563eb',
  backgroundColor: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(4px)',
  border: '1px solid #bfdbfe',
  borderRadius: '6px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.06)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  userSelect: 'none',
  transition: 'all 0.15s ease',
};

const floatingExportButtonStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '20px',
  right: '20px',
  zIndex: 10,
  padding: '6px 14px',
  fontSize: '0.80rem',
  fontWeight: 600,
  color: '#ffffff',
  backgroundColor: '#2563eb',
  border: '1px solid #1d4ed8',
  borderRadius: '6px',
  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.28)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  userSelect: 'none',
  transition: 'all 0.15s ease',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
};
