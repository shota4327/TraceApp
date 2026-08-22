import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';

// MonacoEditor のモック
vi.mock('../components/MonacoEditor', () => ({
  MonacoEditor: ({ code, onChange }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={code}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// FlowchartViewer のモック
vi.mock('../components/FlowchartViewer', () => ({
  FlowchartViewer: () => <div data-testid="flowchart-viewer">Flowchart Mock</div>,
}));

describe('マクロ言語編集時のステータスバッジ連動およびトレース準備 (Issue #28)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('マクロ言語コードを編集した際、ステータスバッジが「コードが変更されました」になりトレース準備ボタンが活性化されること', async () => {
    render(<App />);

    // 1. 初期ロード完了を待機
    await waitFor(() => {
      expect(screen.getByTestId('status-text').textContent).toContain('準備完了');
    }, { timeout: 10000 });

    // トレース準備ボタンは最初は非活性（disabled）
    const runBtn = screen.getByTestId('btn-run') as HTMLButtonElement;
    expect(runBtn.disabled).toBe(true);

    // 2. マクロ言語タブへ切り替え
    const vbaTabBtn = screen.getByTestId('tab-vba');
    fireEvent.click(vbaTabBtn);

    // 3. マクロ言語コードを編集（2つ目のエディタがVBA）
    const editors = screen.getAllByTestId('monaco-editor');
    const vbaEditor = editors[1]!;
    fireEvent.change(vbaEditor, { target: { value: 'Sub Program()\n    x = 100\n    MsgBox (x)\nEnd Sub' } });

    // 4. ステータスバッジが「コードが変更されました」に変化すること
    await waitFor(() => {
      expect(screen.getByTestId('status-text').textContent).toContain('コードが変更されました');
    });

    // 5. トレース準備ボタンが有効化（enabled）されること
    expect(runBtn.disabled).toBe(false);

    // 6. 「トレース準備」ボタンをクリック
    fireEvent.click(runBtn);

    // 7. 再トレースが実行され、タブはマクロ言語のまま「準備完了」に復帰すること
    await waitFor(() => {
      expect(screen.getByTestId('status-text').textContent).toContain('準備完了');
    }, { timeout: 10000 });

    // エディタの内容が保持されていること
    const updatedEditors = screen.getAllByTestId('monaco-editor');
    expect((updatedEditors[1] as HTMLTextAreaElement).value).toContain('x = 100');
  });
});
