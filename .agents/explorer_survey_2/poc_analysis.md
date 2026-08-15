# Phase 1 PoC 再利用可能資産・既存コードベース調査分析報告書 (`poc_analysis.md`)

## 1. 概要 (Executive Summary)

本報告書は、Phase 1 PoC で作成された `index.html`（検証UIおよびPythonトレーサー実装）、`test_runner.html`（自動テストスイート）、および `poc_report.md`（技術検証報告書）を精査し、Phase 2（Web Worker + React + TypeScript による本実装）に向けて再利用可能な技術資産・ロジック、エッジケース対策、および既存ワークスペースの現状をまとめた分析報告書です。

### 主要な結論
1. **コアロジックの完成度**: `sys.settrace()` を用いたステップ実行トレーサー、`frame.f_locals` / `frame.f_globals` のスコープ分離、および `sys.stdout` の差分キャプチャロジックは完全かつ決定論的に動作しており、Phase 2 へそのまま移植可能です。
2. **高堅牢なエッジケース対策**: `TraceLimitExceeded(BaseException)` によるユーザーコードの例外捕捉（`try...except Exception:`）突破、特殊浮動小数点数（`NaN`, `Infinity`）の JSON 互換文字列化、循環参照・可変オブジェクトの `repr(v)` フォールバックとディープコピー機構の 3 点が検証済みです。
3. **既存コードベースの現状**: 現状のワークスペース（`c:\Git\TraceApp`）は PoC 検証用のスタンドアロン HTML / JS / Playwright 環境（`package.json` に `playwright` のみ）であり、Vite + React + TypeScript + Monaco Editor の開発・ビルド環境は未構築です。

---

## 2. 再利用可能な Python トレーサーロジック (`sys.settrace` 実装)

Phase 1 PoC (`index.html` Lines 289–441, `test_runner.html` Lines 91–242) で構築された `PyodideTracer` クラスの核となる構造および再利用可能コンポーネントの分析です。

### 2.1 トレーサー構造 (`PyodideTracer` クラス)

- **ターゲットファイルの絞り込み**:
  - `compile(code_str, "<string>", 'exec')` により、実行コードのファイル名を `"<string>"` に固定。
  - トレース関数 `trace_func` の冒頭で `if frame.f_code.co_filename != self.target_filename: return self.trace_func` と判定することで、Pyodide 内部フレームやトレーサー自体のフレームを完全に除外。
- **イベントキャプチャ**:
  - `'line'`: 行実行イベント（行番号 `frame.f_lineno`、関数名 `frame.f_code.co_name`）。
  - `'call'`: 関数呼び出しイベント。
  - `'return'`: 関数復帰イベント。`returnValue = repr(arg)` により戻り値を捕捉。
  - 最終ステップへの `'end'` イベント自動付加（全実行終了時のグローバル変数の最終状態を保持）。

### 2.2 変数取得とスコープ区別 (`_sanitize_scope`)

- **スコープの分離**:
  - `frame.f_locals`（ローカル変数）と `frame.f_globals`（グローバル変数）を各ステップで独立して収集。
  - モジュールレベル（`<module>`）実行時は、`f_locals` と `f_globals` が同一辞書を指すため、UI 側での混乱を防ぐために変数は原則グローバルとして扱い、関数内実行時のみローカル変数として区別する設計。
- **内部・組み込み変数の自動フィルタリング**:
  - `__` で開始かつ終了する組み込み属性（`__name__`, `__doc__` 等）を除外。
  - トレーサー内部変数（`sys`, `json`, `io`, `math`, `PyodideTracer`, `StepStdoutWriter`, `TraceLimitExceeded`, `tracer`, `exec_globals` 等）を除外リストでサニタイズ。

### 2.3 `sys.stdout` 差分出力キャプチャ (`StepStdoutWriter`)

- **カスタム Writer による差分抽出**:
  - `sys.stdout` を一時的に `StepStdoutWriter` インスタンスに置換。
  - `io.StringIO` バッファに出力を蓄積しつつ、`get_delta()` メソッドで前回のポインタ `last_pos` からの増加分（差分テキスト）を抽出。
  - トレースステップ生成時およびステップ間で発生した差分を `stepData['stepOutput']` に記録。
  - 全体の累積出力は `cumulativeOutput` として保持し、ステップごとのコンソール表示と同期。

