import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZoomSlider } from '../components/ZoomSlider';

describe('ZoomSlider 独立共通コンポーネントの検証 (Issue #19)', () => {
  it('デフォルトPropsで「拡大率:」ラベル、スライダー、カウンターが描画されること', () => {
    const onZoomChange = vi.fn();
    render(<ZoomSlider zoom={100} onZoomChange={onZoomChange} />);

    const label = screen.getByText('拡大率:');
    expect(label).toBeDefined();

    const slider = screen.getByTestId('zoom-slider') as HTMLInputElement;
    expect(slider).toBeDefined();
    expect(slider.type).toBe('range');
    expect(slider.min).toBe('50');
    expect(slider.max).toBe('400');
    expect(slider.value).toBe('100');

    const counter = screen.getByTestId('zoom-counter');
    expect(counter.textContent).toBe('100%');
  });

  it('カスタム id / testId を指定した場合、指定された属性でレンダリングされること', () => {
    const onZoomChange = vi.fn();
    render(
      <ZoomSlider
        zoom={150}
        onZoomChange={onZoomChange}
        id="custom-zoom-slider"
        testId="custom-zoom-slider"
      />
    );

    const slider = screen.getByTestId('custom-zoom-slider') as HTMLInputElement;
    expect(slider.id).toBe('custom-zoom-slider');
    expect(slider.value).toBe('150');

    const counter = screen.getByTestId('custom-zoom-slider-counter');
    expect(counter.id).toBe('custom-zoom-slider-counter');
    expect(counter.textContent).toBe('150%');
  });

  it('スライダーの値を変更した際、onZoomChangeコールバックが呼び出されること', () => {
    const onZoomChange = vi.fn();
    render(<ZoomSlider zoom={100} onZoomChange={onZoomChange} />);

    const slider = screen.getByTestId('zoom-slider');
    fireEvent.change(slider, { target: { value: '250' } });

    expect(onZoomChange).toHaveBeenCalledTimes(1);
    expect(onZoomChange).toHaveBeenCalledWith(250);
  });
});
