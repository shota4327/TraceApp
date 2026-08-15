## 2026-08-11T13:22:51+09:00
<USER_REQUEST>
あなたは E2E Testing Track の Test Writer エージェントです。
作業ディレクトリ: c:\Git\TraceApp\.agents\test_writer_1
参照ファイル:
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md`
- `c:\Git\TraceApp\PROJECT.md`
- `c:\Git\TraceApp\.agents\sub_orch_e2e\SCOPE.md`
- `c:\Git\TraceApp\.agents\spec_miner_e2e_1\analysis.md`
- `c:\Git\TraceApp\.agents\explorer_e2e_1\analysis.md`

【タスク】
1. プロジェクトルートに `TEST_INFRA.md`（c:\Git\TraceApp\TEST_INFRA.md）を作成してください。
   `TEST_INFRA.md` には、テスト方針、全機能インベントリマッピング、テストアーキテクチャ、4階層（Tier 1〜4）のカバレッジ目標とテストケース仕様を記載してください。
2. `c:\Git\TraceApp\tests\e2e\` ディレクトリを作成し、以下の 4 つの Playwright テストファイルを構造化・実装してください:
   - `tests/e2e/tier1_features.spec.ts`: 機能網羅テスト（初期化、サンプル切替、エディタ編集、.pyアップロード、ステップ進行、デコレーション、変数履歴表、printコンソール、流れ図描画、タブ切替）
   - `tests/e2e/tier2_boundary.spec.ts`: 境界値・エッジケーステスト（10,000ステップ上限超過 `TraceLimitExceeded`、NaN/Infinity値、SyntaxError, ZeroDivisionError, 空コード, 大量変数, 深層ネスト, 特殊文字print, 再帰関数, ローディング保護）
   - `tests/e2e/tier3_combinations.spec.ts`: 複合機能テスト（スライダー移動時の4点全要素同期, 前へ/次へ往復の一致, タブ切替時のハイライト保持, サンプル切替＋カスタム編集＋リセット, ファイルアップロード＋スライダー移動, 高速連打操作）
   - `tests/e2e/tier4_realworld.spec.ts`: 実用アプリケーションシナリオ（検証用テスト1: 順次・代入, 検証用テスト2: 条件分岐, 検証用テスト3: ループと関数, シナリオ4: ユーザースモールデバッグ演習）
3. テストコード内コメント・ドキュメントはすべて**日本語**で記述してください。既存 DOM ID (`#btn-next` 等) および `data-testid` (`data-testid="btn-next"` 等) の両方で柔軟に要素を取得できるようにロバストに作成してください。
4. テスト実行環境の動作確認（`npm test` や Playwright テスト実行）を行い、問題がないことを確認してください。
5. 作業完了後、`c:\Git\TraceApp\.agents\test_writer_1\handoff.md` に実装内容・テスト結果サマリーを作成し、親に `send_message` で報告してください。
</USER_REQUEST>
