# Original User Request

## Initial Request — 2026-08-13T21:07:52+09:00

プログラミング教育用のPythonトレース可視化Webアプリ「TraceApp」の本実装（Phase 2〜4）の**続行**。過去複数回クォータ制限で停止したため、途中から再開する。

## ❗ 重要な運用制約

**並列プロセスの制限**: 過去の実行時に、Node.jsの開発サーバー（`npm run dev`や`npx vite`等）が20個程度並列で立ち上がる問題が発生した。以下のルールを厳守すること:
- **開発サーバー（`npm run dev`、`npx vite`、`node server.js`等）は同時に1つだけ起動すること。**新しいサーバーを起動する前に、既存のサーバーを必ず停止すること。
- **ビルドコマンド（`npm run build`）も同時に複数実行しないこと。**
- テストやビルドを行う際は、先に既存のプロセスを確認し、不要なプロセスがないことを確認してから実行すること。
- 並列でサブエージェントが作業する場合も、同じポートを使うサーバーを複数起動しないこと。

## 前回チームが作成済みのファイル

以下のファイルが既にワークスペースに存在する。これらを確認し、必要に応じて修正・完成させること:

- `vite.config.ts`, `tsconfig.json`, `package.json` - プロジェクト設定
- `src/types/` - trace.ts, flowchart.ts, worker.ts, index.ts（型定義）
- `src/components/` - App.tsx, Header.tsx, LeftPanel.tsx, RightPanel.tsx, MonacoEditor.tsx, FlowchartViewer.tsx, StepNavigation.tsx, VariableTable.tsx, OutputConsole.tsx
- `src/services/` - samplePrograms.ts, tracer.ts, **flowchartGenerator.ts**, **flowchartRenderer.tsx**（流れ図関連）
- `src/worker/` - pyodideWorker.ts, pythonTracer.ts（Web Worker関連）
- `src/hooks/` - useTraceEngine.ts
- `src/main.tsx`, `src/index.css`, `index.html`
- `tests/` - Playwrightテスト

**重要**: Milestone 1（UI骨格）とMilestone 2（Web Worker + トレースエンジン）の多くのファイルが存在するが、完成度は不明。流れ図関連（flowchartGenerator.ts, flowchartRenderer.tsx）も作成済み。既存コードの状態を確認し、動作するものは活用し、不完全なものは修正して完成させること。

Working directory: c:\Git\TraceApp
Integrity mode: demo

参照資料:
- 基本設計書: c:\Users\kneko\.gemini\antigravity\brain\41ba1623-f522-4512-aa3a-57276ce39e11\basic_design.md
- Phase 1 PoCコード: c:\Git\TraceAppのルートにある古いindex.html（PoC時のもの。トレーサーのPythonコードやエッジケース対策を流用してよい）
- Phase 1 PoC検証レポート: c:\Git\TraceApp\poc_report.md

## Requirements

### R1. トレース実行エンジン（Web Worker + Pyodide）

Pyodide（WebAssembly版Python）を**Web Worker上**で実行し、メインスレッド（UI）をブロックしないトレースエンジンを構築する。メインスレッドとWeb Worker間は`postMessage`で非同期通信する。プログラム全体を`sys.settrace()`付きで事前に一括実行し、各ステップの状態（実行行番号、全変数のスナップショット、print出力）を配列として保持する。対応する変数のデータ型は基本型（int, float, str, bool）のみ。ステップ数の上限を設け、無限ループを防止する（`TraceLimitExceeded(BaseException)`パターンをPoCから流用）。NaN/Infinity/循環参照のエッジケース対策もPoCから引き継ぐ。変数は原則グローバルとして扱い、関数内実行時のみローカル変数として区別する。

### R2. 2ペイン画面構成とステップナビゲーション

左パネルに「コード」と「流れ図」のタブ切り替え、右パネル上部に変数履歴表、下部にprint出力エリアを配置する。左パネル下部に「前へ」「次へ」「リセット」ボタンと、**ステップスライダー**（Range Input）を配置する。スライダーは全ステップ中の現在位置を視覚的に表示し、ドラッグで任意のステップにジャンプできる。自動再生機能は不要。コードエディタには**Monaco Editor**を使用し、Pythonのシンタックスハイライトと実行行のデコレーションハイライトを実装する。エディタでの直接入力と.pyファイルのアップロードの両方に対応する。変数履歴表はスプレッドシート型（変数名を横、値の変化を縦）とし、変更セルとその列全体をハイライトする。

### R3. Python → 流れ図変換と表示

Pyodide上のPython `ast`モジュールでASTを解析し、順次（代入・print等）・判断（if/elif/else）・繰り返し（while/for）・関数定義/呼び出しの流れ図データを生成する。流れ図はSVG/Canvasで独自レンダリングし、ステップ実行時に現在実行中のノードをハイライト表示する。使用する記号と形状: 処理=長方形、判断=ひし形、ループ開始/終了=六角形（角が取れた長方形）、サブルーチン/関数呼び出し=二重線長方形、端子=角丸長方形。内部データはdraw.ioのmxGraph XML形式で保持する。クラスやインターフェースは対象外。

### R4. サンプルプログラムと初期体験

起動時にサンプルプログラム（最侎3種類）をプリセットとして初期表示し、ユーザーが即座にトレースを体験できるようにする。ドロップダウンでサンプルを切り替え可能。

### R5. 技術スタックとコーディング原則

Vite + React + TypeScriptで構築する（JavaScriptは使用しない）。ライトモード基調の明るく教科書的なデザインとする。各関数は1つの責務に集中させ、30〜50行以内を目安に適度に分割する。コード内のコメントはすべて日本語で記述する。

## Acceptance Criteria