---

## 3. エッジケース対策メカニズム

PoC 検証で立証された 3 大エッジケース対策の具体的コードと挙動の分析です。

### 3.1 無限ループ・ステップ数上限オーバー防止 (`TraceLimitExceeded`)

- **課題**: ユーザーコード内に `while True:` や無限ループが存在する場合、ブラウザが応答不能になる。また、ユーザーが `try: ... except Exception:` を記述していた場合、通常の `RuntimeError` 等ではユーザーの例外ハンドラに捕捉され、ガードが回避されてしまう。
- **実装ロジック**:
  ```python
  class TraceLimitExceeded(BaseException):
      """ステップ数上限超過を表すカスタム例外 (BaseException を直接継承)"""
      pass
  ```
- **効果と検証**:
  - Python の例外クラス階層において `Exception` は `BaseException` のサブクラスであるため、`except Exception:` では `TraceLimitExceeded` を捕獲できせん。
  - `trace_func` 内で `self.step_count > self.max_steps` に達した際 `raise TraceLimitExceeded(...)` を発行し、最外周の `run_code()` の `except TraceLimitExceeded as e:` で確実に捕捉して安全に `success: false` とエラーメッセージを返却します（`test_runner.html` EDGE-3 テストで PASS 確認済み）。

### 3.2 特殊浮動小数点数 (`NaN`, `Infinity`, `-Infinity`) の安全な JSON シリアライズ

- **課題**: Python の `json.dumps()` は `float('nan')` や `float('inf')` を非標準の `NaN` / `Infinity` トークンとして出力します。これを JavaScript の `JSON.parse()` に渡すと SyntaxError でクラッシュします。
- **実装ロジック** (`_sanitize_scope` 内):
  ```python
  elif isinstance(v, float):
      if math.isnan(v):
          clean[k] = "NaN"
      elif math.isinf(v):
          clean[k] = "-Infinity" if v < 0 else "Infinity"
      else:
          clean[k] = v
  ```
- **効果**: 特殊浮動小数点数を JavaScript 互換の文字列 `"NaN"`, `"Infinity"`, `"-Infinity"` に事前変換してシリアライズすることで、`JSON.parse()` のクラッシュを完全防止します。

### 3.3 循環参照および可変オブジェクトの参照汚染防止

- **課題**:
  1. `a = []; a.append(a)` のような循環参照が存在すると `json.dumps()` が `ValueError: Circular reference detected` で停止する。
  2. 可変オブジェクト（list, dict）の参照をそのまま保持すると、後続ステップでの変更が過去のステップ記録にまで波及してしまう（スコープ参照汚染）。
- **実装ロジック**:
  ```python
  elif isinstance(v, (list, dict, tuple, set)):
      clean[k] = json.loads(json.dumps(v, allow_nan=False))
  else:
      clean[k] = repr(v)
  ```
  例外発生時は `except Exception:` で安全に `repr(v)`（例: `"[...]"`）にフォールバック。
- **効果**: `json.loads(json.dumps(...))` による値のコピー（ディープスナップショット）で参照汚染を防ぎ、シリアライズ不能な複合構造・循環参照は安全な文字列表現として保持します。

---

## 4. Web Worker / JavaScript への移植ガイド

Phase 2 要求仕様 R1 に基づき、Pyodide および Python トレーサーを Web Worker 上へ移設する際のアーキテクチャと変更点です。

### 4.1 通信プロトコル設計 (`postMessage` / `onmessage`)

Web Worker (`trace.worker.ts`) とメインスレッド（UI 側）間で送受信するデータ構造の設計案です。

```typescript
// メインスレッド -> Web Worker
export type WorkerRequest = 
  | { type: 'INIT_PYODIDE' }
  | { type: 'RUN_TRACE'; code: string; maxSteps?: number };

// Web Worker -> メインスレッド
export type WorkerResponse = 
  | { type: 'INIT_PROGRESS'; status: string }
  | { type: 'INIT_SUCCESS' }
  | { type: 'INIT_ERROR'; error: string }
  | { type: 'TRACE_SUCCESS'; result: TraceResult }
  | { type: 'TRACE_ERROR'; error: string };
```

### 4.2 Web Worker 内での処理フロー

