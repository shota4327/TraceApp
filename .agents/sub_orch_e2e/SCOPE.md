# Scope: E2E Testing Track — Requirement-Driven Test Suite

## Objective
要求定義（`ORIGINAL_REQUEST.md`）および Feature Inventory（`PROJECT.md`）に記載された全機能・全エッジケース・全アプリケーションシナリオに対するブラックボックス E2E テストスイートの構築と `TEST_READY.md` の発行。

## Architecture & Deliverables
- `TEST_INFRA.md`: テスト方針、機能インベントリマッピング、4階層（Tier 1〜4）テストケース一覧
- `tests/e2e/`: Playwright による E2E テストケース群
  - `tests/e2e/tier1_features.spec.ts`: 機能網羅テスト（各機能5件以上）
  - `tests/e2e/tier2_boundary.spec.ts`: 境界値・エッジケーステスト（10,000ステップ、NaN/Infinity、空入力等）
  - `tests/e2e/tier3_combinations.spec.ts`: 複合機能テスト（スライダー＋変数ハイライト, タブ切替＋ノードハイライト等）
  - `tests/e2e/tier4_realworld.spec.ts`: 実用アプリケーションシナリオ（テストプログラム1〜3等）
- `TEST_READY.md`: テストスイート準備完了シグナルおよびカバレッジサマリー

## Test Methodology (4-Tier Framework)
1. **Tier 1 — 機能網羅 (Feature Coverage)**: 各機能に対して最低5ケースの正常系テスト。
2. **Tier 2 — 境界値・コーナーケース (Boundary & Corner)**: 限界値、エッジケース、異常系のテスト。
3. **Tier 3 — 機能複合・相互作用 (Cross-Feature Combinations)**: 複数機能が連動する操作ペアのテスト。
4. **Tier 4 — 実用アプリケーションシナリオ (Real-World Application Scenarios)**:
   - 検証用テスト1 (順次・代入)
   - 検証用テスト2 (条件分岐)
   - 検証用テスト3 (ループと関数)
   - リアルワールド実用コードシナリオ

## Requirements
- テストケースは実装詳細に依存せず、ブラウザ画面の要素（ボタン、Monacoエディタ、スライダー、変数履歴表、print出力、流れ図ノード）を操作・検証するブラックボックステストとすること。
- テストスイートが完成したらプロジェクトルートに `TEST_READY.md` を作成・保存すること。
