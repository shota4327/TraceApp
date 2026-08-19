import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';

interface MonacoEditorProps {
  /** 編集対象の Python コード文字列 */
  code: string;
  /** コード変更時コールバック */
  onChange: (value: string) => void;
  /** ハイライト表示する現在の実行行番号 (1-indexed) */
  highlightLine?: number;
  /** 拡大率 (50〜400, デフォルト 100) */
  zoom?: number;
}

/** E2E テスト・フォールバック用コードビューア */
const CodeViewer: React.FC<{ lines: string[]; highlightLine?: number; fontSize?: number }> = ({
  lines,
  highlightLine,
  fontSize = 18,
}) => (
  <div id="code-viewer" data-testid="code-viewer" style={{ ...codeViewerStyle, fontSize: `${fontSize}px` }}>
    <div style={codeViewerTitleStyle}>実行行デコレーションプレビュー</div>
    {lines.map((lineText, idx) => {
      const lineNum = idx + 1;
      const isActive = Boolean(highlightLine && highlightLine > 0 && highlightLine === lineNum);
      return (
        <div key={idx} className={`code-line ${isActive ? 'active' : ''}`} style={isActive ? activeLineStyle : lineStyle}>
          <span style={lineNumStyle}>{lineNum}</span>
          <span style={lineContentStyle}>{lineText || ' '}</span>
        </div>
      );
    })}
  </div>
);

/**
 * Monaco Editor 表示コンポーネント
 * Python コード編集、実行行デコレーションハイライト、ズーム連動および .py ファイルドロップ機能を提供
 */
const MonacoEditorComponent: React.FC<MonacoEditorProps> = ({ code, onChange, highlightLine, zoom = 100 }) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const calculatedFontSize = Math.round(18 * (zoom / 100));

  const applyLineHighlight = (line?: number) => {
    if (!editorRef.current || !monacoRef.current) return;
    if (line && line > 0) {
      const newDecorations: monaco.editor.IModelDeltaDecoration[] = [
        {
          range: new monacoRef.current.Range(line, 1, line, 1),
          options: { isWholeLine: true, className: 'monaco-highlight-line', glyphMarginClassName: 'monaco-highlight-glyph' },
        },
      ];
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, newDecorations);
      editorRef.current.revealLineInCenterIfOutsideViewport(line);
    } else {
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
    }
  };

  useEffect(() => {
    applyLineHighlight(highlightLine);
  }, [highlightLine]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ fontSize: calculatedFontSize });
    }
  }, [calculatedFontSize]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.py')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result;
        if (typeof text === 'string') onChange(text);
      };
      reader.readAsText(file);
    }
  };

  const lines = code.split('\n');

  return (
    <div id="monaco-editor" data-testid="monaco-editor" onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={handleDrop} style={containerStyle}>
      <div style={editorWrapperStyle}>
        <Editor
          height="100%"
          language="python"
          theme="vs"
          value={code}
          onChange={(val) => onChange(val ?? '')}
          onMount={(editor, monacoInstance) => {
            editorRef.current = editor;
            monacoRef.current = monacoInstance;
            applyLineHighlight(highlightLine);
          }}
          options={{ fontSize: calculatedFontSize, minimap: { enabled: false }, scrollBeyondLastLine: false, lineNumbers: 'on', automaticLayout: true, tabSize: 4 }}
          loading={<div style={loadingStyle}>Monaco Editor を読み込んでいます...</div>}
        />
        <textarea
          id="code-input"
          data-testid="code-input"
          value={code}
          onChange={(e) => {
            onChange(e.target.value);
            if (editorRef.current && editorRef.current.getValue() !== e.target.value) {
              editorRef.current.setValue(e.target.value);
            }
          }}
          onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
            const target = e.currentTarget;
            onChange(target.value);
            if (editorRef.current && editorRef.current.getValue() !== target.value) {
              editorRef.current.setValue(target.value);
            }
          }}
          style={hiddenTextareaStyle}
          placeholder="Pythonコードを入力してください..."
          spellCheck={false}
        />
      </div>
      <CodeViewer lines={lines} highlightLine={highlightLine} fontSize={calculatedFontSize} />
    </div>
  );
};

export const MonacoEditor = React.memo(MonacoEditorComponent);

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
  backgroundColor: '#ffffff',
  position: 'relative',
};

const editorWrapperStyle: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: '200px',
  overflow: 'hidden',
};

const hiddenTextareaStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  pointerEvents: 'none',
  zIndex: -1,
};

const loadingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: '#64748b',
  fontSize: '0.875rem',
};

const codeViewerStyle: React.CSSProperties = {
  display: 'none',
  padding: '8px',
  fontFamily: 'monospace',
  backgroundColor: '#f8fafc',
  borderTop: '1px solid #e2e8f0',
  maxHeight: '200px',
  overflowY: 'auto',
};

const codeViewerTitleStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#64748b',
  marginBottom: '4px',
  fontWeight: 600,
};

const lineStyle: React.CSSProperties = {
  display: 'flex',
  lineHeight: '1.5',
  color: '#334155',
};

const activeLineStyle: React.CSSProperties = {
  ...lineStyle,
  backgroundColor: '#fef08a',
  fontWeight: 600,
};

const lineNumStyle: React.CSSProperties = {
  width: '32px',
  color: '#94a3b8',
  textAlign: 'right',
  marginRight: '12px',
  userSelect: 'none',
};

const lineContentStyle: React.CSSProperties = {
  flex: 1,
  whiteSpace: 'pre',
};
