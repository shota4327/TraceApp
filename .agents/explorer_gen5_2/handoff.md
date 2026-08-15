# M3 UI統合（変数履歴表・Monaco同期・ステップナビゲーション）調査報告書

## 1. Observation（観測事実）

### 1.1 `src/components/VariableTable.tsx` の観測
- **ファイル情報**: 146行。日本語コメント付与済み。
- **スプレッドシート型構造**（37〜75行目）:
  - 横軸に変数名（`allVarNames`）、縦軸に各ステップ行（`activeSnapshots`）を展開し、現在のステップ行（`isCurrent`）をアクティブ行としてハイライト（`#eff6ff`）。
- **変更セルのハイライト**（60〜68行目, 141〜145行目）:
  ```tsx
  const isChanged = s.changedVars.includes(name);
  return (
    <td
      key={name}
      style={isChanged ? changedTdStyle : tdStyle}
    >
      {val !== undefined ? String(val) : '-'}
    </td>
  );
  ```
  - `changedTdStyle`（背景色 `#fef08a`, 太字）が変更された個別セルにのみ適用されている。
- **列全体のハイライトの欠落**:
  - 要件R2（`ORIGINAL_REQUEST.md:46`）「変更セルとその列全体をハイライトする」およびAcceptance Criteria（`ORIGINAL_REQUEST.md:67`）「各ステップで変更された変数のセルと列がハイライト表示される」に対し、現在のステップで変更された変数（`activeSnapshot.changedVars`）の列ヘッダー（`<th>`）や同列セルに対する列単位のハイライトスタイル（クラス・背景色等）が実装されていない。
- **不要要素・互換ダミー**（77行目）:
  - `<div id="globals-table-body" data-testid="globals-table-body" style={{ display: 'none' }} />` が非表示ダミーとして配置されている。

### 1.2 `src/components/MonacoEditor.tsx` の観測
- **ファイル情報**: 253行。本体関数19〜157行（約138行）。日本語コメント付与済み。
- **Monaco 統合 & デコレーションハイライト**（36〜60行目, 105〜123行目）:
  - `@monaco-editor/react` を利用し、`language="python"` で Monaco を描画。
  - `applyLineHighlight` 内で `deltaDecorations` を実行し、`className: 'monaco-highlight-line'`, `glyphMarginClassName: 'monaco-highlight-glyph'` を適用（`src/index.css:36-43` でスタイル定義済み）。
  - 下部にテスト・フォールバック用の `code-viewer`（138〜154行目）を備え、`.code-line.active` クラスが付与される。
- **ファイルドロップ時の拡張子バリデーション欠落**（72〜86行目）:
  ```tsx
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result;
        if (typeof text === 'string') {
          onChange(text);
        }
      };
      reader.readAsText(file);
    }
  };
  ```
  - `file.name.endsWith('.py')` などの拡張子バリデーションがなく、非 `.py` ファイル（`.txt` や `.png` 等）も無条件で読み込んでしまう。

### 1.3 `src/components/StepNavigation.tsx` の観測
- **ファイル情報**: 160行。本体関数17〜106行（約90行）。日本語コメント付与済み。
- **ボタン構成・スライダー**（41〜104行目）:
  - `btn-run`（トレース実行）、`btn-prev`（前へ）、`btn-next`（次へ）、`btn-reset`（最初 / リセット）、`btn-last`（最後）が配置されている。
  - ステップスライダー `step-slider`（`<input type="range">`）および `step-counter` が完全実装され、境界値での無効化（`canPrev`, `canNext`, `isTracing`）も正しく制御されている。
- **属性整合性**:
  - リセットボタンの属性が `id="btn-reset"`, `data-testid="btn-first"` となっている（Playwright E2E では `btn-first` が参照されている）。

### 1.4 `src/components/LeftPanel.tsx`, `src/components/RightPanel.tsx`, `src/components/OutputConsole.tsx` の観測
- **LeftPanel.tsx**（155行）:
  - タブ切り替え（53〜76行目）: コード (`tab-code`) と 流れ図 (`tab-flowchart`) のトグル表示。`display: 'none'` による非表示切り替えにより、Monaco Editor および SVG/Canvas の DOM インスタンスとステートを保持。
  - 下部に `StepNavigation` を配置。
- **RightPanel.tsx**（52行）:
  - 上部 60% に `VariableTable`、下部 40% に `OutputConsole` を配置。
