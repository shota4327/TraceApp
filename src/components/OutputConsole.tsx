import React from 'react';

interface OutputConsoleProps {
  stdout: string;
}

/**
 * 標準出力 (print出力) 表示エリアコンポーネント (M3統合準備構造)
 */
export const OutputConsole: React.FC<OutputConsoleProps> = ({ stdout }) => {
  return (
    <div id="output-console" data-testid="output-console" style={containerStyle}>
      <div style={headerStyle}>標準出力</div>
      <pre id="console-output" data-testid="console-output" style={consoleAreaStyle}>
        {stdout || (
          <span style={{ color: '#94a3b8' }}>
            （実行出力結果がここに表示されます）
          </span>
        )}
      </pre>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#ffffff',
  borderTop: '1px solid #e2e8f0',
};

const headerStyle: React.CSSProperties = {
  padding: '0 12px',
  backgroundColor: '#f1f5f9',
  borderBottom: '1px solid #e2e8f0',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#475569',
  height: '38px',
  minHeight: '38px',
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
};

const consoleAreaStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  margin: 0,
  backgroundColor: '#0f172a',
  color: '#f8fafc',
  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
  fontSize: '0.875rem',
  overflowY: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
};
