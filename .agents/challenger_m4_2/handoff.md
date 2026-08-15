# Handoff Report — Milestone 4 Challenger 2 (AST Flowchart & UI Verification)

**判定結果: REQUEST_CHANGES**

## 1. Observation
M4 実装（AST フローチャート生成・描画、UI タブ切り替え、ステップハイライト、アクセシビリティ等）に対して独立した攻撃・ストレステストコード (`src/__tests__/challenger_m4_2_attack.test.tsx`, `src/__tests__/challenger_m4_2_deep.test.tsx`) を構築・実行した結果、以下の事実を確認・検証しました：

1. **WAI-ARIA アクセシビリティ非準拠**:
   - `src/components/LeftPanel.tsx` (Line 42-60): タブコンテナに `role="tablist"` が付与されておらず、各タブボタンに `role="tab"`, `aria-selected`, `aria-controls` 等のアクセシビリティ属性が欠落している。
   - `src/services/flowchartRenderer.tsx` (Line 210-215): SVG ルート要素に `role="img"` および `aria-label` が存在せず、アクセシビリティツリーでダイアグラムとして認識されない。また各ノード `<g>` に `role="graphics-symbol"` や `aria-label`, `tabIndex` がなく、キーボードおよびスクリーンリーダーでのノードナビゲーションが不可能。
   - **検証テスト結果**: `LeftPanel tab container should have role="tablist"` および `SVG should have role="img"` が `AssertionError` で失敗。

2. **UI タブ切り替え性能および DOM アンマウントの副作用**:
   - `src/components/LeftPanel.tsx` (Line 62-70): `{activeTab === 'code' ? <MonacoEditor /> : <FlowchartViewer />}` の条件判定により、タブを切り替えるたびに `MonacoEditor` または `FlowchartViewer` が DOM からアンマウント・再マウント（インスタンス破棄・再生成）されている。
   - **ベンチマーク結果**: 100回の高速タブ切り替えテストで **629.7ms** を要し（基準500ms未満超過）、Monaco Editor のフォーカス・カーソル位置・スクロール状態が切り替え時に消失する。またインラインスタイルの競合警告 (`border` vs `borderBottom`) がログに複数出力された。

3. **ステップハイライト更新時の重複アクティブ（ダブルハイライト）バグ**:
   - `src/worker/pythonTracer.ts` (Line 276-277): Python AST Visitor において `For`/`While` ループの終わりに `lineRange: [el, el]` (ループ最終行) を持つ `loop` ノード（`"ループ終了"`）が追加される。
   - `src/services/flowchartRenderer.tsx` (Line 22-29): `isNodeActive` は `activeLine >= node.lineRange[0] && activeLine <= node.lineRange[1]` で判定するため、ステップ進行で `activeLine` がループ最終行に達した際、ループ内の最終ステートメントノードと「ループ終了」ノードの 2 つが同時にアクティブ（青枠強調）表示されてしまう。
   - **検証テスト結果**: `Loop end node sharing lineRange with last loop statement causes simultaneous highlighting` で Line 3 に対して 2 個のノードが同時アクティブになるバグを再現・実証。

4. **コーディング規約違反（関数 50 行上限の超過）**:
   - 要件 R5「各関数・コンポーネントが概ね50行以内に収まっている」に対し、静的解析検証で以下の関数が大幅超過していることを確認：
     - `src/services/flowchartRenderer.tsx` の `renderNodeShape`: **153 行**
     - `src/services/flowchartGenerator.ts` の `generateFlowchartNodes`: **89 行**
     - `src/worker/pythonTracer.ts` の `generate_ast_flowchart`: **125 行**

## 2. Logic Chain
1. アクセシビリティ検証において、`LeftPanel.tsx` および `flowchartRenderer.tsx` に WAI-ARIA 属性（`tablist`, `tab`, `aria-selected`, `aria-controls`, `role="img"`, `aria-label`）が設定されていなかったため、スクリーンリーダーおよびキーボードアクセシビリティ要求を満たしていないと結論付けた。
2. タブ切り替えにおいて、コンポーネントのアンマウント（三項演算子切り替え）を採用したことで、切り替え毎に Monaco Editor が初期化し直され、100回連続処理で 620ms 以上の遅延とエディタ状態の失効を招いていることを論理的に確認した（非表示化 CSS `display: none` / `hidden` 制御への変更が必須）。
3. ノードアクティブ判定 `isNodeActive` において、`lineRange` が重複するノード（特にループ最後の文と `ループ終了` ノード）が存在するため、単一の `activeLine` に対して複数のノードが同時ハイライトされる表示欠陥を引き起こしている。
4. プロジェクト規約（R5 Quality）の「関数約50行以内」を満たさない巨大関数（153行の `renderNodeShape` 等）が存在するため、単一責任原則に従ったのリファクタリングが必要と判断した。

## 3. Caveats
- 開発サーバーの同期起動ルールに従い、本検証は `vitest` / `tsc` による静的・動的テストコード実行によって独立して実証しました。E2E の ブラウザ上での視覚的アニメーションは E2E テストスイートおよび Phase 5 にて検証されます。

## 4. Conclusion
判定: **REQUEST_CHANGES**

Worker は以下の修正を実施してください：
1. **WAI-ARIA アクセシビリティ対応**:
   - `LeftPanel.tsx` に `role="tablist"`, 各タブボタンに `role="tab"`, `aria-selected`, `aria-controls` を付与。
   - `flowchartRenderer.tsx` の SVG に `role="img"`, `aria-label="処理流れ図"`, 各ノード `<g>` に `role="graphics-symbol"`, `aria-label`, `tabIndex={0}` を付与。
2. **タブ切り替え制御の修正**:
   - `LeftPanel.tsx` で `{activeTab === 'code' ? ... : ...}` のアンマウント方式をやめ、CSS (`style={{ display: activeTab === 'code' ? 'block' : 'none' }}`) で両コンポーネントを DOM 上に保持したまま切り替える方式に変更。
   - インラインスタイルの `borderBottom` と `border` の衝突警告を修正。
3. **ループ終了ノードのアクティブ判定修正**:
   - `isNodeActive` またはノード生成ロジックにおいて、`ループ終了` ノードの `lineRange` やアクティブ判定を調整し、単一ステップで複数ノードが同時に青枠ハイライトされないよう修正。
4. **巨大関数の分割**:
   - `renderNodeShape` (153行) をノードタイプごとの小関数 (`renderTerminalNode`, `renderProcessNode`, `renderDecisionNode`, `renderLoopNode`, `renderSubroutineNode`) に分割し、各関数を 30〜50 行以内に抑える。

## 5. Verification Method
以下のコマンドを実行し、全テストの通過を確認すること：
1. `npx tsc --noEmit` -> 型エラー 0 件
2. `npx vitest run` -> 既存テストおよび自作攻撃テストスイート (`src/__tests__/challenger_m4_2_attack.test.tsx`, `src/__tests__/challenger_m4_2_deep.test.tsx`) が全件 PASS すること。