- **OutputConsole.tsx**（54行）:
  - `<pre id="console-output">` に `stdout`（累積出力）を表示。空時はプレースホルダーを表示。

### 1.5 `src/App.tsx` & `src/hooks/useTraceEngine.ts` の観測
- **App.tsx**（239行）:
  - ステート管理: `selectedSampleId`, `code`, `currentStep`, `snapshots`, `flowchartNodes`, `flowchartEdges`, `statusText` を保持。
  - 初期化完了時の初回自動トレース実行（67〜72行目）およびサンプル切り替え・ファイルアップロード時の自動トレース実行を管理。
  - `loading-overlay`（126〜139行目）により Pyodide 初期化中の操作を安全にブロック。
  - 現在ステップ `currentStep` に応じて `activeLine` と `stdout` を計算し各コンポーネントへ完全同期。
- **useTraceEngine.ts**（165行）:
  - Web Worker との通信（`postMessage`）、`INIT` および `RUN_TRACE` の Promise 制御、エラーハンドリング（`TraceLimitExceeded` や `SyntaxError` 等）が整備されている。

### 1.6 ビルドおよび型チェック結果の観測
- `npx tsc --noEmit` 実行結果:
  - `src/__tests__/challenger_m2_3_empirical.test.ts(145,13): error TS6133: 'printGradeNode' is declared but its value is never read.` （テストファイル内の未使用変数エラーが1件検出）
- `npx vitest run src/__tests__/m3_ui.test.tsx` 実行結果: 3 tests passed.
- `npx vitest run src/__tests__/challenger_m3_ui_boundary.test.tsx` 実行結果: 7 tests passed.

---

## 2. Logic Chain（論理チェーン）

1. **要件R2・Acceptance Criteriaとの照合（変数履歴表ハイライト）**:
   - 観測事実 1.1 より、`VariableTable.tsx` では個別セルへのハイライト（`isChanged ? changedTdStyle : tdStyle`）は存在するが、現在ステップで変更された変数の列全体（`<th>` やその列の背景色）に対するハイライト処理が存在しない。
   - したがって、要件R2「変更セルとその列全体をハイライトする」およびAcceptance Criteria「各ステップで変更された変数のセルと列がハイライト表示される」を完全に満たすためには、現在ステップで変更された変数列（`currentChangedVars`）を判定し、該当列の `<th>` および `<td>` に対して列ハイライト（例: 薄い黄色背景 `#fef9c3` や専用クラス）を付与する修正が必要である。

2. **要件R2との照合（Monaco Editor & ファイルドロップ）**:
   - 観測事実 1.2 より、`MonacoEditor.tsx` の `handleDrop` では `file.name.endsWith('.py')` 等の拡張子判定を行わずに `FileReader` で読み込んでいる。
   - ユーザーが `.txt` やその他の非 Python ファイルをドラッグ＆ドロップした場合に不正なファイル内容がエディタにセットされてしまうため、`.py` 拡張子チェックおよび不正時の安全な無視（または通知）を追加する必要がある。

3. **コーディング原則（50行ルール & 責務分離）との照合**:
   - 観測事実 1.1, 1.2, 1.3, 1.4, 1.5 より、以下のコンポーネントが概ね50行の目安を超過している:
     - `MonacoEditor.tsx`: 253行（本体約138行）
     - `App.tsx`: 239行（本体約160行）
     - `StepNavigation.tsx`: 160行（本体約90行）
     - `LeftPanel.tsx`: 155行（本体約87行）
     - `VariableTable.tsx`: 146行（本体約68行）
   - これらはインラインのスタイル定義オブジェクトを同一ファイル内に大量に保持していること、および複数責務（例: エディタ本体とテスト用ビューア、ボタン群とスライダー）が単一コンポーネントに混在していることに起因する。
   - 適切なサブコンポーネント化（例: `CodeViewer`, `StepSlider`, `NavButtons`, `VariableTableHeader`, `VariableTableRow`）およびスタイルの外部モジュール化を行うことで、責務を明確にしつつ50行ルールに適合させることが可能である。

4. **テスト・型整合性との照合**:
   - 観測事実 1.6 より、`src/__tests__/challenger_m2_3_empirical.test.ts` に TS6133 未使用変数エラーが存在するため、型チェック（`npm run build` / `tsc --noEmit`）を0エラーで通過させるために修正が必要である。

