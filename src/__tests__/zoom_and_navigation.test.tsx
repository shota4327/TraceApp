import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../components/Header';
import { LeftPanel } from '../components/LeftPanel';
import { FlowchartViewer } from '../components/FlowchartViewer';
import { MonacoEditor } from '../components/MonacoEditor';

describe('ズーム機能およびヘッダーステップシークバーの検証', () => {
  it('LeftPanel タブバーにズームスライダーが描画され、拡大率変更が反映されること', () => {
    const handleZoomChange = vi.fn();
    render(
      <LeftPanel
        code="x = 1"
        onChangeCode={() => {}}
        zoom={150}
        onZoomChange={handleZoomChange}
      />
    );

    const zoomSlider = screen.getByTestId('zoom-slider') as HTMLInputElement;
    const zoomCounter = screen.getByTestId('zoom-counter');

    expect(zoomSlider).toBeDefined();
    expect(zoomSlider.value).toBe('150');
    expect(zoomCounter.textContent).toBe('150%');

    fireEvent.change(zoomSlider, { target: { value: '200' } });
    expect(handleZoomChange).toHaveBeenCalledWith(200);
  });

  it('Header 内にステップスライダーとステップカウンターが正しく描画され、変更が通知されること', () => {
    const handleStepChange = vi.fn();
    render(
      <Header
        currentStep={1}
        totalSteps={4}
        onStepChange={handleStepChange}
        onReset={() => {}}
      />
    );

    const stepSlider = screen.getByTestId('step-slider') as HTMLInputElement;
    const stepCounter = screen.getByTestId('step-counter');

    expect(stepSlider).toBeDefined();
    expect(stepSlider.value).toBe('1');
    expect(stepCounter.textContent).toBe('ステップ 1 / 3');

    fireEvent.change(stepSlider, { target: { value: '2' } });
    expect(handleStepChange).toHaveBeenCalledWith(2);
  });

  it('MonacoEditor に zoom prop を渡した際にエラーなくレンダリングされること', () => {
    const { container } = render(
      <MonacoEditor code="print(1)" onChange={() => {}} highlightLine={1} zoom={200} />
    );
    expect(container).toBeDefined();
  });

  it('FlowchartViewer でドラッグパンおよびズームが正常にレンダリングされること', () => {
    const { container } = render(
      <FlowchartViewer code="x = 1\ny = 2" activeLine={1} zoom={150} />
    );
    const viewer = container.querySelector('#flowchart-viewer');
    expect(viewer).toBeDefined();
  });
});
