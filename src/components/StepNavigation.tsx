import React from 'react';

interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
  onReset: () => void;
  onRun?: () => void;
  onLast?: () => void;
  isTracing?: boolean;
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

/** ステップスライダーサブコンポーネント */
const StepSlider: React.FC<{
  currentStep: number;
  totalSteps: number;
  maxStep: number;
  isTracing: boolean;
  onStepChange: (step: number) => void;
}> = ({ currentStep, totalSteps, maxStep, isTracing, onStepChange }) => (
  <div style={sliderContainerStyle}>
    <input
      id="step-slider"
      data-testid="step-slider"
      type="range"
      min={0}
      max={maxStep}
      value={currentStep}
      onChange={(e) => onStepChange(Number(e.target.value))}
      disabled={totalSteps <= 0 || isTracing}
      style={sliderStyle}
    />
    <span id="step-counter" data-testid="step-counter" style={stepLabelStyle}>
      {totalSteps > 0 ? `ステップ ${currentStep + 1} / ${totalSteps}` : 'ステップ 0 / 0'}
    </span>
  </div>
);

/**
 * ステップナビゲーションコンポーネント
 * 前へ・次へ・リセット・最後・実行ボタンおよびステップスライダーを提供
 */
export const StepNavigation: React.FC<StepNavigationProps> = ({
  currentStep,
  totalSteps,
  onStepChange,
  onReset,
  onRun,
  onLast,
  isTracing = false,
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
      <StepSlider
        currentStep={currentStep}
        totalSteps={totalSteps}
        maxStep={maxStep}
        isTracing={isTracing}
        onStepChange={onStepChange}
      />
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
  gap: '12px',
  flex: 1,
  maxWidth: '320px',
};

const sliderStyle: React.CSSProperties = {
  flex: 1,
  cursor: 'pointer',
};

const stepLabelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#475569',
  whiteSpace: 'nowrap',
  minWidth: '80px',
};