---

## 3. Caveats（留意事項）

1. **テストセレクタの互換性維持**:
   - `StepNavigation.tsx` のリセットボタンは `data-testid="btn-first"` と `id="btn-reset"` が併用されている。Playwright E2E テスト（`tier1_features.spec.ts`, `tier3_combinations.spec.ts` 等）で `btn-first` および `btn-reset` が参照されているため、既存の `id` / `data-testid` 属性を削除・変更せず維持（または両対応）する必要がある。
2. **Monaco Editor と E2E テスト（code-input / code-viewer）の共存**:
   - Monaco Editor は Headless ブラウザ環境で DOM 内部構造が複雑化するため、E2E テスト用に配置されているダミー入力エリア（`#code-input`）および行ハイライト確認用ビューア（`#code-viewer`）はテスト互換性のために必須である。リファクタリング時にもこれらの要素・属性を損なわないよう注意が必要である。
3. **並列プロセス制約**:
   - テスト実行時は `vitest.config.ts` の `fileParallelism: false`, `maxForks: 1` を厳守し、Vite / Vitest プロセスを乱立させないこと。

---

## 4. Conclusion（結論と推奨修正項目）

### 推奨修正項目一覧

| # | 対象ファイル | 修正分類 | 修正内容の詳細 |
|---|---|---|---|
| 1 | `src/components/VariableTable.tsx` | 機能補完 (R2) | 現在ステップの変更変数（`currentSnapshot.changedVars`）に含まれる列のヘッダー（`<th>`）および同列のセル（`<td>`）に列全体のハイライトスタイル（例: `#fefce8` 等）を付与する。 |
| 2 | `src/components/MonacoEditor.tsx` | バグ修正 & 防御 | `handleDrop` ハンドラーに `file.name.endsWith('.py')` の拡張子チェックを追加し、非 `.py` ファイルの不正読み込みを防止する。 |
| 3 | `src/components/MonacoEditor.tsx` | リファクタリング | `CodeViewer`（テスト・フォールバック用行ビューア）をサブコンポーネントまたは別ファイルへ抽出し、スタイル定義を分離して本体関数を50行以内に収める。 |
| 4 | `src/components/StepNavigation.tsx` | リファクタリング | `NavButtons`（ボタン群）と `StepSlider`（スライダー＆カウンター）にコンポーネント分割し、50行以内に収める。 |
| 5 | `src/components/LeftPanel.tsx` | リファクタリング | `TabBar`（コード/流れ図タブ）の分離とスタイル分離。 |
| 6 | `src/components/VariableTable.tsx` | リファクタリング | `VariableTableHeader`, `VariableTableRow` への分割とスタイル分離。 |
| 7 | `src/App.tsx` | リファクタリング | `LoadingOverlay` の分離、およびステップ進行処理の整理。 |
| 8 | `src/__tests__/challenger_m2_3_empirical.test.ts` | 型エラー解消 | 145行目の未使用変数 `printGradeNode` を削除または活用し、TS6133 エラーを解消する。 |

---

## 5. Verification Method（検証方法）

1. **型チェック検証**:
   ```bash
   npx tsc --noEmit
   ```
   - 期待結果: TS6133 等の型エラーが 0 件で正常終了すること。
2. **M3 UI ユニット＆境界値テスト検証**:
   ```bash
   npx vitest run src/__tests__/m3_ui.test.tsx
   npx vitest run src/__tests__/challenger_m3_ui_boundary.test.tsx
   ```
   - 期待結果: 全テストがエラーなく 100% Pass すること。
3. **ビルド検証**:
   ```bash
   npm run build
   ```
   - 期待結果: Vite ビルドがエラーなく成功し、`dist/` が生成されること。
4. **E2E テスト検証（Playwright）**:
   ```bash
   npx playwright test tests/e2e/tier1_features.spec.ts
   npx playwright test tests/e2e/tier2_boundary.spec.ts
   npx playwright test tests/e2e/tier3_combinations.spec.ts
   npx playwright test tests/e2e/tier4_realworld.spec.ts
   ```
   - 期待結果: Tiers 1〜4 の全シナリオ（初期化、サンプル切替、ステップナビゲーション、変数履歴表、Monaco同期、print出力）が正常に合格すること。
