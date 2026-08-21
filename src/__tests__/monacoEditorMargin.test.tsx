import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MonacoEditor } from '../components/MonacoEditor';
import Editor from '@monaco-editor/react';

// @monaco-editor/react のモック
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn((props: any) => {
    return <div data-testid="mock-monaco" data-options={JSON.stringify(props.options)} />;
  }),
}));

describe('MonacoEditor 余白最適化設定の検証 (Issue #21)', () => {
  it('Monaco Editor の options に glyphMargin: false, lineNumbersMinChars: 3, folding: true が設定されること', () => {
    const onChange = vi.fn();
    render(<MonacoEditor code="print('hello')" onChange={onChange} />);

    expect(Editor).toHaveBeenCalled();
    const lastCallProps = (Editor as any).mock.calls[(Editor as any).mock.calls.length - 1][0];

    expect(lastCallProps.options.glyphMargin).toBe(false);
    expect(lastCallProps.options.lineNumbersMinChars).toBe(3);
    expect(lastCallProps.options.folding).toBe(true);
  });
});
