# TraceApp プロジェクト詳細調査・分析レポート (explorer_survey_1)

**調査日時**: 2026-08-13
**調査者**: Explorer Agent (explorer_survey_1)
**対象プロジェクト**: TraceApp (`c:\Git\TraceApp`)

---

## 1. 調査目的と概要

Project Orchestrator (gen3) からの指示に基づき、TraceApp プロジェクトの現在の状態を包括的に調査・分析しました。
本レポートは、Milestone 2の最終接続・検証ゲート通過および残りの Milestone（Milestone 3, Milestone 4, Milestone 5 / E2E Track）の円滑な進行計画を策定するための詳細エビデンスおよび現状の正確なマッピングを提供するものです。

---

## 2. 稼働プロセス調査（Node.js / Vite / 開発サーバー）

- **確認コマンド**: `powershell -Command "Get-Process node, vite -ErrorAction SilentlyContinue"` / `tasklist`
- **調査結果**: 現在実行中の `Node.js`、`Vite`、`esbuild` またはその他の開発サーバープロセスは **0件（存在しない）** です。
- **分析・評価**: 過去のセッションで発生した「20個以上の Node.js 並列プロセスが残存・衝突する問題」は完全にクリアされており、クリーンな状態で開発・テストを実行できる環境が確保されています。

---

## 3. プロジェクト設定と依存関係 (`package.json`)

### 3.1 依存パッケージ (dependencies)
- `react`: `^18.3.1`, `react-dom`: `^18.3.1`
- `monaco-editor`: `^0.50.0`, `@monaco-editor/react`: `^4.6.0` (Monaco Editor Web統合)
- `pyodide`: `^0.26.4` (WebAssembly Pythonランタイム)
- `lucide-react`: `^0.420.0` (アイコンUI部品)

### 3.2 開発依存パッケージ & スクリプト (devDependencies / scripts)
- **ビルド・型チェック**: `typescript` (`^5.5.4`), `vite` (`^5.4.1`), `@vitejs/plugin-react` (`^4.3.1`)
  - `npm run build`: `tsc && vite build`
  - `npm run typecheck`: `tsc --noEmit`
- **単体・統合テスト**: `vitest` (`^2.0.5`), `@testing-library/react` (`^16.0.0`), `jsdom` (`^24.1.1`)
  - `npm run test`: `vitest run`
- **E2Eテスト**: `playwright` (`^1.62.1`), `@playwright/test` (`^1.62.1`)
  - `npm run test:e2e`: `playwright test`

---

## 4. Milestone 別の実装状況および機能インベントリ分析

| Milestone | 名称 | 現状のステータス | 判定・根拠 |
|---|---|---|---|
| **Milestone 1** | Infrastructure & Basic Setup | **COMPLETED** (完了) | Vite+React+TS構成, 型定義, サンプルプリセット, UI骨格レイアウト作成完了 |
| **Milestone 2** | Web Worker Trace Engine | **IMPLEMENTED & GATE CLEAN** (実装完了・検証通過) | Pyodide Worker, `sys.settrace()`, 連打即時同期ガード(`pendingRequestRef`), 全単体テストPASS |
| **Milestone 3** | Code Editor & Navigation UI | **IN PROGRESS** (UI骨格・Mock状態) | UIコンポーネント配置済。`MonacoEditor.tsx`統合と `App.tsx` のWorker接続が残タスク |
| **Milestone 4** | AST Flowchart Generator & Renderer | **PLANNED** (スタブ表示) | `FlowchartViewer.tsx` スタブ配置済。AST解析器・SVG/Canvasレンダラー実装が未着手 |
| **Milestone 5** | E2E Verification & Hardening | **IN PROGRESS** (基盤修復済・E2E準備完了) | `playwright.config.ts` Vite接続修復済, DOM ID/data-testid付与完了。M3/M4完成後の全PASS検証 |

### 4.1 モジュール別詳細分析

#### (1) トレースエンジン層 (`src/worker/`, `src/hooks/`, `src/services/`)
- `src/worker/pyodideWorker.ts`, `src/worker/pythonTracer.ts`:
  Web Worker 上での Pyodide 初期化、`sys.settrace()` による全ステップ実行・`StepSnapshot[]` 収集、10,000ステップ上限ガード (`TraceLimitExceeded`)、NaN/Infinity/循環参照のサニタイズ処理が完全に実装されています。
- `src/hooks/useTraceEngine.ts`:
  メインスレッドと Pyodide Web Worker 間の通信プロトコル (`WorkerRequest` / `WorkerResponse`) を提供。`useRef` による `pendingRequestRef` を用いた同期ガードにより、連続連打時の重複送信・競合状態を即時に拒否拒絶する堅牢な実装となっています。単体テスト (`tracer.test.ts`, `tracerStress.test.ts`, `challenger_m2_deep_stress.test.ts`) は全件 PASS しており、Forensic Audit (`auditor_m2_2`) にて `CLEAN` 判定を獲得しています。
- `src/services/tracer.ts`:
  M1/UI初期開発用の同期型簡易 JS モックトレースエンジン。現時点の `App.tsx` からはこのモックが呼ばれています。

