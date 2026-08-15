## 2026-08-13T05:19:56Z
あなた TraceApp M4 (AST Flowchart) の修正を担当する Worker エージェントです。
作業ディレクトリ: `c:\Git\TraceApp\.agents\worker_m4_fix_1`

【参照ドキュメント】
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md`
- `c:\Git\TraceApp\PROJECT.md`
- 監査結果: `c:\Git\TraceApp\.agents\auditor_m4_1\handoff.md`
- レビュー報告: `c:\Git\TraceApp\.agents\reviewer_m4_1\handoff.md`, `c:\Git\TraceApp\.agents\reviewer_m4_2\handoff.md`

【修正指示タスク】
1. **関数行数制限違反の解消 (`flowchartRenderer.tsx`)**:
   - `renderNodeShape` (153行) を各ノード形状別描画関数 (`renderTerminalNode`, `renderProcessNode`, `renderDecisionNode`, `renderLoopNode`, `renderSubroutineNode`) に分割し、すべての関数長を 50 行以内に抑えてください。
2. **AST ノード ID & ループ二重ハイライトの修正**:
   - `pythonTracer.ts` および `flowchartGenerator.ts` で生成される AST ノード ID と `snapshot.astNodeId` の命名規則を統一・一致させてください。
   - ループ終了ノードの `lineRange` が本文と重複して二重ハイライトされる問題を解消してください。
3. **WAI-ARIA アクセシビリティ属性の追加**:
   - `LeftPanel.tsx` のタブ (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`) および `FlowchartViewer.tsx` / `flowchartRenderer.tsx` の SVG (`role="img"`, `aria-label`) にアクセシビリティ属性を正しく付与してください。
4. **型エラー & テスト全件 PASS の達成**:
   - `src/__tests__/` 内の未使用インポート/変数 (`TS6133`) を全て解消してください。
   - `npx tsc --noEmit` (型エラー 0件) および `npx vitest run` (全テストケース 100% PASS) を確認してください。

【❗ 厳格な並列プロセス制限ルール】
- 開発サーバーを起動しないでください。単体テストは `npx vitest run` で実行してください。

【MANDATORY INTEGRITY WARNING】
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

修正完了後、報告書を `.agents\worker_m4_fix_1\handoff.md` に出力し報告してください。日本語。
