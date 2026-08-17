import { useState, useEffect, useRef, useCallback } from 'react';
import type { TraceResult } from '../types';
import { getPyodideInstance, runPythonTrace } from '../services/tracer';

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

/**
 * メインスレッド上の Pyodide トレースエンジンと状態同期を行う React フック
 * Web Worker や環境分岐を介さず、メインスレッド上の単一 Pyodide インスタンスを直接実行します。
 */
export function useTraceEngine(): UseTraceEngineReturn {
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [isTracing, setIsTracing] = useState<boolean>(false);
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initErrorRef = useRef<string | null>(null);
  const isInitializingRef = useRef<boolean>(true);
  const isTracingRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await getPyodideInstance();
        if (isMounted) {
          setIsInitializing(false);
          isInitializingRef.current = false;
          setInitError(null);
          initErrorRef.current = null;
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[TraceEngine] Pyodide init error:', err);
          setIsInitializing(false);
          isInitializingRef.current = false;
          setInitError(msg);
          initErrorRef.current = msg;
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const runTrace = useCallback(
    async (code: string, maxSteps?: number): Promise<TraceResult> => {
      if (initErrorRef.current) {
        throw new Error(`Pyodide初期化エラー: ${initErrorRef.current}`);
      }
      if (isInitializingRef.current) {
        throw new Error('Pyodideの初期化中です。完了までお待ちください。');
      }
      if (isTracingRef.current) {
        throw new Error('現在トレースを実行中です。前の実行が完了するまでお待ちください。');
      }

      isTracingRef.current = true;
      setIsTracing(true);
      setError(null);

      try {
        const result = await runPythonTrace(code, maxSteps);
        setTraceResult(result);
        if (result.truncated) {
          setError(result.error || 'ステップ数上限を超過しました。');
        } else {
          setError(null);
        }
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err instanceof Error ? err : new Error(msg);
      } finally {
        isTracingRef.current = false;
        setIsTracing(false);
      }
    },
    []
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
