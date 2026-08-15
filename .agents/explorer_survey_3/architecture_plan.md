# TraceApp (Phase 2-4) 全体アーキテクチャ・モジュール構造・環境計画書

## 1. 概要

本ドキュメントは、プログラミング教育用Pythonトレース可視化ツール「TraceApp」のPhase 2〜4本実装に向けた全体アーキテクチャ、モジュール構造、およびビルド/テスト環境計画を定義する設計書である。
Phase 1 PoCでの技術検証（Pyodide上での`sys.settrace()`動作、スコープ変数取得、`sys.stdout`キャプチャ、エッジケース対策）の成功に基づき、React + TypeScript + Vite + Pyodide Web Worker + Monaco Editor + AST流れ図表示を統合した本格的なWebアプリケーションを構築する。

---

## 2. 全体アーキテクチャ (Overall Architecture)

### 2.1 技術スタック

| レイヤー / 機能 | 採用技術 | 選定理由・目的 |
|---|---|---|
| **フロントエンド UI** | React 18+ | コンポーネント指向による宣言的UI構築、状態変更に伴う高効率なレンダリング |
| **開発 / ビルド環境** | Vite + TypeScript (Strict Mode) | 高速なHMR、厳格な型安全性の確保、ビルドの最適化 |
| **コードエディタ** | Monaco Editor (`@monaco-editor/react`) | VS Codeと同等の高度なPythonエディタ体験、デコレーションAPIによる実行行ハイライト |
| **Python実行エンジン** | Pyodide v0.26.4 (WebAssembly) | ブラウザ完結で動作するPython 3 runtime (`sys.settrace()` 完全サポート) |
| **マルチスレッド構成** | Web Worker (HTML5 Web Worker API) | Pyodide初期化および重いトレース実行をバックグラウンド化し、UI応答性を維持 |
| **流れ図生成 / レンダリング** | Python `ast` + `dagre.js` + 独自SVG/Canvas | Pyodide内でASTを構造解析し、dagreで自動レイアウト、SVG描画とdraw.io XML保持 |
| **テスト環境** | Vitest + React Testing Library + Playwright | ユニットテスト/コンポーネントテスト(Vitest) + ブラウザ間E2Eテスト(Playwright) |

### 2.2 スレッド分離アーキテクチャ

UIの応答性を100%確保するため、メインスレッドとWeb Workerスレッドを完全に分離する。

