# TraceApp E2E テスト環境 & コードベース調査レポート (`analysis.md`)

## 1. 概要
本レポートは、TraceApp (プログラミング教育用 Python トレース可視化 Web アプリ) の E2E テスト構築に向け、既存コードベース構造、Playwright テスト実行基盤、および UI 要素の識別・操作手法（DOM セレクタ、`data-testid`、ARIA ロール）を包括的に調査・定義したドキュメントです。

---

## 2. 既存コードベースおよびプロジェクト構造

### 2.1 現状のファイル構成 (Phase 1 PoC 資産)
- **`package.json`**:
  - Playwright (`^1.62.1`) が依存関係に含まれており、`npm test` で `node run_tests.js` を実行するスクリプトが登録されています。
- **`run_tests.js`**:
  - Node.js の `http` モジュールでポート `8080` にインプロセス静的ファイルサーバーを起動し、Playwright Headless Chromium を使用して `http://localhost:8080/test_runner.html` にアクセスし、`window.__TEST_RESULTS__` を検証するカスタムランナーです。
- **`index.html`**:
  - Phase 1 PoC の単一ページ Web アプリ。CDN から Pyodide `v0.26.4` を読み込み、DOM 要素（`<textarea id="code-input">`, `#btn-run`, `#btn-next`, `#btn-prev`, `#btn-first`, `#btn-last`, `#code-viewer`, `#locals-table-body`, `#globals-table-body`, `#console-output`）でステップトレース動作を検証可能な構造となっています。
- **`test_runner.html`**:
  - Phase 1 PoC 自動テストスイート。10個のテストケース（順次、分岐、ループ、関数スコープ分離、print出力キャプチャ、NaN/Inf/循環参照エッジケース等）が定義され、すべて PASS することを確認済みです。

### 2.2 Phase 2-4 Target システム構成 (`PROJECT.md` 定義)
Phase 2-4 では Vite + React + TypeScript + Monaco Editor + Canvas/SVG 流れ図描画エンジンへ移行します。
`src/` 配下で想定されるコンポーネント構造は以下の通りです:

```
src/
├── components/
│   ├── Header.tsx            # タイトル、サンプルプログラム選択ドロップダウン、.pyファイルアップロード
│   ├── LeftPanel.tsx         # 左パネル ("コード" / "流れ図" タブ切り替え)
│   ├── RightPanel.tsx        # 右パネル (スプレッドシート型変数履歴表 + print出力コンソール)
│   ├── MonacoEditor.tsx      # Monaco Editor 本体 + トレース実行行デコレーションハイライト
│   ├── StepNavigation.tsx   # ナビゲーション (前へ, 次へ, リセット, ステップスライダー)
│   ├── VariableTable.tsx     # スプレッドシート型変数履歴表 (変更セル・列ハイライト)
│   ├── OutputConsole.tsx     # sys.stdout print 出力表示パネル
│   └── FlowchartViewer.tsx   # AST 流れ図描画 (SVG/Canvas, ノードハイライト)
├── hooks/
│   ├── useTraceEngine.ts     # Web Worker との通信
│   └── useStepNavigation.ts  # ステップインデックス状態管理
├── worker/
│   ├── pyodideWorker.ts      # Web Worker (sys.settrace Pre-execution)
│   └── pythonTracer.py       # Python 側 sys.settrace トレーサー
├── App.tsx                   # メインアプリケーションコンポーネント
└── main.tsx                  # エントリポイント
```

---

## 3. E2E テスト実行環境と起動要件

### 3.1 既存テスト実行環境 (`npm test`)
- **実行コマンド**: `npm test` または `node run_tests.js`
- **サーバー起動形態**: Node.js `http` モジュールによるポート `8080` のインプロセス静的サーバー
- **Playwright 起動方法**: `chromium.launch({ headless: true })`
- **検証ターゲット**: `http://localhost:8080/test_runner.html`
- **結果検知**: `window.__TEST_RESULTS__ !== undefined` (タイムアウト: 60,000ms)

### 3.2 Phase 2-4 (Vite + React) における Playwright テスト実行構成
Playwright 公式テストランナー (`@playwright/test` / `npx playwright test`) での実行構成仕様:
- **開発サーバー起動**: `npm run dev` (Vite 開発サーバー, デフォルトポート `5173`)
- **プレビューサーバー起動**: `npm run build && npm run preview` (デフォルトポート `4173`)
- **`playwright.config.ts` 設定仕様要件**:
  ```typescript
  import { defineConfig } from '@playwright/test';

  export default defineConfig({
    testDir: './tests/e2e',
    timeout: 60000, // Pyodide ロードを考慮し 60秒に設定
    use: {
      baseURL: 'http://localhost:5173',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
    },
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  });
  ```
- **環境・起動上の注意点**:
  1. **Pyodide ロード待機**: Pyodide (v0.26.4 WebAssembly) のロードと Web Worker の初期化に数秒〜十数秒必要となります。E2E テスト実行時は `page.goto('/')` 直後に Pyodide 準備完了インジケーター (`[data-testid="status-bar"]` またはローディングオーバーレイの非表示) を明示的に待機する必要があります。
  2. **ブラウザ互換性**: WebAssembly および Web Worker (`postMessage`) をサポートする Chromium / Firefox / WebKit で動作可能です。

