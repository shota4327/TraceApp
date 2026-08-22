import { FlowchartNode, FlowchartEdge } from '../types/flowchart';
import { generateDrawIoXml } from './flowchartGenerator';

/**
 * draw.io (diagrams.net) で直接編集可能な完全な mxfile XML 文字列を生成
 */
export function generateFullDrawIoXml(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[]
): string {
  const innerGraphXml = generateDrawIoXml(nodes, edges);

  const timestamp = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${timestamp}" agent="PyTrace" version="21.0.0" type="device">
  <diagram id="flowchart-diagram" name="流れ図">
    ${innerGraphXml}
  </diagram>
</mxfile>`;
}

/**
 * draw.io ファイルの保存ダイアログを表示して保存
 * ※ ファイル名は初期状態で空白とし、ユーザーに入力させます
 */
export async function saveDrawIoFile(xmlContent: string): Promise<void> {
  // 1. File System Access API (モダンブラウザ)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        types: [
          {
            description: 'draw.io 図面ファイル (*.drawio)',
            accept: {
              'application/vnd.jgraph.mxfile': ['.drawio'],
              'application/xml': ['.xml'],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(xmlContent);
      await writable.close();
      return;
    } catch (err: any) {
      // ユーザーが保存ダイアログをキャンセルした場合は何もせず終了
      if (err.name === 'AbortError') {
        return;
      }
      console.warn('showSaveFilePicker failed, falling back to download:', err);
    }
  }

  // 2. フォールバック (非対応ブラウザ / prompt によるファイル名入力)
  let inputName = '';
  if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
    const promptRes = window.prompt('保存するファイル名を入力してください（拡張子不要）:');
    if (promptRes === null) {
      // キャンセル
      return;
    }
    inputName = (promptRes || '').trim();
  }

  const filename = inputName
    ? inputName.endsWith('.drawio') || inputName.endsWith('.xml')
      ? inputName
      : `${inputName}.drawio`
    : 'flowchart.drawio';

  const blob = new Blob([xmlContent], { type: 'application/vnd.jgraph.mxfile;charset=utf-8' });
  if (typeof window !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }
}
