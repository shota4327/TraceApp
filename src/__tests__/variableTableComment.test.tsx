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
