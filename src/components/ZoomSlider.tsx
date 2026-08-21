import React from 'react';

/** ズーム（拡大率）スライダーコンポーネントのProps */
export interface ZoomSliderProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  id?: string;
  testId?: string;
}

/**
 * 汎用拡大率（ズーム）スライダーコンポーネント
 * 50%〜400% の範囲で 5% 刻みのスライダーとパーセント表示を提供
 */
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
  fontWeight: 400,
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
