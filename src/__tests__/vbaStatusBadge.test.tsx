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

  it('Pythonまたはマクロ言語コード編集時（not ready）、変数履歴表が「表示する変数の履歴がありません」になること (Issue #37)', async () => {
    render(<App />);

    // 1. 初期ロード完了を待機
    await waitFor(() => {
      expect(screen.getByTestId('status-text').textContent).toContain('準備完了');
    }, { timeout: 10000 });

    // 初期状態では変数履歴表が表示されている（現在の値行などが存在する）
    expect(screen.getByTestId('locals-table-body').textContent).not.toContain('表示する変数の履歴がありません');

    // 2. Pythonコードを編集して not ready にする
    const pyEditor = screen.getAllByTestId('monaco-editor')[0]!;
    fireEvent.change(pyEditor, { target: { value: 'val = 999\nprint(val)' } });

    // 3. ステータスが「コードが変更されました」になり、変数履歴表がクリアされて空メッセージが表示されること
    await waitFor(() => {
      expect(screen.getByTestId('status-text').textContent).toContain('コードが変更されました');
      expect(screen.getByTestId('locals-table-body').textContent).toContain('表示する変数の履歴がありません');
    });

    // 4. 「トレース準備」ボタンを押下
    const runBtn = screen.getByTestId('btn-run') as HTMLButtonElement;
    fireEvent.click(runBtn);

    // 5. 準備完了になり、再度変数履歴表が表示されること
    await waitFor(() => {
      expect(screen.getByTestId('status-text').textContent).toContain('準備完了');
      expect(screen.getByTestId('locals-table-body').textContent).not.toContain('表示する変数の履歴がありません');
    }, { timeout: 10000 });
  });
});