```
┌────────────────────────────────────────────────────────────────────────┐
│                        メインスレッド (Main UI Thread)                   │
│                                                                        │
│  ┌────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐ │
│  │ Monaco Editor  │ │  Step Controls   │ │ Variable History Table   │ │
│  │ (Code/Line H/L)│ │  & Step Slider   │ │ & Print Output Panel     │ │
│  └───────┬────────┘ └────────┬─────────┘ └────────────┬─────────────┘ │
│          │                   │                        │                │
│          └───────────────────┼────────────────────────┘                │
│                              ▼                                         │
│                   ┌───────────────────────┐                            │
│                   │  TraceEngine Manager  │                            │
│                   └──────────┬────────────┘                            │
└──────────────────────────────┼─────────────────────────────────────────┘
                               │ postMessage (非同期通信)
┌──────────────────────────────┼─────────────────────────────────────────┐
│                              ▼ Web Worker Thread                       │
│                   ┌───────────────────────┐                            │
│                   │  Pyodide Worker Host  │                            │
│                   └──────────┬────────────┘                            │
│                              │                                         │
│         ┌────────────────────┴────────────────────┐                    │
│         ▼                                         ▼                    │
│  ┌───────────────┐                       ┌─────────────────┐           │
│  │ Pyodide Runtime│                      │ AST Parser &    │           │
│  │ sys.settrace()│                       │ Flowchart Gen   │           │
│  └───────────────┘                       └─────────────────┘           │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.3 データフロー設計 (全ステップ事前実行方式)

1. **ユーザー入力・操作**: Monaco Editorでのコード編集、またはファイル/サンプル選択。
2. **トレース要求発行**: 「次へ」またはステップ操作が行われた際、TraceEngineがWeb Workerへコード文字列を転送。
3. **Worker内処理 (事前一括実行)**:
   - Pyodide上で `ast.parse()` を実行し、流れ図データ (`FlowchartData`) とAST行マッピングを生成。
   - `sys.settrace()` を有効化した状態で全コードを実行し、各ステップの行番号、スコープ変数のスナップショット、累積print出力を記録した `StepSnapshot[]` 配列を生成。
   - ステップ上限（10,000ステップ）超過時は `TraceLimitExceeded` を送出し安全に中断。
4. **UI同期更新**: Workerから受信した `StepSnapshot[]` と `FlowchartData` をReact状態に保持。
5. **ナビゲーション**: 以降の「次へ」「前へ」「リセット」「スライダー移動」は、配列のインデックス (`currentStepIndex`) を変更するのみで高速かつ同期的にUI（Monaco行ハイライト、変数履歴表ハイライト、print出力、流れ図ノードハイライト）に反映される。

---

## 3. モジュール構造とディレクトリレイアウト

プロジェクトは機能ごとに明確に切り離され、単一責任原則(SRP)を遵守する。

```
c:\Git\TraceApp\
├── index.html                  # Vite エントリHTML
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx                # React エントリポイント
│   ├── App.tsx                 # 最上位アプリケーションコンポーネント
│   ├── components/             # React UI コンポーネント群
│   │   ├── layout/             # 全体レイアウト構成
│   │   │   ├── MainLayout.tsx  # 2ペインレイアウト
│   │   │   ├── Header.tsx      # ヘッダー (ロゴ・アクション)
│   │   │   ├── LeftPanel.tsx   # 左パネル (コード/流れ図タブ)
│   │   │   └── RightPanel.tsx  # 右パネル (変数履歴/print)
│   │   ├── editor/             # エディタ・コード入力関連
│   │   │   ├── CodeEditor.tsx  # Monaco Editor ラッパー (行ハイライト制御)
│   │   │   ├── SampleSelector.tsx # サンプルプログラム選択ドロップダウン
│   │   │   └── FileUploader.tsx   # .pyファイル読み込みボタン
│   │   ├── flowchart/          # 流れ図表示関連
│   │   │   ├── FlowchartViewer.tsx# 流れ図SVGレンダラー
│   │   │   ├── FlowNode.tsx    # 流れ図ノード要素 (長方形, ひし形, 六角形等)
│   │   │   └── FlowEdge.tsx    # ノード接続線要素
│   │   ├── controls/           # ステップ操作関連
│   │   │   ├── StepControls.tsx# 前へ・次へ・リセットボタン
│   │   │   └── StepSlider.tsx  # ステップ選択レンジスライダー
│   │   ├── variables/          # 変数履歴表示関連
│   │   │   ├── VariableHistoryTable.tsx # スプレッドシート型変数履歴表
│   │   │   └── VariableCell.tsx# 変更セル・列ハイライト用セル
│   │   ├── output/             # コンソール出力関連
│   │   │   └── PrintOutputPanel.tsx # print() 出力表示エリア
│   │   └── common/             # 共通UI部品
│   │       ├── TabSwitcher.tsx # タブ切替ボタン
│   │       └── LoadingOverlay.tsx # Pyodideロード中表示
│   ├── worker/                 # Web Worker 関連
│   │   ├── pyodide.worker.ts   # Worker エントリポイント
│   │   ├── workerBridge.ts     # メインスレッド用 Worker 通信ブリッジ
│   │   └── python/             # Pyodide内で実行されるPythonコアロジック
│   │       ├── tracer.py       # sys.settrace() トレーサースクリプト
│   │       └── ast_parser.py   # AST解析・流れ図データ変換スクリプト
│   ├── services/               # ドメインロジック / サービス層
│   │   ├── traceEngine.ts      # トレースエンジン管理・状態キャッシュ
│   │   ├── flowchartGenerator.ts # 流れ図ノード自動レイアウト (dagre連携)
│   │   └── samplePrograms.ts   # プリセットサンプルコード定義
│   ├── hooks/                  # カスタム React フック
│   │   ├── useTraceEngine.ts   # トレース実行・ステップ移動管理
│   │   └── useMonacoDecorations.ts # Monaco Editor 行ハイライトデコレーション
│   ├── types/                  # TypeScript 型定義
│   │   ├── trace.ts            # トレース・スナップショット型定義
│   │   ├── flowchart.ts        # 流れ図ノード・エッジ・XML型定義
│   │   └── worker.ts           # Worker通信メッセージ型定義
│   └── styles/                 # CSSスタイルシート (Vanilla CSS / Module)
│       ├── main.css
│       ├── layout.css
│       └── variables.css
└── tests/                      # テストコード群
    ├── unit/                   # ユニットテスト (Vitest)
    │   ├── tracer.test.ts
    │   └── flowchart.test.ts
    ├── components/             # コンポーネントテスト (React Testing Library)
    │   ├── VariableHistoryTable.test.tsx
    │   └── StepSlider.test.tsx
    └── e2e/                    # E2Eテスト (Playwright)
        └── trace_execution.spec.ts
