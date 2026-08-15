# Handoff Report — Reviewer 2 (Milestone 4: AST Flowchart)

## 1. Observation (直接の観察結果)

### 静的解析・ビルド・テスト結果
- **型チェック (`npx tsc --noEmit`)**:
  - エラー 0 件 (正常終了)。
- **基本ユニットテスト (`npx vitest run src/__tests__/flowchart.test.tsx`)**:
  - 1 ファイル / 7 テストケース全件 PASS。
- **ストレステスト (`src/__tests__/challenger_m4_stress.test.tsx`)**:
  - 13 テストケース全件 PASS (深層ネスト分岐・ループ・空入力・長ラベル切り詰め等)。
- **深層検証テスト (`src/__tests__/challenger_m4_2_deep.test.tsx` / `challenger_m4_2_attack.test.tsx`)**:
  - 関数行数上限違反、AST ノード ID 不一致、ループ終了ノード重複ハイライト、WAI-ARIA 属性不足が検出された。

### 構成ファイルの実態確認
1. `src/services/flowchartRenderer.tsx`:
   - `renderNodeShape` 関数が **153 行** (行 36〜188)。プロジェクト制約（概ね 50 行以内）の 3 倍超の長大関数。
   - `renderFlowchartSvg` 関数が **84 行** (行 193〜276)。
   - SVG ルート `<svg>` およびノード `<g>` に WAI-ARIA 属性 (`role="img"`, `aria-label`, `role="tablist"` 等) が未付与。
2. `src/services/flowchartGenerator.ts`:
   - `generateFlowchartNodes` 関数が **89 行** (行 38〜126)。
3. `src/worker/pythonTracer.ts`:
   - `generate_ast_flowchart` 関数が **127 行** (行 201〜327)。
   - `pythonTracer.ts` で生成される AST ノード ID は `"ast-node-1"`, `"ast-node-2"` と命名されるが、`PyodideTracer.trace_func` が各 `StepSnapshot` に設定する `astNodeId` は `"node-{line_no}"` (例: `"node-3"`) となっており、**IDの命名規則が不一致**。このため `isNodeActive` における `activeNodeId` によるノード特定ハイライトが機能しない。
   - `visit_For` および `visit_While` で追加される「ループ終了」ノードの `lineRange` が `[el, el]` (ループブロックの最終行) に設定されている。このため、ループ内の最終ステートメントが実行中の際、`isNodeActive(node, activeLine)` により**処理ノードとループ終了ノードの 2 つが同時にアクティブ表示**される。

---

## 2. Logic Chain (論理的推論チェーン)

1. **型安全性・動作確認**:
   `npx tsc --noEmit` および基本テスト `flowchart.test.tsx` は成功しており、TypeScript の型コンパイルや基盤 UI レンダリングは正常に動作している。不正なコード・ダミー実装・ハードコードされたテスト結果などの整合性違反は見られなかった。
2. **品質制約違反 (関数行数上限超過)**:
   要件 (R5) および PROJECT.md では「各関数・コンポーネントが概ね50行以内に収まっていること」が明確に規定されている。しかし `flowchartRenderer.tsx` の `renderNodeShape` (153行) は単一関数で 5 つの形状描画を switch 文で抱え込んでおり、モジュール分割が不十分である。
3. **ロジック不具合 (AST Node ID の不一致 & ダブルハイライト)**:
   `pythonTracer.ts` において、`StepSnapshot.astNodeId` と `FlowchartNode.id` の命名規則が異なっているため、Worker から返却された AST ノード ID を用いた高精度ハイライトが連動しない。また「ループ終了」ノードの `lineRange` がループ内最終行と被るため、最後の行実行時に2ノードが同時青枠強調される視覚的不具合が存在する。

---

## 3. Caveats (注意事項・前提条件)

- **開発サーバー起動の禁止**: 要件に従い開発サーバー (`npm run dev`) は起動せず、`tsc` および `vitest` の静的実行・テスト実行のみで検証を行いました。
- **整合性違反**: ソースコード内に意図的なダミー実装やテスト偽装コードは検出されませんでした。

---

## 4. Conclusion (判定結果: REQUEST_CHANGES)

M4 成果物の基盤構造および基本レンダリングは良好ですが、**関数行数制限違反 (153行)**、**Pyodide Worker と流れ図間の AST ノード ID 不一致**、および**ループ終了ノードの重複ハイライト**の修正が必要なため、**`REQUEST_CHANGES`** と判定します。

### 必要な修正内容
1. **`flowchartRenderer.tsx` のリファクタリング (Critical)**:
   - `renderNodeShape` を各形状用小関数 (`renderTerminalNode`, `renderProcessNode`, `renderDecisionNode`, `renderLoopNode`, `renderSubroutineNode`) に分割し、すべて 30〜40 行以内に収める。
2. **`pythonTracer.ts` の ID 命名統一 & ループ終了ノードハイライト調整 (Major)**:
   - `pythonTracer.ts` の `astNodeId` 生成規則を `FlowchartNode.id` と一致させる（または `lineRange` 優先の動作を整理する）。
   - ループ終了ノードの `lineRange` またはアクティブ判定条件を調整し、ループ内最終行と同時ハイライトされないようにする。
3. **WAI-ARIA 属性の強化 (Minor)**:
   - `LeftPanel.tsx` のタブボタン群に `role="tablist"`, `role="tab"`, `aria-selected` を付与。
   - `FlowchartViewer.tsx` / `flowchartRenderer.tsx` の SVG およびノードに `role="img"`, `aria-label` を付与。

---

## 5. Verification Method (独立検証方法)

1. **型チェック**: `npx tsc --noEmit`
2. **全ユニットテスト実行**: `npx vitest run`
3. **M4 テストスイート単体実行**: `npx vitest run src/__tests__/flowchart.test.tsx`
4. **M4 挑戦・深層テスト実行**: `npx vitest run src/__tests__/challenger_m4_2_deep.test.tsx`