1. Worker 初期化時に `importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js')` または npm パッケージ経由で Pyodide をロード。
2. `PYTHON_TRACER_CODE` を `pyodide.runPythonAsync()` で実行し、`_global_tracer` を準備。
3. `RUN_TRACE` メッセージを受信したら、`_global_tracer.run_code(code)` を非同期呼び出し。
4. 返却された JSON 文字列を `JSON.parse()` して `TraceResult` オブジェクトとしてメインスレッドへ返信。

### 4.3 注意点・変更必要箇所

| 項目 | PoC (`index.html`) の状態 | Phase 2 Web Worker での変更点 |
|:---|:---|:---|
| **実行スレッド** | メインスレッド（UIブロックの懸念あり） | Web Worker（UI操作を100%ノンブロッキング化） |
| **言語・型定義** | JavaScript (ES6 inline) | TypeScript (`TraceStep`, `TraceResult` 等の厳格なインターフェース定義) |
| **ステップ上限** | `max_steps = 2000` | `max_steps = 10000` (Phase 2 要件仕様に準拠) |
| **Pyodide ロード** | `<script>` タグ経由 CDN | Worker 内でのロード (`importScripts` / Pyodide npm / CDN) |
| **コードエディタ** | `<textarea>` タグ | Monaco Editor (`@monaco-editor/react`) との行ハイライト連動 |

---

## 5. 既存コードベースの状態調査

現在のワークスペース `c:\Git\TraceApp` の構成および Phase 2 開始に向けたギャップ分析です。

### 5.1 現状のディレクトリ構成とファイル一覧

```
c:\Git\TraceApp\
├── .agents/               # エージェント用作業・ハンドオフメタデータディレクトリ
│   ├── orchestrator/
│   ├── explorer_survey_2/
│   └── ...
├── ORIGINAL_REQUEST.md     # Phase 1 および Phase 2〜4 要求仕様書
├── PROJECT.md              # プロジェクトアーキテクチャ・要求タスク定義
├── index.html              # Phase 1 PoC スタンドアロンUI (HTML + JS)
├── test_runner.html        # Phase 1 PoC 自動テストスイート (10/10 PASS)
├── run_tests.js            # Node.js + Playwright 用テスト実行スクリプト
├── poc_report.md           # Phase 1 PoC 検証報告書
├── package.json            # Node package 設定
└── package-lock.json
```

### 5.2 `package.json` の現状分析

現在の `package.json` 内容:
```json
{
  "name": "traceapp",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "test": "node run_tests.js"
  },
  "dependencies": {
    "playwright": "^1.62.1"
  }
}
```

- **開発スタック未導入**: Vite, React, TypeScript, React DOM, Monaco Editor, Tailwind CSS 等の本番実装に必要なパッケージは未インストールです。
- **スクリプト構造**: 現在の `npm test` は Playwright による `test_runner.html` の自動検証用スクリプトとなっています。

### 5.3 Phase 2 構築に向けた必要タスク

1. **プロジェクト基盤のセットアップ**:
   - Vite + React + TypeScript プロジェクトの構成。
   - Monaco Editor (`@monaco-editor/react` または `monaco-editor`) のインストール・設定。
2. **モジュール分割設計**:
   - `src/workers/trace.worker.ts`: Web Worker + Pyodide トレーサー
   - `src/engine/TraceEngine.ts`: Worker 通信管理クラス
   - `src/components/`: Monaco Editor、スライダー、変数履歴テーブル、コンソールパネル
   - `src/flowchart/`: AST 解析・SVG/Canvas 流れ図レンダラー
3. **サンプルプログラムのプリセット化**:
   - テスト1（基本順次）, テスト2（条件分岐）, テスト3（ループと関数）のプリセットデータ定義。

---

## 6. まとめ (Summary & Recommendations)

- Phase 1 PoC は**成功判定 (PASS)** であり、コアとなる Python トレーサーコード（`sys.settrace()`、エッジケース対策、`sys.stdout` キャプチャ）はそのまま Phase 2 の Web Worker 環境へ引き継ぎ・再利用可能です。
- Phase 2 実装者は、PoC の Python トレーサーロジックを尊重しつつ、TypeScript 化および Web Worker へのカプセル化、Monaco Editor + Flowchart レンダラーとの統合に集中して開発を進めることが推奨されます。
