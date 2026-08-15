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
  /** 実行状態 ('not_started' | 'running' | 'ended') */
  executionStatus?: 'not_started' | 'running' | 'ended';
}

/** エディタヘッダーサブコンポーネント */
const EditorHeader: React.FC<{ highlightLine?: number; executionStatus?: 'not_started' | 'running' | 'ended' }> = ({
  highlightLine,
  executionStatus,
}) => {
  let badgeText = '実行行: (未実行)';
  if (executionStatus === 'ended') {
    badgeText = '実行行: (実行終了)';
  } else if (executionStatus === 'running' || (highlightLine !== undefined && highlightLine > 0)) {
    badgeText = `実行行: Line ${highlightLine}`;
  } else {
    badgeText = '実行行: (未実行)';
  }

  return (
    <div style={headerInfoStyle}>
      <span>Python ソースコードエディタ (.pyファイルドロップ可能)</span>
      <span style={highlightBadgeStyle}>{badgeText}</span>
    </div>
  );
};

/** E2E テスト・フォールバック用コードビューア */
const CodeViewer: React.FC<{ lines: string[]; highlightLine?: number }> = ({ lines, highlightLine }) => (
  <div id="code-viewer" data-testid="code-viewer" style={codeViewerStyle}>
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
 * Python コード編集、実行行デコレーションハイライト、および .py ファイルドロップ機能を提供
 */
export const MonacoEditor: React.FC<MonacoEditorProps> = ({ code, onChange, highlightLine, executionStatus }) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

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
      <EditorHeader highlightLine={highlightLine} executionStatus={executionStatus} />
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
          options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, lineNumbers: 'on', automaticLayout: true, tabSize: 4 }}
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
      <CodeViewer lines={lines} highlightLine={highlightLine} />
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
  backgroundColor: '#ffffff',
  position: 'relative',
};

const headerInfoStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 12px',
  backgroundColor: '#f1f5f9',
  borderBottom: '1px solid #e2e8f0',
  fontSize: '0.85rem',
  color: '#475569',
};

const highlightBadgeStyle: React.CSSProperties = {
  backgroundColor: '#fef08a',
  color: '#854d0e',
  padding: '2px 8px',
  borderRadius: '4px',
  fontWeight: 600,
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
  height: '1px',
  opacity: 0.01,
  zIndex: 1,
  border: 'none',
  outline: 'none',
  resize: 'none',
};

const loadingStyle: React.CSSProperties = {
  padding: '16px',
  color: '#64748b',
  fontSize: '0.875rem',
};

const codeViewerStyle: React.CSSProperties = {
  display: 'none',
  padding: '8px 12px',
  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
  fontSize: '0.85rem',
  lineHeight: '1.4',
  backgroundColor: '#f8fafc',
  maxHeight: '100px',
  overflowY: 'auto',
  borderTop: '1px solid #e2e8f0',
};

const codeViewerTitleStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#94a3b8',
  marginBottom: '4px',
};

const lineStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  padding: '1px 4px',
  borderRadius: '2px',
};

const activeLineStyle: React.CSSProperties = {
  ...lineStyle,
  backgroundColor: '#fef08a',
  color: '#854d0e',
  fontWeight: 600,
};

const lineNumStyle: React.CSSProperties = {
  width: '20px',
  color: '#64748b',
  textAlign: 'right',
};

const lineContentStyle: React.CSSProperties = {
  whiteSpace: 'pre',
};
