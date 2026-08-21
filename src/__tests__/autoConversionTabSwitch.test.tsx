import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';

// MonacoEditor のモック
vi.mock('../components/MonacoEditor', () => ({
  MonacoEditor: ({ code, onChange, language, testId }: any) => (
    <textarea
      data-testid={testId || (language === 'vba' ? 'monaco-editor-vba' : 'monaco-editor-code')}
      value={code}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// FlowchartViewer のモック
vi.mock('../components/FlowchartViewer', () => ({
  FlowchartViewer: ({ nodes, code }: any) => (
    <div data-testid="flowchart-viewer" data-nodes-count={nodes.length} data-code={code}>
      Flowchart ({nodes.length} nodes)
    </div>
  ),
}));

describe('タブ切り替え時のスマート自動変換・同期検証 (Issue #10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Pythonコードを変更後にマクロ言語タブへ切り替えると、自動でVBAに変換されること', async () => {
    render(<App />);

    // 初期状態のPythonエディタを取得
    const pyEditor = await screen.findByTestId('monaco-editor-code');
    fireEvent.change(pyEditor, { target: { value: 'score = 80\nprint(score)' } });

    // マクロ言語タブをクリック
    const vbaTab = screen.getByRole('tab', { name: 'マクロ言語' });
    fireEvent.click(vbaTab);

    // VBAエディタに自動変換されたVBAコードが反映されていること
    const vbaEditor = screen.getByTestId('monaco-editor-vba');
    expect(vbaEditor.textContent || (vbaEditor as HTMLTextAreaElement).value).toContain('Sub Program()');
    expect(vbaEditor.textContent || (vbaEditor as HTMLTextAreaElement).value).toContain('score = 80');
    expect(vbaEditor.textContent || (vbaEditor as HTMLTextAreaElement).value).toContain('MsgBox (score)');
  });

  it('マクロ言語コードを変更後にPythonタブへ切り替えると、自動でPythonに逆変換されること', async () => {
    render(<App />);

    // マクロ言語タブへ切り替え
    const vbaTab = screen.getByRole('tab', { name: 'マクロ言語' });
    fireEvent.click(vbaTab);

    const vbaEditor = screen.getByTestId('monaco-editor-vba');
    fireEvent.change(vbaEditor, {
      target: {
        value: `Sub Program()
    Dim count As Integer
    count = 100
    MsgBox (count)
End Sub`,
      },
    });

    // Pythonタブをクリック
    const pyTab = screen.getByRole('tab', { name: 'Python' });
    fireEvent.click(pyTab);

    // Pythonエディタに逆変換されたコードが反映されていること
    const pyEditor = screen.getByTestId('monaco-editor-code');
    expect((pyEditor as HTMLTextAreaElement).value).toContain('count = 100');
    expect((pyEditor as HTMLTextAreaElement).value).toContain('print(count)');
  });

  it('マクロ言語コードを変更後に流れ図タブを開いた場合、自動でPython逆変換と流れ図生成が行われること', async () => {
    render(<App />);

    // マクロ言語タブへ切り替え
    const vbaTab = screen.getByRole('tab', { name: 'マクロ言語' });
    fireEvent.click(vbaTab);

    const vbaEditor = screen.getByTestId('monaco-editor-vba');
    fireEvent.change(vbaEditor, {
      target: {
        value: `Sub Program()
    Dim x As Integer
    x = 42
    MsgBox (x)
End Sub`,
      },
    });

    // 流れ図タブをクリック
    const flowTab = screen.getByRole('tab', { name: '流れ図' });
    fireEvent.click(flowTab);

    // 流れ図ビューアに逆変換されたPythonコードが渡され、流れ図ノードが生成されていること
    await waitFor(() => {
      const flowchartViewer = screen.getByTestId('flowchart-viewer');
      expect(flowchartViewer.getAttribute('data-code')).toContain('x = 42');
      expect(flowchartViewer.getAttribute('data-code')).toContain('print(x)');
    });
  });
});