### トレース実行
- [ ] サンプルプログラム（最侎3種類）で「次へ」ボタンを押すとステップが進み、Monaco Editor上の対応行がハイライトされる
- [ ] 「前へ」ボタンで前のステップに戻り、変数履歴表の表示も正しく戻る
- [ ] 「リセット」ボタンでトレース状態が初期化され、コード編集状態に戻る
- [ ] ステップスライダーのドラッグで任意のステップにジャンプでき、表示が正しく更新される
- [ ] 各ステップで変更された変数のセルと列がハイライト表示される
- [ ] print()の出力が右パネル下部にステップ進行に応じて表示される
- [ ] Pyodideの初期化中はローディング表示が出て、完了後に操作可能になる

### Web Worker
- [ ] Pyodideの初期化と実行がWeb Worker上で行われ、UI操作がブロックされない
- [ ] Worker内でのトレース実行結果がメインスレッドに正しく返却される

### 流れ図
- [ ] Pythonコードから流れ図が自動生成され、表示される
- [ ] if文はひし形、ループは六角形、関数は二重線長方形で正しく描画される
- [ ] ステップ実行時に流れ図の対応ノードがハイライトされる
- [ ] コードタブと流れ図タブの切り替えが正常に動作する

### コード入力
- [ ] Monaco EditorでPythonコードを入力・編集できる
- [ ] .pyファイルをアップロードしてコードを読み込める
- [ ] ドロップダウンからサンプルプログラムを選択して切り替えられる

### 品質
- [ ] `npm run build`がエラーなく成功する
- [ ] TypeScriptの型エラーが0件である
- [ ] 各関数・コンポーネントが概ね50行以内に収まっている

### 検証用テストプログラム

以下の3つのPythonプログラムで正常にトレースが動作することを確認する:

**テスト1: 基本的な順次・代入**
```python
x = 5
y = 3
total = x + y
print(total)
```

**テスト2: 条件分岐**
```python
score = 75
if score >= 80:
    grade = "A"
elif score >= 60:
    grade = "B"
else:
    grade = "C"
print(grade)
```

**テスト3: ループと関数**
```python
def add(a, b):
    result = a + b
    return result

total = 0
for i in range(1, 4):
    total = add(total, i)
print(total)
```

## Follow-up — 2026-08-14T11:41:09Z

プログラミング教育用のPythonトレース可視化Webアプリ「TraceApp」の本実装（Phase 2〜4）の**続行**。過去複数回クォータ制限で停止したため、途中から再開する。

## ❗ 重要な運用制約

**並列プロセスの制限**: 過去の実行時に、Node.jsの開発サーバー（`npm run dev`や`npx vite`等）が20個程度並列で立ち上がる問題が発生した。以下のルールを厳守すること:
- **開発サーバー（`npm run dev`、`npx vite`、`node server.js`等）は同時に1つだけ起動すること。**新しいサーバーを起動する前に、既存のサーバーを必ず停止すること。
- **ビルドコマンド（`npm run build`）も同時に複数実行しないこと。**
- **`npx vitest run`の並列実行問題は修正済み**: `vitest.config.ts` に `fileParallelism: false` および `maxForks: 1` が設定済み。この設定を変更しないこと。
- 並列でサブエージェントが作業する場合も、同じポートを使うサーバーを複数起動しないこと。

## 前回チームの進捗状況

前回のチームは以下まで完了している:
- **M0 (既存コード全件調査)**: 完了
- **M1 (Web Worker + Pyodide トレースエンジン)**: 完了・検証合格
- **M2 (Python → 流れ図変換・描画)**: 実装完了、コードレビュー修正中（単一if文のFalseエッジ追加、TS型警告修正）で停止
- **M3 (UI統合)**: 未着手（変数履歴表ハイライト・Monaco同期）
- **M4 (最終検証)**: 未着手（Playwright / Vitest）

## 作成済みのファイル

以下のファイルが既にワークスペースに存在する:

- `vite.config.ts`, `tsconfig.json`, `package.json` - プロジェクト設定
- `vitest.config.ts` - テスト設定（並列実行制御済み）
- `src/types/` - trace.ts (1.9KB), flowchart.ts (1.8KB), worker.ts, index.ts
- `src/components/` - App.tsx (7.0KB), Header.tsx (4.4KB), LeftPanel.tsx (4.2KB), RightPanel.tsx, MonacoEditor.tsx (7.0KB), FlowchartViewer.tsx (2.9KB), StepNavigation.tsx (3.8KB), VariableTable.tsx (4.1KB), OutputConsole.tsx
- `src/services/` - samplePrograms.ts, tracer.ts (14KB), **flowchartGenerator.ts (10.2KB)**, **flowchartRenderer.tsx (14.8KB)**
- `src/worker/` - pyodideWorker.ts (3.4KB), **pythonTracer.ts (21.7KB)**
- `src/hooks/` - useTraceEngine.ts (5.5KB)
- `src/__tests__/` - 22個のテストファイル
既存コードを確認し、M2のコードレビュー修正から再開し、M3・M4を完成させること。

## Follow-up — 2026-08-14T11:59:20Z

引き続き作業を続行してください。前回の進捗報告ではExplorerによるM2/M3/M4の現状精査が進行中でした。

追加の注意事項:
- `vitest.config.ts` がユーザーの指示により元の状態に戻されました（並列実行制御の設定が削除されました）。チーム側で `vitest.config.ts` に並列実行制御を追加する必要がある場合は、改めて追加してください。
- 引き続き、開発サーバー・ビルドコマンドの並列起動制限を厳守してください。

現在のオーケストレーターおよびサブエージェントの作業状況を報告し、実装を進めてください。
