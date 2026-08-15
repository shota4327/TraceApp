import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariableTable } from '../components/VariableTable';
import { StepNavigation } from '../components/StepNavigation';
import { OutputConsole } from '../components/OutputConsole';
import { MonacoEditor } from '../components/MonacoEditor';
import { StepSnapshot } from '../types/trace';

describe('Challenger M3 UI Edge Cases & Boundary Verification', () => {
  describe('1. VariableTable 境界値・特殊構造テスト', () => {
    it('1.1. 変数が全く存在しない空のスナップショット群のレンダリング', () => {
      const snapshots: StepSnapshot[] = [
        {
          stepIndex: 0,
          line: 1,
          event: 'line',
          globals: {},
          locals: {},
          changedVars: [],
          stdoutDelta: '',
          stdoutCumulative: '',
        },
      ];

      const { container } = render(
        <VariableTable snapshots={snapshots} currentStepIndex={0} />
      );

      expect(container.textContent).toContain('表示する変数の履歴がありません');
    });

    it('1.2. NaN, Infinity, -Infinity, 複合リスト・辞書を含む変数の正常レンダリングと変更ハイライト', () => {
      const snapshots: StepSnapshot[] = [
        {
          stepIndex: 0,
          line: 1,
          event: 'line',
          globals: { nanVar: 'NaN', infVar: 'Infinity', listVar: [1, 2] },
          locals: {},
          changedVars: ['nanVar', 'infVar', 'listVar'],
          stdoutDelta: '',
          stdoutCumulative: '',
        },
        {
          stepIndex: 1,
          line: 2,
          event: 'line',
          globals: { nanVar: 'NaN', infVar: 'Infinity', listVar: [1, 2, 3] },
          locals: {},
          changedVars: ['listVar'],
          stdoutDelta: '',
          stdoutCumulative: '',
        },
      ];

      const { container } = render(
        <VariableTable snapshots={snapshots} currentStepIndex={1} />
      );

      expect(container.textContent).toContain('NaN');
      expect(container.textContent).toContain('Infinity');
      expect(container.textContent).toContain('1,2,3');
    });
  });

  describe('2. StepNavigation 境界値テスト', () => {
    it('2.1. totalSteps = 0 の場合、「前へ」「次へ」ボタンが無効化されること', () => {
      const onStepChange = vi.fn();
      const onReset = vi.fn();

      render(
        <StepNavigation
          currentStep={0}
          totalSteps={0}
          onStepChange={onStepChange}
          onReset={onReset}
        />
      );

      const prevBtn = screen.getByRole('button', { name: /前へ/i }) as HTMLButtonElement;
      const nextBtn = screen.getByRole('button', { name: /次へ/i }) as HTMLButtonElement;

      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(true);
    });

    it('2.2. 最終ステップ到達時に「次へ」ボタンが無効化され、「前へ」が有効化されること', () => {
      const onStepChange = vi.fn();
      const onReset = vi.fn();

      render(
        <StepNavigation
          currentStep={4}
          totalSteps={5}
          onStepChange={onStepChange}
          onReset={onReset}
        />
      );

      const prevBtn = screen.getByRole('button', { name: /前へ/i }) as HTMLButtonElement;
      const nextBtn = screen.getByRole('button', { name: /次へ/i }) as HTMLButtonElement;

      expect(prevBtn.disabled).toBe(false);
      expect(nextBtn.disabled).toBe(true);
    });
  });

  describe('3. OutputConsole 境界値テスト', () => {
    it('3.1. stdout が空の場合の表示', () => {
      const { container } = render(<OutputConsole stdout="" />);
      expect(container.textContent).toContain('（実行出力結果がここに表示されます）');
    });

    it('3.2. 複数行の stdout が正常にレンダリングされること', () => {
      const { container } = render(<OutputConsole stdout="Line1\nLine2\nLine3" />);
      expect(container.textContent).toContain('Line1');
      expect(container.textContent).toContain('Line2');
      expect(container.textContent).toContain('Line3');
    });
  });

  describe('4. MonacoEditor 境界値テスト', () => {
    it('4.1. 空文字列コードと非.pyファイルのドロップ処理', () => {
      const onChange = vi.fn();
      const { container } = render(
        <MonacoEditor code="" onChange={onChange} highlightLine={undefined} />
      );

      const textarea = container.querySelector('#code-input') as HTMLTextAreaElement;
      expect(textarea).not.toBeNull();
      expect(textarea.value).toBe('');

      const file = new File(['text content'], 'test.txt', { type: 'text/plain' });
      const dropZone = container.firstChild as HTMLElement;

      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
        },
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
