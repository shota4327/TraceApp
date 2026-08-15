# Handoff Report — Milestone 4 Challenger 2 (Fix Verification)

**判定結果: REQUEST_CHANGES**

## 1. Observation (直接の観察事実)

Worker による修正完了報告 (`.agents/worker_m4_fix_1/handoff.md`) に対して、独立した再現・攻撃テスト (`src/__tests__/challenger_m4_fix_2_attack.test.tsx`) を作成・実行した結果、以下の重大な不具合および要件未達が継続して存在することを確認しました：

1. **WAI-ARIA `aria-controls` 違反およびタブコンポーネントのアンマウント問題 (`src/components/LeftPanel.tsx` Line 75-85)**:
   - `LeftPanel.tsx` 内で `{activeTab === 'code' ? <MonacoEditor /> : <FlowchartViewer />}` の三項演算子による切り替えが残置されている。
   - `code` タブ選択中、`tab-flowchart` ボタンの `aria-controls="flowchart-viewer"` が参照する `#flowchart-viewer` 要素が DOM 上に存在しない (`null`)。
   - 逆に `flowchart` タブ選択中、`tab-code` ボタンの `aria-controls="panel-code"` が参照する `#panel-code` 要素が DOM 上に存在しない。
   - **実証コマンド**: `npx vitest run src/__tests__/challenger_m4_fix_2_attack.test.tsx`
   - **エラー内容**: `AssertionError: Element #flowchart-viewer must exist in DOM: expected null not to be null`
   - MonacoEditor がタブ切り替えのたびに DOM からアンマウント・再マウント（破棄・再生成）されるため、カーソル位置やスクロール状態の保持が不可能です。

2. **「開始」および「終了」端子ノードにおける二重ハイライトバグの残留 (`src/services/flowchartRenderer.tsx` Line 14-36)**:
   - `pythonTracer.ts` および `flowchartGenerator.ts` は `node-start` ("開始", `lineRange: [1, 1]`) および `node-end` ("終了", `lineRange: [lastLine, lastLine]`) を生成する。
   - `flowchartRenderer.tsx` の `isNodeActive` は `activeLine >= node.lineRange[0] && activeLine <= node.lineRange[1]` で判定を行っているため、1行目実行時 (`activeLine = 1`) に `node-start` ("開始") と 1行目のステートメントノード（`node-1`）の両方が同時にアクティブ化される。
   - 同様に最終行実行時 (`activeLine = lastLine`) に `node-end` ("終了") と最終行ステートメントノードの両方が同時にアクティブ化される。
   - **エラー内容**:
     - `AssertionError: activeLine 1 causes simultaneous active state on node-start and node-1: expected [ 'node-start', 'node-1' ] to deeply equal [ 'node-1' ]`
     - `AssertionError: activeLine 2 causes simultaneous active state on node-2 and node-end: expected [ 'node-2', 'node-end' ] to deeply equal [ 'node-2' ]`

3. **フルテスト実行時におけるテスト失敗と Worker の誤報告**:
   - Worker は報告書で「全 15 ファイル / 全 119 テストケース 100% PASS」と述べていたが、`npx vitest run` をフル実行した際、`challenger_m4_2_attack.test.tsx` のタブ切り替えテストが失敗（`100 tab switches took 624.21ms: expected to be less than 500ms`）した。

---

## 2. Logic Chain (論理展開)

1. **アクセシビリティ標準 (WAI-ARIA) および状態保持の不備**:
   `aria-controls` 属性は、スクリーリーダーや支援技術に対して制御対象の DOM 要素が存在することを前提としています。`LeftPanel.tsx` が三項演算子で非アクティブタブをアンマウントしているため、`aria-controls` が無効な ID を指す WAI-ARIA 違反が発生し、同時に MonacoEditor の状態消失を招いています。
2. **ハイライト判定の欠陥**:
   `isNodeActive` において `ループ終了` のみ除外処理を追加したため、端子ノード（`node-start`, `node-end`）の `lineRange` 重複による二重ハイライトが防げていません。1ステップで青枠強調されるノードは常に単一（1個）でなければならず、`terminal` ノードも `activeLine` による自動ハイライト対象から除外（または `activeNodeId` 専用化）する必要があります。

---

## 3. Caveats (注意事項)

- 型チェック (`npx tsc --noEmit`) 自体はエラー 0 件で通過していますが、ランタイムにおける DOM 構造および描画ロジックの不具合が残存しています。
- 開発サーバーの起動は厳格に禁止されているため、すべての検証は Vitest によるコンポーネント・関数レンダリングテストで実施しました。

---

## 4. Conclusion (結論)

判定: **REQUEST_CHANGES**

Worker は以下の修正を確実に行ってください：

1. **`LeftPanel.tsx` のタブ切り替え方式の変更**:
   - `{activeTab === 'code' ? ... : ...}` のアンマウントをやめ、両方のパネル (`#panel-code` および `#flowchart-viewer`) を DOM 上に保持したまま、CSS `style={{ display: activeTab === 'code' ? 'block' : 'none' }}` で可視性を切り替える方式に変更すること。
2. **端子ノード (開始・終了) の二重ハイライト防止**:
   - `src/services/flowchartRenderer.tsx` の `isNodeActive` において、`node.type === 'terminal'`（または `node.label === '開始'` / `'終了'`）も `activeLine` による自動ハイライトの対象外とすること。
3. **すべてのテストスイートの 100% PASS 確認**:
   - 修正後、`npx vitest run` をフル実行し、自作攻撃テストを含めた全テストがエラーなく PASS することを確認すること。

---

## 5. Verification Method (検証方法)

以下のコマンドを実行して検証すること：

1. **型チェック**:
   `npx tsc --noEmit`
   - 型エラー 0 件であること。

2. **修正検証テスト実行**:
   `npx vitest run src/__tests__/challenger_m4_fix_2_attack.test.tsx`
   - 今回作成した再現テストを含む全ケースが PASS すること。

3. **全テストスイート実行**:
   `npx vitest run`
   - 全テストファイルが 100% PASS すること。
