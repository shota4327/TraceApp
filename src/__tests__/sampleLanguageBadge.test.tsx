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

  it('トリガーボタン内に言語バッジが表示され、「サンプル:」ラベルが存在しないこと', () => {
    render(<LeftPanel {...defaultProps} selectedSampleId="seq" />);

    // 「サンプル:」テキストラベルは削除されていること
    expect(screen.queryByText('サンプル:')).toBeNull();

    // 言語バッジが表示されていること
    const badge = screen.getByTestId('badge-sample-language');
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe('Python');
  });

  it('VBAサンプル選択時、トリガーの言語バッジに「マクロ言語」が表示されること', () => {
    render(<LeftPanel {...defaultProps} selectedSampleId="zensho-2-74-4-1-2-vba" />);

    const badge = screen.getByTestId('badge-sample-language');
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe('マクロ言語');
  });

  it('カスタムドロップダウン展開時、各サンプル行内に色付きバッジが表示され、クリックで選択できること', () => {
    const onSelectSample = vi.fn();
    render(<LeftPanel {...defaultProps} selectedSampleId="seq" onSelectSample={onSelectSample} />);

    // 最初はメニューが閉じていること
    expect(screen.queryByTestId('sample-select-menu')).toBeNull();

    // トリガーボタンをクリックして展開
    const triggerBtn = screen.getByTestId('preset-select-button');
    fireEvent.click(triggerBtn);

    // メニューが展開されること
    const menu = screen.getByTestId('sample-select-menu');
    expect(menu).toBeDefined();

    // VBA サンプルの行が表示されており、マクロ言語バッジが含まれていること
    const vbaItem = screen.getByTestId('sample-item-zensho-2-74-4-1-2-vba');
    expect(vbaItem).toBeDefined();
    expect(vbaItem.textContent).toContain('マクロ言語');
    expect(vbaItem.textContent).toContain('2級 第74回【4】(1)(2)');

    // アイテムをクリックして選択
    fireEvent.click(vbaItem);
    expect(onSelectSample).toHaveBeenCalledWith('zensho-2-74-4-1-2-vba');

    // 選択後にメニューが閉じること
    expect(screen.queryByTestId('sample-select-menu')).toBeNull();
  });

  it('隠しselectの変更でも onSelectSample コールバックが呼び出されること (E2E互換性)', () => {
    const onSelectSample = vi.fn();
    render(<LeftPanel {...defaultProps} selectedSampleId="seq" onSelectSample={onSelectSample} />);

    const select = screen.getByTestId('preset-select');
    fireEvent.change(select, { target: { value: 'branch' } });

    expect(onSelectSample).toHaveBeenCalledWith('branch');
  });

  it('サンプルプログラム定義に language 属性がサポートされていること', () => {
    expect(SAMPLE_PROGRAMS.length).toBeGreaterThan(0);
    // 登録されたサンプルは 'python' または 'vba' であること
    SAMPLE_PROGRAMS.forEach((sample) => {
      expect(sample.language === undefined || sample.language === 'python' || sample.language === 'vba').toBe(true);
    });
  });
});
