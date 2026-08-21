import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LeftPanel } from '../components/LeftPanel';

// MonacoEditor のモック
vi.mock('../components/MonacoEditor', () => ({
  MonacoEditor: ({ code, onChange }: any) => (
    <textarea data-testid="monaco-editor" value={code} onChange={(e) => onChange(e.target.value)} />
  ),
}));

// FlowchartViewer のモック
vi.mock('../components/FlowchartViewer', () => ({
  FlowchartViewer: () => <div data-testid="flowchart-viewer">Flowchart Mock</div>,
}));

describe('「.py読込」フローティングボタンの検証 (Issue #24)', () => {
  const defaultProps = {
    code: "print('hello')",
    onChangeCode: vi.fn(),
    onFileUpload: vi.fn(),
  };

  it('Pythonコードタブ表示時、エディタ右上にフローティングボタン（file-upload-label）が表示されること', () => {
    render(<LeftPanel {...defaultProps} activeTab="code" />);

    const label = screen.getByTestId('file-upload-label');
    expect(label).toBeDefined();
    expect(label.textContent).toContain('.py 読込');

    const input = screen.getByTestId('file-upload-input') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.type).toBe('file');
    expect(input.accept).toBe('.py');
  });

  it('タブバー側（TabBarControls）には.py読込ボタンが存在しないこと', () => {
    const { container } = render(<LeftPanel {...defaultProps} activeTab="code" />);

    // タブバー（role="tablist"）内に file-upload-input は存在しないこと
    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist?.querySelector('[data-testid="file-upload-input"]')).toBeNull();
  });

  it('マクロ言語タブまたは流れ図タブのとき、Pythonパネル（panel-code）は非表示（display: none）であること', () => {
    const { rerender } = render(<LeftPanel {...defaultProps} activeTab="vba" />);

    const panelCode = screen.getByTestId('panel-code');
    expect(panelCode.style.display).toBe('none');

    rerender(<LeftPanel {...defaultProps} activeTab="flowchart" />);
    expect(panelCode.style.display).toBe('none');
  });

  it('ファイルをアップロードした際、onFileUpload コールバックが呼び出されること', async () => {
    const onFileUpload = vi.fn();
    render(<LeftPanel {...defaultProps} onFileUpload={onFileUpload} activeTab="code" />);

    const input = screen.getByTestId('file-upload-input');
    const file = new File(["x = 100\nprint(x)"], 'test.py', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onFileUpload).toHaveBeenCalledTimes(1);
      expect(onFileUpload).toHaveBeenCalledWith("x = 100\nprint(x)");
    });
  });
});
