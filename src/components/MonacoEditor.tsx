import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import { registerVbaLanguage } from '../services/vbaLanguage';

interface MonacoEditorProps {
  /** 編集対象のコード文字列 */
  code: string;
  /** コード変更時コールバック */
  onChange: (value: string) => void;
  /** ハイライト表示する現在の実行行番号 (1-indexed) */
  highlightLine?: number;
  /** 拡大率 (50〜400, デフォルト 100) */
  zoom?: number;
  /** 言語 ('python' | 'vb'、デフォルト: 'python') */
  language?: string;
  /** 要素IDプレフィックス */
  id?: string;
  /** テスト用IDプレフィックス */
  testId?: string;
}

/** E2E テスト・フォールバック用コードビューア */
const CodeViewer: React.FC<{ lines: string[]; highlightLine?: number; fontSize?: number; testId?: string }> = ({
  lines,
  highlightLine,
  fontSize = 18,
  testId = 'code-viewer',
}) => (
  <div id={testId} data-testid={testId} style={{ ...codeViewerStyle, fontSize: `${fontSize}px` }}>
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
 * Python/VB.NET コード編集、シンタックスハイライト、コード補完、実行行デコレーションハイライト、ズーム連動およびファイルドロップ機能を提供
 */
const MonacoEditorComponent: React.FC<MonacoEditorProps> = ({
  code,
  onChange,
  highlightLine,
  zoom = 100,
  language = 'python',
  id = 'monaco-editor',
  testId = 'monaco-editor',
}) => {
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
    if (!file) return;
    const isPy = language === 'python' && file.name.endsWith('.py');
    const isVb = (language === 'vb' || language === 'vba') && (file.name.endsWith('.bas') || file.name.endsWith('.vba') || file.name.endsWith('.vb') || file.name.endsWith('.txt'));
    if (isPy || isVb) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result;
        if (typeof text === 'string') onChange(text);
      };
      reader.readAsText(file);
    }
  };

  const lines = code.split('\n');
  const isVbLang = language === 'vb' || language === 'vba';
  const inputId = isVbLang ? 'vba-code-input' : 'code-input';
  const placeholder = isVbLang ? 'VB/VBAコードを入力してください...' : 'Pythonコードを入力してください...';

  return (
    <div id={id} data-testid={testId} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={handleDrop} style={containerStyle}>
      <div style={editorWrapperStyle}>
        <Editor
          height="100%"
          language={language}
          theme="vs"
          value={code}
          onChange={(val) => onChange(val ?? '')}
          beforeMount={(monacoInstance) => {
            registerVbaLanguage(monacoInstance as unknown as typeof monaco);
          }}
          onMount={(editor, monacoInstance) => {
            editorRef.current = editor;
            monacoRef.current = monacoInstance;
            registerVbaLanguage(monacoInstance);
            applyLineHighlight(highlightLine);
          }}
          options={{
            fontSize: calculatedFontSize,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            automaticLayout: true,
            tabSize: 4,
            glyphMargin: false,
            lineNumbersMinChars: 3,
            folding: true,
            quickSuggestions: { other: true, comments: false, strings: false },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            wordBasedSuggestions: 'allDocuments',
          }}
          loading={<div style={loadingStyle}>Monaco Editor を読み込んでいます...</div>}
        />
        <textarea
          id={inputId}
          data-testid={inputId}
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
          placeholder={placeholder}
          spellCheck={false}
        />
      </div>
      <CodeViewer
        lines={lines}
        highlightLine={highlightLine}
        fontSize={calculatedFontSize}
        testId={testId === 'monaco-editor' ? 'code-viewer' : `${testId}-viewer`}
      />
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
  display: 'flex',
  lineHeight: '1.5',
  backgroundColor: '#fef08a',
  color: '#854d0e',
  fontWeight: 600,
  borderRadius: '2px',
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

const loadingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: '#64748b',
  fontSize: '0.875rem',
};
