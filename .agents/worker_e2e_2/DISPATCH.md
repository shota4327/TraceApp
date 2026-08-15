## 2026-08-11T04:27:47Z
あなたは E2E Testing Track の 修正実装 Worker エージェントです。
作業ディレクトリ: c:\Git\TraceApp\.agents\worker_e2e_2
参照ファイル:
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md`
- `c:\Git\TraceApp\PROJECT.md`
- `c:\Git\TraceApp\.agents\sub_orch_e2e\SCOPE.md`
- `c:\Git\TraceApp\.agents\explorer_e2e_2\analysis.md` （★最新の修正・統合戦略レポート）
- `c:\Git\TraceApp\.agents\auditor_e2e_1\handoff.md` （★監査結果レポート）

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

【タスク】
`c:\Git\TraceApp\.agents\explorer_e2e_2\analysis.md` に定義された修復方針に従い、以下の全修正を正確かつ完璧に遂行してください:

1. **`playwright.config.ts` の修復**:
   `webServer.command` を `node server.js` から Vite 開発/プレビューサーバー (`npm run dev -- --port 5173`) に変更し、Vite による TSX コンパイルと Headless Chromium からのアクセス環境を構築してください。

2. **コンポーネント (`src/components/*`) の ID / `data-testid` 追加・整頓**:
   - `Header.tsx`: `status-indicator` (`status-bar`), `status-text`, `preset-select`, `file-upload-input`
   - `LeftPanel.tsx`: `tab-code`, `tab-flowchart`
   - `MonacoEditor.tsx`: `code-input`, `monaco-editor`, `code-viewer`
   - `StepNavigation.tsx`: `btn-run`, `btn-prev`, `btn-next`, `btn-reset`, `btn-last`, `step-counter`, `step-slider`
   - `VariableTable.tsx`: `locals-table-body`, `globals-table-body`, `variable-table`
   - `OutputConsole.tsx`: `console-output`, `output-console`
   - `FlowchartViewer.tsx`: `flowchart-viewer`

3. **`tests/e2e/*.spec.ts` の本質的アサーションへの修正**:
   - `tier1_features.spec.ts` L204-L219 (T1-10), `tier3_combinations.spec.ts` L106-L109 (T3-03) の要素不在時ダミー `else` 分岐を完全削除。
   - `tier2_boundary.spec.ts` L59-L61 (T2-01) の通常表示文字列 "ステップ" による恒真アサーション判定を完全削除。
   - `T1-09` (流れ図描画), `T2-03` (構文エラー), `T2-04` (実行例外) の表面アサーションを、実際の DOM ノード描画やダイアログ/エラー表示メッセージの本質検証に差替。
   - `T2-10` の `beforeEach` 依存を解除し、初期ロード中の非活性状態（`disabled`）を動的検証。

4. **ビルドおよび Playwright テスト実行**:
   型チェック (`npx tsc --noEmit` 等) および `npx playwright test` を実行し、全ケースが正常かつ真正にグリーンパスすることを確認してください。

5. 修正完了後、`c:\Git\TraceApp\.agents\worker_e2e_2\handoff.md` に完了報告（日本語）を作成し、親に `send_message` で報告してください。
