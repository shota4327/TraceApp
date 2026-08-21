import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { VariableTable } from '../components/VariableTable';
import { StepSnapshot } from '../types/trace';

describe('VariableTable 自動スクロール機能の検証 (Issue #2)', () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    scrollIntoViewMock.mockReset();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
  });

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
    {
      stepIndex: 1,
      line: 2,
      event: 'line',
      globals: { x: 10, y: 20 },
      locals: {},
      changedVars: ['y'],
      stdoutCumulative: '',
      stdoutDelta: '',
    },
    {
      stepIndex: 2,
      line: 3,
      event: 'line',
      globals: { x: 10, y: 20, total: 30 },
      locals: {},
      changedVars: ['total'],
      stdoutCumulative: '',
      stdoutDelta: '',
    },
  ];

  it('初期ステップ描画時にアクティブ行へ scrollIntoView が呼び出されること', () => {
    render(<VariableTable snapshots={dummySnapshots} currentStepIndex={0} />);

    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        block: 'nearest',
        inline: 'nearest',
      })
    );
  });

  it('ステップ進行（currentStepIndex の更新）時に新しいアクティブ行へ scrollIntoView が再トリガーされること', () => {
    const { rerender } = render(
      <VariableTable snapshots={dummySnapshots} currentStepIndex={0} />
    );

    const initialCallCount = scrollIntoViewMock.mock.calls.length;
    expect(initialCallCount).toBeGreaterThanOrEqual(1);

    // ステップ 1 へ進行
    rerender(<VariableTable snapshots={dummySnapshots} currentStepIndex={1} />);
    expect(scrollIntoViewMock.mock.calls.length).toBeGreaterThan(initialCallCount);

    // ステップ 2 へ進行
    const secondCallCount = scrollIntoViewMock.mock.calls.length;
    rerender(<VariableTable snapshots={dummySnapshots} currentStepIndex={2} />);
    expect(scrollIntoViewMock.mock.calls.length).toBeGreaterThan(secondCallCount);
  });
});
