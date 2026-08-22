import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariableTable } from '../components/VariableTable';
import { StepSnapshot } from '../types/trace';

describe('VariableTable: 変更のない行を非表示フィルタリング機能', () => {
  const sampleSnapshots: StepSnapshot[] = [
    {
      stepIndex: 0,
      line: 5,
      event: 'line',
      globals: { total: 0 },
      locals: {},
      changedVars: ['total'],
      stdoutDelta: '',
      stdoutCumulative: '',
    },
    {
      stepIndex: 1,
      line: 6,
      event: 'line',
      globals: { total: 0, i: 1 },
      locals: {},
      changedVars: ['i'],
      stdoutDelta: '',
      stdoutCumulative: '',
    },
    {
      stepIndex: 2,
      line: 7,
      event: 'line',
      globals: { total: 0, i: 1 },
      locals: {},
      changedVars: [], // 変更なし
      stdoutDelta: '',
      stdoutCumulative: '',
    },
    {
      stepIndex: 3,
      line: 1,
      event: 'line',
      globals: { total: 0, i: 1 },
      locals: { a: 0, b: 1 },
      changedVars: ['a', 'b'],
      stdoutDelta: '',
      stdoutCumulative: '',
    },
    {
      stepIndex: 4,
      line: 2,
      event: 'line',
      globals: { total: 0, i: 1 },
      locals: { a: 0, b: 1, result: 1 },
      changedVars: ['result'],
      stdoutDelta: '',
      stdoutCumulative: '',
    },
    {
      stepIndex: 5,
      line: 3,
      event: 'line',
      globals: { total: 0, i: 1 },
      locals: { a: 0, b: 1, result: 1 },
      changedVars: [], // 変更なし
      stdoutDelta: '',
      stdoutCumulative: '',
    },
    {
      stepIndex: 6,
      line: 7,
      event: 'line',
      globals: { total: 1, i: 1 },
      locals: {},
      changedVars: ['total'],
      stdoutDelta: '',
      stdoutCumulative: '',
    },
  ];

  it('1. デフォルト（チェックあり）時、変更のないステップ（Step 3, Step 6）が非表示となり、Step番号が元の番号を保持していること', () => {
    render(<VariableTable snapshots={sampleSnapshots} currentStepIndex={6} />);

    const checkbox = screen.getByTestId('hide-unchanged-steps-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    const rows = screen.getAllByRole('row');
    // ヘッダー2行 (変数名・現在の値) + 変更ありステップ (Step 1, 2, 4, 5, 7 の 5行) = 7行
    expect(rows.length).toBe(7);

    const tableText = screen.getByTestId('locals-table-body').textContent || '';
    expect(tableText).toContain('1'); // Step 1
    expect(tableText).toContain('2'); // Step 2
    expect(tableText).toContain('4'); // Step 4
    expect(tableText).toContain('5'); // Step 5
    expect(tableText).toContain('7'); // Step 7
  });

  it('2. チェックを外すと、変更のないステップ（Step 3, Step 6）も含めて全7ステップが表示されること', () => {
    render(<VariableTable snapshots={sampleSnapshots} currentStepIndex={6} />);

    const checkbox = screen.getByTestId('hide-unchanged-steps-checkbox');
    fireEvent.click(checkbox);

    const rows = screen.getAllByRole('row');
    // ヘッダー2行 (変数名・現在の値) + 全ステップ 7行 = 9行
    expect(rows.length).toBe(9);
  });

  it('3. 現在ステップが変更なしステップ（Step 3: currentStepIndex=2）の時、テーブル上に余計なアクティブ行がつかないこと', () => {
    const { container } = render(<VariableTable snapshots={sampleSnapshots} currentStepIndex={2} />);

    // Step 1, 2 の2行が表示され、Step 3 は非表示
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    // いずれの行もアクティブ（isCurrent / 背景青色 #eff6ff）になっていないこと
    rows.forEach((row) => {
      const htmlRow = row as HTMLElement;
      expect(htmlRow.style.backgroundColor).not.toBe('rgb(239, 246, 255)');
    });
  });
});
