## 2026-08-13T14:28:38+09:00

あなた TraceApp M4 の最終修正を担当する Worker エージェントです。
作業ディレクトリ: `c:\Git\TraceApp\.agents\worker_m4_fix2_1`

【参照ドキュメント】
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md`
- `c:\Git\TraceApp\PROJECT.md`
- 監査結果: `c:\Git\TraceApp\.agents\auditor_m4_fix_1\handoff.md`
- 各レビュー: `c:\Git\TraceApp\.agents\reviewer_m4_fix_1\handoff.md`, `c:\Git\TraceApp\.agents\reviewer_m4_fix_2\handoff.md`, `c:\Git\TraceApp\.agents\challenger_m4_fix_1\handoff.md`, `c:\Git\TraceApp\.agents\challenger_m4_fix_2\handoff.md`

【修正指示タスク】
1. **LeftPanel.tsx の DOM 常存化と DOM アタッチ修正**:
   - `{activeTab === 'code' ? <MonacoEditor ... /> : <FlowchartViewer ... />}` による条件削除（アンマウント）を全廃し、両コンポーネントを DOM 上に常時配置してください。
   - 表示切替は `className={activeTab === 'code' ? 'block h-full' : 'hidden'}` および `className={activeTab === 'flowchart' ? 'block h-full' : 'hidden'}` (または `style={{ display: ... }}`) で行ってください。
   - これにより、`aria-controls` が参照する `#panel-code` と `#flowchart-viewer` が常に DOM に残り、WAI-ARIA 違反および MonacoEditor 再マウントに伴う遅延・状態失効を解消してください。
2. **端子ノード (terminal) のアクティブハイライト除外**:
   - `src/services/flowchartRenderer.tsx` の `isNodeActive` 関数内にて、`node.type === 'terminal'` (または `node.id === 'node-start'` / `node.id === 'node-end'`) のノードをアクティブハイライト対象から除外してください。
   - 1行目・最終行実行時に「開始」「終了」ノードが処理ノードと同時ハイライトされるバグを完全に修正してください。
3. **テストファイルの完全修正**:
   - `src/__tests__/` 配下の全テストコードで `TS6133` (未使用インポート/変数) を完全に削除してください。
   - `toBeInTheDocument` のアサーション箇所を Vitest / Testing Library 標準に合わせ `expect(...).not.toBeNull()` 等に修復してください。
   - 50行上限テストのスキャン範囲を正しく M4 コンポーネント・サービスにアプライしてください。
4. **型チェック・全テスト・ビルド検証**:
   - `npx tsc --noEmit` で型エラー 0 件。
   - `npx vitest run` で全 16 テストファイル・全テストケース 100% PASS。
   - `npm run build` で Exit Code 0。

【❗ 厳格な並列プロセス制限ルール】
- 開発サーバーは絶対に起動しないでください！テストは `npx vitest run` で実行してください。

【MANDATORY INTEGRITY WARNING】
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

報告書を `.agents\worker_m4_fix2_1\handoff.md` に作成して報告してください。日本語記述。
