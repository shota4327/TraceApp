# Scope: Milestone 2 — Web Worker Trace Engine

## Objective
Pyodide を Web Worker 上で起動し、メインスレッドをブロックせずに Python コードを事前全ステップ実行し、`StepSnapshot[]` 配列、print出力、各種エッジケース対策を生成する非同期トレースエンジンの構築と検証。

## Architecture & Code Layout
- `src/worker/pythonTracer.ts` または `src/worker/tracerScript.py`: Python トレーサー本体コード
- `src/worker/pyodideWorker.ts`: Pyodide Web Worker エントリポイント (`postMessage` 通信ハンドラー)
- `src/hooks/useTraceEngine.ts`: メインスレッド用 Web Worker 管理 React Hook
- `src/__tests__/tracer.test.ts`: トレースエンジン単体テスト

## Tasks & Deliverables
1. **Pyodide Web Worker 実装 (`src/worker/pyodideWorker.ts`)**:
   - Web Worker 上で Pyodide (`loadPyodide`) の初期化とロード処理の実装。
   - `WorkerRequest` (`INIT`, `RUN_TRACE`) の受信メッセージハンドラーと、`WorkerResponse` (`INIT_COMPLETE`, `INIT_ERROR`, `TRACE_SUCCESS`, `TRACE_ERROR`) の送信処理。

2. **Python `sys.settrace()` 事前実行トレーサー構築**:
   - `sys.settrace()` によるステップ毎のイベント（`line`, `call`, `return`）、行番号、関数名、`f_locals` および `f_globals` のスナップショット取得。
   - グローバル変数とローカル変数の区別（関数内実行時のみローカル変数として分離）。
   - `StepStdoutWriter` による `sys.stdout` 差分 (`stdoutDelta`) および累積 (`stdoutCumulative`) 出力キャプチャ。
   - 変更のあった変数名リスト `changedVars` の抽出。

3. **エッジケース & 安全機能の完全実装**:
   - **ステップ上限ガード (`TraceLimitExceeded`)**: `BaseException` を継承する例外クラスを定義し、10,000ステップ超過時に投げてユーザーの `except Exception:` を突破し安全停止。
   - **特殊浮動小数点数対策**: `math.isnan(v)` -> `"NaN"`, `math.isinf(v)` -> `"Infinity"` / `"-Infinity"` の文字列化。
   - **循環参照・ディープコピー対策**: `json.dumps()` および `try...except` での `repr(v)` フォールバックによるオブジェクト非破壊化。

4. **メインスレッド統合 Hook (`src/hooks/useTraceEngine.ts`)**:
   - Web Worker のライフサイクル管理（`Worker` 生成・破棄、Pyodide 初期化状態 `isInitializing`）。
   - コード文字列を受け取って `runTrace` を呼び出し、プロミスまたはステートとして `TraceResult`（`snapshots`, `stdout`, `totalSteps`）を受け取る通信インターフェース。

5. **単体テスト・検証**:
   - Vitest によるトレーサーロジック・型定義・エッジケース処理の単体テスト (`src/__tests__/tracer.test.ts`)。
   - `npx tsc --noEmit` で型エラー 0 件、`npx vitest run` 全テスト PASS、`npm run build` が成功することを確認。

## Requirements & Quality Rules
- コードコメントはすべて**日本語**で記述。
- 各関数・コンポーネントは 30〜50 行以内に収める。
- JavaScript (.js/.jsx) ファイルは作成しない。