```

---

## 4. 型定義とインターフェース契約

### 4.1 トレース・スナップショット構造 (`src/types/trace.ts`)

```typescript
/** 単一変数のスナップショット */
export interface VariableSnapshot {
  name: string;
  value: string;             // 文字列表現 ('5', '"B"', 'True' など)
  type: 'int' | 'float' | 'str' | 'bool';
  scope: 'global' | 'local';
  changed: boolean;          // 直前ステップから変化があったか
}

/** 1ステップの実行状態スナップショット */
export interface StepSnapshot {
  stepIndex: number;         // 0始まりのステップインデックス
  lineNumber: number;        // 対応するPythonソースコードの行番号
  variables: VariableSnapshot[]; // 現在使用されている全変数のリスト
  printOutput: string[];     // このステップ時点での累積print出力
  astNodeId: string | null;  // 対応する流れ図ノードID
}

/** トレース実行結果 */
export interface TraceResult {
  success: boolean;
  snapshots: StepSnapshot[];
  flowchartData: FlowchartData;
  error?: string;
  exceededLimit?: boolean;
}
```

### 4.2 流れ図データ構造 (`src/types/flowchart.ts`)

```typescript
export type FlowNodeType = 
  | 'start_end'   // 端子 (角丸長方形)
  | 'process'     // 処理 (長方形)
  | 'decision'    // 判断 (ひし形)
  | 'loop_start'  // ループ開始 (六角形)
  | 'loop_end'    // ループ終了 (六角形)
  | 'subroutine'; // サブルーチン/関数 (二重線長方形)

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  label: string;
  lineNumber?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface FlowEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string; // 'True' / 'False' など
}

export interface FlowchartData {
  nodes: FlowNode[];
  edges: FlowEdge[];
  mxGraphXml: string; // draw.io 互換 XML データ
}
```

### 4.3 Web Worker 通信契約 (`src/types/worker.ts`)

```typescript
export type WorkerRequest = 
  | { type: 'INIT' }
  | { type: 'RUN_TRACE'; payload: { code: string } };

export type WorkerResponse = 
  | { type: 'INIT_COMPLETE'; success: boolean }
  | { type: 'TRACE_COMPLETE'; result: TraceResult }
  | { type: 'ERROR'; message: string };
```

---

## 5. 核心モジュール設計

### 5.1 Python トレーサー (`src/worker/python/tracer.py`)
- **`sys.settrace()` のフック**:
  - `event == 'line'` のタイミングでスタックフレーム (`frame`) を検査。
  - `frame.f_locals` および `frame.f_globals` から基本データ型（int, float, str, bool）の変数を抽出。
  - 特殊な値（NaN, Infinity）や循環参照に対しては安全に `repr()` 文字列化を実施。
  - ステップ数が 10,000 を超えた場合は、ユーザーコードの `try...except Exception:` をバイパスできる `TraceLimitExceeded(BaseException)` を raise して安全停止。
- **`sys.stdout` のキャプチャ**:
  - カスタムの `OutputCapture` クラスを `sys.stdout` に割り当て、`print()` の呼出ログを取得。

### 5.2 Python AST パーサー & 流れ図変換 (`src/worker/python/ast_parser.py`)
- **AST解析**:
  - Python標準モジュール `ast` を使用し、入力コードの構文ツリーを走査。
  - `Assign`, `Expr(Call(print))`: `process` ノード
  - `If`: `decision` ノード (True/Falseブランチの分岐接続)
  - `For`, `While`: `loop_start` および `loop_end` ノード
  - `FunctionDef`, `Call`: `subroutine` ノード
- **draw.io XML (mxGraph) 変換**:
  - 生成したノード/エッジツリーを mxGraph XML フォーマットへと変換し、XML文字列として返却。

### 5.3 Monaco Editor 行ハイライト統合 (`src/hooks/useMonacoDecorations.ts`)
- `@monaco-editor/react` の `editor.deltaDecorations()` APIを使用。
- `currentStepIndex` に対応する `lineNumber` に以下のデコレーションスタイルを動的に適用。
  - 背景色: 薄黄色 (`#fff59d`)
  - 行ヘッダーマーカー: 黄色インジケータ

