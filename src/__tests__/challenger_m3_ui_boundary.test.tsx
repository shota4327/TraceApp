import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariableTable } from '../components/VariableTable';
import { StepNavigation } from '../components/StepNavigation';
import { OutputConsole } from '../components/OutputConsole';
import { MonacoEditor } from '../components/MonacoEditor';
import { Header } from '../components/Header';
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

    it('1.3. 変数履歴表の列ヘッダー（th）がスクロール時に固定表示（position: sticky, top: 0）されること', () => {
      const snapshots: StepSnapshot[] = [
        {
          stepIndex: 0,
          line: 1,
          event: 'line',
          globals: { a: 10, b: 20 },
          locals: {},
          changedVars: ['a', 'b'],
          stdoutDelta: '',
          stdoutCumulative: '',
        },
      ];

      const { container } = render(
        <VariableTable snapshots={snapshots} currentStepIndex={0} />
      );

      const thElements = container.querySelectorAll<HTMLElement>('thead tr:first-child th');
      expect(thElements.length).toBeGreaterThan(0);
      thElements.forEach((th) => {
        expect(th.style.position).toBe('sticky');
        expect(th.style.top).toBe('0px');
      });
      const currentValThElements = container.querySelectorAll<HTMLElement>('thead tr[data-testid="current-values-row"] th');
      expect(currentValThElements.length).toBeGreaterThan(0);
      currentValThElements.forEach((th) => {
        expect(th.style.position).toBe('sticky');
        expect(th.style.top).toBe('29px');
      });
    });
  });

  describe('2. StepNavigation 境界値テスト', () => {
    it('2.1. currentStep = 0 の場合、「最初」「前へ」ボタンが無効化されること', () => {
      const onStepChange = vi.fn();
      const onReset = vi.fn();

      render(
        <StepNavigation
          currentStep={0}
          totalSteps={5}
          onStepChange={onStepChange}
          onReset={onReset}
        />
      );

      const firstBtn = screen.getByRole('button', { name: /最初/i }) as HTMLButtonElement;
      const prevBtn = screen.getByRole('button', { name: /前へ/i }) as HTMLButtonElement;
      const nextBtn = screen.getByRole('button', { name: /次へ/i }) as HTMLButtonElement;

      expect(firstBtn.disabled).toBe(true);
      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(false);
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

    it('2.3. isCodeDirty = true の場合、「トレース準備」ボタンが有効化され、ステップナビゲーション（最初・前へ・次へ・最後）が無効化されること', () => {
      const onStepChange = vi.fn();
      const onReset = vi.fn();
      const onRun = vi.fn();
      const onLast = vi.fn();

      render(
        <StepNavigation
          currentStep={2}
          totalSteps={5}
          onStepChange={onStepChange}
          onReset={onReset}
          onRun={onRun}
          onLast={onLast}
          isCodeDirty={true}
        />
      );

      const runBtn = screen.getByRole('button', { name: /トレース準備/i }) as HTMLButtonElement;
      const firstBtn = screen.getByRole('button', { name: /最初/i }) as HTMLButtonElement;
      const prevBtn = screen.getByRole('button', { name: /前へ/i }) as HTMLButtonElement;
      const nextBtn = screen.getByRole('button', { name: /次へ/i }) as HTMLButtonElement;
      const lastBtn = screen.getByRole('button', { name: /最後/i }) as HTMLButtonElement;

      expect(runBtn.disabled).toBe(false);
      expect(firstBtn.disabled).toBe(true);
      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(true);
      expect(lastBtn.disabled).toBe(true);
    });

    it('2.4. isCodeDirty = false の場合、「トレース準備」ボタンが無効化され、ステップナビゲーションが通常動作すること', () => {
      render(
        <StepNavigation
          currentStep={2}
          totalSteps={5}
          onStepChange={vi.fn()}
          onReset={vi.fn()}
          onRun={vi.fn()}
          onLast={vi.fn()}
          isCodeDirty={false}
        />
      );

      const runBtn = screen.getByRole('button', { name: /トレース準備/i }) as HTMLButtonElement;
      const firstBtn = screen.getByRole('button', { name: /最初/i }) as HTMLButtonElement;
      const prevBtn = screen.getByRole('button', { name: /前へ/i }) as HTMLButtonElement;
      const nextBtn = screen.getByRole('button', { name: /次へ/i }) as HTMLButtonElement;
      const lastBtn = screen.getByRole('button', { name: /最後/i }) as HTMLButtonElement;

      expect(runBtn.disabled).toBe(true);
      expect(firstBtn.disabled).toBe(false);
      expect(prevBtn.disabled).toBe(false);
      expect(nextBtn.disabled).toBe(false);
      expect(lastBtn.disabled).toBe(false);
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

  describe('5. Header ステータスインジケータテスト', () => {
    it('5.1. 「コードが変更されました」のときにオレンジ注意色のスタイルが適用されること', () => {
      const { container } = render(
        <Header
          selectedSampleId="seq"
          onSelectSample={vi.fn()}
          onFileUpload={vi.fn()}
          statusText="コードが変更されました (not ready)"
        />
      );

      const statusBar = container.querySelector('#status-indicator') as HTMLElement;
      const statusText = container.querySelector('#status-text') as HTMLElement;

      expect(statusBar).not.toBeNull();
      expect(statusBar.className).toContain('dirty');
      expect(statusBar.style.backgroundColor).toBe('rgb(255, 247, 237)'); // #fff7ed
      expect(statusBar.style.borderColor).toBe('rgb(249, 115, 22)'); // #f97316
      expect(statusText.style.color).toBe('rgb(194, 65, 12)'); // #c2410c
      expect(statusText.style.fontWeight).toBe('600');
    });

    it('5.2. 「準備完了 (ready)」のときに青色スタイルが適用されること', () => {
      const { container } = render(
        <Header
          selectedSampleId="seq"
          onSelectSample={vi.fn()}
          onFileUpload={vi.fn()}
          statusText="準備完了 (ready)"
        />
      );

      const statusBar = container.querySelector('#status-indicator') as HTMLElement;
      const statusText = container.querySelector('#status-text') as HTMLElement;

      expect(statusBar).not.toBeNull();
      expect(statusBar.className).toContain('ready');
      expect(statusBar.style.backgroundColor).toBe('rgb(239, 246, 255)'); // #eff6ff
      expect(statusBar.style.borderColor).toBe('rgb(191, 219, 254)'); // #bfdbfe
      expect(statusText.style.color).toBe('rgb(29, 78, 216)'); // #1d4ed8
    });
  });
});
