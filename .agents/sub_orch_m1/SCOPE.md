# Scope: Milestone 1 — Infrastructure & Basic Project Setup

## Objective
Vite + React + TypeScript の開発環境構築、各種パッケージ導入、共通型定義、サンプルプログラム定義、および基本UIレイアウトフレームワークの実装と検証。

## Architecture & Code Layout
- `package.json`, `vite.config.ts`, `tsconfig.json`
- `src/types/trace.ts`, `src/types/flowchart.ts`, `src/types/worker.ts`
- `src/services/samplePrograms.ts`
- `src/components/Header.tsx`, `src/components/LeftPanel.tsx`, `src/components/RightPanel.tsx`
- `src/App.tsx`, `src/main.tsx`, `src/index.css`
- `vitest.config.ts`, `src/__tests__/samplePrograms.test.ts`

## Tasks & Deliverables
1. **プロジェクト基盤環境の初期構築**:
   - Vite + React + TypeScript 構成の設定（Vite 5+, React 18+, TypeScript 5+）。
   - 必要パッケージのインストール: `react`, `react-dom`, `@monaco-editor/react`, `monaco-editor`, `lucide-react` (UIアイコン用), `pyodide` (Web Worker内用)。
   - 開発・テストパッケージ: `typescript`, `vite`, `vitest`, `@testing-library/react`, `playwright`.
   - `tsconfig.json` の strict モード設定（`strict: true`, 型エラー0件必須）。

2. **型定義・共有インターフェースの実装**:
   - `PROJECT.md` のインターフェース契約に準拠した TypeScript 型定義ファイル作成:
     - `src/types/trace.ts`: `VariableSnapshot`, `StepSnapshot`, `TraceResult`
     - `src/types/flowchart.ts`: `FlowchartNode`, `FlowchartNodeType`
     - `src/types/worker.ts`: `WorkerRequest`, `WorkerResponse`

3. **サンプルプログラムモジュール実装**:
   - `src/services/samplePrograms.ts`:
     - サンプル1 (基本順次・代入): `x = 5; y = 3; total = x + y; print(total)`
     - サンプル2 (条件分岐): `score = 75; if score >= 80: grade = "A" ...`
     - サンプル3 (ループと関数): `def add(a, b): ... total = 0; for i in range(1, 4): total = add(total, i); print(total)`

4. **UI レイアウトフレームワーク構築**:
   - 2ペイン構造の初期コンポーネント（ライトモード教科書風デザイン）:
     - `Header.tsx`: タイトル、サンプルプログラム選択ドロップダウン
     - `LeftPanel.tsx`: 「コード」「流れ図」タブ表示枠
     - `RightPanel.tsx`: 変数履歴表エリア、print出力エリア枠
     - `App.tsx`: 全体レイアウト構成

5. **単体テスト・ビルド検証**:
   - `vitest` によるサンプルプログラムデータのテスト (`src/__tests__/samplePrograms.test.ts`)
   - `npm run build` がエラーなく成功し、`npx tsc --noEmit` で型エラーが 0 件であることを確認。

## Requirements & Quality Rules
- コードコメントはすべて**日本語**で記述。
- 各関数・コンポーネントは 30〜50 行以内に収める。
- JavaScript (.js/.jsx) ファイルは設定ファイル以外一切作成しない。
