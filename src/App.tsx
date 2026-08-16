import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { SAMPLE_PROGRAMS, DEFAULT_SAMPLE } from './services/samplePrograms';
import { StepSnapshot } from './types/trace';
import { FlowchartNode, FlowchartEdge } from './types/flowchart';
import { generateFlowchartGraph } from './services/flowchartGenerator';
import { useTraceEngine } from './hooks/useTraceEngine';
import { useHorizontalResize } from './hooks/useHorizontalResize';

/** Pyodide 初期化中ローディングオーバーレイ */
const LoadingOverlay: React.FC = () => (
  <div id="loading-overlay" data-testid="loading-overlay" style={overlayStyle}>
    <div style={overlayContentStyle}>
      <div style={spinnerStyle} />
      <span style={loadingTextStyle}>Pyodide (WebAssembly Python) ランタイム初期化中...</span>
    </div>
  </div>
);

/**
 * メインアプリケーションコンポーネント
 * アプリ全体のレイアウト構築、Pyodide Worker接続および状態管理を統括
 */
export const App: React.FC = () => {
  const [selectedSampleId, setSelectedSampleId] = useState<string>(DEFAULT_SAMPLE.id);
  const [code, setCode] = useState<string>(DEFAULT_SAMPLE.code);
  const [lastTracedCode, setLastTracedCode] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [snapshots, setSnapshots] = useState<StepSnapshot[]>([]);
  const [flowchartNodes, setFlowchartNodes] = useState<FlowchartNode[]>([]);
  const [flowchartEdges, setFlowchartEdges] = useState<FlowchartEdge[]>([]);
  const [statusText, setStatusText] = useState<string>('Pyodide初期化中...');

  const { isInitializing, initError, isTracing, runTrace: executeTraceEngine } = useTraceEngine();
  const { containerRef: mainContainerRef, leftRatio, isDragging, handlePointerDown } = useHorizontalResize({
    initialRatio: 0.5,
    minRatio: 0.2,
    maxRatio: 0.8,
  });
  const [isResizerHovered, setIsResizerHovered] = useState<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);

  const leftPercent = `calc(${leftRatio * 100}% - 4px)`;
  const rightPercent = `calc(${(1 - leftRatio) * 100}% - 4px)`;

  const runTrace = useCallback(
    async (targetCode: string) => {
      if (isInitializing) return;
      setStatusText('トレース実行中...');
      try {
        const result = await executeTraceEngine(targetCode);
        setSnapshots(result.snapshots || []);
        if (result.flowchartNodes && result.flowchartNodes.length > 0) {
          setFlowchartNodes(result.flowchartNodes);
          setFlowchartEdges(result.flowchartEdges || []);
        } else {
          const graph = generateFlowchartGraph(targetCode);
          setFlowchartNodes(graph.nodes);
          setFlowchartEdges(graph.edges);
        }
        setLastTracedCode(targetCode);
        setCurrentStep(0);
        setStatusText(result.truncated ? `警告: ${result.error || 'ステップ数上限を超過しました。'}` : '準備完了 (ready)');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusText(msg);
        if (typeof window !== 'undefined' && window.alert) window.alert(msg);
      }
    },
    [isInitializing, executeTraceEngine]
  );

  useEffect(() => {
    if (!isInitializing && !initError && !isInitializedRef.current) {
      isInitializedRef.current = true;
      runTrace(code);
    }
  }, [isInitializing, initError, code, runTrace]);

  useEffect(() => {
    if (initError) setStatusText(`Pyodide初期化エラー: ${initError}`);
  }, [initError]);

  const handleSelectSample = (id: string) => {
    setSelectedSampleId(id);
    const target = SAMPLE_PROGRAMS.find((s) => s.id === id);
    if (target) {
      setCode(target.code);
      if (!isInitializing) runTrace(target.code);
    }
  };

  const handleFileUpload = (newCode: string) => {
    setCode(newCode);
    setSelectedSampleId('custom');
    if (!isInitializing) runTrace(newCode);
  };

  const isCodeDirty = !isInitializing && !initError && lastTracedCode !== '' && code !== lastTracedCode;

  // 実行状態の計算:
  // isCodeDirty === true: コード変更未準備（Line 0, 開始ノード）
  // currentStep === 0: 未実行状態（Line 0, 開始ノード, 変数履歴なし）
  // currentStep === snapshots.length - 1 (かつ snapshots.length > 1): 全行実行終了（ハイライトなし, 終了ノード）
  // 1 <= currentStep < snapshots.length - 1: ステップ実行中（直前の行を実行した結果）
  const isEnded = !isCodeDirty && snapshots.length > 1 && currentStep === snapshots.length - 1;
  const isNotStarted = isCodeDirty || currentStep === 0;
  const executionStatus: 'not_started' | 'running' | 'ended' = isNotStarted
    ? 'not_started'
    : isEnded
    ? 'ended'
    : 'running';

  const activeLine = isNotStarted || isEnded ? 0 : (snapshots[currentStep - 1]?.line ?? 0);
  const activeNodeId = isNotStarted
    ? 'node-start'
    : isEnded
    ? 'node-end'
    : (snapshots[currentStep - 1]?.astNodeId ?? 'node-start');
  const activeSnapshot = isNotStarted ? undefined : (isEnded ? snapshots[snapshots.length - 1] : snapshots[currentStep - 1]);

  let displayStatusText = statusText;
  if (isInitializing) {
    displayStatusText = 'Pyodide初期化中...';
  } else if (initError) {
    displayStatusText = `Pyodide初期化エラー: ${initError}`;
  } else if (isTracing) {
    displayStatusText = 'トレース実行中...';
  } else if (isCodeDirty) {
    displayStatusText = 'コードが変更されました (not ready)';
  } else if (statusText === 'トレース実行中...' || statusText === 'Pyodide初期化中...') {
    displayStatusText = '準備完了 (ready)';
  }

  return (
    <div style={appContainerStyle}>
      {isInitializing && <LoadingOverlay />}
      <Header selectedSampleId={selectedSampleId} onSelectSample={handleSelectSample} onFileUpload={handleFileUpload} statusText={displayStatusText} />
      <main ref={mainContainerRef} style={{ ...mainContentStyle, userSelect: isDragging ? 'none' : 'auto' }}>
        <div style={{ ...leftPanelWrapperStyle, flex: `0 0 ${leftPercent}`, width: leftPercent }}>
          <LeftPanel
            code={code}
            onChangeCode={setCode}
            currentStep={isCodeDirty ? 0 : currentStep}
            totalSteps={isCodeDirty ? 0 : snapshots.length}
            onStepChange={setCurrentStep}
            onReset={() => setCurrentStep(0)}
            onRun={() => runTrace(code)}
            onLast={() => snapshots.length > 0 && setCurrentStep(snapshots.length - 1)}
            activeLine={activeLine}
            activeNodeId={activeNodeId}
            flowchartNodes={flowchartNodes}
            flowchartEdges={flowchartEdges}
            isTracing={isTracing || isInitializing}
            isCodeDirty={isCodeDirty}
            executionStatus={executionStatus}
          />
        </div>
        <div
          id="main-horizontal-resizer"
          data-testid="main-horizontal-resizer"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={handlePointerDown}
          onMouseEnter={() => setIsResizerHovered(true)}
          onMouseLeave={() => setIsResizerHovered(false)}
          style={{
            ...horizontalResizerStyle,
            backgroundColor: isDragging || isResizerHovered ? '#3b82f6' : '#e2e8f0',
          }}
        >
          <div style={horizontalHandleKnobStyle} />
        </div>
        <div style={{ ...rightPanelWrapperStyle, flex: `0 0 ${rightPercent}`, width: rightPercent }}>
          <RightPanel
            snapshots={snapshots}
            currentStepIndex={isNotStarted ? -1 : currentStep - 1}
            stdout={activeSnapshot?.stdoutCumulative ?? ''}
          />
        </div>
      </main>
    </div>
  );
};

const appContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden',
  position: 'relative',
};

const mainContentStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
  position: 'relative',
};

const horizontalResizerStyle: React.CSSProperties = {
  width: '8px',
  cursor: 'col-resize',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.15s ease',
  zIndex: 10,
  flexShrink: 0,
};

const horizontalHandleKnobStyle: React.CSSProperties = {
  width: '3px',
  height: '32px',
  borderRadius: '2px',
  backgroundColor: '#94a3b8',
  pointerEvents: 'none',
};

const leftPanelWrapperStyle: React.CSSProperties = {
  height: '100%',
  overflow: 'hidden',
};

const rightPanelWrapperStyle: React.CSSProperties = {
  height: '100%',
  overflow: 'hidden',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.85)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999,
};

const overlayContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
  padding: '24px 36px',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
  border: '1px solid #e2e8f0',
};

const spinnerStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  border: '4px solid #e2e8f0',
  borderTop: '4px solid #2563eb',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const loadingTextStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#1e293b',
};
