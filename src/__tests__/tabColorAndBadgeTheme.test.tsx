import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeftPanel } from '../components/LeftPanel';
import { Header } from '../components/Header';

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

describe('タブのコード表示（マクロ言語側緑色）と準備完了バッジ青ベース化の検証 (Issue #29)', () => {
  const leftPanelProps = {
    code: 'x = 5',
    onChangeCode: vi.fn(),
    vbaCode: 'x = 5',
    onChangeVbaCode: vi.fn(),
  };

  it('Pythonタブ選択時、スライドインジケーターの背景色が青色であること', () => {
    render(<LeftPanel {...leftPanelProps} activeTab="code" />);

    const indicator = screen.getByTestId('tab-slide-indicator');
    expect(indicator).toBeDefined();
    expect(indicator.style.backgroundColor).toBe('rgb(37, 99, 235)'); // #2563eb
  });

  it('マクロ言語タブ選択時、スライドインジケーターの背景色が緑色であること', () => {
    render(<LeftPanel {...leftPanelProps} activeTab="vba" />);

    const indicator = screen.getByTestId('tab-slide-indicator');
    expect(indicator).toBeDefined();
    expect(indicator.style.backgroundColor).toBe('rgb(22, 163, 74)'); // #16a34a
  });

  it('ヘッダーの準備完了ステータスバッジが青ベース（背景: #eff6ff, 文字: #1d4ed8）で描画されること', () => {
    render(<Header statusText="準備完了 (ready)" isCodeDirty={false} />);

    const statusBar = screen.getByTestId('status-bar');
    const statusText = screen.getByTestId('status-text');

    expect(statusBar.style.backgroundColor).toBe('rgb(239, 246, 255)'); // #eff6ff
    expect(statusBar.style.borderColor).toBe('rgb(191, 219, 254)'); // #bfdbfe
    expect(statusText.style.color).toBe('rgb(29, 78, 216)'); // #1d4ed8
  });
});
