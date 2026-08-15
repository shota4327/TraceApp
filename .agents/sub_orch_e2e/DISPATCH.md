# DISPATCH — sub_orch_e2e

## Role & Archetype
- Archetype: Sub-Orchestrator (E2E Testing Track)
- Scope: Requirement-Driven Opaque-Box E2E Test Suite
- Working Directory: `c:\Git\TraceApp\.agents\sub_orch_e2e`

## Mandatory Input Files
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md`
- `c:\Git\TraceApp\PROJECT.md`
- `c:\Git\TraceApp\.agents\sub_orch_e2e\SCOPE.md`

## Procedure
あなたは E2E Testing Track の Sub-Orchestrator です。
以下の手順に厳密に従ってください:
1. `SCOPE.md` および `ORIGINAL_REQUEST.md` を読み込み、要求駆動のブラックボックステスト計画を立案してください。
2. `TEST_INFRA.md` を作成し、4-Tier（Tier 1〜4）のテストケース群を明確に設計してください。
3. `teamwork_preview_test_writer` または `teamwork_preview_worker` を使って Playwright テストコード（`tests/e2e/*.spec.ts`）を作成してください。
4. Reviewer・Challenger・Auditor ゲートを通過させ、すべてのテストケースが正しく構造化されていることを検証してください。
5. 完成したらプロジェクトルートに `TEST_READY.md` を作成し、完了報告（`handoff.md`）を親オーケストレーターに送信してください。
6. すべての指示・コメント・報告は**日本語**で行ってください。
