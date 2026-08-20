import { loadPyodide, type PyodideInterface } from 'pyodide';
import { PYTHON_TRACER_SCRIPT } from '../worker/pythonTracer';
import { TraceResult } from '../types';
import { generateFlowchartGraph, generateDrawIoXml } from './flowchartGenerator';

let pyodideInstance: PyodideInterface | null = null;
let pyodideInitPromise: Promise<PyodideInterface> | null = null;

/**
 * Pyodide ランタイムのローダー関数を取得
 */
async function getPyodideLoader(): Promise<typeof loadPyodide> {
  const globalObj = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
  if (typeof globalObj.loadPyodide === 'function') {
    return globalObj.loadPyodide;
  }
  try {
    const pyodideModule = await import('pyodide');
    if (pyodideModule && typeof pyodideModule.loadPyodide === 'function') {
      return pyodideModule.loadPyodide;
    }
  } catch {
    // ES module import が利用できない場合のフォールバック
  }
  return loadPyodide;
}

/**
 * 環境に応じた indexURL を取得
 */
function getPyodideIndexURL(): string {
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      // Node.js (Vitest) 環境
      const nodePath = typeof require !== 'undefined' ? require('path') : null;
      if (nodePath) {
        return nodePath.resolve(process.cwd(), 'node_modules/pyodide');
      }
    } catch {
      // パス解決失敗時はフォールバックURLを使用
    }
  }
  return 'https://cdn.jsdelivr.net/pyodide/v314.0.5/full/';
}

/**
 * メインスレッド上の Pyodide インスタンスを取得・初期化
 */
export async function getPyodideInstance(): Promise<PyodideInterface> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideInitPromise) return pyodideInitPromise;

  pyodideInitPromise = (async () => {
    const loader = await getPyodideLoader();
    const indexURL = getPyodideIndexURL();
    const py = await loader({ indexURL });
    await py.runPythonAsync(PYTHON_TRACER_SCRIPT);
    pyodideInstance = py;
    return py;
  })();

  return pyodideInitPromise;
}

/**
 * トレース実行結果オブジェクトを構築するヘルパー
 */
function buildTraceResult(parsed: any, code: string): TraceResult {
  const graph = generateFlowchartGraph(code);
  const isTruncated = !parsed.success && parsed.snapshots && parsed.snapshots.length > 0;

  return {
    snapshots: parsed.snapshots || [],
    totalSteps: parsed.totalSteps || (parsed.snapshots ? parsed.snapshots.length : 0),
    stdout: parsed.stdout || '',
    flowchartNodes: graph.nodes,
    flowchartEdges: graph.edges,
    flowchartXml: generateDrawIoXml(graph),
    truncated: isTruncated,
    error: isTruncated ? parsed.error || 'ステップ数上限を超過しました。' : undefined,
  };
}

/**
 * メインスレッド上の Pyodide で Python コードのトレースを実行
 */
export async function runPythonTrace(code: string, maxSteps = 10000): Promise<TraceResult> {
  const py = await getPyodideInstance();
  const runTracePy = py.globals.get('run_trace');
  let jsonStr: string;
  try {
    jsonStr = runTracePy(code, maxSteps);
  } finally {
    if (runTracePy && typeof runTracePy.destroy === 'function') {
      runTracePy.destroy();
    }
  }

  const parsed = JSON.parse(jsonStr);
  if (!parsed.success && (!parsed.snapshots || parsed.snapshots.length === 0)) {
    throw new Error(parsed.error || 'トレース実行中にエラーが発生しました。');
  }

  return buildTraceResult(parsed, code);
}
