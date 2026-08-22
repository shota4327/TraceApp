import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeftPanel } from '../components/LeftPanel';
import { generateFullDrawIoXml, saveDrawIoFile } from '../services/drawioExporter';
import { FlowchartNode, FlowchartEdge } from '../types/flowchart';

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

describe('流れ図のdraw.io形式書き出し機能 (Issue #23)', () => {
  const sampleNodes: FlowchartNode[] = [
    { id: 'node-start', type: 'terminal', label: '開始', x: 100, y: 40, width: 100, height: 40 },
    { id: 'node-1', type: 'process', label: 'x = 5', x: 100, y: 120, width: 140, height: 50 },
    { id: 'node-end', type: 'terminal', label: '終了', x: 100, y: 200, width: 100, height: 40 },
  ];

  const sampleEdges: FlowchartEdge[] = [
    { id: 'edge-1', sourceId: 'node-start', targetId: 'node-1' },
    { id: 'edge-2', sourceId: 'node-1', targetId: 'node-end' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-blob-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  it('generateFullDrawIoXml が完全な mxfile XML を生成すること', () => {
    const xml = generateFullDrawIoXml(sampleNodes, sampleEdges);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<mxfile host="app.diagrams.net"');
    expect(xml).toContain('<diagram id="flowchart-diagram" name="流れ図">');
    expect(xml).toContain('<mxGraphModel>');
    expect(xml).toContain('id="node-start"');
    expect(xml).toContain('value="開始"');
    expect(xml).toContain('id="node-1"');
    expect(xml).toContain('value="x = 5"');
    expect(xml).toContain('id="edge-1"');
    expect(xml).toContain('value=""');
    expect(xml).not.toContain('value="Next"');
    expect(xml).toContain('source="node-start"');
    expect(xml).toContain('target="node-1"');
  });

  it('saveDrawIoFile で showSaveFilePicker が利用可能な場合、ストリーム書き込みが行われること', async () => {
    const mockWritable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const mockHandle = {
      createWritable: vi.fn().mockResolvedValue(mockWritable),
    };
    const showSaveFilePickerMock = vi.fn().mockResolvedValue(mockHandle);
    (window as any).showSaveFilePicker = showSaveFilePickerMock;

    await saveDrawIoFile('<xml>test</xml>');

    expect(showSaveFilePickerMock).toHaveBeenCalled();
    expect(mockWritable.write).toHaveBeenCalledWith('<xml>test</xml>');
    expect(mockWritable.close).toHaveBeenCalled();

    delete (window as any).showSaveFilePicker;
  });

  it('流れ図タブ表示時に右下の「draw.io形式で書き出し」ボタンが表示され、クリックできること', () => {
    render(
      <LeftPanel
        code="x = 5"
        onChangeCode={vi.fn()}
        vbaCode="x = 5"
        onChangeVbaCode={vi.fn()}
        flowchartNodes={sampleNodes}
        flowchartEdges={sampleEdges}
        activeTab="flowchart"
      />
    );

    const exportBtn = screen.getByTestId('btn-export-drawio');
    expect(exportBtn).toBeDefined();
    expect(exportBtn.textContent).toContain('draw.io形式で書き出し');

    // ボタンクリックがエラーなく実行できること
    fireEvent.click(exportBtn);
  });
});
