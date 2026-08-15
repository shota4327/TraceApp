# Web Worker & Pyodide トレース実行エンジン (R1) コード解析・検証詳細報告書

- **調査担当者**: Explorer (`explorer_m0_1`)
- **作成日時**: 2026-08-13
- **対象コンポーネント**: R1 トレース実行エンジン（Web Worker + Pyodide）
- **対象ファイル**:
  - `src/worker/pyodideWorker.ts`
  - `src/worker/pythonTracer.ts`
  - `src/services/tracer.ts`
  - `src/hooks/useTraceEngine.ts`
  - `src/types/worker.ts`, `src/types/trace.ts`
  - `src/App.tsx`
  - PoC 参照資料: `test_runner.html`, `poc_report.md`

---

## 1. エグゼクティブサマリー

TraceApp のコア機能である「Web Worker + Pyodide による Python コードの事前全ステップトレース実行エンジン (R1)」のコード構造、動作検証、PoC との差分、および問題点の精査を行いました。

**全体評価: ほぼ完成しているが、エッジケース処理およびバグ・設計不備の修正が4点必要。**

Web Worker の構築、`postMessage` による非同期通信、`sys.settrace()` を用いたステップ実行、`TraceLimitExceeded` による上限ガード、特殊浮動小数点数（NaN/Infinity）や循環参照のシリアライズ防止機構などの骨格部分は非常に高い品質で実装されています。
しかし、以下のバグおよび設計上の不備が確認されたため、後続の修正フェーズ（Implementer）での修正を強く推奨します：

1. **【クリティカルバグ】 Python トレーサー内の改行エスケープ不備 (`pythonTracer.ts`)**: テンプレート文字列内のエスケープミスにより Python コード内で `code_str.split("\\n")` となっており、複数行コードが分割できず AST 流れ図生成が破損する。
2. **【設計不備】 無限ループガード発生時のスナップショット破棄 (`pyodideWorker.ts`)**: `TraceLimitExceeded` 発生時に `parsed.success === false` となるが、Worker 側で途中までの `snapshots` を全て破棄してエラーメッセージのみ返却している。
3. **【機能欠落】 最終ステップ (`event: 'end'`) の欠落 (`pythonTracer.ts`)**: スクリプト終了直後の最終変数状態を記録する `event: 'end'` ステップが実装されていない。
4. **【検出判定不備】 `changedVars`（変更変数）スコープ混同 (`pythonTracer.ts`)**: ローカル変数とグローバル変数をマージして変化検知を行っているため、同名変数やスコープ遷移時に誤判定する。

---

## 2. 検証・報告項目詳細 (R1トレース実行エンジン要求事項)

### 項目1: PyodideのWeb Worker上での初期化・ロード処理の実装状態
- **コード位置**: `src/worker/pyodideWorker.ts` (L10–L37), `src/hooks/useTraceEngine.ts` (L41–L106)
- **分析内容**:
  - `pyodideWorker.ts` では CDN URL `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/` から `loadPyodide()` を実行し、ブラウザのバックグラウンドスレッドで Pyodide (v0.26.4) を初期化します。
  - 初期化成功後、`pyodide.runPythonAsync(PYTHON_TRACER_SCRIPT)` を呼び出し、Python 内に `PyodideTracer` クラスおよび `run_trace` 関数を常駐・定義させています。
  - フラグ `isInitializing` および `pyodide` の存在チェックにより二重初期化を確実に防止しています。
  - メインスレッド（UI 側）では `useTraceEngine.ts` が `new Worker(new URL('../worker/pyodideWorker.ts', import.meta.url), { type: 'module' })` により Worker を動的生成し、初期化中は `isInitializing: true` を保持します。
  - `App.tsx` では `isInitializing` の間、全画面のローディングモーダルを表示してユーザーの誤操作を防止しています。
- **判定**: **合格 (PASS)**

### 項目2: `postMessage`通信フォーマットおよびメインスレッドとの同期・非同期状態
- **コード位置**: `src/types/worker.ts`, `src/hooks/useTraceEngine.ts`
- **分析内容**:
  - メッセージ型定義 (`src/types/worker.ts`):
    - `WorkerRequest`: `{ type: 'INIT' }` | `{ type: 'RUN_TRACE'; code: string; maxSteps?: number }`
    - `WorkerResponse`: `{ type: 'INIT_COMPLETE' }` | `{ type: 'INIT_ERROR'; error: string }` | `{ type: 'TRACE_SUCCESS'; result: TraceResult }` | `{ type: 'TRACE_ERROR'; error: string }`
  - 同期・非同期状態:
    - UI 側コンポーネントは `useTraceEngine()` フック経由で Worker とやり取りします。
    - `runTrace(code, maxSteps)` は `Promise<TraceResult>` を返し、内部の `pendingRequestRef` が Worker からの `TRACE_SUCCESS` / `TRACE_ERROR` メッセージを受信して Promise を resolve/reject します。
    - メインスレッドの UI レンダリングやイベント処理は一切ブロックされず完全な非同期通信が維持されています。
