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
      <th style={metaThStyle}>Step</th>
      <th style={lineThStyle}>Line</th>
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
  stepNumber: number;
  snapshot: StepSnapshot;
  executedLine: number;
  isCurrent: boolean;
  varNames: string[];
  currentChangedVars: string[];
  latestChangedStepByVar: Record<string, number>;
}> = ({ stepNumber, snapshot, executedLine, isCurrent, varNames, currentChangedVars, latestChangedStepByVar }) => (
  <tr style={isCurrent ? activeRowStyle : trStyle}>
    <td style={metaTdStyle}>{stepNumber}</td>
    <td style={lineTdStyle}>{executedLine}</td>
    {varNames.map((name) => {
      const isLocal = snapshot.locals[name] !== undefined;
      const val = isLocal ? snapshot.locals[name] : snapshot.globals[name];
      const isChanged = snapshot.changedVars.includes(name);
      const isLatestChanged = latestChangedStepByVar[name] === stepNumber;
      const isColChanged = currentChangedVars.includes(name);

      let cellStyle = tdStyle;
      if (isLatestChanged) {
        cellStyle = changedTdStyle;
      } else if (isColChanged) {
        cellStyle = colChangedTdStyle;
      }

      return (
        <td key={name} style={cellStyle} title={isChanged ? (isLocal ? `${name} (ローカル変数)` : `${name} (グローバル変数)`) : undefined}>
          {isChanged && val !== undefined ? String(val) : ''}
          {isChanged && isLocal ? <span style={localBadgeStyle}>L</span> : null}
        </td>
      );
    })}
  </tr>
);

/** 値が関数・モジュールオブジェクトであるかを判定 */
function isFunctionValue(val: unknown): boolean {
  if (typeof val === 'function') return true;
  if (typeof val === 'string' && (val.startsWith('<function ') || val.startsWith('<module ') || val.startsWith('<built-in '))) {
    return true;
  }
  return false;
}

/** スナップショットから関数名を除外した変数名一覧を抽出 */
function extractAllVarNames(snapshots: StepSnapshot[]): string[] {
  return Array.from(
    new Set(
      snapshots.flatMap((s) => [
        ...Object.keys(s.globals).filter((k) => !isFunctionValue(s.globals[k])),
        ...Object.keys(s.locals).filter((k) => !isFunctionValue(s.locals[k])),
      ])
    )
  );
}

/**
 * スプレッドシート型変数履歴表コンポーネント
 * 変数名を横軸、ステップ実行履歴を縦軸として各ステップの変数変化を表示
 */
export const VariableTable: React.FC<VariableTableProps> = ({
  snapshots = [],
  currentStepIndex = 0,
}) => {
  const allVarNames = extractAllVarNames(snapshots);
  // currentStepIndex < 0 の場合は未実行状態 (0件)
  const count = currentStepIndex >= 0 ? currentStepIndex + 1 : 0;
  const activeSnapshots = snapshots.slice(0, count).filter((s) => s.event !== 'end');
  const currentSnapshot = activeSnapshots.length > 0 ? activeSnapshots[activeSnapshots.length - 1] : undefined;
  const currentChangedVars = currentSnapshot?.changedVars ?? [];

  // 各変数が最後に書き換わった最新ステップを計算
  const latestChangedStepByVar: Record<string, number> = {};
  activeSnapshots.forEach((s, idx) => {
    const stepNo = idx + 1;
    for (const v of s.changedVars) {
      latestChangedStepByVar[v] = stepNo;
    }
  });

  return (
    <div id="variable-table" data-testid="variable-table" style={containerStyle}>
      <div style={headerTitleStyle}>変数履歴表</div>
      <div id="locals-table-body" data-testid="locals-table-body" style={tableWrapperStyle}>
        {allVarNames.length === 0 || activeSnapshots.length === 0 ? (
          <div style={emptyStyle}>表示する変数の履歴がありません</div>
        ) : (
          <table style={tableStyle}>
            <VariableTableHeader varNames={allVarNames} changedVars={currentChangedVars} />
            <tbody>
              {activeSnapshots.map((s, idx) => {
                const stepNo = idx + 1;
                return (
                  <VariableTableRow
                    key={stepNo}
                    stepNumber={stepNo}
                    snapshot={s}
                    executedLine={s.line}
                    isCurrent={stepNo === activeSnapshots.length}
                    varNames={allVarNames}
                    currentChangedVars={currentChangedVars}
                    latestChangedStepByVar={latestChangedStepByVar}
                  />
                );
              })}
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

const tableWrapperStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 0,
};

const emptyStyle: React.CSSProperties = {
  padding: '16px',
  textAlign: 'center',
  color: '#94a3b8',
  fontSize: '0.875rem',
};

const tableStyle: React.CSSProperties = {
  width: 'auto',
  borderCollapse: 'separate',
  borderSpacing: 0,
  fontSize: '0.85rem',
  fontFamily: 'Consolas, Monaco, monospace',
};

const metaThStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 10,
  borderTop: 'none',
  borderBottom: '1px solid #cbd5e1',
  borderLeft: '1px solid #cbd5e1',
  borderRight: '1px solid #cbd5e1',
  padding: '6px 10px',
  backgroundColor: '#f1f5f9',
  color: '#64748b',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  fontSize: '0.78rem',
  fontWeight: 500,
};

const metaTdStyle: React.CSSProperties = {
  borderTop: 'none',
  borderBottom: '1px solid #e2e8f0',
  borderLeft: '1px solid #e2e8f0',
  borderRight: '1px solid #e2e8f0',
  padding: '6px 10px',
  backgroundColor: '#f8fafc',
  color: '#64748b',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  fontSize: '0.8rem',
};

const lineThStyle: React.CSSProperties = {
  ...metaThStyle,
  borderRight: '4px double #64748b',
};

const lineTdStyle: React.CSSProperties = {
  ...metaTdStyle,
  borderRight: '4px double #64748b',
};

const thStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 10,
  borderTop: 'none',
  borderBottom: '1px solid #cbd5e1',
  borderLeft: 'none',
  borderRight: '1px solid #cbd5e1',
  padding: '6px 12px',
  backgroundColor: '#ffffff',
  color: '#334155',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  fontWeight: 600,
};

const thChangedColStyle: React.CSSProperties = {
  ...thStyle,
  backgroundColor: '#fefce8',
  color: '#854d0e',
  fontWeight: 700,
};

const trStyle: React.CSSProperties = {};

const activeRowStyle: React.CSSProperties = {
  ...trStyle,
  backgroundColor: '#eff6ff',
};

const tdStyle: React.CSSProperties = {
  borderTop: 'none',
  borderBottom: '1px solid #e2e8f0',
  borderLeft: 'none',
  borderRight: '1px solid #e2e8f0',
  padding: '6px 12px',
  color: '#1e293b',
  textAlign: 'center',
  whiteSpace: 'nowrap',
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

const localBadgeStyle: React.CSSProperties = {
  marginLeft: '6px',
  fontSize: '0.7rem',
  padding: '1px 4px',
  backgroundColor: '#10b981',
  color: '#ffffff',
  borderRadius: '3px',
  fontWeight: 700,
};
