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
  FlowchartViewer: () => <div id="flowchart-viewer" data-testid="flowchart-viewer" role="tabpanel" aria-labelledby="tab-flowchart">Flowchart Content</div>,
}));

describe('LeftPanel - VBA Tab and Conversion UI', () => {
  const defaultProps = {
    code: 'x = 10\nprint(x)',
    onChangeCode: vi.fn(),
    vbaCode: 'x = 10\nMsgBox x',
    onChangeVbaCode: vi.fn(),
    onConvertToVba: vi.fn(),
    onConvertToPython: vi.fn(),
    currentStep: 1,
    totalSteps: 3,
    onStepChange: vi.fn(),
    onReset: vi.fn(),
    onRun: vi.fn(),
    onLast: vi.fn(),
    activeLine: 2,
    activeVbaLine: 2,
    executionStatus: 'running' as const,
  };

  it('renders tabs in the exact order: コード(Python), コード(マクロ言語), 流れ図', () => {
    render(<LeftPanel {...defaultProps} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(3);
    expect(tabs[0]?.textContent).toBe('コード(Python)');
    expect(tabs[1]?.textContent).toBe('コード(マクロ言語)');
    expect(tabs[2]?.textContent).toBe('流れ図');

    expect(tabs[0]?.getAttribute('id')).toBe('tab-code');
    expect(tabs[1]?.getAttribute('id')).toBe('tab-vba');
    expect(tabs[2]?.getAttribute('id')).toBe('tab-flowchart');

    expect(tabs[0]?.getAttribute('aria-controls')).toBe('panel-code');
    expect(tabs[1]?.getAttribute('aria-controls')).toBe('panel-vba');
    expect(tabs[2]?.getAttribute('aria-controls')).toBe('flowchart-viewer');
  });

  it('switches between tabs properly', () => {
    render(<LeftPanel {...defaultProps} />);

    const pyTab = screen.getByRole('tab', { name: 'コード(Python)' });
    const vbaTab = screen.getByRole('tab', { name: 'コード(マクロ言語)' });
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

  it('triggers conversion handlers on button clicks', () => {
    const onConvertToVba = vi.fn();
    const onConvertToPython = vi.fn();

    render(
      <LeftPanel
        {...defaultProps}
        onConvertToVba={onConvertToVba}
        onConvertToPython={onConvertToPython}
      />
    );

    // Pythonタブ内のマクロ言語へ変換ボタンをクリック
    const btnToVba = screen.getByTestId('btn-convert-to-vba');
    expect(btnToVba.textContent?.trim()).toBe('マクロ言語へ変換 ➔');
    fireEvent.click(btnToVba);
    expect(onConvertToVba).toHaveBeenCalledTimes(1);

    // VBAタブへ切り替え
    const vbaTab = screen.getByRole('tab', { name: 'コード(マクロ言語)' });
    fireEvent.click(vbaTab);

    // VBAタブ内のPythonへ変換ボタンをクリック
    const btnToPy = screen.getByTestId('btn-convert-to-py');
    fireEvent.click(btnToPy);
    expect(onConvertToPython).toHaveBeenCalledTimes(1);
  });

  it('passes activeVbaLine to VBA MonacoEditor and updates line badge on VBA tab', () => {
    render(<LeftPanel {...defaultProps} activeLine={1} activeVbaLine={3} />);

    // VBAタブへ切り替え
    const vbaTab = screen.getByRole('tab', { name: 'コード(マクロ言語)' });
    fireEvent.click(vbaTab);

    const badge = screen.getByTestId('active-line-badge');
    expect(badge.textContent).toBe('実行行: Line 3');

    const vbaEditor = screen.getByTestId('monaco-editor-vba');
    expect(vbaEditor.getAttribute('data-highlight')).toBe('3');
    expect(vbaEditor.getAttribute('data-language')).toBe('vba');
  });

  it('respects external activeTab and triggers onChangeTab on click', () => {
    const onChangeTab = vi.fn();
    const { rerender } = render(
      <LeftPanel {...defaultProps} activeTab="flowchart" onChangeTab={onChangeTab} />
    );

    const pyTab = screen.getByRole('tab', { name: 'コード(Python)' });
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
});
