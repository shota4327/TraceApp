import { TraceResult } from './trace';

/**
 * メインスレッドから Web Worker へのリクエストメッセージ型
 */
export type WorkerRequest =
  | { type: 'INIT' }
  | { type: 'RUN_TRACE'; code: string; maxSteps?: number };

/**
 * Web Worker からメインスレッドへのレスポンスメッセージ型
 */
export type WorkerResponse =
  | { type: 'INIT_COMPLETE' }
  | { type: 'INIT_ERROR'; error: string }
  | { type: 'TRACE_SUCCESS'; result: TraceResult }
  | { type: 'TRACE_ERROR'; error: string };
