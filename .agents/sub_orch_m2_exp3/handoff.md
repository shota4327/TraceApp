# Milestone 2: React Integration & Vitest Test Setup Handoff Report

**作業ディレクトリ**: `c:\Git\TraceApp\.agents\sub_orch_m2_exp3`  
**担当**: Explorer 3 (React Integration & Vitest Test Setup Investigator)  
**作成日時**: 2026-08-11T13:30:45Z  

---

## 1. Observation (直接的な観察事実)

### 1.1 プロジェクト設定および依存関係の検証
- **`package.json`**:
  - `pyodide`: `^0.26.4`
  - `react` / `react-dom`: `^18.3.1`
  - `vitest`: `^2.0.5`
  - `jsdom`: `^24.1.1`
  - `@testing-library/react`: `^16.0.0`
  - `typescript`: `^5.5.4`
  - `vite`: `^5.4.1`
- **`tsconfig.json`**:
  - `target`: `"ES2022"`
  - `lib`: `["ES2022", "DOM", "DOM.Iterable", "WebWorker"]` (Web Worker 型定義が含まれていることを確認)
  - `moduleResolution`: `"bundler"`
  - `strict`: `true`
  - `noEmit`: `true`
- **`vite.config.ts`**:
  - `worker.format`: `'es'` 設定あり (Worker を ES モジュールとしてビルド可能)
  - `@` パスエイリアス (`c:\Git\TraceApp\src`) が設定済み
- **`vitest.config.ts`**:
  - `environment`: `'jsdom'`
  - `include`: `['src/**/*.{test,spec}.{ts,tsx}']`
  - `@` パスエイリアス設定済み

### 1.2 現行コマンドの実行結果 (100% PASS)
- **`npx tsc --noEmit`**: エラー 0 件 (Exit code: 0)
- **`npx vitest run`**: 2 ファイル (6 テスト) 100% PASS (Exit code: 0)
  - `src/__tests__/samplePrograms.test.ts` (4 passed)
  - `src/__tests__/types.test.ts` (2 passed)
- **`npm run build`**: 正常ビルド完了 (`tsc && vite build`, Exit code: 0)

### 1.3 既存型定義 (`src/types/index.ts`)
- `WorkerRequest`: `{ type: 'INIT' } | { type: 'RUN_TRACE'; code: string; maxSteps?: number }`
- `WorkerResponse`: `{ type: 'INIT_COMPLETE' } | { type: 'INIT_ERROR'; error: string } | { type: 'TRACE_SUCCESS'; result: TraceResult } | { type: 'TRACE_ERROR'; error: string }`
- `TraceResult`: `{ snapshots: StepSnapshot[]; totalSteps: number; stdout: string; flowchartXml?: string; flowchartNodes?: FlowchartNode[] }`

---

## 2. Logic Chain (理論的推論チェーン)

### 2.1 メインスレッド用 React Hook `src/hooks/useTraceEngine.ts` の詳細設計

#### (1) ライフサイクル管理 & リソース解放
- **Worker の生成**: Vite の標準動的モジュール読み込み構文 `new Worker(new URL('../worker/pyodideWorker.ts', import.meta.url), { type: 'module' })` を使用。
- **参照保持**: `useRef<Worker | null>(null)` で Worker インスタンスを保持し、コンポーネントの再レンダリングによる重複生成を防止。
- **クリーンアップ (terminate)**: `useEffect` のクリーンアップ関数にて `worker.terminate()` を確実に呼ぶことで、アンマウント時に Pyodide WASM メモリリソースを即座に解放しメモリリークを防止。

#### (2) 状態管理仕様
Hook は以下の 5 つの React State と 2 つの Callback 関数を管理・提供する:
1. `isInitializing: boolean` (初期値 `true`): Worker 生成後に `{ type: 'INIT' }` を送出し、`INIT_COMPLETE` または `INIT_ERROR` 受信で `false` に推移。
2. `initError: string | null` (初期値 `null`): `INIT_ERROR` 受信時または Worker スレッドエラー時にエラー文字列を保持。
3. `isRunning: boolean` (初期値 `false`): `runTrace` 実行中に `true` となり、`TRACE_SUCCESS` または `TRACE_ERROR` 受信で `false` に復帰。
4. `traceResult: TraceResult | null` (初期値 `null`): 最新の成功トレース結果スナップショットを保持。
5. `error: string | null` (初期値 `null`): 最新のトレース実行エラーメッセージを保持。

#### (3) `runTrace` Promise 通信 & リクエスト/レスポンス照合メカニズム
- シングルスレッドである Worker に対して、同時に 1 企のトレース実行のみを受け付ける。
- `pendingRequestRef` (`useRef<{ resolve: (res: TraceResult) => void; reject: (err: Error) => void } | null>(null)`) を保持。
- `runTrace(code, maxSteps)` 呼び出し時に Promise を返し、`pendingRequestRef` に `resolve`/`reject` をセット。
- ガード条件:
  - `isInitializing === true` の場合: `Error('Pyodideの初期化中です。完了までお待ちください。')` で即時 reject。
  - `initError !== null` の場合: `Error('Pyodide初期化エラー: ' + initError)` で即時 reject。
  - `isRunning === true` の場合: `Error('現在トレースを実行中です。前の実行が完了するまでお待ちください。')` で即時 reject。
