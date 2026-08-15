# Handoff Report — Milestone 4 Review (AST Flowchart Generator & Renderer)

## 1. Observation (観察事実)

### 独立テスト・ビルド実行結果
1. `npx tsc --noEmit`
   - **結果**: PASS (終了コード 0、型エラー 0 件)。
2. `npx vitest run`
   - **結果**: FAIL (一部のテストスイートにてエラー発生)。
   - **エラー出力抜粋 1 (`src/__tests__/challenger_m4_2_deep.test.tsx`)**:
     ```
     × Challenger M4_2: Deep Logic & Code Quality Audits > Loop end node sharing lineRange with last loop statement causes simultaneous highlighting
       → Line 3 matches both print(i) and Loop End node: expected 2 to be 1

     × Challenger M4_2: Deep Logic & Code Quality Audits > Functions in M4 components/services should adhere to the ~50-line limit constraint
       → Found functions exceeding 60 lines: [{"file":"flowchartRenderer.tsx","functionName":"renderNodeShape","lineCount":153},{"file":"flowchartGenerator.ts","functionName":"generateFlowchartNodes","lineCount":89}]
     ```
   - **エラー出力抜粋 2 (`src/__tests__/challenger_m4_2_attack.test.tsx`)**:
     ```
     × Accessibility (WAI-ARIA & Screen Reader) Verification > LeftPanel tab controls should comply with WAI-ARIA tablist/tab pattern
       → LeftPanel tab container should have role="tablist": expected null not to be null
     × Accessibility (WAI-ARIA & Screen Reader) Verification > FlowchartViewer SVG and nodes should have accessibility attributes
       → SVG should have role="img": expected null to be 'img'
     ```

### コード検証結果
1. **JIS記号仕様の確認**:
   - 端子 (terminal): `<rect rx="22">` 角丸長方形
   - 処理 (process): `<rect rx="4">` 長方形
   - 判断 (decision): `<polygon>` ひし形
   - ループ (loop): `<polygon>` 六角形
   - サブルーチン (subroutine): 二重線長方形 (`<rect>` + 左右縦直線 `<line>`)
   - JIS / 標準記号の SVG レンダリング形状定義は要件通り実装されている。

2. **アクティブノードハイライト動作**:
   - `src/services/flowchartRenderer.tsx` の `isNodeActive()` は `activeLine` がノードの `lineRange` 内にあるかを判定。
   - しかし、`pythonTracer.ts` の `visit_For` / `visit_While` で生成される「ループ終了」ノードがループ最終行と同等の `lineRange` (`[el, el]`) を保持するため、ループ最終行の実行時にループ本文の処理ノードと「ループ終了」ノードが同時に青枠ハイライト（二重ハイライト）される問題が発生。

3. **コード品質（関数の行数制限）**:
   - `PROJECT.md` および `ORIGINAL_REQUEST.md` (R5, Quality) の「各関数・コンポーネントが概ね50行以内に収まっている」という品質要件に対して：
     - `src/services/flowchartRenderer.tsx` の `renderNodeShape` 関数: **153行** (大幅オーバー)
     - `src/services/flowchartGenerator.ts` の `generateFlowchartNodes` 関数: **89行** (オーバー)

## 2. Logic Chain (論理展開)

1. **仕様・品質要件との不一致**:
   - プロジェクト要件（PROJECT.md / ORIGINAL_REQUEST.md）では「全テストの合格」および「関数のモジュール化・50行以内の分割」が明確に規定されている。
2. **ダブルハイライト欠陥の発生**:
   - `pythonTracer.ts` において、`visit_For` / `visit_While` のループ終了ノードに付与される `lineRange` がループボディ最終行と重なっているため、ステップ実行時に本来1つであるべきアクティブノードが2つ同時にハイライト表示されてしまう。
3. **WAI-ARIA 属性の不足**:
   - タブUI (`LeftPanel.tsx`) および SVGコンテナ (`FlowchartViewer.tsx`, `flowchartRenderer.tsx`) にアクセシビリティ属性 (`role="tablist"`, `role="tab"`, `role="img"`, `aria-label`) が設定されていないため、アクセシビリティテストが失敗する。
4. **関数の長大化**:
   - `renderNodeShape` (153行) はノード種別ごとの個別の描画関数 (`renderTerminalNode`, `renderProcessNode`, `renderDecisionNode`, `renderLoopNode`, `renderSubroutineNode`) に分割すべきであり、`generateFlowchartNodes` (89行) もヘルパー関数へ抽出が必要である。

## 3. Caveats (注意事項・前提条件)

- Pyodide 本体のブラウザ上での非同期ロードおよび Worker 全体を通じた実機 E2E の動作確認は M5 / M_TEST テストスイートにて実施されるため、本レビューでは Vitest ユニット・統合テストおよび TypeScript 静的型チェックを主な独立検証手段としています。

## 4. Conclusion (判定結果)

**判定結果**: `REQUEST_CHANGES` (要修正)

### 必須修正項目 (Critical / Major Findings):
1. **`npx vitest run` の全件 PASS 化**:
   - `challenger_m4_2_deep.test.tsx` および `challenger_m4_2_attack.test.tsx` のテスト失敗を解消すること。
2. **ループ終了ノードの重複ハイライト防止**:
   - ループ終了ノードの `lineRange` または `isNodeActive` 判定を調整し、ステップ実行時に単一のアクティブノードのみがハイライト表示されるように改善すること。
3. **関数の50行以内分割・リファクタリング**:
   - `renderNodeShape` (153行) をノード形状ごとのサブ関数に分割すること。
   - `generateFlowchartNodes` (89行) をヘルパー関数に分割すること。
4. **WAI-ARIA アクセシビリティ属性の追加**:
   - `LeftPanel.tsx` のタブコンテナに `role="tablist"`, ボタンに `role="tab"`, `aria-selected`, `aria-controls` を追加すること。
   - `flowchartRenderer.tsx` の SVG に `role="img"` および `aria-label` を追加すること。

## 5. Verification Method (独立検証方法)

以下のコマンドを独立実行して検証を行ってください:
1. `npx tsc --noEmit`
   - エラー 0 件であることを確認。
2. `npx vitest run`
   - 全テストファイル（全 14 スイート）が 100% PASS することを確認。
