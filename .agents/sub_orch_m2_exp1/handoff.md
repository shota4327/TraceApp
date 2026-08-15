# Handoff Report — Explorer 1 (Milestone 2: Web Worker Trace Engine)

## 1. Observation (観察事実)

以下の指定インプットファイルおよびプロジェクト既存コードの精査を行いました:
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md` (PoC要件およびPhase 2全般要件)
- `c:\Git\TraceApp\PROJECT.md` (全体アーキテクチャ、モジュール構造、型インターフェース契約)
- `c:\Git\TraceApp\.agents\sub_orch_m2\SCOPE.md` (Milestone 2 の詳細スコープと受入条件)
- `c:\Git\TraceApp\index.html` (エントリーポイント)
- `c:\Git\TraceApp\poc_report.md` (Phase 1 PoC 19件テスト100% PASS実績および技術知見)
- `src/types/trace.ts`, `src/types/worker.ts`, `src/types/flowchart.ts` (型定義)
- `package.json`, `tsconfig.json`, `vite.config.ts` (設定・ビルド環境)

### 観察できた事実:
1. **型定義 (`src/types/`)**:
   - `StepSnapshot` (`stepIndex`, `line`, `event`, `functionName?`, `globals`, `locals`, `changedVars`, `stdoutDelta`, `stdoutCumulative`, `astNodeId?`) および `WorkerRequest` / `WorkerResponse` は M2 要件を満たす形で完全に定義されています。
2. **ビルドおよびWorker設定 (`vite.config.ts`, `package.json`)**:
   - `package.json` に `"pyodide": "^0.26.4"` がインストール済みです。
   - `vite.config.ts` に `worker: { format: 'es' }` が指定されており、Web Worker 内で ES モジュール (`import ... from 'pyodide'`) がバンドル・実行可能です。
3. **PoC の検証結果 (`poc_report.md`)**:
   - Pyodide v0.26.4 上での `sys.settrace()` によるステップ実行、`sys.stdout` の差分出力キャプチャ、`TraceLimitExceeded(BaseException)` による上限保護、特殊浮動小数点数 (`NaN`, `Infinity`) の文字列化、循環参照に対する `repr(v)` フォールバックが完全に実証されています。

---

## 2. Logic Chain (理論的推論過程)

### 2.1 既存プロジェクトコードの精査と型適合性
- `src/types/worker.ts` に定義された `WorkerRequest` (`INIT`, `RUN_TRACE`) と `WorkerResponse` (`INIT_COMPLETE`, `INIT_ERROR`, `TRACE_SUCCESS`, `TRACE_ERROR`) は、Worker の初期化段階と実行段階を明確に伝達できます。
- `StepSnapshot` において `globals` と `locals` の型が `VariableSnapshot` (Record<string, any>) と定められており、基本型（int, float, str, bool）および特殊値表現（`"NaN"`, `"Infinity"`, `"-Infinity"`）をそのまま保持可能です。

### 2.2 Pyodide Web Worker 通信プロトコルの詳細設計 (`src/worker/pyodideWorker.ts`)
1. **初期化プロトコル (`INIT` -> `INIT_COMPLETE` / `INIT_ERROR`)**:
   - Web Worker 起動後、メインスレッドから `{ type: 'INIT' }` を受信。
   - Worker 内で `loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' })` を呼び出して Pyodide ランタイムを構築。
   - 定義済みの Python トレーサースクリプト（`PYTHON_TRACER_SCRIPT`）を `runPythonAsync` で評価・インポート。
   - 成功時に `{ type: 'INIT_COMPLETE' }` を `postMessage` 返却。失敗時に `{ type: 'INIT_ERROR', error: string }` を返却。
2. **トレース実行プロトコル (`RUN_TRACE` -> `TRACE_SUCCESS` / `TRACE_ERROR`)**:
   - メインスレッドから `{ type: 'RUN_TRACE', code: string, maxSteps?: number }` を受信（`maxSteps` のデフォルト値は 10,000）。
   - Pyodide 空間の `run_trace(code, max_steps)` を呼び出し、Python 側から返される JSON 文字列をパース。
   - Python 側で例外や文法エラーが発生した場合は `{ type: 'TRACE_ERROR', error: string }` を返却。
   - 正常完了時は `snapshots` 配列、`totalSteps`, `stdout` を詰め込んだ `TraceResult` を含め `{ type: 'TRACE_SUCCESS', result: TraceResult }` を返却。