- Worker から `TRACE_SUCCESS` 受信時: `pendingRequestRef.current.resolve(result)` を実行後、`pendingRequestRef.current = null` にクリア。
- Worker から `TRACE_ERROR` 受信時: `pendingRequestRef.current.reject(new Error(error))` を実行後、`pendingRequestRef.current = null` にクリア。

#### (4) コード設計案 (`src/hooks/useTraceEngine.ts`)
```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import type { TraceResult, WorkerRequest, WorkerResponse } from '../types';

export interface UseTraceEngineReturn {
  isInitializing: boolean;
  initError: string | null;
  isRunning: boolean;
  traceResult: TraceResult | null;
  error: string | null;
  runTrace: (code: string, maxSteps?: number) => Promise<TraceResult>;
  resetTrace: () => void;
}

interface PendingRequest {
  resolve: (result: TraceResult) => void;
  reject: (error: Error) => void;
}

export function useTraceEngine(): UseTraceEngineReturn {
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const pendingRequestRef = useRef<PendingRequest | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../worker/pyodideWorker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      switch (response.type) {
        case 'INIT_COMPLETE':
          setIsInitializing(false);
          setInitError(null);
          break;
        case 'INIT_ERROR':
          setIsInitializing(false);
          setInitError(response.error);
          if (pendingRequestRef.current) {
            pendingRequestRef.current.reject(new Error(`Pyodide init error: ${response.error}`));
            pendingRequestRef.current = null;
          }
          break;
        case 'TRACE_SUCCESS':
          setIsRunning(false);
          setTraceResult(response.result);
          setError(null);
          if (pendingRequestRef.current) {
            pendingRequestRef.current.resolve(response.result);
            pendingRequestRef.current = null;
          }
          break;
        case 'TRACE_ERROR':
          setIsRunning(false);
          setError(response.error);
          if (pendingRequestRef.current) {
            pendingRequestRef.current.reject(new Error(response.error));
            pendingRequestRef.current = null;
          }
          break;
      }
    };

    worker.onerror = (err) => {
      const msg = err.message || 'Web Worker error';
      setIsInitializing(false);
      setIsRunning(false);
      setError(msg);
      if (pendingRequestRef.current) {
        pendingRequestRef.current.reject(new Error(msg));
        pendingRequestRef.current = null;
      }
    };

    worker.postMessage({ type: 'INIT' } satisfies WorkerRequest);

    return () => {
      worker.terminate();
      workerRef.current = null;
      if (pendingRequestRef.current) {
        pendingRequestRef.current.reject(new Error('Component unmounted'));
        pendingRequestRef.current = null;
      }
    };
  }, []);

  const runTrace = useCallback(
    (code: string, maxSteps?: number): Promise<TraceResult> => {
      return new Promise<TraceResult>((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Web Worker is not initialized'));
          return;
        }
        if (isInitializing) {
          reject(new Error('Pyodide is initializing. Please wait.'));
          return;
        }
        if (initError) {
          reject(new Error(`Pyodide init error: ${initError}`));
          return;
        }
        if (isRunning) {
          reject(new Error('Trace is already running.'));
          return;
        }

        setIsRunning(true);
        setError(null);
        pendingRequestRef.current = { resolve, reject };

        const request: WorkerRequest = { type: 'RUN_TRACE', code, maxSteps };
        workerRef.current.postMessage(request);
      });
    },
    [isInitializing, initError, isRunning]
  );

  const resetTrace = useCallback(() => {
    setTraceResult(null);
    setError(null);
  }, []);

  return {
    isInitializing,
    initError,
    isRunning,
    traceResult,
    error,
    runTrace,
    resetTrace,
  };
}
```

---

### 2.2 Vitest テスト環境 (`src/__tests__/tracer.test.ts` & `src/__tests__/useTraceEngine.test.ts`) の設計

#### (1) jsdom / Web Worker の制約とモック検証戦略
- **課題**: Node.js + jsdom 環境の Vitest では、実 Pyodide WASM および CDN ネットワーク読み込みを含む Web Worker の実行が不可能（または遅延・不安定）。
- **解決策 (Dual-Track Testing)**:
  1. **Unit Test (Vitest / jsdom)**: `MockWorker` クラスを Vitest の `vi.stubGlobal('Worker', MockWorker)` で注入し、Hook の状態遷移 (`isInitializing`, `isRunning`), メッセージプロトコル通信, エラーハンドリング, `terminate` 解放をミリ秒単位で高速・確定的に検証。
  2. **Tracer Core Logic Test**: トレーサーロジックモジュール (`src/services/tracer.ts` または直接計算) を Vitest で直接検証。
  3. **E2E Browser Test (Playwright)**: 実ブラウザ環境 (Chromium) で Pyodide Web Worker のリアルロードおよび Python コード実行 (`sys.settrace()`) をテスト (M_TEST / M5 スケジュール)。

