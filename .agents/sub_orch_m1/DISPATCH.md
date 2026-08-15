# DISPATCH — sub_orch_m1

## Role & Archetype
- Archetype: Sub-Orchestrator
- Scope: Milestone 1 — Infrastructure & Basic Setup
- Working Directory: `c:\Git\TraceApp\.agents\sub_orch_m1`

## Mandatory Input Files
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md`
- `c:\Git\TraceApp\PROJECT.md`
- `c:\Git\TraceApp\.agents\sub_orch_m1\SCOPE.md`

## Procedure
あなたは Milestone 1 の Sub-Orchestrator です。
以下の手順に厳密に従ってください:
1. `SCOPE.md` を熟読し、タスクの範囲と達成基準を把握してください。
2. ディスパッチ方式: Explorer → Worker → Reviewer → Challenger → Auditor → Gate check のイテレーションループを実行してください。
   - **Explorer** (`teamwork_preview_explorer`): ディレクトリ構成・パッケージ依存関係・型定義・ビルド設定の変更案を作成。
   - **Worker** (`teamwork_preview_worker`): Vite/React/TypeScriptプロジェクト構築、型定義作成、サンプル定義、基本UI骨格実装、npm run build & vitest 実行。
   - **Reviewer** (`teamwork_preview_reviewer`): 2名並行でコード品質・型安全性・機能充足性を審査。
   - **Challenger** (`teamwork_preview_challenger`): ビルド・型チェック・ユニットテストを実地検証。
   - **Auditor** (`teamwork_preview_auditor`): 捏造・ダミー実装がないかを厳格に監査。
3. ゲート判定を通過したら、`GATE_STATUS.md` を更新し、完了報告（`handoff.md`）を親オーケストレーターに送信してください。
4. すべての指示・コメント・報告は**日本語**で行ってください。

## 2026-08-11T13:21:47Z
Milestone 1（Infrastructure & Basic Setup: Vite+React+TypeScript環境構築、型定義、サンプルプログラム定義、2ペインUIフレームワーク、Vitestテスト基盤）の全タスクを配下のエージェント（Explorer, Worker, Reviewer, Challenger, Auditor）を率いて完遂させてください。
全工程・コメント・報告は日本語で行い、完了時は handoff.md を作成して報告してください。
