# Handoff Report — Challenger M4 Fix 1 Verification

## 1. Observation (直接の観察事実)

### 検証コマンドおよび結果
1. **型チェック**:
   `npx tsc --noEmit`
   - 結果: エラー 0 件 (正常終了)。

2. **全ユニットテストスイート実行**:
   `npx vitest run`
   - 結果: 16 テストファイル中 **15 PASS / 1 FAIL** (全 128 ケース中 125 PASS, 3 FAIL)。

### 検出された具体的な失敗テストケースとエラーログ (抜粋)
`src/__tests__/challenger_m4_fix_2_attack.test.tsx`:

```text
 ❯ src/__tests__/challenger_m4_fix_2_attack.test.tsx (3 tests | 3 failed) 111ms
   × Challenger M4 Fix 2: Empirical Verification & Bug Reproduction > WAI-ARIA aria-controls & Tab Panel Coexistence > Both tab panels must coexist in DOM so aria-controls remains valid and Monaco state is preserved 101ms
     → Element #flowchart-viewer must exist in DOM: expected null not to be null
   × Challenger M4 Fix 2: Empirical Verification & Bug Reproduction > Terminal Node Simultaneous Double Highlighting Bug > activeLine = 1 must NOT highlight node-start ("開始") simultaneously with line 1 process node 6ms
     → activeLine 1 causes simultaneous active state on node-start and node-1: expected [ 'node-start', 'node-1' ] to deeply equal [ 'node-1' ]
   × Challenger M4 Fix 2: Empirical Verification & Bug Reproduction > Terminal Node Simultaneous Double Highlighting Bug > activeLine = lastLine must NOT highlight node-end ("終了") simultaneously with last line process node 2ms
     → activeLine 2 causes simultaneous active state on node-2 and node-end: expected [ 'node-2', 'node-end' ] to deeply equal [ 'node-2' ]
```

### ソースコードの該当箇所観察
1. **端子ノードの二重ハイライト問題 (`src/services/flowchartRenderer.tsx` L14-L36)**:
   ```typescript
   export function isNodeActive(
     node: FlowchartNode,
     activeLine?: number,
     activeNodeId?: string
   ): boolean {
     if (activeNodeId && node.id === activeNodeId) {
       return true;
     }
     // ループ終了ノードは activeLine のみによる自動ハイライトから除外（二重ハイライト防止）
     if (node.label === 'ループ終了' || node.label.includes('ループ終了')) {
       return false;
     }
     if (
       activeLine !== undefined &&
       node.lineRange &&
       node.lineRange[0] <= node.lineRange[1] &&
       activeLine >= node.lineRange[0] &&
       activeLine <= node.lineRange[1]
     ) {
       return true;
     }
     return false;
   }
   ```
   `flowchartGenerator.ts` 内で生成される端子ノード「開始」(`node-start`) は `lineRange: [1, 1]`、端子ノード「終了」(`node-end`) は `lineRange: [lastLine, lastLine]` が設定されています。
   `isNodeActive` において「ループ終了」ノードは除外処理されていますが、端子ノード (Terminal node: `開始`, `終了` または `type === 'terminal'`) に対する除外処理が存在しないため、`activeLine = 1` の時に 1 行目の処理ノードと「開始」ノードの両方が同時にアクティブ表示されます。同様に最終行実行時にも最終行の処理ノードと「終了」ノードが同時にアクティブ表示されます。

2. **WAI-ARIA `aria-controls` 先 DOM 非存在問題 (`src/components/LeftPanel.tsx` L74-L86)**:
   ```tsx
   <div style={contentStyle}>
     {activeTab === 'code' ? (
       <div id="panel-code" role="tabpanel" aria-labelledby="tab-code" style={{ height: '100%' }}>
         <MonacoEditor ... />
       </div>
     ) : (
       <FlowchartViewer nodes={memoizedNodes} activeLine={activeLine} code={code} />
     )}
   </div>
   ```
   `LeftPanel.tsx` のタブボタンには `aria-controls="panel-code"` および `aria-controls="flowchart-viewer"` が指定されていますが、三項演算子による条件付きレンダリングによって非アクティブなタブのコンポーネントが DOM からアンマウント（削除）されます。これにより、WAI-ARIA 規格で要求される `aria-controls` 参照先 ID の DOM 共存条件が崩れ、アクセシビリティテストおよびタブ切替時の Monaco エディタ状態保持に違反しています。

---

## 2. Logic Chain (論理展開)

1. **実証的テスト通過条件の不充足**:
   タスク要求事項「2. `npx vitest run` を実行し全テストスイートの通過を確認してください」に対し、`npx vitest run` 実行時に `src/__tests__/challenger_m4_fix_2_attack.test.tsx` の 3 ケースが失敗しました。
2. **仕様および品質基準との乖離**:
   - **端子ノードの二重ハイライト**: ループ終了ノードの二重ハイライト修正と同様に、端子ノード（開始・終了）も `activeLine` 単体による自動ハイライトから除外（または `activeNodeId` 一致時のみハイライト）する必要があります。現在の状態では、1 行目または最終行実行時に常に 2 つのノードが青枠強調されてしまいます。
   - **WAI-ARIA アクセシビリティ規定**: `aria-controls` 属性を設定している要素は、非表示時であっても `display: 'none'` 等により DOM 上に共存することが WAI-ARIA 1.2 仕様上必要です。条件付きレンダリング (`{activeTab === 'code' ? ... : ...}`) をスタイルの `display` 切り替えに変更することで解消可能です。

---

## 3. Caveats (注意事項)

- 静的コード行数制限（全関数 50 行以内）については、`flowchartRenderer.tsx`, `flowchartGenerator.ts`, `FlowchartViewer.tsx`, `LeftPanel.tsx` の全てで合格（0 件違反）を確認済みです。
- TypeScript 型チェック (`npx tsc --noEmit`) もエラー 0 件で正常終了しています。
- 残る不具合は上記の 2 課題（端子ノード二重ハイライト除外漏れ、`LeftPanel.tsx` の DOM 非アンマウント化）のみであり、これらを修正することで全テストが PASS します。

---

## 4. Conclusion (結論)

判定結果: **REQUEST_CHANGES**

M4 修正版に対して `npx vitest run` を実行した結果、`src/__tests__/challenger_m4_fix_2_attack.test.tsx` において 3 件のテスト失敗が発生しました。
「開始」「終了」端子ノードの `activeLine` 連動による二重ハイライト、および `LeftPanel.tsx` での `aria-controls` 参照先 DOM の消失バグの修正を要求します。

---

## 5. Verification Method (検証方法)

1. **TypeScript 型チェック**:
   `npx tsc --noEmit`
   - エラー 0 件で正常終了すること。

2. **全ユニットテスト実行**:
   `npx vitest run`
   - 全 16 テストファイル、全 128 テストケースが 100% PASS すること。

3. **個別の検証ポイント**:
   - `src/__tests__/challenger_m4_fix_2_attack.test.tsx` が PASS すること。
   - `isNodeActive` において `activeLine = 1` 時に `['node-1']` のみが返されること。
   - `LeftPanel.tsx` 内で `#panel-code` と `#flowchart-viewer` が同時に DOM 上に存在し、非アクティブ側が `display: none` となること。
