import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VariableTable } from '../components/VariableTable';
import { StepSnapshot } from '../types/trace';

describe('VariableTable コメント表示機能の検証 (Issue #3)', () => {
  const sampleCode = `x = 5 #(ア)
y = 10
total = x + y # (イ) 合計
print(total)`;

  const dummySnapshots: StepSnapshot[] = [
    {
      stepIndex: 0,
      line: 1,
      event: 'line',
      globals: { x: 5 },
      locals: {},
      changedVars: ['x'],
      stdoutCumulative: '',
      stdoutDelta: '',
    },
    {
      stepIndex: 1,
      line: 2,
      event: 'line',
      globals: { x: 5, y: 10 },
      locals: {},
      changedVars: ['y'],
      stdoutCumulative: '',
      stdoutDelta: '',
    },
    {
      stepIndex: 2,
      line: 3,
      event: 'line',
      globals: { x: 5, y: 10, total: 15 },
      locals: {},
      changedVars: ['total'],
      stdoutCumulative: '',
      stdoutDelta: '',
    },
  ];

  it('コメントのある行で値が変化した時、セルの横にコメントバッジが表示されること', () => {
    render(
      <VariableTable
        snapshots={dummySnapshots}
        currentStepIndex={2}
        code={sampleCode}
      />
    );

    const badges = screen.getAllByTestId('var-comment-badge');
    expect(badges.length).toBe(2);

    // 1行目の (ア)
    expect(badges[0]?.textContent).toBe('(ア)');
    // 3行目の (イ) 合計
    expect(badges[1]?.textContent).toBe('(イ) 合計');
  });

  it('コメントのない行（2行目 y=10）にはコメントバッジが表示されないこと', () => {
    render(
      <VariableTable
        snapshots={dummySnapshots.slice(0, 2)}
        currentStepIndex={1}
        code={sampleCode}
      />
    );

    const badges = screen.getAllByTestId('var-comment-badge');
    expect(badges.length).toBe(1);
    expect(badges[0]?.textContent).toBe('(ア)');
  });
});

describe('変数履歴表の現在の値固定表示機能 (Issue #4)', () => {
  const mockSnapshots: StepSnapshot[] = [
    {
      stepIndex: 0,
      line: 1,
      event: 'line',
      globals: { a: 10 },
      locals: {},
      stdoutCumulative: '',
      stdoutDelta: '',
      changedVars: ['a'],
    },
    {
      stepIndex: 1,
      line: 2,
      event: 'line',
      globals: { a: 10, b: 20 },
      locals: {},
      stdoutCumulative: '',
      stdoutDelta: '',
      changedVars: ['b'],
    },
    {
      stepIndex: 2,
      line: 3,
      event: 'line',
      globals: { a: 30, b: 20 },
      locals: {},
      stdoutCumulative: '',
      stdoutDelta: '',
      changedVars: ['a'],
    },
  ];

  it('ヘッダー内に「現在の値」行が描画され、初期ステップの値が反映されること', () => {
    render(<VariableTable snapshots={mockSnapshots} currentStepIndex={0} />);

    const currentValuesRow = screen.getByTestId('current-values-row');
    expect(currentValuesRow).toBeDefined();
    expect(currentValuesRow.textContent).toContain('現在の値');
    expect(currentValuesRow.textContent).toContain('10');
  });

  it('ステップ進行に伴い、現在の値行が最新のスナップショット値に更新されること', () => {
    const { rerender } = render(<VariableTable snapshots={mockSnapshots} currentStepIndex={0} />);

    let currentValuesRow = screen.getByTestId('current-values-row');
    expect(currentValuesRow.textContent).toContain('10');

    // Step 2 に進める (a=10, b=20)
    rerender(<VariableTable snapshots={mockSnapshots} currentStepIndex={1} />);
    currentValuesRow = screen.getByTestId('current-values-row');
    expect(currentValuesRow.textContent).toContain('10');
    expect(currentValuesRow.textContent).toContain('20');

    // Step 3 に進める (a=30, b=20)
    rerender(<VariableTable snapshots={mockSnapshots} currentStepIndex={2} />);
    currentValuesRow = screen.getByTestId('current-values-row');
    expect(currentValuesRow.textContent).toContain('30');
    expect(currentValuesRow.textContent).toContain('20');
  });

  it('ローカル変数にはローカル変数バッジ(L)が表示されること', () => {
    const localSnapshots: StepSnapshot[] = [
      {
        stepIndex: 0,
        line: 5,
        event: 'line',
        globals: {},
        locals: { x: 99 },
        stdoutCumulative: '',
        stdoutDelta: '',
        changedVars: ['x'],
      },
    ];

    render(<VariableTable snapshots={localSnapshots} currentStepIndex={0} />);

    const currentValuesRow = screen.getByTestId('current-values-row');
    expect(currentValuesRow.textContent).toContain('99');
    expect(currentValuesRow.textContent).toContain('L');
  });
});
