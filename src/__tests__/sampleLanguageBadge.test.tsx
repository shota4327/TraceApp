import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeftPanel } from '../components/LeftPanel';
import { SAMPLE_PROGRAMS } from '../services/samplePrograms';

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

describe('サンプル選択のコード種別表示・レイアウト検証 (Issue #9)', () => {
  const defaultProps = {
    code: "print('hello')",
    onChangeCode: vi.fn(),
    onSelectSample: vi.fn(),
  };

  it('プルダウンの左側に言語バッジが表示され、「サンプル:」ラベルが存在しないこと', () => {
    render(<LeftPanel {...defaultProps} selectedSampleId="seq" />);

    // 「サンプル:」テキストラベルは削除されていること
    expect(screen.queryByText('サンプル:')).toBeNull();

    // 言語バッジが表示されていること
    const badge = screen.getByTestId('badge-sample-language');
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe('Python');
  });

  it('プルダウンの選択肢変更時に onSelectSample コールバックが呼び出されること', () => {
    const onSelectSample = vi.fn();
    render(<LeftPanel {...defaultProps} selectedSampleId="seq" onSelectSample={onSelectSample} />);

    const select = screen.getByTestId('preset-select');
    fireEvent.change(select, { target: { value: 'branch' } });

    expect(onSelectSample).toHaveBeenCalledWith('branch');
  });

  it('VBAサンプル選択時、言語バッジに「マクロ言語」が表示されること', () => {
    render(<LeftPanel {...defaultProps} selectedSampleId="zensho-2-74-4-1-2-vba" />);

    const badge = screen.getByTestId('badge-sample-language');
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe('マクロ言語');
  });

  it('サンプルプログラム定義に language 属性がサポートされていること', () => {
    expect(SAMPLE_PROGRAMS.length).toBeGreaterThan(0);
    // 登録されたサンプルは 'python' または 'vba' であること
    SAMPLE_PROGRAMS.forEach((sample) => {
      expect(sample.language === undefined || sample.language === 'python' || sample.language === 'vba').toBe(true);
    });
  });
});
