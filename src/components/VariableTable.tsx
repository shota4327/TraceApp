import React from 'react';
import { StepSnapshot } from '../types/trace';

interface VariableTableProps {
  snapshots?: StepSnapshot[];
  currentStepIndex?: number;
}

/** テーブルヘッダー行コンポーネント */
const VariableTableHeader: React.FC<{
  varNames: string[];
  changedVars: string[];
}> = ({ varNames, changedVars }) => (
  <thead>
    <tr>
      <th style={thStyle}>Step</th>
      <th style={thStyle}>Line</th>
      {varNames.map((name) => (
        <th key={name} style={changedVars.includes(name) ? thChangedColStyle : thStyle}>
          {name}
        </th>
      ))}
    </tr>
  </thead>
);

/** テーブル本体行コンポーネント */
const VariableTableRow: React.FC<{
  snapshot: StepSnapshot;
  executedLine: number;
  isCurrent: boolean;
  varNames: string[];
  currentChangedVars: string[];
}> = ({ snapshot, executedLine, isCurrent, varNames, currentChangedVars }) => (
  <tr style={isCurrent ? activeRowStyle : trStyle}>
    <td style={tdStyle}>{snapshot.stepIndex}</td>
    <td style={tdStyle}>{executedLine}</td>
    {varNames.map((name) => {
      const isLocal = snapshot.locals[name] !== undefined;
      const val = isLocal ? snapshot.locals[name] : snapshot.globals[name];
      const isChanged = snapshot.changedVars.includes(name);
      const isColChanged = currentChangedVars.includes(name);

      let cellStyle = tdStyle;
      if (isChanged) {
        cellStyle = changedTdStyle;
      } else if (isLocal) {
        cellStyle = localTdStyle;
      } else if (isColChanged) {
        cellStyle = colChangedTdStyle;
      }

      return (
        <td key={name} style={cellStyle} title={isLocal ? `${name} (ローカル変数)` : `${name} (グローバル変数)`}>
          {val !== undefined ? String(val) : '-'}
          {isLocal ? <span style={localBadgeStyle}>L</span> : null}
        </td>
      );
    })}
  </tr>
);

/**
 * スプレッドシート型変数履歴表コンポーネント
 * 変数名を横軸、ステップ実行履歴を縦軸として各ステップの変数変化を表示
 */
export const VariableTable: React.FC<VariableTableProps> = ({
  snapshots = [],
  currentStepIndex = 0,
}) => {
  const allVarNames = Array.from(
    new Set(snapshots.flatMap((s) => [...Object.keys(s.globals), ...Object.keys(s.locals)]))
  );
  const activeSnapshots = snapshots
    .slice(0, currentStepIndex + 1)
    .filter((s) => Object.keys(s.globals).length > 0 || Object.keys(s.locals).length > 0);
  const currentSnapshot = snapshots[currentStepIndex];
  const currentChangedVars = currentSnapshot?.changedVars ?? [];

  return (
    <div id="variable-table" data-testid="variable-table" style={containerStyle}>
      <div style={headerTitleStyle}>変数履歴表 (Variable History Table)</div>
      <div id="locals-table-body" data-testid="locals-table-body" style={tableWrapperStyle}>
        {allVarNames.length === 0 || activeSnapshots.length === 0 ? (
          <div style={emptyStyle}>表示する変数の履歴がありません</div>
        ) : (
          <table style={tableStyle}>
            <VariableTableHeader varNames={allVarNames} changedVars={currentChangedVars} />
            <tbody>
              {activeSnapshots.map((s, idx) => (
                <VariableTableRow
                  key={s.stepIndex}
                  snapshot={s}
                  executedLine={snapshots[s.stepIndex - 1]?.line ?? s.line}
                  isCurrent={s.stepIndex === currentSnapshot?.stepIndex || idx === activeSnapshots.length - 1}
                  varNames={allVarNames}
                  currentChangedVars={currentChangedVars}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div id="globals-table-body" data-testid="globals-table-body" style={{ display: 'none' }} />
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#ffffff',
};

const headerTitleStyle: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: '#f1f5f9',
  borderBottom: '1px solid #e2e8f0',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#475569',
};

const tableWrapperStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '8px',
};

const emptyStyle: React.CSSProperties = {
  padding: '16px',
  textAlign: 'center',
  color: '#94a3b8',
  fontSize: '0.875rem',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
  fontFamily: 'Consolas, Monaco, monospace',
};

const thStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  padding: '6px 10px',
  backgroundColor: '#f8fafc',
  color: '#334155',
  textAlign: 'left',
};

const thChangedColStyle: React.CSSProperties = {
  ...thStyle,
  backgroundColor: '#fefce8',
  color: '#854d0e',
  fontWeight: 700,
};

const trStyle: React.CSSProperties = {
  borderBottom: '1px solid #e2e8f0',
};

const activeRowStyle: React.CSSProperties = {
  ...trStyle,
  backgroundColor: '#eff6ff',
};

const tdStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  padding: '6px 10px',
  color: '#1e293b',
};

const colChangedTdStyle: React.CSSProperties = {
  ...tdStyle,
  backgroundColor: '#fefce8',
};

const changedTdStyle: React.CSSProperties = {
  ...tdStyle,
  backgroundColor: '#fef08a',
  fontWeight: 600,
};

const localTdStyle: React.CSSProperties = {
  ...tdStyle,
  backgroundColor: '#ecfdf5',
  color: '#065f46',
};

const localBadgeStyle: React.CSSProperties = {
  marginLeft: '6px',
  fontSize: '0.7rem',
  padding: '1px 4px',
  backgroundColor: '#10b981',
  color: '#ffffff',
  borderRadius: '3px',
  fontWeight: 700,
};
