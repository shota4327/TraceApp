import React from 'react';

/** ナビゲーションボタン群コンポーネント */
export interface NavButtonsProps {
  onRun?: () => void;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  canPrev: boolean;
  canNext: boolean;
  isTracing: boolean;
  isCodeDirty?: boolean;
}

export const NavButtons: React.FC<NavButtonsProps> = ({
  onRun,
  onReset,
  onPrev,
  onNext,
  onLast,
  canPrev,
  canNext,
  isTracing,
  isCodeDirty,
}) => {
  const isRunDisabled = isTracing || !isCodeDirty;
  const isNavDisabled = isTracing || !!isCodeDirty;
  const isPrevDisabled = isNavDisabled || !canPrev;
  const isNextDisabled = isNavDisabled || !canNext;

  return (
    <div style={buttonGroupStyle}>
      <button
        id="btn-run"
        data-testid="btn-run"
        onClick={onRun}
        disabled={isRunDisabled}
        style={isRunDisabled ? disabledRunButtonStyle : primaryButtonStyle}
      >
        トレース準備
      </button>
      <button
        id="btn-reset"
        data-testid="btn-first"
        onClick={onReset}
        disabled={isPrevDisabled}
        style={isPrevDisabled ? disabledButtonStyle : buttonStyle}
      >
        最初
      </button>
      <button
        id="btn-prev"
        data-testid="btn-prev"
        onClick={onPrev}
        disabled={isPrevDisabled}
        style={isPrevDisabled ? disabledButtonStyle : buttonStyle}
      >
        前へ
      </button>
      <button
        id="btn-next"
        data-testid="btn-next"
        onClick={onNext}
        disabled={isNextDisabled}
        style={isNextDisabled ? disabledButtonStyle : buttonStyle}
      >
        次へ
      </button>
      <button
        id="btn-last"
        data-testid="btn-last"
        onClick={onLast}
        disabled={isNextDisabled}
        style={isNextDisabled ? disabledButtonStyle : buttonStyle}
      >
        最後
      </button>
    </div>
  );
};

/** ステップシークバー（スライダー＆ステップ数カウンター）コンポーネント */
export interface StepSeekBarProps {
  currentStep: number;
  totalSteps: number;
  isTracing: boolean;
  isCodeDirty?: boolean;
  onStepChange: (step: number) => void;
}

export const StepSeekBar: React.FC<StepSeekBarProps> = ({
  currentStep,
  totalSteps,
  isTracing,
  isCodeDirty,
  onStepChange,
}) => {
  const maxStep = Math.max(0, totalSteps - 1);
  const isSliderDisabled = totalSteps <= 0 || isTracing || !!isCodeDirty;

  return (
    <div style={stepSeekBarWrapperStyle}>
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
      <span id="step-counter" data-testid="step-counter" style={stepCounterStyle}>
        {totalSteps > 0 ? `ステップ ${currentStep} / ${maxStep}` : 'ステップ 0 / 0'}
      </span>
    </div>
  );
};

/** ズーム（拡大率）スライダーコンポーネント */
export interface ZoomSliderProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  id?: string;
  testId?: string;
}

export const ZoomSlider: React.FC<ZoomSliderProps> = ({
  zoom,
  onZoomChange,
  id = 'zoom-slider',
  testId = 'zoom-slider',
}) => (
  <div style={sliderContainerStyle}>
    <span style={zoomIconLabelStyle}>拡大率:</span>
    <input
      id={id}
      data-testid={testId}
      type="range"
      min={50}
      max={400}
      step={5}
      value={zoom}
      onChange={(e) => onZoomChange(Number(e.target.value))}
      style={sliderStyle}
      aria-label="拡大率スライダー"
    />
    <span
      id={id === 'zoom-slider' ? 'zoom-counter' : `${id}-counter`}
      data-testid={testId === 'zoom-slider' ? 'zoom-counter' : `${testId}-counter`}
      style={zoomLabelStyle}
    >
      {`${zoom}%`}
    </span>
  </div>
);

/** 後方互換・単体テスト用 StepNavigation 統合コンポーネント */
export interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
  onReset: () => void;
  onRun?: () => void;
  onLast?: () => void;
  isTracing?: boolean;
  isCodeDirty?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

export const StepNavigation: React.FC<StepNavigationProps> = ({
  currentStep,
  totalSteps,
  onStepChange,
  onReset,
  onRun,
  onLast,
  isTracing = false,
  isCodeDirty = false,
  zoom = 100,
  onZoomChange,
}) => {
  const maxStep = Math.max(0, totalSteps - 1);
  const handleLast = () => (onLast ? onLast() : totalSteps > 0 && onStepChange(maxStep));

  return (
    <div style={stepNavigationContainerStyle}>
      <NavButtons
        onRun={onRun}
        onPrev={() => onStepChange(currentStep - 1)}
        onNext={() => onStepChange(currentStep + 1)}
        onReset={onReset}
        onLast={handleLast}
        canPrev={currentStep > 0}
        canNext={totalSteps > 0 && currentStep < maxStep}
        isTracing={isTracing}
        isCodeDirty={isCodeDirty}
      />
      {onZoomChange && <ZoomSlider zoom={zoom} onZoomChange={onZoomChange} />}
    </div>
  );
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  alignItems: 'center',
};

const baseButtonStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: '4px',
  borderWidth: '1px',
  borderStyle: 'solid',
  fontSize: '0.82rem',
  fontWeight: 500,
  transition: 'all 0.15s ease',
  boxSizing: 'border-box',
  whiteSpace: 'nowrap',
};

const buttonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  borderColor: '#cbd5e1',
  backgroundColor: '#ffffff',
  color: '#1e293b',
  cursor: 'pointer',
  opacity: 1,
};

const disabledButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  borderColor: '#e2e8f0',
  backgroundColor: '#f8fafc',
  color: '#94a3b8',
  cursor: 'not-allowed',
  opacity: 0.5,
};

const primaryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  borderColor: '#2563eb',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  fontWeight: 600,
  cursor: 'pointer',
  opacity: 1,
};

const disabledRunButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  borderColor: '#e2e8f0',
  backgroundColor: '#f1f5f9',
  color: '#94a3b8',
  cursor: 'not-allowed',
  opacity: 0.6,
};

const stepSeekBarWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexShrink: 0,
};

const stepCounterStyle: React.CSSProperties = {
  fontSize: '0.80rem',
  color: '#475569',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  minWidth: '85px',
  textAlign: 'left',
  flexShrink: 0,
};

const stepSliderStyle: React.CSSProperties = {
  width: '110px',
  cursor: 'pointer',
  flexShrink: 0,
  opacity: 1,
};

const disabledStepSliderStyle: React.CSSProperties = {
  ...stepSliderStyle,
  cursor: 'not-allowed',
  opacity: 0.35,
};

const sliderContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexShrink: 0,
};

const sliderStyle: React.CSSProperties = {
  width: '80px',
  cursor: 'pointer',
};

const zoomIconLabelStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#64748b',
  whiteSpace: 'nowrap',
};

const zoomLabelStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#334155',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  minWidth: '38px',
  textAlign: 'right',
};

const stepNavigationContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 16px',
  backgroundColor: '#f8fafc',
  borderTop: '1px solid #e2e8f0',
  gap: '16px',
};
