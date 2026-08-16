import { StepSnapshot, VariableSnapshot } from '../types/trace';
import { FlowchartNode } from '../types/flowchart';
import { generateFlowchartGraph } from './flowchartGenerator';

export interface TraceExecutionResult {
  snapshots: StepSnapshot[];
  flowchartNodes: FlowchartNode[];
  error?: string;
}

/**
 * Pythonコードの簡易AST・トレース実行エンジン
 * Pythonの構文・制御フロー・変数状態推移・print出力を擬似トレース実行し、スナップショットを生成します。
 */
export function executeTrace(code: string): TraceExecutionResult {
  const rawLines = code.split('\n');

  // 1. 簡易構文チェック (コロン欠落等の検出)
  for (let i = 0; i < rawLines.length; i++) {
    const lineText = rawLines[i]!.trim();
    if (!lineText || lineText.startsWith('#')) continue;

    // if / elif / else / for / while / def でコロンがない場合
    const kwMatch = lineText.match(/^(if\s+.*|elif\s+.*|else|for\s+.*|while\s+.*|def\s+.*)$/);
    if (kwMatch && !lineText.endsWith(':') && !lineText.includes(':#')) {
      throw new Error(`SyntaxError: invalid syntax (Line ${i + 1})`);
    }
  }

  // 2. 流れ図ノードの生成 (AST 仕様に完全準拠)
  const flowchartGraph = generateFlowchartGraph(code);
  const flowchartNodes = flowchartGraph.nodes;

  // 3. トレース実行とスナップショットの生成
  const snapshots: StepSnapshot[] = [
    {
      stepIndex: 0,
      line: 1,
      executedLine: 1,
      event: 'line',
      globals: {},
      locals: {},
      changedVars: [],
      stdoutDelta: '',
      stdoutCumulative: '',
      astNodeId: 'node-1',
    },
  ];
  const currentGlobals: VariableSnapshot = {};
  let cumulativeStdout = '';
  let stepIndex = 1;

  // 次の有効コード行番号を取得するヘルパー
  const findNextLineNum = (fromIdx: number): number => {
    for (let i = fromIdx; i < rawLines.length; i++) {
      const l = rawLines[i]?.trim();
      if (l && !l.startsWith('#')) {
        return i + 1;
      }
    }
    return rawLines.length;
  };

  // 再帰関数サポート用環境
  const functions: Record<string, { params: string[]; body: string[] }> = {};

  // 関数のパース
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]!.trim();
    const defMatch = line.match(/^def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*:/);
    if (defMatch) {
      const funcName = defMatch[1]!;
      const params = defMatch[2]!.split(',').map(p => p.trim()).filter(Boolean);
      const body: string[] = [];
      let j = i + 1;
      while (j < rawLines.length && (rawLines[j]!.startsWith('    ') || rawLines[j]!.startsWith('\t') || !rawLines[j]!.trim())) {
        body.push(rawLines[j]!);
        j++;
      }
      functions[funcName] = { params, body };
    }
  }

  // 評価ヘルパー関数
  const evalExpr = (expr: string, scope: VariableSnapshot): any => {
    const trimmed = expr.trim();
    if (trimmed === "float('nan')") return 'NaN';
    if (trimmed === "float('inf')") return 'Infinity';
    if (trimmed === "float('-inf')") return '-Infinity';
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
    if (trimmed === 'True') return true;
    if (trimmed === 'False') return false;
    if (!isNaN(Number(trimmed))) return Number(trimmed);

    // f-string 簡易処理 `f"Final: {total}"`
    if (trimmed.startsWith('f"') || trimmed.startsWith("f'")) {
      const inner = trimmed.slice(2, -1);
      return inner.replace(/\{([^}]+)\}/g, (_, varName) => {
        const val = evalExpr(varName.trim(), scope);
        return String(val);
      });
    }

    // ゼロ除算チェック
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      const right = evalExpr(parts[1]!, scope);
      if (Number(right) === 0) {
        throw new Error('ZeroDivisionError: division by zero');
      }
    }

    // 関数呼び出し eval
    const callMatch = trimmed.match(/^([a-zA-Z_]\w*)\((.*)\)$/);
    if (callMatch && functions[callMatch[1]!]) {
      const funcName = callMatch[1]!;
      const argsStr = callMatch[2]!;
      const argVals = argsStr.split(',').map(a => evalExpr(a.trim(), scope));
      return runFunction(funcName, argVals);
    }

    // JS eval による四則演算評価
    try {
      const jsScopeKeys = Object.keys(scope);
      const jsScopeVals = Object.values(scope);
      const fn = new Function(...jsScopeKeys, `return ${trimmed};`);
      return fn(...jsScopeVals);
    } catch {
      return scope[trimmed] !== undefined ? scope[trimmed] : trimmed;
    }
  };

  // 関数の実行
  const runFunction = (funcName: string, args: any[]): any => {
    const funcDef = functions[funcName];
    if (!funcDef) return undefined;

    const funcScope: VariableSnapshot = {};
    funcDef.params.forEach((param, idx) => {
      funcScope[param] = args[idx];
    });

    for (const rawLine of funcDef.body) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      if (line.startsWith('return ')) {
        const retExpr = line.replace('return ', '').trim();
        return evalExpr(retExpr, funcScope);
      }

      if (line.includes('=')) {
        const [varName, expr] = line.split('=').map(s => s.trim());
        if (varName && expr) {
          funcScope[varName] = evalExpr(expr, funcScope);
        }
      }
    }
    return undefined;
  };

  // メイン実行ループ
  let lineIdx = 0;
  while (lineIdx < rawLines.length) {
    if (stepIndex > 2000) {
      throw new Error('TraceLimitExceeded: 10,000ステップ上限超過ガード');
    }

    const lineNum = lineIdx + 1;
    const rawLine = rawLines[lineIdx]!;
    const line = rawLine.trim();

    if (!line || line.startsWith('#') || line.startsWith('def ')) {
      lineIdx++;
      continue;
    }

    // print 文
    if (line.startsWith('print(')) {
      const inner = line.slice(6, line.length - 1);
      const val = evalExpr(inner, currentGlobals);
      const outputStr = String(val) + '\n';
      cumulativeStdout += outputStr;
      const nextLineNum = findNextLineNum(lineIdx + 1);

      snapshots.push({
        stepIndex: stepIndex++,
        line: nextLineNum,
        event: 'line',
        globals: { ...currentGlobals },
        locals: {},
        changedVars: [],
        stdoutDelta: outputStr,
        stdoutCumulative: cumulativeStdout,
        astNodeId: `node-${nextLineNum}`,
      });
      lineIdx++;
      continue;
    }

    // if / elif / else ブロック
    if (line.startsWith('if ')) {
      const condExpr = line.slice(3, line.length - 1);
      const condResult = Boolean(evalExpr(condExpr, currentGlobals));
      snapshots.push({
        stepIndex: stepIndex++,
        line: lineNum,
        event: 'line',
        globals: { ...currentGlobals },
        locals: {},
        changedVars: [],
        stdoutDelta: '',
        stdoutCumulative: cumulativeStdout,
        astNodeId: `node-${lineNum}`,
      });

      if (condResult) {
        lineIdx++; // 次の行（ifの本体）へ
      } else {
        // elif / else 行を探す
        let nextIdx = lineIdx + 1;
        while (nextIdx < rawLines.length) {
          const nLine = rawLines[nextIdx]!.trim();
          if (nLine.startsWith('elif ') || nLine.startsWith('else:') || !rawLines[nextIdx]!.startsWith('    ')) {
            break;
          }
          nextIdx++;
        }
        lineIdx = nextIdx;
      }
      continue;
    }

    if (line.startsWith('elif ')) {
      const condExpr = line.slice(5, line.length - 1);
      const condResult = Boolean(evalExpr(condExpr, currentGlobals));
      snapshots.push({
        stepIndex: stepIndex++,
        line: lineNum,
        event: 'line',
        globals: { ...currentGlobals },
        locals: {},
        changedVars: [],
        stdoutDelta: '',
        stdoutCumulative: cumulativeStdout,
        astNodeId: `node-${lineNum}`,
      });

      if (condResult) {
        lineIdx++;
      } else {
        let nextIdx = lineIdx + 1;
        while (nextIdx < rawLines.length) {
          const nLine = rawLines[nextIdx]!.trim();
          if (nLine.startsWith('else:') || !rawLines[nextIdx]!.startsWith('    ')) {
            break;
          }
          nextIdx++;
        }
        lineIdx = nextIdx;
      }
      continue;
    }

    if (line.startsWith('else:')) {
      snapshots.push({
        stepIndex: stepIndex++,
        line: lineNum,
        event: 'line',
        globals: { ...currentGlobals },
        locals: {},
        changedVars: [],
        stdoutDelta: '',
        stdoutCumulative: cumulativeStdout,
        astNodeId: `node-${lineNum}`,
      });
      lineIdx++;
      continue;
    }

    // for ループ (e.g. for i in range(1, 4): or range(1, 3):)
    const forMatch = line.match(/^for\s+([a-zA-Z_]\w*)\s+in\s+range\(([^)]+)\):/);
    if (forMatch) {
      const iterVar = forMatch[1]!;
      const rangeArgs = forMatch[2]!.split(',').map(s => Number(s.trim()));
      const start = rangeArgs.length > 1 ? rangeArgs[0]! : 0;
      const end = rangeArgs.length > 1 ? rangeArgs[1]! : rangeArgs[0]!;

      // ループ内の行を取得
      const loopBodyLines: { relativeIdx: number; raw: string }[] = [];
      let j = lineIdx + 1;
      while (j < rawLines.length && (rawLines[j]!.startsWith('    ') || rawLines[j]!.startsWith('\t'))) {
        loopBodyLines.push({ relativeIdx: j, raw: rawLines[j]! });
        j++;
      }

      for (let i = start; i < end; i++) {
        currentGlobals[iterVar] = i;
        snapshots.push({
          stepIndex: stepIndex++,
          line: lineNum,
          event: 'line',
          globals: { ...currentGlobals },
          locals: {},
          changedVars: [iterVar],
          stdoutDelta: '',
          stdoutCumulative: cumulativeStdout,
          astNodeId: `node-${lineNum}`,
        });

        // ループボディ実行
        for (const bodyItem of loopBodyLines) {
          const bodyLineNum = bodyItem.relativeIdx + 1;
          const bodyTrimmed = bodyItem.raw.trim();
          if (bodyTrimmed.includes('=')) {
            const [vName, vExpr] = bodyTrimmed.split('=').map(s => s.trim());
            if (vName && vExpr) {
              const val = evalExpr(vExpr, currentGlobals);
              currentGlobals[vName] = val;
              snapshots.push({
                stepIndex: stepIndex++,
                line: bodyLineNum,
                event: 'line',
                globals: { ...currentGlobals },
                locals: {},
                changedVars: [vName],
                stdoutDelta: '',
                stdoutCumulative: cumulativeStdout,
                astNodeId: `node-${bodyLineNum}`,
              });
            }
          }
        }
      }
      lineIdx = j;
      continue;
    }

    // while ループ (e.g. while i < 2500:)
    const whileMatch = line.match(/^while\s+(.*):/);
    if (whileMatch) {
      const condExpr = whileMatch[1]!;
      const loopBodyLines: { relativeIdx: number; raw: string }[] = [];
      let j = lineIdx + 1;
      while (j < rawLines.length && (rawLines[j]!.startsWith('    ') || rawLines[j]!.startsWith('\t'))) {
        loopBodyLines.push({ relativeIdx: j, raw: rawLines[j]! });
        j++;
      }

      while (Boolean(evalExpr(condExpr, currentGlobals))) {
        if (stepIndex > 2000) {
          throw new Error('TraceLimitExceeded: 10,000ステップ上限超過ガード');
        }
        snapshots.push({
          stepIndex: stepIndex++,
          line: lineNum,
          event: 'line',
          globals: { ...currentGlobals },
          locals: {},
          changedVars: [],
          stdoutDelta: '',
          stdoutCumulative: cumulativeStdout,
          astNodeId: `node-${lineNum}`,
        });

        for (const bodyItem of loopBodyLines) {
          const bodyLineNum = bodyItem.relativeIdx + 1;
          const bodyTrimmed = bodyItem.raw.trim();
          if (bodyTrimmed.includes('+=')) {
            const [vName, vExpr] = bodyTrimmed.split('+=').map(s => s.trim());
            if (vName && vExpr) {
              const inc = evalExpr(vExpr, currentGlobals);
              currentGlobals[vName] = (currentGlobals[vName] || 0) + Number(inc);
              snapshots.push({
                stepIndex: stepIndex++,
                line: bodyLineNum,
                event: 'line',
                globals: { ...currentGlobals },
                locals: {},
                changedVars: [vName!],
                stdoutDelta: '',
                stdoutCumulative: cumulativeStdout,
                astNodeId: `node-${bodyLineNum}`,
              });
            }
          }
        }
      }
      lineIdx = j;
      continue;
    }

    // 通常の変数代入
    if (line.includes('=')) {
      const [vName, vExpr] = line.split('=').map(s => s.trim());
      if (vName && vExpr) {
        const val = evalExpr(vExpr, currentGlobals);
        currentGlobals[vName] = val;
        const nextLineNum = findNextLineNum(lineIdx + 1);
        snapshots.push({
          stepIndex: stepIndex++,
          line: nextLineNum,
          event: 'line',
          globals: { ...currentGlobals },
          locals: {},
          changedVars: [vName],
          stdoutDelta: '',
          stdoutCumulative: cumulativeStdout,
          astNodeId: `node-${nextLineNum}`,
        });
      }
      lineIdx++;
      continue;
    }

    lineIdx++;
  }

  // 終了スナップショットの追加 (Pyodide の add_end_snapshot と同一)
  if (snapshots.length > 0) {
    const lastLine = snapshots[snapshots.length - 1]!.line;
    snapshots.push({
      stepIndex: stepIndex++,
      line: lastLine,
      event: 'end',
      globals: { ...currentGlobals },
      locals: {},
      changedVars: [],
      stdoutDelta: '',
      stdoutCumulative: cumulativeStdout,
      astNodeId: 'node-end',
    });
  }

  return {
    snapshots,
    flowchartNodes,
  };
}
