# PROJECT — TraceApp Phase 2-4

## Architecture
- **フロントエンド UI**: Vite + React + TypeScript, Monaco Editor, Canvas/SVG Flowchart Renderer
- **トレースエンジン**: Pyodide (WebAssembly) running in Web Worker (メインスレッド非ブロック, postMessage通信)
- **データフロー**:
  1. ユーザーがコードを入力／ファイル読込／サンプル選択
  2. メイン UI が `WorkerRequest` を Web Worker へ送出
  3. Worker 内の Pyodide が `sys.settrace()` で事前一括実行し、全 `StepSnapshot[]` 配列を収集
  4. Worker が `WorkerResponse` でスナップショット配列および AST 流れ図データを返却
  5. UI が `StepSnapshot` インデックスを更新し、Monaco デコレーション、スプレッドシート型変数履歴表、print出力、流れ図ノードのハイライトを完全同期

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | プロジェクト基盤構築 | Vite + React + TypeScript + Tailwind/CSS セットアップ, 基本レイアウト定義 | M1 | R5 |
| 2 | 型定義・共有インターフェース | `StepSnapshot`, `VariableSnapshot`, `WorkerMessage`, `FlowchartNode` 等の型定義 | M1 | basic_design.md |
| 3 | サンプルプログラム定義 | 3種類のプリセットプログラム（計算、分岐、ループと関数）の定義と初期読込 | M1 | R4, テスト1-3 |
| 4 | テスト・ビルド基盤 | Vitest ユニットテストおよび Playwright E2E テスト環境の初期構築 | M1 | R5, Quality |
| 5 | Pyodide Web Worker エンジン | Web Worker 内での Pyodide 初期化、Worker postMessage 通信プロトコル | M2 | R1 |
| 6 | `sys.settrace()` トレース収集 | 事前全ステップ実行、行番号・ローカル/グローバル変数スナップショット収集 | M2 | R1, PoC |
| 7 | stdout キャプチャ & エッジケース処理 | print出力キャプチャ, 10,000ステップ上限ガード (`TraceLimitExceeded`), NaN/Infinity/循環参照サニタイズ | M2 | R1, EDGE-1-3 |
| 8 | Monaco Code Editor 統合 | Monaco Editor の React 組み込み, シンタックスハイライト, .py ファイルアップロード | M3 | R2 |
| 9 | エディタ実行行デコレーション | トレースステップ進行に応じた Monaco Editor 上での実行行ハイライト | M3 | R2 |
| 10 | ステップナビゲーション UI | 「前へ」「次へ」「リセット」ボタン, ステップスライダー (Range Input) による任意ジャンプ | M3 | R2 |
| 11 | スプレッドシート型変数履歴表 | 変数名を横・ステップを縦とした変数履歴表示, 変更セル・列全体のハイライト | M3 | R2 |
| 12 | print 出力表示パネル | 右パネル下部での print 出力キャプチャ結果表示とステップ連動 | M3 | R2 |
| 13 | Pyodide 初期化ローディング UI | Pyodide ロード中のオーバーレイ表示と操作保護 | M3 | Acceptance Criteria |
| 14 | Python AST 流れ図生成器 | Pyodide `ast` モジュールによる AST 解析, 順次・判断・繰り返し・関数のノード構造生成 | M4 | R3 |
| 15 | draw.io mxGraph XML 保持 | 流れ図内部データの draw.io mxGraph XML 形式保持 | M4 | R3 |
| 16 | カスタム SVG/Canvas 流れ図描画 | 長方形(処理), ひし形(判断), 六角形(ループ), 二重線長方形(関数), 角丸長方形(端子)の独自レンダリング | M4 | R3 |
| 17 | 流れ図アクティブノードハイライト | ステップ実行時に現在実行中の AST ノードのハイライト表示 | M4 | R3 |
| 18 | コード/流れ図 タブ切り替え | 左パネルでの「コード」と「流れ図」の表示タブ切り替え | M4 | R2, R3 |
| 19 | E2E テストスイート構築 (Dual Track) | 要件駆動・ブラックボックスでの E2E テストスイート (Tiers 1-4) 作成, `TEST_READY.md` 発行 | M_TEST | Dual Track |
| 20 | E2E パストライアル & 逆境検証 | 100% E2E テスト合格 (Tiers 1-4) および Tier 5 白箱・逆境カバレッジ検証・バグ修正 | M5 | Final Milestone |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Infrastructure & Basic Setup | Vite + React + TS, 型定義, サンプルプリセット, テスト基盤 | none | DONE |
| M2 | Web Worker Trace Engine | Pyodide Web Worker, `sys.settrace()`, エッジケースサニタイズ, postMessage | M1 | DONE |
| M3 | Code Editor & Navigation UI | Monaco Editor, 実行行デコレーション, ナビゲーション, 変数履歴表, print表示 | M1, M2 | DONE |
| M4 | AST Flowchart Generator & Renderer | Python AST 解析, draw.io XML, SVG/Canvas レンダラー, ノードハイライト | M1, M2, M3 | PLANNED |
| M5 | E2E Verification & Hardening | E2E 全テストパス (Tiers 1-4), Tier 5 逆境カバレッジ検証 | M1-M4, M_TEST | PLANNED |
| M_TEST | E2E Testing Suite Track | 要求駆動ブラックボックステスト基盤・ケース構築 (Tiers 1-4), `TEST_READY.md` 出力 | none | IN_PROGRESS (fc3ab4f3-4a9f-42b4-8658-8cb9393ff4dc) |

## Interface Contracts
### 1. Main Thread ↔ Web Worker Protocol (`WorkerMessage`)
```typescript
export type WorkerRequest = 
  | { type: 'INIT' }
  | { type: 'RUN_TRACE'; code: string; maxSteps?: number };

export type WorkerResponse = 
  | { type: 'INIT_COMPLETE' }
  | { type: 'INIT_ERROR'; error: string }
  | { type: 'TRACE_SUCCESS'; result: TraceResult }
  | { type: 'TRACE_ERROR'; error: string };

export interface TraceResult {
  snapshots: StepSnapshot[];
  totalSteps: number;
  stdout: string;
  flowchartXml?: string;
  flowchartNodes?: FlowchartNode[];
}
```

### 2. Trace Snapshot Specification (`StepSnapshot`)
```typescript
export interface VariableSnapshot {
  [varName: string]: any; // Primitive values: int, float, str, bool, or "NaN", "Infinity", "Undefined"
}

export interface StepSnapshot {
  stepIndex: number;
  line: number;
  event: 'line' | 'call' | 'return';
  functionName?: string;
  globals: VariableSnapshot;
  locals: VariableSnapshot;
  changedVars: string[]; // List of variable names modified in this step
  stdoutDelta: string;
  stdoutCumulative: string;
  astNodeId?: string;
}
```

### 3. Flowchart Specification (`FlowchartNode`)
```typescript
export type FlowchartNodeType = 'terminal' | 'process' | 'decision' | 'loop' | 'subroutine';

export interface FlowchartNode {
  id: string;
  type: FlowchartNodeType;
  label: string;
  lineRange?: [number, number];
  children?: FlowchartNode[];
  xmlSnippet?: string;
}
```

## Code Layout
```
src/
├── assets/
├── components/
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
│   ├── flowchartGenerator.ts
│   └── flowchartRenderer.ts
├── types/
│   ├── trace.ts
│   ├── flowchart.ts
│   └── worker.ts
├── worker/
│   ├── pyodideWorker.ts
│   └── pythonTracer.py
├── App.tsx
├── main.tsx
└── index.css
```
