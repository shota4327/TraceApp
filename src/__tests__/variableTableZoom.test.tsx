import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariableTable } from '../components/VariableTable';
import { App } from '../App';
import { StepSnapshot } from '../types/trace';

// MonacoEditor のモック
vi.mock('../components/MonacoEditor', () => ({
  MonacoEditor: () => <div data-testid="monaco-editor">Monaco Editor Mock</div>,
}));

// FlowchartViewer のモック
vi.mock('../components/FlowchartViewer', () => ({
  FlowchartViewer: () => <div data-testid="flowchart-viewer">Flowchart Mock</div>,
}));

describe('VariableTable 拡大表示（ズーム機能）の検証 (Issue #13)', () => {
  const dummySnapshots: StepSnapshot[] = [
    {
      stepIndex: 0,
      line: 1,
      event: 'line',
      globals: { x: 10 },
      locals: {},
      changedVars: ['x'],
      stdoutCumulative: '',
      stdoutDelta: '',
    },
  ];

  it('変数履歴表ヘッダーに拡大率スライダー（table-zoom-slider）が正しく描画されること', () => {
    render(<VariableTable snapshots={dummySnapshots} currentStepIndex={0} />);

    const slider = screen.getByTestId('table-zoom-slider');
    expect(slider).toBeDefined();
    expect(slider.getAttribute('type')).toBe('range');
    expect(slider.getAttribute('min')).toBe('50');
    expect(slider.getAttribute('max')).toBe('400');

    const counter = screen.getByTestId('table-zoom-slider-counter');
    expect(counter.textContent).toBe('100%');
  });

  it('ズームスライダーを変更した際、テーブル要素に等比率拡大スタイルが適用されること', () => {
    const { container } = render(
      <VariableTable snapshots={dummySnapshots} currentStepIndex={0} zoom={150} />
    );

    const counter = screen.getByTestId('table-zoom-slider-counter');
    expect(counter.textContent).toBe('150%');

    const table = container.querySelector('table');
    expect(table).toBeDefined();
    expect(table?.style.zoom).toBe('150%');
  });

  it('App全体において、左パネルズームと変数履歴表ズームが独立して制御されること', async () => {
    render(<App />);

    const leftZoomSlider = await screen.findByTestId('zoom-slider');
    const tableZoomSlider = await screen.findByTestId('table-zoom-slider');

    const leftCounter = screen.getByTestId('zoom-counter');
    const tableCounter = screen.getByTestId('table-zoom-slider-counter');

    // 初期状態はどちらも 100%
    expect(leftCounter.textContent).toBe('100%');
    expect(tableCounter.textContent).toBe('100%');

    // 変数履歴表のズームスライダーのみを 200% に変更
    fireEvent.change(tableZoomSlider, { target: { value: '200' } });
    expect(tableCounter.textContent).toBe('200%');
    expect(leftCounter.textContent).toBe('100%');

    // 左パネルのズームスライダーのみを 120% に変更
    fireEvent.change(leftZoomSlider, { target: { value: '120' } });
    expect(leftCounter.textContent).toBe('120%');
    expect(tableCounter.textContent).toBe('200%');
  });
});