#### (2) UI コンポーネント層 (`src/components/`, `src/App.tsx`)
- `Header.tsx`: サンプル切り替えドロップダウン (`#preset-select`)、`.py` ファイル読込インプット (`#file-upload-input`)、ステータスバー (`#status-bar`) を備え、要件を満たしています。
- `StepNavigation.tsx`: 「トレース実行」(`btn-run`), 「前へ」(`btn-prev`), 「次へ」(`btn-next`), 「リセット」(`btn-reset`), 「最後」(`btn-last`) ボタンおよびステップスライダー (`step-slider`, range input) が実装され、各種 ID/data-testid も付与されています。
- `VariableTable.tsx`: 変数名を横軸、ステップを縦軸とするスプレッドシート型変数履歴表。変更セルの黄色ハイライト (`changedTdStyle`) およびカレントステップ行ハイライトが実装されています。
- `OutputConsole.tsx`: 累積 `print()` 出力の表示パネル (`console-output`)。
- `MonacoEditor.tsx` **【M3残作業】**: 現状は `textarea` による簡易テキストエディタとカスタム div による行ハイライトプレビューです。`@monaco-editor/react` (Monaco Editor) 本体の組み込み、および Monaco デコレーション API (`deltaDecorations`) による実行行ハイライトへの置換が必要です。
- `App.tsx` **【M3残作業】**: 現在 `services/tracer.ts` (同期モック) を呼び出しているため、これを `useTraceEngine` フックに置き換え、`isInitializing` (Pyodideロード中) のオーバーレイ表示・操作無効化と連携させる必要があります。

#### (3) 流れ図生成・描画層 (`src/services/`, `src/components/FlowchartViewer.tsx`) **【M4残作業】**
- `FlowchartViewer.tsx`: 現状はノード配列のテキストリストを表示するスタブコンポーネントです。
- 未実装項目:
  1. Pyodide / Python `ast` モジュールまたは TS AST 解析による Python → 流れ図ノード変換モジュール (`src/services/flowchartGenerator.ts`) の作成。
  2. 内部データ構造としての draw.io mxGraph XML 保持。
  3. SVG/Canvas によるカスタム描画モジュール (`src/services/flowchartRenderer.ts`) の作成（処理=長方形、判断=ひし形、ループ=六角形、関数=二重線長方形、端子=角丸長方形）。
  4. ステップ実行時の現在実行行に対応する流れ図ノードのリアルタイムハイライト。

---

## 5. テストスイートおよび品質確認

### 5.1 静的解析・型チェック
- **コマンド**: `npx tsc --noEmit`
- **結果**: **Exit Code 0 (型エラー 0件)**

### 5.2 単体・ストレステスト (`vitest`)
- **コマンド**: `npx vitest run`
- **結果**: **5ファイル / 35テストケース 全件 PASS (100% 成功)**
  - `src/__tests__/types.test.ts` (PASS)
  - `src/__tests__/samplePrograms.test.ts` (PASS)
  - `src/__tests__/tracer.test.ts` (PASS)
  - `src/__tests__/tracerStress.test.ts` (PASS)
  - `src/__tests__/challenger_m2_deep_stress.test.ts` (PASS)

### 5.3 E2E テストスイート状態 (`playwright`)
- **設定ファイル**: `playwright.config.ts`
  - `webServer.command`: `npm run dev -- --port 5173` （過去指摘のあった `node server.js` から修正・正常化済み）
- **テストケース**: `tests/e2e/tier1_features.spec.ts` ～ `tier4_realworld.spec.ts` (計30テストケース)
- **UIセレクター**: 各コンポーネントに `#btn-run`, `#btn-prev`, `#btn-next`, `#step-slider`, `#preset-select`, `#status-bar` 等の `data-testid` / `id` 属性が既に付与完了。

---

## 6. 残り Milestone の進行・ロードマップ推奨案

### 【Phase A: Milestone 2 最終ゲート通過 & M3 接続 (即時実行)】
1. `App.tsx` のトレース実行部を `services/tracer.ts` の同期モックから `useTraceEngine` フック接続に切り替え。
2. Pyodide 初期化中 (`isInitializing`) に画面上にローディング表示を出し、操作を無効化するプロテクションを実装。

### 【Phase B: Milestone 3 - Monaco Editor 統合 & UI洗練】
1. `MonacoEditor.tsx` に `@monaco-editor/react` を組み込み、Python シンタックスハイライトを有効化。
2. ステップ進行 (`activeLine`) に応じて Monaco Editor 上の該当行をデコレーションハイライト (`deltaDecorations`) する機能を実装。
3. `VariableTable.tsx` の変数変更列全体の表示ハイライト調整。

### 【Phase C: Milestone 4 - AST 流れ図生成器 & Custom Renderer】
1. `src/services/flowchartGenerator.ts` を作成し、Python AST から 順次/判断/繰り返し/関数のノード構造および mxGraph XML を生成。
2. `src/services/flowchartRenderer.ts` を作成し、SVG/Canvas で各種記号形状をレンダリング。
3. `FlowchartViewer.tsx` に統合し、ステップ進行時のノードアクティブハイライトおよび「コード/流れ図」タブ切り替えを完成。

### 【Phase D: Milestone 5 - E2E 全件PASS確認 & 逆境検証】
1. `npx playwright test` を実行し、Tiers 1-4 の全30ケースが PASS することを確認。
2. Tier 5 (白箱・逆境カバレッジ検証) を実施し、`TEST_READY.md` および最終勝利宣言を発行。

---
