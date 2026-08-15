# TraceApp UI・コンポーネント詳細解析レポート (`analysis.md`)

**作成者**: Explorer (explorer_m0_3)  
**作成日時**: 2026-08-13  
**対象リポジトリ**: `c:\Git\TraceApp`  
**検証範囲**: 2ペインUI, Monaco Editor, ステップナビゲーション, 変数履歴表, サンプルプログラム, CSS/デザイン, TypeScript/ビルド設定  

---

## 1. 総合評価サマリー

| 調査項目 | 実装度 | 主な発見・評価 |
|---|---|---|
| 1. 2ペイン画面構成・タブ切替 | 100% (完全) | `App.tsx`, `LeftPanel.tsx`, `RightPanel.tsx` による50%:50%レイアウトとWAI-ARIA準拠の「コード/流れ図」タブ切替が完璧に実装されている。 |
| 2. Monaco Editor & 行ハイライト | 95% (高) | `@monaco-editor/react` によるPythonシンタックスハイライト、コード編集、`deltaDecorations`による実行行ハイライト、スクロール追従が実装済み。E2E用プレビューも併設。 |
| 3. .pyファイルアップロード | 100% (完全) | Headerからのファイル選択ダイアログとMonacoEditor領域でのDrag & Dropの双方に完全対応。 |
| 4. ステップナビゲーション | 100% (完全) | 「トレース実行」「前へ」「次へ」「最初/リセット」「最後」ボタンとRange Input（スライダー）の双方向動的連動が完了している。 |
| 5. 変数履歴表 (Variable Table) | 85% (概ね良好) | 横軸:変数名、縦軸:ステップ履歴のスプレッドシート形式、変更セルの黄ハイライト(`fef08a`)、未定義「-」表示に対応。ただし「列全体ハイライト」および「globals/localsの明示的スコープ色分け」に一部拡張の余地あり。 |
| 6. print出力コンソール | 100% (完全) | `stdoutCumulative` と連携し、ステップ進行に合わせた時系列の累積print出力をダークテーマコンソールに表示。 |
| 7. プリセットサンプルプログラム | 100% (完全) | 要求された3種（順次・分岐・ループ関数）+ 1種（printテスト）の計4種がドロップダウンから切替可能。 |
| 8. UIデザイン・CSS | 100% (完全) | ライトモード基調の明るく教科書的なUIデザイン（`:root`変数活用）が統一的に適用されている。 |
| 9. TypeScript・品質・環境 | 95% (高) | 各関数は30〜50行以内。アプリ本体の型エラー0件。`typecheck`でテスト用ファイルに1件の未使用import警告があるのみ。 |

---

## 2. 項目別詳細解析

