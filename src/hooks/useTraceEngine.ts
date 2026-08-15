import { useState, useEffect, useRef, useCallback } from 'react';
import type { TraceResult, WorkerRequest, WorkerResponse } from '../types';
import { executeTrace } from '../services/tracer';
import { generateFlowchartGraph, generateDrawIoXml } from '../services/flowchartGenerator';
import PyodideWorker from '../worker/pyodideWorker?worker&inline';

export interface UseTraceEngineReturn {
  /** Pyodide の初期化中フラグ */
  isInitializing: boolean;
  /** Pyodide 初期化エラーメッセージ */
  initError: string | null;
  /** トレース実行中フラグ */
  isTracing: boolean;
  /** トレース実行中フラグ（エイリアス） */
  isRunning: boolean;
  /** 最新のトレース結果 */
  traceResult: TraceResult | null;
  /** トレース実行エラーメッセージ */
  error: string | null;
  /** Pythonコードのトレース実行を開始する非同期関数 */
  runTrace: (code: string, maxSteps?: number) => Promise<TraceResult>;
  /** トレース状態およびエラーをリセットする関数 */
  resetTrace: () => void;
}

interface PendingRequest {
  resolve: (result: TraceResult) => void;
  reject: (error: Error) => void;
}

/**
 * Web Worker 内で動作する Pyodide トレースエンジンと通信・状態同期を行うカスタム React フック
 * Worker 利用不可環境（file:/// プロトコル等）ではクライアント側 TS トレースエンジンに自動フォールバックします。
 */
export function useTraceEngine(): UseTraceEngineReturn {
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [isTracing, setIsTracing] = useState<boolean>(false);
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const pendingRequestRef = useRef<PendingRequest | null>(null);
  const isFallbackModeRef = useRef<boolean>(false);
  const initErrorRef = useRef<string | null>(null);
  const isInitializingRef = useRef<boolean>(true);
  const currentCodeRef = useRef<string>('');

  useEffect(() => {
    // 動作環境に応じた Web Worker のインスタンス化
    let worker: Worker | null = null;
    try {
      if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
        // file:/// プロトコル時はインライン Worker を起動
        worker = new PyodideWorker();
      } else {
        // 通常の Web サーバー環境では ES Module Worker を起動
        try {
          worker = new Worker(
            new URL('../worker/pyodideWorker.ts', import.meta.url),
            { type: 'module' }
          );
        } catch {
          worker = new PyodideWorker();
        }
      }
    } catch {
      // Worker 生成失敗時はフォールバックモードへ
      isFallbackModeRef.current = true;
      setIsInitializing(false);
      isInitializingRef.current = false;
      setInitError(null);
      initErrorRef.current = null;
      return;
    }
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      switch (response.type) {
        case 'INIT_COMPLETE':
          setIsInitializing(false);
          isInitializingRef.current = false;
          setInitError(null);
          initErrorRef.current = null;
          break;
        case 'INIT_ERROR':
          // Worker 初期化失敗
          console.warn('[TraceEngine] Worker init failed:', response.error);
          setIsInitializing(false);
          isInitializingRef.current = false;
          setInitError(response.error);
          initErrorRef.current = response.error;
          if (pendingRequestRef.current) {
            const req = pendingRequestRef.current;
            pendingRequestRef.current = null;
            req.reject(new Error(`Pyodide初期化エラー: ${response.error}`));
          }
          break;
        case 'TRACE_SUCCESS': {
          setIsTracing(false);
          const graph = generateFlowchartGraph(currentCodeRef.current);
          const enrichedResult: TraceResult = {
            ...response.result,
            flowchartNodes: graph.nodes,
            flowchartEdges: graph.edges,
            flowchartXml: generateDrawIoXml(graph),
          };
          setTraceResult(enrichedResult);
          if (enrichedResult.truncated) {
            setError(enrichedResult.error || 'ステップ数上限を超過しました。');
          } else {
            setError(null);
          }
          if (pendingRequestRef.current) {
            pendingRequestRef.current.resolve(enrichedResult);
            pendingRequestRef.current = null;
          }
          break;
        }
        case 'TRACE_ERROR':
          setIsTracing(false);
          setError(response.error);
          if (pendingRequestRef.current) {
            pendingRequestRef.current.reject(new Error(response.error));
            pendingRequestRef.current = null;
          }
          break;
      }
    };

    worker.onerror = (err) => {
      console.warn('[TraceEngine] Web Worker error, switching to fallback trace engine:', err);
      isFallbackModeRef.current = true;
      setIsInitializing(false);
      isInitializingRef.current = false;
      setIsTracing(false);
      setInitError(null);
      initErrorRef.current = null;
      if (pendingRequestRef.current) {
        const req = pendingRequestRef.current;
        pendingRequestRef.current = null;
        req.reject(new Error(err.message || 'Worker error'));
      }
    };

    // Workerへ初期化メッセージを送信
    worker.postMessage({ type: 'INIT' } satisfies WorkerRequest);

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (pendingRequestRef.current) {
        pendingRequestRef.current.reject(new Error('コンポーネントがアンマウントされました。'));
        pendingRequestRef.current = null;
      }
    };
  }, []);

  const runTrace = useCallback(
    (code: string, maxSteps?: number): Promise<TraceResult> => {
      return new Promise<TraceResult>((resolve, reject) => {
        if (initErrorRef.current) {
          reject(new Error(`Pyodide初期化エラー: ${initErrorRef.current}`));
          return;
        }
        if (isInitializingRef.current) {
          reject(new Error('Pyodideの初期化中です。完了までお待ちください。'));
          return;
        }
        if (isTracing || pendingRequestRef.current !== null) {
          reject(new Error('現在トレースを実行中です。前の実行が完了するまでお待ちください。'));
          return;
        }

        // フォールバックモードの場合（Worker が使用不可または file:/// 環境）
        if (isFallbackModeRef.current || !workerRef.current) {
          setIsTracing(true);
          setError(null);
          try {
            const execResult = executeTrace(code);
            const graph = generateFlowchartGraph(code);
            const lastSnapshot = execResult.snapshots.length > 0 ? execResult.snapshots[execResult.snapshots.length - 1] : undefined;
            const result: TraceResult = {
              snapshots: execResult.snapshots,
              totalSteps: execResult.snapshots.length,
              stdout: lastSnapshot?.stdoutCumulative || '',
              flowchartNodes: graph.nodes,
              flowchartEdges: graph.edges,
              flowchartXml: generateDrawIoXml(graph),
              truncated: false,
            };
            setIsTracing(false);
            setTraceResult(result);
            resolve(result);
          } catch (err: unknown) {
            setIsTracing(false);
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
            reject(err instanceof Error ? err : new Error(msg));
          }
          return;
        }

        currentCodeRef.current = code;
        setIsTracing(true);
        setError(null);
        pendingRequestRef.current = { resolve, reject };

        try {
          const request: WorkerRequest = { type: 'RUN_TRACE', code, maxSteps };
          workerRef.current.postMessage(request);
        } catch (err: any) {
          pendingRequestRef.current = null;
          setIsTracing(false);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    },
    [isInitializing, initError, isTracing]
  );

  const resetTrace = useCallback(() => {
    setTraceResult(null);
    setError(null);
  }, []);

  return {
    isInitializing,
    initError,
    isTracing,
    isRunning: isTracing,
    traceResult,
    error,
    runTrace,
    resetTrace,
  };
}
