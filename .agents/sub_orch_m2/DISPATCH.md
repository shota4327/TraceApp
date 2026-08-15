# DISPATCH — sub_orch_m2

## Role & Archetype
- Archetype: Sub-Orchestrator
- Scope: Milestone 2 — Web Worker Trace Engine
- Working Directory: `c:\Git\TraceApp\.agents\sub_orch_m2`

## Mandatory Input Files
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md`
- `c:\Git\TraceApp\PROJECT.md`
- `c:\Git\TraceApp\index.html` (PoCコード参考)
- `c:\Git\TraceApp\poc_report.md` (PoCレポート参考)
- `c:\Git\TraceApp\.agents\sub_orch_m2\SCOPE.md`

## Procedure
あなたは Milestone 2 の Sub-Orchestrator です。
以下の手順に厳密に従ってください:
1. `SCOPE.md` を熟読し、タスクの範囲と達成基準を把握してください。
2. ディスパッチ方式: Explorer → Worker → Reviewer → Challenger → Auditor → Gate check のイテレーションループを実行してください。
   - **Explorer** (`teamwork_preview_explorer`): Pyodide Web Worker、`sys.settrace()` トレース収集、エッジケース対策の設計案を作成。
   - **Worker** (`teamwork_preview_worker`): `src/worker/pyodideWorker.ts`, Pythonトレーサーロジック, `useTraceEngine.ts`, 単体テストを実装し、ビルドとテストを検証。
   - **Reviewer** (`teamwork_preview_reviewer`): 2名並行でコード品質・型安全性・非同期通信・エッジケース処理を審査。
   - **Challenger** (`teamwork_preview_challenger`): ビルド・型チェック・ユニットテスト・10,000ステップ上限・NaN/循環参照等の挙動を実地検証。
   - **Auditor** (`teamwork_preview_auditor`): 捏造・ダミー実装がないかを厳格に監査（`TraceLimitExceeded` やスナップショット収集が本物であるか確証）。
3. ゲート判定を通過したら、`GATE_STATUS.md` を更新し、完了報告（`handoff.md`）を親オーケストレーターに送信してください。
4. すべての指示・コメント・報告は**日本語**で行ってください。
