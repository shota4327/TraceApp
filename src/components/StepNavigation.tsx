import React from 'react';

interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
  onReset: () => void;
  onRun?: () => void;
  onLast?: () => void;
  isTracing?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

/** ナビゲーションボタン群サブコンポーネント */
const NavButtons: React.FC<{
  onRun?: () => void;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  canPrev: boolean;
  canNext: boolean;
  isTracing: boolean;
}> = ({ onRun, onReset, onPrev, onNext, onLast, canPrev, canNext, isTracing }) => (
  <div style={buttonGroupStyle}>
    <button id="btn-run" data-testid="btn-run" onClick={onRun} disabled={isTracing} style={primaryButtonStyle}>
      トレース準備
    </button>
    <button id="btn-reset" data-testid="btn-first" onClick={onReset} disabled={isTracing} style={buttonStyle}>
      最初
    </button>
    <button id="btn-prev" data-testid="btn-prev" onClick={onPrev} disabled={!canPrev || isTracing} style={buttonStyle}>
      前へ
    </button>
    <button id="btn-next" data-testid="btn-next" onClick={onNext} disabled={!canNext || isTracing} style={buttonStyle}>
      次へ
    </button>
    <button id="btn-last" data-testid="btn-last" onClick={onLast} disabled={!canNext || isTracing} style={buttonStyle}>
      最後
    </button>
  </div>
);

/** ズームスライダーサブコンポーネント */
const ZoomSlider: React.FC<{
  zoom: number;
  onZoomChange: (zoom: number) => void;
}> = ({ zoom, onZoomChange }) => (
  <div style={sliderContainerStyle}>
    <span style={zoomIconLabelStyle}>拡大率:</span>
    <input
      id="zoom-slider"
      data-testid="zoom-slider"
      type="range"
      min={50}
      max={400}
      step={5}
      value={zoom}
      onChange={(e) => onZoomChange(Number(e.target.value))}
      style={sliderStyle}
      aria-label="拡大率スライダー"
    />
    <span id="zoom-counter" data-testid="zoom-counter" style={zoomLabelStyle}>
      {`${zoom}%`}
    </span>
  </div>
);

/**
 * ステップナビゲーションコンポーネント
 * 前へ・次へ・リセット・最後・実行ボタンおよびズーム設定スライダーを提供
 */
export const StepNavigation: React.FC<StepNavigationProps> = ({
  currentStep,
  totalSteps,
  onStepChange,
  onReset,
  onRun,
  onLast,
  isTracing = false,
  zoom = 100,
  onZoomChange,
}) => {
  const maxStep = Math.max(0, totalSteps - 1);
  const handleLast = () => (onLast ? onLast() : totalSteps > 0 && onStepChange(maxStep));

  return (
    <div style={containerStyle}>
      <NavButtons
        onRun={onRun}
        onPrev={() => onStepChange(currentStep - 1)}
        onNext={() => onStepChange(currentStep + 1)}
        onReset={onReset}
        onLast={handleLast}
        canPrev={currentStep > 0}
        canNext={totalSteps > 0 && currentStep < maxStep}
        isTracing={isTracing}
      />
      {onZoomChange && <ZoomSlider zoom={zoom} onZoomChange={onZoomChange} />}
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 16px',
  backgroundColor: '#f8fafc',
  borderTop: '1px solid #e2e8f0',
  gap: '16px',
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

const buttonStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: '4px',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#334155',
  fontSize: '0.875rem',
  cursor: 'pointer',
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#2563eb',
  color: '#ffffff',
  borderColor: '#2563eb',
  fontWeight: 600,
};

const sliderContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flex: 1,
  maxWidth: '280px',
  justifyContent: 'flex-end',
};

const sliderStyle: React.CSSProperties = {
  flex: 1,
  cursor: 'pointer',
  minWidth: '100px',
  maxWidth: '160px',
};

const zoomIconLabelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#64748b',
  whiteSpace: 'nowrap',
};

const zoomLabelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#334155',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  minWidth: '45px',
  textAlign: 'right',
};
