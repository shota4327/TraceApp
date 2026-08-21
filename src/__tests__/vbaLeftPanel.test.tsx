import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeftPanel } from '../components/LeftPanel';

// MonacoEditor のモック
vi.mock('../components/MonacoEditor', () => ({
  MonacoEditor: ({
    code,
    onChange,
    highlightLine,
    language,
    testId,
  }: {
    code: string;
    onChange: (val: string) => void;
    highlightLine?: number;
    language?: string;
    testId?: string;
  }) => (
    <div data-testid={testId || 'monaco-editor'} data-language={language} data-highlight={highlightLine}>
      <textarea
        data-testid={language === 'vba' || language === 'vb' ? 'vba-textarea' : 'py-textarea'}
        value={code}
        onChange={(e) => onChange(e.target.value)}
      />
      <div>Line: {highlightLine}</div>
    </div>
  ),
}));

// FlowchartViewer のモック
vi.mock('../components/FlowchartViewer', () => ({
  FlowchartViewer: () => (
    <div id="flowchart-viewer" data-testid="flowchart-viewer" role="tabpanel" aria-labelledby="tab-flowchart">
      Flowchart Content
    </div>
  ),
}));

describe('LeftPanel - VBA Tab and Conversion UI', () => {
  const defaultProps = {
    code: 'x = 10\nprint(x)',
    onChangeCode: vi.fn(),
    vbaCode: 'x = 10\nMsgBox x',
    onChangeVbaCode: vi.fn(),
    onConvertToVba: vi.fn(),
    onConvertToPython: vi.fn(),
    activeLine: 2,
    activeVbaLine: 2,
  };

  it('renders tabs in the exact order: Python, マクロ言語, 流れ図', () => {
    render(<LeftPanel {...defaultProps} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(3);
    expect(tabs[0]?.textContent?.trim()).toBe('Python');
    expect(tabs[1]?.textContent?.trim()).toBe('マクロ言語');
    expect(tabs[2]?.textContent?.trim()).toBe('流れ図');

    expect(tabs[0]?.getAttribute('id')).toBe('tab-code');
    expect(tabs[1]?.getAttribute('id')).toBe('tab-vba');
    expect(tabs[2]?.getAttribute('id')).toBe('tab-flowchart');

    expect(tabs[0]?.getAttribute('aria-controls')).toBe('panel-code');
    expect(tabs[1]?.getAttribute('aria-controls')).toBe('panel-vba');
    expect(tabs[2]?.getAttribute('aria-controls')).toBe('flowchart-viewer');
  });

  it('switches between tabs properly', () => {
    render(<LeftPanel {...defaultProps} />);

    const pyTab = screen.getByRole('tab', { name: 'Python' });
    const vbaTab = screen.getByRole('tab', { name: 'マクロ言語' });
    const flowTab = screen.getByRole('tab', { name: '流れ図' });

    // 初期状態は Python タブ
    expect(pyTab.getAttribute('aria-selected')).toBe('true');
    expect(vbaTab.getAttribute('aria-selected')).toBe('false');

    // VBAタブをクリック
    fireEvent.click(vbaTab);
    expect(vbaTab.getAttribute('aria-selected')).toBe('true');
    expect(pyTab.getAttribute('aria-selected')).toBe('false');

    const vbaPanel = screen.getByTestId('panel-vba');
    expect(vbaPanel.style.display).not.toBe('none');

    // 流れ図タブをクリック
    fireEvent.click(flowTab);
    expect(flowTab.getAttribute('aria-selected')).toBe('true');
    expect(vbaTab.getAttribute('aria-selected')).toBe('false');
  });

  it('does not render floating convert buttons anymore', () => {
    render(<LeftPanel {...defaultProps} />);

    // フローティングボタンが削除されていること
    expect(screen.queryByTestId('btn-convert-to-vba')).toBeNull();
    expect(screen.queryByTestId('btn-convert-to-py')).toBeNull();
  });

  it('passes activeVbaLine to VBA MonacoEditor on VBA tab', () => {
    render(<LeftPanel {...defaultProps} activeLine={1} activeVbaLine={3} />);

    // VBAタブへ切り替え
    const vbaTab = screen.getByRole('tab', { name: 'マクロ言語' });
    fireEvent.click(vbaTab);

    const vbaEditor = screen.getByTestId('monaco-editor-vba');
    expect(vbaEditor.getAttribute('data-highlight')).toBe('3');
    expect(vbaEditor.getAttribute('data-language')).toBe('vba');
  });

  it('respects external activeTab and triggers onChangeTab on click', () => {
    const onChangeTab = vi.fn();
    const { rerender } = render(
      <LeftPanel {...defaultProps} activeTab="flowchart" onChangeTab={onChangeTab} />
    );

    const pyTab = screen.getByRole('tab', { name: 'Python' });
    const flowTab = screen.getByRole('tab', { name: '流れ図' });

    expect(flowTab.getAttribute('aria-selected')).toBe('true');
    expect(pyTab.getAttribute('aria-selected')).toBe('false');

    // Pythonタブをクリックすると onChangeTab('code') が呼ばれること
    fireEvent.click(pyTab);
    expect(onChangeTab).toHaveBeenCalledWith('code');

    // 外部から activeTab="code" に更新されたら Python タブが選択状態になること
    rerender(<LeftPanel {...defaultProps} activeTab="code" onChangeTab={onChangeTab} />);
    expect(pyTab.getAttribute('aria-selected')).toBe('true');
    expect(flowTab.getAttribute('aria-selected')).toBe('false');
  });

  it('restores last active code language when switching back from flowchart', () => {
    const onChangeTab = vi.fn();
    const { rerender } = render(
      <LeftPanel {...defaultProps} activeTab="vba" onChangeTab={onChangeTab} />
    );

    // VBA が選択中
    const vbaTab = screen.getByRole('tab', { name: 'マクロ言語' });
    expect(vbaTab.getAttribute('aria-selected')).toBe('true');

    // 流れ図に切り替え
    const flowTab = screen.getByRole('tab', { name: '流れ図' });
    fireEvent.click(flowTab);
    expect(onChangeTab).toHaveBeenCalledWith('flowchart');

    // 流れ図アクティブ状態で再描画
    rerender(<LeftPanel {...defaultProps} activeTab="flowchart" onChangeTab={onChangeTab} />);

    // コードタブのコンテナ領域をクリック（Python/マクロ直接でなくコード枠）
    const codeTab = screen.getByRole('tab', { name: 'Python' });
    fireEvent.click(codeTab);

    // 直前に開いていた 'vba' で復帰すること
    expect(onChangeTab).toHaveBeenLastCalledWith('vba');
  });
});