---

## 4. UI 要素の識別・操作手法と DOM セレクタ仕様

ブラックボックス E2E テスト (Tier 1〜4) において、安定して信頼性の高い要素識別を行うためのセレクタ・`data-testid` 規約および判定ルール一覧です。

| UI コンポーネント | 操作・検証対象要素 | 推奨 `data-testid` | 代替 DOM / CSS セレクタ / ARIA ロール | 検証ポイント / 期待挙動 |
|------------------|------------------|-------------------|--------------------------------------|-----------------------|
| **Header** | サンプルコード選択 | `preset-select` | `select#preset-select`, `role="combobox"` | サンプル選択時、コードがエディタへロードされる |
| **Header** | .py ファイルアップロード | `file-upload-input` | `input[type="file"]` | ファイル指定で Python コードがロードされる |
| **LeftPanel** | タブ: コード | `tab-code` | `button:has-text("コード")`, `role="tab"[name="コード"]` | クリックで Monaco Editor 表示へ切り替え |
| **LeftPanel** | タブ: 流れ図 | `tab-flowchart` | `button:has-text("流れ図")`, `role="tab"[name="流れ図"]` | クリックで FlowchartViewer 表示へ切り替え |
| **MonacoEditor** | エディタ本体領域 | `monaco-editor` | `.monaco-editor`, `textarea.inputarea` | コード入力、編集、テキスト内容の取得・アサート |
| **MonacoEditor** | 実行行ハイライト | `editor-active-line` | `.view-line.active-line-decoration`, `.monaco-highlight-line` | 現在ステップに対応する行番号のハイライト装飾 |
| **StepNavigation** | 「前へ」ボタン | `btn-prev` | `button#btn-prev`, `role="button"[name="前へ"]` | クリックでステップが1戻る。ステップ0では disabled |
| **StepNavigation** | 「次へ」ボタン | `btn-next` | `button#btn-next`, `role="button"[name="次へ"]` | クリックでステップが1進む。最終ステップでは disabled |
| **StepNavigation** | 「リセット」ボタン | `btn-reset` | `button#btn-reset`, `role="button"[name="リセット"]` | クリックで初期化状態 (ステップ0) に復帰 |
| **StepNavigation** | ステップスライダー | `step-slider` | `input[type="range"]` | `fill` または `value` 変更で任意ステップへ一発ジャンプ |
| **StepNavigation** | ステップカウンター | `step-counter` | `#step-counter`, `span:has-text("ステップ")` | `ステップ X / Y` 形式のテキスト文字列検証 |
| **VariableTable** | 変数履歴表 | `variable-table` | `table.variable-table` | 横軸: 変数名、縦軸: ステップの表示構造 |
| **VariableTable** | 変更セルハイライト | `variable-cell-changed` | `td.highlight-cell`, `[data-changed="true"]` | 当該ステップで更新された変数のセルハイライト |
| **VariableTable** | 変更列ハイライト | `variable-col-changed` | `col.highlight-col`, `td.highlight-col` | 変更された変数全体の縦列ハイライト |
| **OutputConsole** | print 出力パネル | `output-console` | `#console-output`, `pre.console-output` | `sys.stdout` の累積出力・ステップ連動出力検証 |
| **FlowchartViewer** | 流れ図描画領域 | `flowchart-viewer` | `svg.flowchart`, `canvas` | AST から生成された SVG/Canvas 要素の確認 |
| **FlowchartViewer** | 処理ノード (順次) | `flowchart-node-process` | `rect.node-process`, `g[data-node-type="process"]` | 長方形記号の生成・表示 |
| **FlowchartViewer** | 判断ノード (条件分岐)| `flowchart-node-decision` | `polygon.node-decision`, `g[data-node-type="decision"]` | ひし形記号の生成・表示 |
| **FlowchartViewer** | ループノード (繰り返し)| `flowchart-node-loop` | `polygon.node-loop`, `g[data-node-type="loop"]` | 六角形 (角丸長方形) 記号の生成・表示 |
| **FlowchartViewer** | サブルーチンノード (関数)| `flowchart-node-subroutine` | `g.node-subroutine`, `g[data-node-type="subroutine"]` | 二重線長方形記号の生成・表示 |
| **FlowchartViewer** | 端子ノード (開始/終了)| `flowchart-node-terminal` | `rect.node-terminal`, `g[data-node-type="terminal"]` | 角丸長方形記号の生成・表示 |
| **FlowchartViewer** | アクティブノード | `flowchart-node-active` | `.node-active`, `.highlighted-node` | 現在実行中の AST ノードの強調表示 |
| **Status / Overlay** | 初期化ステータス | `status-bar` / `loading-overlay` | `#status-indicator`, `#status-text` | Pyodide 読み込み中・準備完了状態の検知 |

---

## 5. まとめと方針
調査結果に基づき、E2E テストスイート (Tiers 1〜4) は上記 `data-testid` およびセマンティックな CSS / ARIA セレクタを活用して構築可能です。Pyodide ロード待機を考慮したタイムアウト設計 (60秒) を適用することで、安定した自動テスト実行を実現します。
