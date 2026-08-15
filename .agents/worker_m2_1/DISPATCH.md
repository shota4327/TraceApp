## 2026-08-11T11:35:56Z
あなたは Milestone 2 (Web Worker Trace Engine) の実装を担当する Worker エージェント (worker_m2_1) です。
作業ディレクトリ: c:\Git\TraceApp\.agents\worker_m2_1
(作業開始時に .agents/worker_m2_1/BRIEFING.md および progress.md を作成してください)

## タスク目的
TraceApp の Milestone 2「Web Worker Pyodide トレースエンジン」を完全に実装・単体テストし、動作確認を行ってください。

## 参照ファイル
1. Verbatim Request: `c:\Git\TraceApp\ORIGINAL_REQUEST.md`
2. 全体設計: `c:\Git\TraceApp\PROJECT.md`
3. Explorer 1 報告書: `c:\Git\TraceApp\.agents\sub_orch_m2_exp1\handoff.md`
4. Explorer 2 報告書: `c:\Git\TraceApp\.agents\sub_orch_m2_exp2\handoff.md`
5. Explorer 3 報告書: `c:\Git\TraceApp\.agents\sub_orch_m2_exp3\handoff.md`
6. 型定義: `src/types/trace.ts`, `src/types/worker.ts`, `src/types/flowchart.ts`

## 必須実装内容
1. **Web Worker 内 Pyodide トレースエンジン (`src/worker/pyodideWorker.ts`, `src/worker/pythonTracer.ts` または同等モジュール)**:
   - Web Worker 内で Pyodide (v0.26.4) を初期化。
   - `postMessage` プロトコルによるメインスレッド通信を実装:
     - `INIT` -> `INIT_COMPLETE` / `INIT_ERROR`
     - `RUN_TRACE` -> `TRACE_SUCCESS` / `TRACE_ERROR`
   - Python `sys.settrace()` トレース収集処理:
     - `TraceLimitExceeded(BaseException)` による 10,000 ステップ上限超過ガード（`except Exception:` 突破対応）
     - `StepStdoutWriter` による `print()` 出力の差分 (`stdoutDelta`) および累積 (`stdoutCumulative`) の収集
     - `math.isnan()`, `math.isinf()` による `"NaN"`, `"Infinity"`, `"-Infinity"` の JS 文字列変換
     - `seen` set ID 追跡と `_safe_repr()` による循環参照・無制限ネストの安全フォールバック
     - スコープ分離 (`globals` と `locals`) および内部予約変数のフィルタリング
     - ステップ間における `changedVars`（変更・追加された変数名）の自動算出
2. **React フック (`src/hooks/useTraceEngine.ts`)**:
   - `pyodideWorker.ts` を非同期 Web Worker として生成・通信管理。
   - `isInitializing`, `isTracing`, `traceResult`, `error`, `runTrace`, `resetTrace` 等の状態・関数をエクスポート。
3. **単体テスト (`src/__tests__/tracer.test.ts` または `src/__tests__/worker.test.ts`)**:
   - `sys.settrace()` トレースロジック、上限ガード (10,000ステップ)、`NaN`/`Infinity`/循環参照のサニタイズ、stdout キャプチャ、変数の変更検知を検証する Vitest テストを作成・全 PASS させる。

## 完了・検証条件
- `npx tsc --noEmit` で型エラー 0 件。
- `npx vitest run` で全単体テスト PASS。
- `npm run build` がエラーなく成功。
- 作業成果と検証コマンド実行結果を `c:\Git\TraceApp\.agents\worker_m2_1\handoff.md` に出力。

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

すべてのコメント、ドキュメント、進捗報告、handoff.md は日本語で記述してください。

## 2026-08-13T21:15:24Z
あなたはTraceAppのPython -> 流れ図変換・描画機能 (R3要求事項) の拡張実装を担当するWorker (worker_m2_1)です。

【重要指示】
- あなたの作業ディレクトリは `c:\Git\TraceApp\.agents\worker_m2_1` です。
- 必ず `c:\Git\TraceApp\.agents\ORIGINAL_REQUEST.md`, `c:\Git\TraceApp\.agents\orchestrator_1\PROJECT.md`, および Explorerの調査報告書 `c:\Git\TraceApp\.agents\explorer_m0_2\analysis.md` を熟読してください。
- **コード内のコメントはすべて日本語で記述すること。**
- **各関数・コンポーネントは1つの責務に集中させ、30〜50行以内を目安に適度に分割すること。**
- **並列プロセスの制限**: 開発サーバーを新しく起動しないこと。ビルド・テストの同時実行を避けること。

【担当タスク (Milestone 2: 流れ図CFG変換・レンダラー・draw.io XML拡張)】
1. `src/types/flowchart.ts`:
   - `FlowchartEdge` インターフェース (`id`, `sourceId`, `targetId`, `label?: 'True' | 'False' | 'Loop' | 'Next'`) を追加定義。
   - `FlowchartGraph` または `FlowchartNode` / `FlowchartData` に `edges?: FlowchartEdge[]` および座標・サイズ情報をサポート。
2. `src/worker/pythonTracer.ts` & `src/services/flowchartGenerator.ts`:
   - ASTパース処理で、条件分岐 (`if/elif/else`) の True/False 分岐エッジ、および繰り返し (`while/for`) の LoopBack（繰り返し戻り）エッジを含む制御フローグラフ (CFG) ノード・エッジ構造を生成するよう拡張。
3. `src/services/flowchartRenderer.tsx`:
   - ノード間の接続線を単一垂直直線から、分岐矢印（True/False ラベル付きSVGパス）およびループ戻り矢印 (LoopBack) を適切に描画するよう拡張。
   - ステップ実行時のアクティブノード（実行行に対応するASTノード）のハイライト表示を維持・強化。
4. `src/services/flowchartGenerator.ts` (`generateDrawIoXml`):
   - `<mxCell vertex="1">` (ノード) に加え、`<mxCell edge="1">` (接続矢印、`source`, `target`, `value` ラベル) を出力し、完全な draw.io mxGraph XML 形式として出力・保存できるように修正。
5. `src/components/FlowchartViewer.tsx`:
   - 生成された CFG ノード・エッジ構造を SVG レンダラーへ渡し、ハイライト表示およびタブ切り替え表示を動作させる。
6. 単体テスト・ビルド確認:
   - `npx vitest run` を実行し、既存テストおよび追加した流れ図テストが全件パスすることを確認。
   - `npx tsc --noEmit` で型エラー 0 件を確認。
