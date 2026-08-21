import React from 'react';
import { StepSnapshot } from '../types/trace';
import { extractLineComments } from '../services/commentExtractor';

interface VariableTableProps {
  snapshots?: StepSnapshot[];
  currentStepIndex?: number;
  code?: string;
  lineComments?: Record<number, string>;
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
const VariableTableRow = React.forwardRef<
  HTMLTableRowElement,
  {
    stepNumber: number;
    snapshot: StepSnapshot;
    executedLine: number;
    isCurrent: boolean;
    varNames: string[];
    currentChangedVars: string[];
    latestChangedStepByVar: Record<string, number>;
    lineComment?: string;
  }
>(({ stepNumber, snapshot, executedLine, isCurrent, varNames, currentChangedVars, latestChangedStepByVar, lineComment }, ref) => (
  <tr ref={ref} style={isCurrent ? activeRowStyle : trStyle}>
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
          {isChanged && val !== undefined ? (
            <span style={cellContentWrapperStyle}>
              <span>{String(val)}</span>
              {isLocal ? <span style={localBadgeStyle}>L</span> : null}
              {lineComment ? <span style={commentBadgeStyle} data-testid="var-comment-badge">{lineComment}</span> : null}
            </span>
          ) : ''}
        </td>
      );
    })}
  </tr>
));
VariableTableRow.displayName = 'VariableTableRow';

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
  code,
  lineComments,
}) => {
  const [hideUnchanged, setHideUnchanged] = React.useState(true);
  const activeRowRef = React.useRef<HTMLTableRowElement | null>(null);

  const lineCommentsMap = React.useMemo(() => {
    if (lineComments) return lineComments;
    if (code) return extractLineComments(code);
    return {};
  }, [code, lineComments]);

  const allVarNames = extractAllVarNames(snapshots);
  // currentStepIndex < 0 の場合は未実行状態 (0件)
  const count = currentStepIndex >= 0 ? currentStepIndex + 1 : 0;
  const activeSnapshots = snapshots.slice(0, count).filter((s) => s.event !== 'end');
  const displayedSnapshots = hideUnchanged
    ? activeSnapshots.filter((s) => s.changedVars.length > 0)
    : activeSnapshots;
  const currentSnapshot = activeSnapshots.length > 0 ? activeSnapshots[activeSnapshots.length - 1] : undefined;
  const currentChangedVars = currentSnapshot?.changedVars ?? [];

  // 各変数が最後に書き換わった最新ステップを計算
  const latestChangedStepByVar: Record<string, number> = {};
  activeSnapshots.forEach((s) => {
    const stepNo = s.stepIndex + 1;
    for (const v of s.changedVars) {
      latestChangedStepByVar[v] = stepNo;
    }
  });

  // ステップ進行時にアクティブ行へ自動スクロール
  React.useEffect(() => {
    if (activeRowRef.current && typeof activeRowRef.current.scrollIntoView === 'function') {
      activeRowRef.current.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [currentStepIndex, displayedSnapshots.length, hideUnchanged]);

  return (
    <div id="variable-table" data-testid="variable-table" style={containerStyle}>
      <div style={headerTitleStyle}>
        <span>変数履歴表</span>
        <label style={filterCheckboxLabelStyle}>
          <input
            id="hide-unchanged-steps-checkbox"
            data-testid="hide-unchanged-steps-checkbox"
            type="checkbox"
            checked={hideUnchanged}
            onChange={(e) => setHideUnchanged(e.target.checked)}
            style={{ cursor: 'pointer', margin: 0 }}
          />
          変更のない行を非表示
        </label>
      </div>
      <div id="locals-table-body" data-testid="locals-table-body" style={tableWrapperStyle}>
        {allVarNames.length === 0 || displayedSnapshots.length === 0 ? (
          <div style={emptyStyle}>表示する変数の履歴がありません</div>
        ) : (
          <table style={tableStyle}>
            <VariableTableHeader varNames={allVarNames} changedVars={currentChangedVars} />
            <tbody>
              {displayedSnapshots.map((s, idx) => {
                const stepNo = s.stepIndex + 1;
                const isCurrent = currentSnapshot?.stepIndex === s.stepIndex && currentSnapshot.changedVars.length > 0;
                const shouldAttachRef = isCurrent || idx === displayedSnapshots.length - 1;
                const lineComment = lineCommentsMap[s.line];
                return (
                  <VariableTableRow
                    key={s.stepIndex}
                    ref={shouldAttachRef ? activeRowRef : undefined}
                    stepNumber={stepNo}
                    snapshot={s}
                    executedLine={s.line}
                    isCurrent={isCurrent}
                    varNames={allVarNames}
                    currentChangedVars={currentChangedVars}
                    latestChangedStepByVar={latestChangedStepByVar}
                    lineComment={lineComment}
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

const filterCheckboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: '#64748b',
  cursor: 'pointer',
  userSelect: 'none',
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
  justifyContent: 'space-between',
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
  marginLeft: '2px',
  fontSize: '0.7rem',
  padding: '1px 4px',
  backgroundColor: '#10b981',
  color: '#ffffff',
  borderRadius: '3px',
  fontWeight: 700,
};

const cellContentWrapperStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
};

const commentBadgeStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#475569',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  marginLeft: '2px',
};
