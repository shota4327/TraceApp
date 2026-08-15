import { loadPyodide, type PyodideInterface } from 'pyodide';
import { PYTHON_TRACER_SCRIPT } from './pythonTracer';
import type { WorkerRequest, WorkerResponse, TraceResult } from '../types';

/**
 * Pyodide Web Worker トレースエンジン
 * メインスレッドと postMessage で非同期通信し、Pyodide の初期化と sys.settrace トレース実行を行います。
 */

let pyodide: PyodideInterface | null = null;
let isInitializing = false;

/**
 * 環境に応じた Pyodide ローダーを取得するヘルパー関数
 */
async function getPyodideLoader(): Promise<typeof loadPyodide> {
  const globalSelf = self as any;
  if (typeof globalSelf.loadPyodide === 'function') {
    return globalSelf.loadPyodide;
  }
  try {
    const pyodideModule = await import('pyodide');
    if (pyodideModule && typeof pyodideModule.loadPyodide === 'function') {
      return pyodideModule.loadPyodide;
    }
  } catch {
    // ES module import が利用できない場合のフォールバック
  }
  if (typeof globalSelf.importScripts === 'function') {
    try {
      globalSelf.importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');
      if (typeof globalSelf.loadPyodide === 'function') {
        return globalSelf.loadPyodide;
      }
    } catch {
      // ignore
    }
  }
  return loadPyodide;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  if (request.type === 'INIT') {
    if (pyodide) {
      self.postMessage({ type: 'INIT_COMPLETE' } satisfies WorkerResponse);
      return;
    }
    if (isInitializing) return;

    isInitializing = true;
    try {
      console.log('[Worker] Starting Pyodide initialization...');
      const loader = await getPyodideLoader();
      pyodide = await loader({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
      });
      console.log('[Worker] Pyodide loaded, running tracer script...');
      await pyodide.runPythonAsync(PYTHON_TRACER_SCRIPT);
      console.log('[Worker] Tracer script initialized successfully.');
      isInitializing = false;
      self.postMessage({ type: 'INIT_COMPLETE' } satisfies WorkerResponse);
    } catch (err: unknown) {
      console.error('[Worker] Initialization error:', err);
      isInitializing = false;
      const errorMessage = err instanceof Error ? err.message : String(err);
      self.postMessage({
        type: 'INIT_ERROR',
        error: errorMessage,
      } satisfies WorkerResponse);
    }
  } else if (request.type === 'RUN_TRACE') {
    console.log('[Worker] Received RUN_TRACE request');
    if (!pyodide) {
      console.warn('[Worker] Pyodide not initialized yet');
      self.postMessage({
        type: 'TRACE_ERROR',
        error: 'Pyodideの初期化が完了していません。',
      } satisfies WorkerResponse);
      return;
    }

    try {
      const code = request.code;
      const maxSteps = request.maxSteps ?? 10000;
      console.log('[Worker] Running trace via run_trace function...');
      const runTracePy = pyodide.globals.get('run_trace');
      let jsonStr: string;
      try {
        jsonStr = runTracePy(code, maxSteps);
      } finally {
        if (runTracePy && typeof runTracePy.destroy === 'function') {
          runTracePy.destroy();
        }
      }
      console.log('[Worker] Trace completed, parsing JSON response...');

      const parsed = JSON.parse(jsonStr);
      if (!parsed.success) {
        // TraceLimitExceeded等で収集された部分スナップショットが存在する場合、破棄せずに truncated: true で返却
        if (parsed.snapshots && parsed.snapshots.length > 0) {
          const partialResult: TraceResult = {
            snapshots: parsed.snapshots,
            totalSteps: parsed.totalSteps || parsed.snapshots.length,
            stdout: parsed.stdout || '',
            flowchartNodes: parsed.flowchartNodes || [],
            flowchartEdges: parsed.flowchartEdges || [],
            flowchartXml: parsed.flowchartXml || '',
            truncated: true,
            error: parsed.error || 'ステップ数上限を超過しました。',
          };
          self.postMessage({
            type: 'TRACE_SUCCESS',
            result: partialResult,
          } satisfies WorkerResponse);
          return;
        }

        self.postMessage({
          type: 'TRACE_ERROR',
          error: parsed.error || 'トレース実行中にエラーが発生しました。',
        } satisfies WorkerResponse);
        return;
      }

      const result: TraceResult = {
        snapshots: parsed.snapshots,
        totalSteps: parsed.totalSteps,
        stdout: parsed.stdout,
        flowchartNodes: parsed.flowchartNodes,
        flowchartEdges: parsed.flowchartEdges,
        flowchartXml: parsed.flowchartXml,
      };

      self.postMessage({
        type: 'TRACE_SUCCESS',
        result,
      } satisfies WorkerResponse);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      self.postMessage({
        type: 'TRACE_ERROR',
        error: errorMessage,
      } satisfies WorkerResponse);
    }
  }
};