- **判定**: **合格 (PASS)**

### 項目3: `sys.settrace()`によるPython実行行・変数スナップショット・print出力の取得実装
- **コード位置**: `src/worker/pythonTracer.ts` (`PyodideTracer` クラス L45–L200)
- **分析内容**:
  - `sys.settrace(self.trace_func)` フックを登録し、`frame.f_code.co_filename == "<string>"` のみをフィルタリングすることで Pyodide 内部フレームを除外。
  - 行番号 `frame.f_lineno` とイベント (`'line'`, `'call'`, `'return'`)、関数名 `frame.f_code.co_name` を正確にキャプチャ。
  - `sys.stdout` を `StepStdoutWriter`（`io.StringIO` バッファ）へリダイレクトし、`get_delta()` で各ステップの差分出力 (`stdoutDelta`)、`get_cumulative()` で累積出力 (`stdoutCumulative`) を収集。
  - 各ステップで `globals` と `locals` の辞書を分離記録。
- **課題点**:
  - **`event: 'end'` の欠損**: スクリプトの実行完了時に最終状態を記録する `event: 'end'` ステップが追加されていないため、最後の行で変更された変数がスナップショットに含まれない可能性があります。
  - **`changedVars` の誤判定**: L174にて `current_all = {**globals_snap, **locals_snap}` でローカルとグローバルを単一辞書に結合して前回比較しているため、同名変数や関数呼び出し時に変化検知が乱れるリスクがあります。
- **判定**: **一部修正が必要 (NEEDS FIX)**

### 項目4: 無限ループ防止用の `TraceLimitExceeded(BaseException)` の実装有無と妥当性
- **コード位置**: `src/worker/pythonTracer.ts` (L13–L18, L158–L160, L358–L369), `src/worker/pyodideWorker.ts` (L54–L60)
- **分析内容**:
  - Python 例外クラス `class TraceLimitExceeded(BaseException): pass` が正しく定義されています。
  - `BaseException` を直接継承することで、ユーザーが記述した Python コード内の `try: ... except Exception:` に捕獲されず、確実に実行を緊急停止させることができます（PoC 実証済み）。
  - `PyodideTracer` 内で `self.step_count > self.max_steps`（デフォルト 10,000）に達すると例外を発行します。
- **クリティカルな課題点**:
  - `pythonTracer.ts` の `run_trace` 関数は、`TraceLimitExceeded` をキャッチした際に `"success": false` とともに、それまでに収集された `snapshots` や `stdout` を含めた JSON を返却しています。
  - しかし `pyodideWorker.ts` (L54–L60) では、`if (!parsed.success)` の場合に `self.postMessage({ type: 'TRACE_ERROR', error: parsed.error })` のみをメインスレッドに返却し、**収集済みのスナップショットを全て廃棄しています**。
  - この結果、無限ループが発生した際に「どこまで進んで無限ループになったか」のトレース表示が UI 上で行えず、単にエラーダイアログが表示されるだけの状態になっています。
- **判定**: **修正が必要 (NEEDS FIX)**

### 項目5: NaN, Infinity, 循環参照などのエッジケースシリアライズ対策の有無
- **コード位置**: `src/worker/pythonTracer.ts` (L65–L144)
- **分析内容**:
  - `_sanitize_value(v, depth, max_depth, seen)` メソッドが実装されています。
  - `float` 型の `math.isnan(v)` を `"NaN"`、`math.isinf(v)` を `"Infinity"` または `"-Infinity"` に文字列化し、JavaScript `JSON.parse()` での構文エラークラッシュを防ぎます。
  - 循環参照対策として `id(v)` を `seen` セットで保持・判定し、循環参照またはネスト深さ 5 超過時に `_safe_repr(v)` に安全フォールバックします。
  - 任意の例外発生に対しても二重・三重の `try...except` で `_safe_repr(v)` および `<Unrepresentable Object>` へ安全にフォールバックします。
- **判定**: **合格 (PASS)**

### 項目6: 変数のグローバル/ローカルスコープ判定とデータ型(int, float, str, bool)のフィルタリング処理
- **コード位置**: `src/worker/pythonTracer.ts` (L49–L54, L135–L173)
- **分析内容**:
  - `func_name == "<module>"`（トップレベル）実行時は `globals` のみを記録し、`locals` は `{}`、`functionName` は `None` に設定。
  - 関数実行中の場合は `globals` と `locals` の辞書を分離して記録し、`functionName` に関数名を保持。
  - `EXCLUDED_NAMES` (`sys`, `json`, `math`, `PyodideTracer`, `__builtins__` 等) や `__tracer_`, `_pyodide_` で始まる内部変数を徹底的に除外。
- **設計仕様との照合**:
  - 基本設計書/R1 では「基本型（int, float, str, bool）のみ対応」と記載されていますが、現在の `pythonTracer.ts` は `list`, `dict`, `set`, `tuple` などの複合型も再帰的に要素をサニタイズして取得しています。これは初学者向けツールとしてはより親切な挙動（配列や辞書の可視化が可能）ですが、UI 側の `VariableTable.tsx` が複合型オブジェクトの表示に対応しているか整合性の確認が必要です。