### 2.3 Python `sys.settrace()` トレーススクリプト構築方針 (`src/worker/pythonTracer.ts`)
1. **ステップ上限保護 (`TraceLimitExceeded`)**:
   - `BaseException` を継承する `class TraceLimitExceeded(BaseException): pass` を定義。ユーザーコード内の `try...except Exception:` をすり抜け、`max_steps`（10,000）超過時に確実に実行停止させます。
2. **`sys.stdout` の差分・累積キャプチャ (`StepStdoutWriter`)**:
   - `io.StringIO` バッファを保持するカスタムライターを作成し、`sys.stdout` を差し替え。
   - ステップ呼び出しごとに `get_delta()`（直前ステップからの差分）および `get_cumulative()`（ここまでの全出力）を取得して各 `StepSnapshot` に保存します。
3. **スコープ分離とフィルタリング**:
   - `frame.f_code.co_filename == "<string>"` のみに対象を限定。
   - モジュール最上位（`co_name == "<module>"`）では `globals` に変数を格納し、`locals` は空オブジェクト `{}` とする。
   - 関数内（`co_name != "<module>"`）では `frame.f_globals` と `frame.f_locals` を個別に取得・分離。
   - 内部予約変数（`__name__`, `__doc__`, `__builtins__`, トレーサー内部変数等）を除外フィルタリング。
4. **`changedVars` の抽出**:
   - 直前ステップの全変数状態（`prev_vars`）と現ステップの全変数状態を比較し、値が変更された変数名および新規追加された変数名のリストを出力。
5. **安全なサニタイズ処理**:
   - 特殊浮動小数点数: `math.isnan(v)` -> `"NaN"`, `math.isinf(v)` -> `"Infinity"` / `"-Infinity"`。
   - 複合オブジェクト・循環参照: `json.dumps()` または `copy.deepcopy()` の試行時例外発生で `repr(v)` に安全フォールバック。

---

## 3. Caveats (注意点・制約事項)

1. **Pyodide CDN ロード依存と初期化時間**:
   - Pyodide の初回ロードには数 MB の WebAssembly ファイルダウンロードが必要です。Worker 内で初期化中は `INIT_COMPLETE` を受け取るまで `isInitializing` ステートでメインUIからの操作をガードする必要があります。
2. **Worker 空間と Main Thread 空間の型転送**:
   - `postMessage` 通信でデータを転送する際、Pyodide から得たオブジェクトは一旦 Python 側で `json.dumps()` して `JSON.parse()` するか、シリアライズ可能なプレーン JS オブジェクト構造としてメインスレッドへ返却する必要があります。

---

## 4. Conclusion (設計結論)

1. `src/types/` 内の型定義は修正不要であり、M2 実装のインターフェースとしてそのまま利用可能です。
2. Pyodide Web Worker (`src/worker/pyodideWorker.ts`) と Python トレーサー (`src/worker/pythonTracer.ts`) は、明確な非同期メッセージプロトコル (`INIT`, `RUN_TRACE` 等) と `sys.settrace()` によるステップデータ・stdout キャプチャ・サニタイズ機構を備える設計として確立されました。
3. これにより、メインスレッドを一切フリーズさせることなく 10,000 ステップ上限・エッジケース対応済みの Python トレースエンジンを構築できます。

---

## 5. Verification Method (検証方法)

M2 実装後に以下の検証コマンド・テストを実施して独立検証が可能です:

1. **型チェック検証**:
   ```bash
   npx tsc --noEmit
   ```
   - 型エラーが 0 件であることを確認。
2. **単体テスト実行**:
   ```bash
   npx vitest run
   ```
   - トレーサーロジックおよび Web Worker 通信ハンドラーの単体テストがすべて PASS することを確認。
3. **ビルド検証**:
   ```bash
   npm run build
   ```
   - Vite によるバンドルおよび Worker のコンパイルが成功することを確認。