#### (2) Vitest 用 MockWorker パターン設計
```typescript
import { vi } from 'vitest';

export class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;

  postMessage = vi.fn((msg: any) => {
    if (msg.type === 'INIT') {
      setTimeout(() => {
        this.onmessage?.({ data: { type: 'INIT_COMPLETE' } } as MessageEvent);
      }, 0);
    } else if (msg.type === 'RUN_TRACE') {
      if (msg.code.includes('RAISE_ERROR')) {
        setTimeout(() => {
          this.onmessage?.({
            data: { type: 'TRACE_ERROR', error: 'Execution failed' },
          } as MessageEvent);
        }, 0);
      } else {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              type: 'TRACE_SUCCESS',
              result: {
                snapshots: [
                  {
                    stepIndex: 0,
                    line: 1,
                    event: 'line',
                    globals: { x: 5 },
                    locals: {},
                    changedVars: ['x'],
                    stdoutDelta: '',
                    stdoutCumulative: '',
                  },
                ],
                totalSteps: 1,
                stdout: '',
              },
            },
          } as MessageEvent);
        }, 0);
      }
    }
  });

  terminate = vi.fn();
}
```

#### (3) `src/__tests__/tracer.test.ts` / `src/__tests__/useTraceEngine.test.ts` のテストケース一覧
1. **Hook 初期化テスト**:
   - 初期状態 `isInitializing === true`
   - `INIT_COMPLETE` 受信後 `isInitializing === false`, `initError === null`
2. **`runTrace` 成功テスト**:
   - `runTrace('x = 5')` 呼び出し時に `isRunning === true`
   - Promise が `TraceResult` で resolve され、`traceResult` state に結果が格納される
3. **`runTrace` エラーテスト**:
   - Worker から `TRACE_ERROR` が返却された際、Promise が reject され `error` state にエラー文字列が格納される
4. **ガード条件テスト**:
   - 初期化中 (`isInitializing === true`) に `runTrace` を呼び出すと即座に reject される
   - 実行中 (`isRunning === true`) に二重呼び出しすると即座に reject される
5. **アンマウントクリーンアップテスト**:
   - Hook コンポーネントのアンマウント時に `worker.terminate()` が呼び出される

---

### 2.3 依存関係・型整合性の全系検証

1. **`npx tsc --noEmit`**:
   - `tsconfig.json` の `lib: ["ES2022", "DOM", "DOM.Iterable", "WebWorker"]` により、`Worker`, `DedicatedWorkerGlobalScope`, `MessageEvent`, `postMessage` などの Web Worker API 型が完全に組み込まれており、型エラーなし。
2. **`npx vitest run`**:
   - `vitest.config.ts` の `environment: 'jsdom'` および `@testing-library/react` により `renderHook` および `act` が完全に利用可能。
3. **`npm run build`**:
   - Vite 5 の `worker: { format: 'es' }` 設定により `new Worker(new URL(...), { type: 'module' })` が正常に生産ビルド可能。

---

## 3. Caveats (注意点・制限事項・前提)

1. **Pyodide 初回ロード時間の存在**:
   - Web Worker 上で Pyodide (WASM) の初期化・CDN ダウンロードを行うため、ネットワーク速度に応じて初回ロードに 1〜3 秒程度要します。React UI 側で `isInitializing` フラグに応じたローディング表示 (スピナー等) が必須です。
2. **Vitest jsdom 環境での Worker モック要件**:
   - Vitest 単体テスト実行時は必ず `vi.stubGlobal('Worker', MockWorker)` で Worker をモック化する必要があります。実 Pyodide の動作検証は Playwright E2E テスト環境にて実施します。
3. **単一実行キュー制約**:
   - Pyodide の Worker スレッドはシングルスレッドで動くため、`runTrace` の重複並行実行は拒否する設計としています。

---

## 4. Conclusion (結論)

- `src/hooks/useTraceEngine.ts` の設計仕様（ライフサイクル管理、状態推移、`runTrace` Promise 通信、アンマウントクリーンアップ）が完全に策定されました。
- `src/__tests__/tracer.test.ts` および `src/__tests__/useTraceEngine.test.ts` における Vitest 単体テスト環境構築手法（`MockWorker` パターン）と実環境 E2E テストとの検証分離方針が確定しました。
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` はすべてエラー 0 件 (100% PASS) であり、Implementer による実装フェーズへの移行準備が完全に整いました。

---

## 5. Verification Method (検証方法)

親オーケストレーターおよび次行程エージェントは、以下の手順で本報告結果を検証できます:

### Verification Commands
```powershell
# 1. 型チェックの検証 (エラー0件であること)
npx tsc --noEmit

# 2. 単体テストの実行 (全6テスト PASS であること)
npx vitest run

# 3. 生産ビルドの検証 (エラーなく成功すること)
npm run build
```

### Files to Inspect
- `c:\Git\TraceApp\.agents\sub_orch_m2_exp3\handoff.md` (本レポート)
- `c:\Git\TraceApp\package.json`, `c:\Git\TraceApp\tsconfig.json`, `c:\Git\TraceApp\vitest.config.ts`