### 5.4 変数履歴表スプレッドシート (`src/components/variables/VariableHistoryTable.tsx`)
- 全ステップに現れる変数名の集合を抽出し、横軸（列）に配置。
- 縦軸（行）にはステップ 0 から `currentStepIndex` までの履歴を表示。
- **ハイライト制御**:
  - `stepIndex === currentStepIndex` かつ `variable.changed === true` のセルに明るい黄色背景 (`#ffe082`) を適用。
  - 該当変数が変化した列全体に薄い背景強調 (`#fff8e1`) を適用。
  - 関数のローカル変数の場合はバッジまたは文字色で識別可能とする。

---

## 6. ビルド・テスト環境計画

### 6.1 開発およびビルド設定 (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
```

### 6.2 パッケージ依存関係 (`package.json`)

```json
{
  "name": "traceapp",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@monaco-editor/react": "^4.6.0",
    "dagre": "^0.8.5"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/dagre": "^0.7.52",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "vitest": "^2.0.3",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^24.1.0",
    "@playwright/test": "^1.45.3"
  }
}
```

### 6.3 テスト戦略と品質検証計画

| テストレベル | ターゲット機能 | 採用フレームワーク | 検証項目 |
|---|---|---|---|
| **ユニットテスト** | `tracer.py`, `ast_parser.py`, `flowchartGenerator.ts` | Vitest | ・ASTから正しいノード/エッジ種別が生成されるか<br>・スナップショット生成時に変数の変更状態 (`changed`) が正しくフラグ付けされるか<br>・10,000ステップ超で `TraceLimitExceeded` が正しく発生するか |
| **コンポーネントテスト** | `VariableHistoryTable`, `StepSlider`, `CodeEditor` | React Testing Library + JSDOM | ・ステップ変更時に変数履歴表の指定セル・列がハイライトされるか<br>・スライダー操作で即座に親の状態が更新されるか |
| **統合 / E2Eテスト** | アプリケーション全体のステップ実行シナリオ | Playwright | ・要求仕様に提示された 3つのテストプログラム (基本代入, if分岐, for+関数) を自動実行<br>・「次へ」「前へ」「リセット」クリックおよびスライダー移動で Monacoハイライト・変数表・print出力・流れ図ノードが正しく連動するか |

#### 必須要件検証プログラム (Playwright E2E対象)
1. **テスト1 (順次・代入)**: `x=5`, `y=3`, `total=x+y`, `print(total)` の変数蓄積検証。
2. **テスト2 (条件分岐)**: `score=75` における `elif` ブランチのみの通過と `grade="B"` の検出検証。
3. **テスト3 (ループと関数)**: `def add(a, b)` 呼び出し時のローカル変数 `a`, `b`, `result` とグローバル `total` のスコープ分離検証。

---

## 7. コーディング原則および規約の徹底

1. **言語の完全統一**: すべてのコードコメント、ドキュメンテーション文字列、設計書は**日本語**で記述する。ソースコードはTypeScript (`.ts`/`.tsx`) のみで記述する。
2. **関数の小規模化 (30〜50行原則)**: 1つの関数につき30〜50行以内を目安とし、責務を切り出して単一責任原則を守る。
3. **TypeScript 厳格化**: TypeScript compiler options で `strict: true` を有効化し、`any` 型の使用を禁止。型エラー 0 件を維持する。
4. **デザイン規約**: ライトモード基調の明るく視認性の高い教科書的 UI とし、明瞭なフォントと明確なハイライト配色（イエロー・アンバー系）を使用する。
