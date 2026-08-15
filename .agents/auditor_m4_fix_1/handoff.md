# Forensic Audit Report — Milestone 4 Fix (AST Flowchart Re-Audit)

**Work Product**: TraceApp M4 修正版 (AST解析・draw.io XML生成・SVGレンダラー・FlowchartViewer・LeftPanelコンポーネント)  
**Profile**: General Project (Demo Mode)  
**Verdict**: **INTEGRITY VIOLATION**

---

## 1. Observation (直接の観察事実)

### Phase 1: ソースコード静的解析 (Source Code Analysis)
Worker M4 Fix の修正内容を検証しました：
- `src/services/flowchartRenderer.tsx`: `renderNodeShape` や `renderFlowchartSvg` の関数分割、WAI-ARIA 属性 (`role="img"`, `role="graphics-symbol"`) の付与。
- `src/services/flowchartGenerator.ts`: `generateFlowchartNodes` の関数分割（50行以内化）。
- `src/components/LeftPanel.tsx`: `role="tablist"`, `role="tab"` 属性の追加。

**解析結果**:
- ソースコード上の意図的な偽装・手抜き・ハードコードされたテスト通過処理（Facade 実装等）は**検出されませんでした**。
- しかし、コンポーネント構造とハイライト判定ロジックに以下の欠陥が検出されました：
  1. `LeftPanel.tsx` (75-85行目): `{activeTab === 'code' ? (...) : (<FlowchartViewer ... />)}` による条件演算子レンダリングのため、`code` タブ選択時に `#flowchart-viewer` (`aria-controls` の対象 ID) が DOM から消滅し、WAI-ARIA 仕様違反が発生。
  2. `flowchartRenderer.tsx`: `isNodeActive()` において `label === 'ループ終了'` のみを除外しており、`type === 'terminal'`（「開始」「終了」ノード）を除外していないため、1行目および最終行の実行時に端子ノードと処理ノードが同時に強調表示される二重ハイライトバグが残存。

---

### Phase 2: 動作検証 (Behavioral Verification)

1. **型チェック & ビルド (`npm run build`)**:
   - 実行結果: **FAIL** (終了コード 1)
   - エラー詳細: `src/__tests__/challenger_m4_fix_2_attack.test.tsx` において未使用インポートの型エラー (`TS6133`) が検出され、ビルドが失敗しました。
     ```text
     src/__tests__/challenger_m4_fix_2_attack.test.tsx(2,18): error TS6133: 'fireEvent' is declared but its value is never read.
     ```

2. **単体テスト (`npx vitest run`)**:
   - 実行結果: **FAIL** (3 件のテスト失敗)
   - `src/__tests__/challenger_m4_fix_2_attack.test.tsx` にて以下の 3 件が FAIL：
     - **WAI-ARIA & DOM 共存テスト**: `Both tab panels must coexist in DOM so aria-controls remains valid and Monaco state is preserved`
       - エラー: `AssertionError: Element #flowchart-viewer must exist in DOM: expected null not to be null`
     - **「開始」端子ノード二重ハイライト**: `activeLine = 1 must NOT highlight node-start ("開始") simultaneously with line 1 process node`
       - エラー: `AssertionError: activeLine 1 causes simultaneous active state on node-start and node-1: expected [ 'node-start', 'node-1' ] to deeply equal [ 'node-1' ]`
     - **「終了」端子ノード二重ハイライト**: `activeLine = lastLine must NOT highlight node-end ("終了") simultaneously with last line process node`
       - エラー: `AssertionError: activeLine 2 causes simultaneous active state on node-2 and node-end: expected [ 'node-2', 'node-end' ] to deeply equal [ 'node-2' ]`

---

## 2. Logic Chain (論理展開)

1. `PROJECT.md` および `ORIGINAL_REQUEST.md` (Quality / Acceptance Criteria) に従い、全自動テストの PASS、プロダクションビルドの成功、およびアクセシビリティ・動作の完全性が要求されています。
2. `npm run build` が型エラー `TS6133` により失敗することを確認しました。
3. `npx vitest run` を実行した結果、`challenger_m4_fix_2_attack.test.tsx` 内の 3 件のテストが不合格であることを実証的に確認しました。
   - `LeftPanel.tsx` での非選択タブの DOM アンマウントによる WAI-ARIA `aria-controls` 破壊。
   - `flowchartRenderer.tsx` の `isNodeActive` における端子ノード（「開始」「終了」）の二重ハイライトバグ。
4. Integrity Forensics 規則に従い、型チェック・ビルド・テストのいずれか 1 件でも失敗した場合は **INTEGRITY VIOLATION** として判定し、成果物を Reject しなければなりません。

---

## 3. Caveats (注意事項)

- Auditor は Audit-only の原則に従い、プロダクションコードおよびテストコードの直接修正を行っていません。
- 開発サーバー (`npm run dev`) は指定の制約に従い一切起動していません。

---

## 4. Conclusion (結論)

**Verdict**: **INTEGRITY VIOLATION**

型チェックおよびプロダクションビルド (`npm run build`) の失敗 (`TS6133`)、ならびに単体テストスイートにおける 3 件の失敗（WAI-ARIA `aria-controls` 対象 DOM 非存在違反、および「開始」「終了」端子ノードの二重ハイライトバグ）が独立検証によって確認されたため、本修正成果物を Reject します。

---

## 5. Verification Method (検証方法)

以下のコマンドを実行することで、指摘事項を独立して再現・検証できます：

1. **型チェックおよびビルド検証**:
   ```powershell
   npm run build
   ```
   - `src/__tests__/challenger_m4_fix_2_attack.test.tsx(2,18): error TS6133` によりビルドが失敗することを確認。

2. **失敗テストの単体検証**:
   ```powershell
   npx vitest run src/__tests__/challenger_m4_fix_2_attack.test.tsx
   ```
   - 3 件のテストケースが FAIL することを確認。
