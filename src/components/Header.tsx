import React from 'react';
import { NavButtons, StepSeekBar, primaryButtonStyle, disabledRunButtonStyle } from './StepNavigation';

export interface HeaderProps {
  statusText?: string;
  currentStep?: number;
  totalSteps?: number;
  onStepChange?: (step: number) => void;
  onReset?: () => void;
  onRun?: () => void;
  onLast?: () => void;
  isTracing?: boolean;
  isCodeDirty?: boolean;
  selectedSampleId?: string;
  onSelectSample?: (id: string) => void;
  onFileUpload?: (code: string) => void;
}

/** タイトル、ステータス表示およびトレース準備ボタンサブコンポーネント */
const HeaderTitleGroup: React.FC<{
  statusText: string;
  onRun?: () => void;
  isTracing?: boolean;
  isCodeDirty?: boolean;
}> = ({ statusText, onRun, isTracing = false, isCodeDirty = false }) => {
  const isDirty = statusText.includes('コードが変更されました') || statusText.includes('not ready');
  const isReady = !isDirty && (statusText.includes('準備完了') || statusText.includes('ready'));
  const isInitializing = statusText.includes('初期化中') || statusText.includes('トレース実行中') || statusText.includes('loading');

  const statusBg = isDirty
    ? '#fff7ed'
    : isReady
    ? '#dcfce7'
    : isInitializing
    ? '#fef9c3'
    : '#fee2e2';

  const statusBorder = isDirty
    ? '#f97316'
    : isReady
    ? '#86efac'
    : isInitializing
    ? '#fde047'
    : '#fca5a5';

  const statusColor = isDirty
    ? '#c2410c'
    : isReady
    ? '#166534'
    : isInitializing
    ? '#854d0e'
    : '#991b1b';

  const dynamicStatusStyle: React.CSSProperties = {
    ...statusIndicatorStyle,
    backgroundColor: statusBg,
    borderColor: statusBorder,
  };
  const dynamicTextStyle: React.CSSProperties = {
    ...statusTextStyle,
    color: statusColor,
    fontWeight: isDirty ? 600 : 500,
  };

  const statusClass = isDirty ? 'dirty not-ready' : isReady ? 'ready' : isInitializing ? 'initializing' : 'error';
  const isRunDisabled = isTracing || !isCodeDirty;

  return (
    <div style={titleGroupStyle}>
      <h1 style={titleStyle}>PyTrace - トレース学習支援システム</h1>
      <div id="status-indicator" data-testid="status-bar" className={`status-bar ${statusClass}`} style={dynamicStatusStyle}>
        <span id="status-text" data-testid="status-text" style={dynamicTextStyle}>
          {statusText}
        </span>
      </div>
      {onRun && (
        <button
          id="btn-run"
          data-testid="btn-run"
          onClick={onRun}
          disabled={isRunDisabled}
          style={isRunDisabled ? disabledRunButtonStyle : primaryButtonStyle}
        >
          {isTracing ? '準備中...' : 'トレース準備'}
        </button>
      )}
    </div>
  );
};

/**
 * ヘッダーコンポーネント
 * アプリタイトル、ステータス、トレース準備ボタン、ステップナビゲーションボタン群およびシークバーを統括
 */
export const Header: React.FC<HeaderProps> = ({
  statusText = '準備完了 (ready)',
  currentStep = 0,
  totalSteps = 0,
  onStepChange = () => {},
  onReset = () => {},
  onRun,
  onLast,
  isTracing = false,
  isCodeDirty = false,
}) => {
  const maxStep = Math.max(0, totalSteps - 1);
  const handleLast = () => (onLast ? onLast() : totalSteps > 0 && onStepChange(maxStep));

  return (
    <header id="header" data-testid="header" className="header-container" style={headerStyle}>
      <HeaderTitleGroup
        statusText={statusText}
        onRun={onRun}
        isTracing={isTracing}
        isCodeDirty={isCodeDirty}
      />
      <div style={headerNavContainerStyle}>
        <div style={headerDividerStyle} />
        <NavButtons
          onPrev={() => onStepChange(currentStep - 1)}
          onNext={() => onStepChange(currentStep + 1)}
          onReset={onReset}
          onLast={handleLast}
          canPrev={currentStep > 0}
          canNext={totalSteps > 0 && currentStep < maxStep}
          isTracing={isTracing}
          isCodeDirty={isCodeDirty}
        />
        <StepSeekBar
          currentStep={currentStep}
          totalSteps={totalSteps}
          isTracing={isTracing}
          isCodeDirty={isCodeDirty}
          onStepChange={onStepChange}
        />
      </div>
    </header>
  );
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 16px',
  backgroundColor: '#ffffff',
  borderBottom: '1px solid #e2e8f0',
  gap: '16px',
  flexWrap: 'nowrap',
  overflowX: 'auto',
};

const titleGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.15rem',
  fontWeight: 600,
  color: '#1e293b',
  whiteSpace: 'nowrap',
  margin: 0,
};

const statusIndicatorStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 8px',
  borderRadius: '12px',
  backgroundColor: '#dcfce7',
  border: '1px solid #86efac',
  whiteSpace: 'nowrap',
};

const statusTextStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 500,
  color: '#166534',
};

const headerNavContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexShrink: 0,
};

const headerDividerStyle: React.CSSProperties = {
  width: '1px',
  height: '24px',
  backgroundColor: '#cbd5e1',
  margin: '0 4px',
};