- **判定**: **合格 (PASS - 実装拡張あり)**

### 項目7: PoCコード (`test_runner.html`, `poc_report.md`) との比較差異・未移行部分
- **差異一覧**:
  1. **シリアライズ処理の進化**: PoC では `json.loads(json.dumps(v))` によるディープコピーだったが、本実装では `_sanitize_value` による手動再帰処理と循環参照 ID 追跡 (`seen`) に進化し、パフォーマンスと安全性が向上。
  2. **最終ステップ (`event: 'end'`) の脱落**: PoC の `test_runner.html` に存在していた「スクリプト完了時の最終状態ステップ追加」が本実装から落としている。
  3. **フィールド名の標準化**: PoC の `stepOutput` / `cumulativeOutput` から、型定義 `src/types/trace.ts` に合わせて `stdoutDelta` / `stdoutCumulative` に改称。
  4. **AST 流れ図生成の Worker 統合**: Python の `ast` モジュールを用いた `generate_ast_flowchart()` が Worker 側スクリプトに組み込まれ、トレース実行時に一括生成されるようになった。
  5. **TS 簡易インタプリタ (`src/services/tracer.ts`) の存在**: Python インタプリタを使わない純 JS/TS の簡易トレース実装が残存しているが、現在 `App.tsx` は Pyodide Worker を主として使用しているため、`tracer.ts` は不要か単体テスト/フォールバック用となっている。
- **判定**: **一部未移行ロジックあり (PARTIAL)**

---

## 3. 不足機能・バグ・修正が必要な具体箇所 (項目8)

### ① 【バグ】 `pythonTracer.ts` 内の改行ダブルエスケープバグ
- **ファイル**: `src/worker/pythonTracer.ts`
- **問題行**: L207, L327, L328
- **コード抜粋**:
  ```python
  code_lines = code_str.split("\\n")  # L207
  cell_snips = "\\n    ".join(n.get("xmlSnippet", "") for n in nodes)  # L327
  ```
- **問題の原因**: TS の TypeScript テンプレート文字列 `` `...` `` 内で `"\\n"` と書いたため、評価後の Python スクリプトには `\n`（改行文字）ではなく文字 `\` と `n`（2文字）が渡されてしまう。
- **影響**: `generate_ast_flowchart` がコードを改行で分割できず、1行目のコードのみとして処理され流れ図生成が壊れる。
- **修正案**: `"\\n"` を `"\n"` に変更する。

### ② 【設計不備】 `pyodideWorker.ts` での無限ループ時スナップショット破棄
- **ファイル**: `src/worker/pyodideWorker.ts`
- **問題行**: L54–L60
- **コード抜粋**:
  ```typescript
  if (!parsed.success) {
    self.postMessage({
      type: 'TRACE_ERROR',
      error: parsed.error || 'トレース実行中にエラーが発生しました。',
    } satisfies WorkerResponse);
    return;
  }
  ```
- **影響**: `TraceLimitExceeded` で上限に達した場合に、上限直前までに収集された `parsed.snapshots` が UI に渡されず全て破棄される。
- **修正案**: `TRACE_SUCCESS` に `warning` / `error` 情報を持たせるか、`TRACE_ERROR` のレスポンス型に `result?: TraceResult` を追加し、上限超過時でも途中までのスナップショットを UI に返却して閲覧可能にする。

### ③ 【機能欠落】 最終ステップ (`event: 'end'`) の生成漏れ
- **ファイル**: `src/worker/pythonTracer.ts`
- **問題箇所**: `run_trace()` 関数の `exec(compiled_code, exec_globals)` 直後
- **影響**: 最終行での変数代入や計算結果が、実行ステップの最後の状態として画面に反映されない可能性がある。
- **修正案**: PoC 同様、`exec` 成功後に最終グローバル変数のスナップショットを `event: 'end'` として `snapshots` 配列の末尾に追加する。

### ④ 【判定不備】 `changedVars`（変更変数）のスコープ結合による判定ミス
- **ファイル**: `src/worker/pythonTracer.ts`
- **問題行**: L174–L180
- **コード抜粋**:
  ```python
  current_all = {**globals_snap, **locals_snap}
  changed_vars = []
  for k, v in current_all.items():
      if k not in self.prev_vars or self.prev_vars[k] != v:
          changed_vars.append(k)
  ```
- **影響**: 同名のグローバル変数とローカル変数が存在した場合や、関数呼び出し時に変数の変更検知が誤作動する。
- **修正案**: `globals` と `locals` を独立して比較するか、スコープキーを付与して比較する。

---

## 4. 結論および Implementer への引継ぎ方針

R1 トレース実行エンジンの基盤構造（Web Worker, `postMessage`, `sys.settrace`, エッジケースサニタイズ）は極めて良好に構築されています。上記 4 点の不備・バグを Implementer が修正することで、100% 堅牢で信頼性の高い Pyodide トレースエンジンが完成します。
