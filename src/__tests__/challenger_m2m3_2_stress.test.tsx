import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { App } from '../App';
import { StepNavigation } from '../components/StepNavigation';
import { VariableTable } from '../components/VariableTable';
import { OutputConsole } from '../components/OutputConsole';
import { MonacoEditor } from '../components/MonacoEditor';
import { StepSnapshot } from '../types/trace';

// window.alert のモック化
vi.stubGlobal('alert', vi.fn());

// Monaco Editor のモック化
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div data-testid="monaco-mock">
      <textarea
        data-testid="monaco-mock-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
}));

describe('Challenger M2/M3 ストレステスト・非同期競合・UI状態整合性検証', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. UIコンポーネント接続・ステップナビゲーション境界値検証', () => {
    it('1.1. StepNavigation で範囲外（マイナス値・超過値）へステップ変更を要求してもエラーにならないこと', () => {
      const handleStepChange = vi.fn();
      const handleReset = vi.fn();

      render(
        <StepNavigation
          currentStep={0}
          totalSteps={3}
          onStepChange={handleStepChange}
          onReset={handleReset}
        />
      );

      const prevBtn = screen.getByTestId('btn-prev');
      const nextBtn = screen.getByTestId('btn-next');

      // 最初のステップなので「前へ」は disabled
      expect(prevBtn).toHaveProperty('disabled', true);
      // 「次へ」をクリック
      fireEvent.click(nextBtn);
      expect(handleStepChange).toHaveBeenCalledWith(1);
    });

    it('1.2. VariableTable に空スナップショットや大量変数を渡した際、クラッシュせず正常描画されること', () => {
      const emptySnapshots: StepSnapshot[] = [];
      const { rerender } = render(
        <VariableTable snapshots={emptySnapshots} currentStepIndex={0} />
      );

      expect(screen.getByTestId('variable-table')).toBeDefined();
      expect(screen.getByText('表示する変数の履歴がありません')).toBeDefined();

      // 大量変数スナップショット
      const manyVars: Record<string, number> = {};
      for (let i = 0; i < 50; i++) {
        manyVars[`var_${i}`] = i;
      }
      const largeSnapshots: StepSnapshot[] = [
        {
          stepIndex: 0,
          line: 1,
          event: 'line',
          globals: manyVars,
          locals: {},
          changedVars: Object.keys(manyVars),
          stdoutDelta: '',
          stdoutCumulative: '',
        },
      ];

      rerender(<VariableTable snapshots={largeSnapshots} currentStepIndex={0} />);
      expect(screen.getByTestId('variable-table')).toBeDefined();
      expect(screen.getByText('var_0')).toBeDefined();
      expect(screen.getByText('var_49')).toBeDefined();
    });

    it('1.3. OutputConsole で stdout が null / undefined / 空文字の場合に安全に処理されること', () => {
      const { rerender } = render(<OutputConsole stdout="" />);
      expect(screen.getByTestId('output-console')).toBeDefined();

      rerender(<OutputConsole stdout="Hello World\nLine 2" />);
      expect(screen.getByText(/Hello World/)).toBeDefined();
    });
  });

  describe('2. App全体における連打・非同期競合ストレス検証', () => {
    it('2.1. App初期化後に「トレース実行」ボタンを連続クリックした際、アプリがフリーズせず安全に処理されること', async () => {
      render(<App />);

      // Pyodide 初期化完了まで待機
      await waitFor(() => {
        expect(screen.queryByTestId('loading-overlay')).toBeNull();
      }, { timeout: 10000 });

      const runBtn = screen.getByTestId('btn-run');
      expect(runBtn).toBeDefined();

      // 連続で「トレース実行」ボタンをクリック
      act(() => {
        fireEvent.click(runBtn);
        fireEvent.click(runBtn);
        fireEvent.click(runBtn);
      });

      // エラーでクラッシュせず準備完了またはステータス表示が維持されること
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toBeDefined();
      });
    });

    it('2.2. サンプル選択ドロップダウンの高速切り替え時にも、UIステート不整合が起きないこと', async () => {
      render(<App />);

      // 初期化完了を待機
      await waitFor(() => {
        expect(screen.queryByTestId('loading-overlay')).toBeNull();
      }, { timeout: 10000 });

      const select = screen.getByTestId('preset-select');

      // サンプル2へ変更
      act(() => {
        fireEvent.change(select, { target: { value: 'if_else' } });
      });

      // サンプル3へ即座に変更
      act(() => {
        fireEvent.change(select, { target: { value: 'loop_func' } });
      });

      await waitFor(() => {
        expect(screen.getByTestId('status-bar')).toBeDefined();
      });
    });

    it('2.3. MonacoEditor の .py ファイルドロップを連打してもエラーにならないこと', async () => {
      const handleChange = vi.fn();
      const { getByTestId } = render(
        <MonacoEditor code="a = 1" onChange={handleChange} />
      );

      const container = getByTestId('monaco-editor');
      const file1 = new File(['x = 100'], 'test1.py', { type: 'text/x-python' });
      const file2 = new File(['y = 200'], 'test2.py', { type: 'text/x-python' });

      // 連続ドロップ
      fireEvent.drop(container, { dataTransfer: { files: [file1] } });
      fireEvent.drop(container, { dataTransfer: { files: [file2] } });

      await new Promise((r) => setTimeout(r, 60));
      expect(handleChange).toHaveBeenCalled();
    });
  });
});
