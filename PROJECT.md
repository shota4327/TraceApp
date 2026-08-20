# PROJECT — TraceApp (PyTrace)

## Architecture
- **フロントエンド UI**: Vite + React 18 + TypeScript, Monaco Editor, Lucide Icons, Vanilla CSS
- **トレースエンジン**: Pyodide (WebAssembly Python) running in main thread (単一 HTML・オフライン完全対応, 直接インメモリ実行)
- **データフロー**:
  1. ユーザーがコードを入力／ファイル読込／サンプル選択
  2. `useTraceEngine` が `runPythonTrace` を呼び出し、Pyodide 上で `sys.settrace()` を用いて事前一括実行
  3. 全 `StepSnapshot[]` 配列および AST 流れ図データ（`FlowchartGraph`）を生成・保持
  4. UI が `StepSnapshot` インデックスを更新し、Monaco デコレーション、スプレッドシート型変数履歴表、print出力、流れ図ノードのハイライトを完全同期

## Feature Inventory
| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 1 | プロジェクト基盤構築 | Vite + React + TypeScript + Vanilla CSS, 単一HTMLビルド (`vite-plugin-singlefile`) | DONE |
| 2 | 型定義・共有インターフェース | `StepSnapshot`, `VariableSnapshot`, `FlowchartNode`, `FlowchartGraph` 等 | DONE |
| 3 | サンプルプログラム定義 | 6種類のプリセット（順次、分岐、ループと関数、print、２級 第73回【４】(１)(２)/(３)(４)） | DONE |
| 4 | テスト・ビルド基盤 | Vitest (200テスト) + Playwright (41テスト) の自動テスト環境 | DONE |
| 5 | Pyodide インメモリ実行エンジン | メインスレッド上の単一 Pyodide インスタンスによる高速・安全なトレース実行 | DONE |
| 6 | `sys.settrace()` トレース収集 | 事前全ステップ実行、行番号・ローカル/グローバル変数スナップショット収集 | DONE |
| 7 | stdout キャプチャ & エッジガード | print出力キャプチャ, 10,000ステップ上限ガード (`TraceLimitExceeded`), NaN/Infinity/循環参照サニタイズ | DONE |
| 8 | Monaco Code Editor 統合 | Monaco Editor の React 組み込み, シンタックスハイライト, .py ファイルアップロード | DONE |
| 9 | エディタ実行行デコレーション | トレースステップ進行に応じた Monaco Editor 上での実行行ハイライト | DONE |
| 10 | ステップナビゲーション UI | 「最初」「前へ」「次へ」「最後」「リセット」ボタン, ステップスライダーによる任意ジャンプ | DONE |
| 11 | スプレッドシート型変数履歴表 | 変数名を横・ステップを縦とした変数履歴表示, 変更セル・列全体のハイライト, 変更なし行非表示フィルター | DONE |
| 12 | print 出力表示パネル | 右パネル下部での print 出力キャプチャ結果表示とステップ連動 | DONE |
| 13 | Pyodide 初期化ローディング UI | Pyodide ロード中のオーバーレイ表示と操作保護 | DONE |
| 14 | Python AST 流れ図生成器 | 順次（代入/累加代入展開）、判断（数式記号化）、繰り返し（六角形）、関数定義の自動パース | DONE |
| 15 | draw.io mxGraph XML 保持 | 流れ図内部データの draw.io mxGraph XML 形式保持 | DONE |
| 16 | カスタム SVG 流れ図描画 | if/elif/else 多分岐の縦整列・共通水平合流線、ズームスライダー (50%〜400%) | DONE |
| 17 | 行末コメントアノテーション | 命令行末尾の `# (ア)` コメントをブロック横（条件分岐は右下）に自動配置、分岐スコープ対応 | DONE |
| 18 | 単語途中改行防止 | トークン単位改行アルゴリズムにより、長い式でも変数名が分断されないよう制御 | DONE |
| 19 | 流れ図アクティブハイライト | ステップ実行時に現在実行中の AST ノードの自動ハイライト表示 | DONE |
| 20 | コード/マクロ言語/流れ図 タブ切り替え | 左パネルでの「コード(Python)」「コード(マクロ言語)」「流れ図」の3タブ切り替え（状態保持） | DONE |
| 21 | パネルドラッグリサイズ | 左右パネル間の水平リサイズ、および右パネル内の上下リサイズ機能 | DONE |
| 22 | Python ⇄ マクロ言語(VBA) 相互変換 | Sub Program()ラップ、Dim一括型宣言、関数独立配置・型推論、MsgBox変換、双方向変換 | DONE |
| 23 | マクロ言語構文ハイライト | Monaco EditorでのVBA言語定義、全構文キーワードの青色ハイライト統一、実行行ハイライト同期 | DONE |

## Code Layout
```
src/
├── components/
│   ├── App.tsx
│   ├── Header.tsx
│   ├── LeftPanel.tsx
│   ├── RightPanel.tsx
│   ├── MonacoEditor.tsx
│   ├── StepNavigation.tsx
│   ├── VariableTable.tsx
│   ├── OutputConsole.tsx
│   └── FlowchartViewer.tsx
├── hooks/
│   ├── useTraceEngine.ts
│   └── useStepNavigation.ts
├── services/
│   ├── samplePrograms.ts
│   ├── tracer.ts
│   ├── flowchartGenerator.ts
│   └── flowchartRenderer.tsx
├── types/
│   ├── trace.ts
│   ├── flowchart.ts
│   └── index.ts
├── worker/
│   └── pythonTracer.ts
├── main.tsx
└── index.css
```