### 2.1 2ペイン画面構成と左右パネル・タブ切替の実装度
- **構造**: `App.tsx` の `<main>` 直下で `<LeftPanel>` (flex: 1) と `<RightPanel>` (flex: 1) を左右均等に配置。`100vh` & `overflow: hidden` で画面崩れを防止。
- **左パネル (`LeftPanel.tsx`)**:
  - `activeTab` (`'code' | 'flowchart'`) による表示制御。
  - WAI-ARIA 属性 (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`) を適用。
  - 切り替え時も Monaco Editor や FlowchartViewer の状態を保持するため `display: activeTab === 'code' ? 'block' : 'none'` によるDOM保持トグル方式を採用。
- **右パネル (`RightPanel.tsx`)**:
  - 上部60% (`flex: '0 0 60%'`) に `VariableTable`、下部40% (`flex: '0 0 40%'`) に `OutputConsole` を配置。

### 2.2 Monaco Editor のPythonシンタックスハイライト・編集・デコレーションハイライト
- **エディタ基盤**: `@monaco-editor/react` (v4.6.0) および `monaco-editor` (v0.50.0) を使用。
- **言語設定・テーマ**: `language="python"`, `theme="vs"` (ライトモード) を指定。
- **実行行デコレーション**:
  - `applyLineHighlight` 関数内で `editorRef.current.deltaDecorations()` を呼び出し、実行行に対して `monaco-highlight-line` (背景 `#fef08a`) 及び `monaco-highlight-glyph` を動的付与。
  - `editorRef.current.revealLineInCenterIfOutsideViewport(line)` により実行行への自動センタリング・スクロールが機能。
- **フォールバック & E2Eロバスト性**:
  - Monaco Editor が読み込まれるまでのローディング表示を完備。
  - E2Eテスト自動化を支援する `<textarea id="code-input">` と `<div id="code-viewer">` を提供。

### 2.3 .pyファイルアップロード機能の実装度
- **ヘッダーアップロード (`Header.tsx`)**:
  - `.py` 拡張子フィルター付きの隠し `<input type="file" accept=".py">` とスタイリングされた `<label>` を設置。
  - `FileReader.readAsText(file)` でファイルを即座に読み込み、`onFileUpload` から `App.tsx` の `code` state を更新。
- **ドラッグ＆ドロップ (`MonacoEditor.tsx`)**:
  - Monaco Editor コンテナで `onDragOver` と `onDrop` をキャプチャし、ドラッグされた `.py` ファイルを自動抽出・反映。

### 2.4 ステップナビゲーション（ボタン群 + Range Input スライダー）
- **コンポーネント**: `StepNavigation.tsx`
- **ボタン機能**:
  - `トレース実行` (`#btn-run`): Pythonコード全体をPyodideで事前一括解析。
  - `前へ` (`#btn-prev`): `currentStep > 0` で活性化。
  - `次へ` (`#btn-next`): `currentStep < maxStep` で活性化。
  - `最初 / リセット` (`#btn-reset`): ステップ 0 に即時復帰。
  - `最後` (`#btn-last`): 最終ステップ (`totalSteps - 1`) へジャンプ。
- **ステップスライダー (Range Input)**:
  - `<input id="step-slider" type="range" min={0} max={maxStep} value={currentStep} onChange={...}>`
  - ドラッグ操作および入力値変更で即座に任意のステップへジャンプ可能。
  - `ステップ X / Y` (1-indexed 表示) のラベルインジケータを配置。

### 2.5 スプレッドシート型変数履歴表
- **コンポーネント**: `VariableTable.tsx`
- **構成**:
  - 横軸: `Step`, `Line`, および過去〜現在のすべてのステップから収集されたユニーク変数名集合 `allVarNames`。
  - 縦軸: `activeSnapshots` (ステップ 0 から現在の `currentStepIndex` までのステップ行)。
- **変更セルハイライト**:
  - 当該ステップで値が変化した変数名が `s.changedVars` に含まれる場合、背景色 `#fef08a` (`changedTdStyle`) で強調。
- **未定義表示**:
  - ステップ時点で未定義の変数は「`-`」を表示。
- **課題・留意点**:
  - 「列全体のハイライト」: 現在セル単位でのハイライトが適用されている。変更があった列のヘッダーや列全体の色付けは未拡張。
  - 「globals/locals のスコープ色分け」: 現在 `s.locals[name] ?? s.globals[name]` として1つのセルで表示されているため、グローバル領域とローカル領域の視覚的区別（背景バッジや文字色変更）を追加すると更に完成度が高まる。

### 2.6 print出力コンソールの時系列追加表示
- **コンポーネント**: `OutputConsole.tsx`
- **表示**:
  - `<pre id="console-output">` 内にダーク背景 (`#0f172a`, 文字色 `#f8fafc`) のターミナル風スタイル。
  - `activeSnapshot.stdoutCumulative` から累積文字を取得し、ステップ進行に追従して出力が順次追加・展開される。

### 2.7 プリセットサンプルプログラム
- **定義**: `src/services/samplePrograms.ts`
  1. `seq`: 基本的な順次・代入 (`x = 5`, `y = 3`, `total = x + y`, `print(total)`)
  2. `branch`: 条件分岐 (`score = 75`, `if score >= 80:` ...)
  3. `loop`: ループ関数 (`def add(a, b):` ..., `for i in range(1, 4):` ...)
  4. `print`: print 出力テスト (`print("Hello TraceApp!")` ...)
- **動作**:
  - Header の `<select id="preset-select">` から変更すると `App.tsx` の state が更新され、新コードでのトレースが即座に起動する。

### 2.8 ライトモード基調のUIデザイン・CSS
- **定義**: `src/index.css`
  - `--bg-main: #f8fafc`, `--bg-panel: #ffffff`, `--border-color: #e2e8f0`, `--primary-color: #2563eb`, `--text-main: #1e293b` 等の教科書風テーマ変数を定義。
- **視覚的印象**:
  - 学習者が親しみやすい明るく清潔感のあるUI。
  - Monaco Editor のライトテーマ (`vs`) と変数履歴表のすっきりした罫線デザインが統一されている。

### 2.9 TypeScript型安全性、関数行数、ビルド・テスト環境
- **型安全性**:
  - `tsconfig.json` で `strict: true` を設定。
  - `npm run typecheck` 実行結果: アプリ本編コードには型エラー0件。`src/__tests__/challenger_m4_gate1_adversarial.test.tsx` の 1 行目に `TS6133: 'React' is declared but its value is never read.` の軽微な未使用import警告のみ。
- **関数行数の遵守度**:
  - 全コンポーネント内の関数ハンドラー (`handleSelectSample`, `handleFileUpload`, `applyLineHighlight` 等) はすべて15行以内。
  - 単一責任の原則が徹底されている。
- **ビルド・テスト**:
  - `vite.config.ts` でパスエイリアス `@/` および Web Worker 用 `format: 'es'` を設定。
  - `package.json` に Vitest 及び Playwright テストスクリプトが整備されている。

---

## 3. 次ステップへの改善推奨事項 (Implemenation Advisor Note)

1. **`src/__tests__/challenger_m4_gate1_adversarial.test.tsx` の警告解消**:
   - `import React from 'react';` を削除して `typecheck` を完全にクリーン化 (エラー 0件) にする。
2. **`VariableTable.tsx` の装飾拡張 (任意)**:
   - 変更された変数の列全体（ヘッダー含む）への薄い背景色の付与。
   - `globals` と `locals` の区別を示す小さなバッジ（例: `[G]`, `[L]`）またはセルテキスト色の差分追加。
