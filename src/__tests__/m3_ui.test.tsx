import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonacoEditor } from '../components/MonacoEditor';
import { App } from '../App';

// Monaco Editor Mock
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="monaco-mock-textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Web Worker Mock
class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;

  postMessage = vi.fn((msg: any) => {
    if (msg.type === 'INIT') {
      queueMicrotask(() => {
        this.onmessage?.({ data: { type: 'INIT_COMPLETE' } } as MessageEvent);
      });
    }
  });

  terminate = vi.fn();
}

vi.stubGlobal('Worker', MockWorker);

describe('MonacoEditor & App M3 結合テスト (m3_ui.test.tsx)', () => {
  it('1. MonacoEditor が正常にレンダリングされ、code-input / code-viewer が存在すること', () => {
    const handleChange = vi.fn();
    render(
      <MonacoEditor
        code="x = 10\nprint(x)"
        onChange={handleChange}
        highlightLine={2}
      />
    );

    expect(screen.getByTestId('monaco-editor')).toBeDefined();
    expect(screen.getByTestId('code-input')).toBeDefined();
    expect(screen.getByTestId('code-viewer')).toBeDefined();
  });

  it('2. MonacoEditor で .py ファイルのドラッグ＆ドロップ時に onChange が発火すること', async () => {
    const handleChange = vi.fn();
    const { getByTestId } = render(
      <MonacoEditor code="a = 1" onChange={handleChange} />
    );

    const editorContainer = getByTestId('monaco-editor');
    const file = new File(['msg = "hello"'], 'test.py', { type: 'text/x-python' });

    fireEvent.dragOver(editorContainer);
    fireEvent.drop(editorContainer, {
      dataTransfer: {
        files: [file],
      },
    });

    // FileReader が読み込みを完了するまで待機
    await new Promise((r) => setTimeout(r, 50));
    expect(handleChange).toHaveBeenCalledWith('msg = "hello"');
  });

  it('3. App 初期化中に loading-overlay が表示されること', () => {
    render(<App />);
    const loadingOverlay = screen.getByTestId('loading-overlay');
    expect(loadingOverlay).toBeDefined();
  });
});
