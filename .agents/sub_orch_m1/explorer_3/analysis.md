# Milestone 1 (Infrastructure & Basic Setup) 実装設計書

## 1. 概要・目標 (Executive Summary & Objective)
本ドキュメントは、Pythonトレース可視化ツール「TraceApp」の Milestone 1（インフラ構築・基本プロジェクトセットアップ）における詳細な実装設計書です。
Phase 1 PoC の成果（Pyodide 上での `sys.settrace()` 動作証明）を踏まえ、Vite + React + TypeScript 開発環境の導入、厳格な型定義共有層、プリセットサンプルプログラム、ライトモード教科書風の2ペイン基本UIフレームワーク、および Vitest テスト基盤の設計仕様を定義します。

---

## 2. リポジトリ現況の分析 (Current Repository Analysis)

### 2.1 現状のファイル構造
現在、ルートリポジトリ（`c:\Git\TraceApp`）には以下のファイルが存在します:
- `ORIGINAL_REQUEST.md`: 要求仕様書
- `PROJECT.md`: アーキテクチャおよび機能一覧
- `.agents/`: オーケストレーターおよびエージェントの作業フォルダ
- `index.html`: PoC 用の単一HTML検証コード
- `poc_report.md`: PoC 検証報告書
- `run_tests.js` / `test_runner.html`: PoC用テスト実行器
- `package.json`: 簡易設定（Playwright のみ含む）

### 2.2 Milestone 1 で新規構築・更新が必要なファイル
Milestone 1 の完了にあたり、以下のファイル群を構築・更新します:
1. プロジェクト設定ファイル: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`
2. ソースコード共通型定義:
   - `src/types/trace.ts`
   - `src/types/flowchart.ts`
   - `src/types/worker.ts`
3. サービスモジュール: `src/services/samplePrograms.ts`
4. UIコンポーネント:
   - `src/components/Header.tsx`
   - `src/components/LeftPanel.tsx`
   - `src/components/RightPanel.tsx`
   - `src/App.tsx`, `src/main.tsx`, `src/index.css`
5. テスト関連:
   - `src/__tests__/samplePrograms.test.ts`

---

## 3. ディレクトリ・ファイル構造設計 (Directory & File Layout)

以下に Milestone 1 で構築すべきディレクトリおよびファイル構造を示します。

```
c:\Git\TraceApp\
├── index.html                  # HTML エントリポイント
├── package.json                # パッケージ依存関係・スクリプト定義
├── vite.config.ts              # Vite & Vitest 設定ファイル
├── tsconfig.json               # TypeScript コンパイラ設定 (App用)
├── tsconfig.node.json          # TypeScript コンパイラ設定 (Vite設定用)
├── src/
│   ├── main.tsx                # React エントリポイント
│   ├── App.tsx                 # アプリケーションルートUIコンポーネント
│   ├── index.css               # グローバルスタイル (ライトモード標準)
│   ├── components/
│   │   ├── Header.tsx          # ヘッダー (タイトル、サンプル選択)
│   │   ├── LeftPanel.tsx       # 左パネル (コード/流れ図 タブ切り替え枠)
│   │   └── RightPanel.tsx      # 右パネル (変数履歴表枠、print出力枠)
│   ├── services/
│   │   └── samplePrograms.ts   # サンプルプログラム定義モジュール
│   ├── types/
│   │   ├── trace.ts            # トレース・変数スナップショット型定義
│   │   ├── flowchart.ts        # 流れ図ノード型定義
│   │   └── worker.ts           # Web Worker 通信メッセージ型定義
│   └── __tests__/
│       └── samplePrograms.test.ts # サンプルプログラムの単体テスト
```

---

## 4. パッケージ構成と環境設定設計 (Package & Config Setup)

### 4.1 `package.json`
プロジェクトに必要な依存関係（dependencies / devDependencies）およびビルド・テスト用 NPM スクリプトを定義します。

```json
{
  "name": "traceapp",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@monaco-editor/react": "^4.6.0",
    "monaco-editor": "^0.50.0",
    "lucide-react": "^0.427.0",
    "pyodide": "^0.26.4"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.1",
    "vitest": "^2.0.5",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.8",
    "jsdom": "^24.1.1",
    "playwright": "^1.62.1"
  }
}
```

### 4.2 `vite.config.ts`
Vite ビルド設定および Vitest テスト設定を統合します。

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
  },
});
```

### 4.3 `tsconfig.json`
`strict: true` を指定し、型安全性を高めます。

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting / Strictness */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### 4.4 `index.html`
HTML5 の標準エントリポイントとして以下を配置します。

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TraceApp - Pythonトレース可視化</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 5. 型定義仕様詳細 (TypeScript Types & Interfaces)

### 5.1 `src/types/trace.ts`
トレース実行エンジンとUIコンポーネント間で受け渡されるデータ構造を定義します。

```typescript
/**
 * 変数のスナップショット型。
 * 基本型（number, string, boolean）および特殊表現（"NaN", "Infinity", "-Infinity"）を保持します。
 */
export interface VariableSnapshot {
  [varName: string]: number | string | boolean | null | undefined;
}

/**
 * トレースの1ステップにおける詳細な状態情報。
 */
export interface StepSnapshot {
  /** ステップインデックス（0から開始） */
  stepIndex: number;
  /** 実行中のPythonソースコード行番号（1-indexed） */
  line: number;
  /** トレースイベント種別（行実行、関数呼び出し、関数復帰） */
  event: 'line' | 'call' | 'return';
  /** 実行中の関数名（グローバルスコープの場合は undefined） */
  functionName?: string;
  /** グローバル変数のスナップショット */
  globals: VariableSnapshot;
  /** ローカル変数のスナップショット */
  locals: VariableSnapshot;
  /** 本ステップで値が変更・新規定義された変数名の一覧 */
  changedVars: string[];
  /** 本ステップで新たに出力された print 文字列 */
  stdoutDelta: string;
  /** 本ステップ時点での累積 print 出力文字列 */
  stdoutCumulative: string;
  /** 関連する AST 流れ図ノードの ID（M4 で使用） */
  astNodeId?: string;
}

/**
 * 全ステップの実行完了結果オブジェクト。
 */
export interface TraceResult {
  /** 収集されたステップスナップショットの全配列 */
  snapshots: StepSnapshot[];
  /** 総ステップ数 */
  totalSteps: number;
  /** 最終的な標準出力結果 */
  stdout: string;
  /** draw.io mxGraph XML形式の流れ図データ（オプショナル） */
  flowchartXml?: string;
}
```

### 5.2 `src/types/flowchart.ts`
AST解析から生成される流れ図のノード構造を定義します。

```typescript
/**
 * 流れ図ノードの種別。
 * - terminal: 端子（開始・終了）
 * - process: 処理（順次実行・代入等）
 * - decision: 判断（条件分岐 if/elif）
 * - loop: 繰り返し（for/while）
 * - subroutine: サブルーチン・関数定義
 */
export type FlowchartNodeType =
  | 'terminal'
  | 'process'
  | 'decision'
  | 'loop'
  | 'subroutine';

/**
 * 流れ図ノードオブジェクト。
 */
export interface FlowchartNode {
  /** ノード識別子 */
  id: string;
  /** ノード種別 */
  type: FlowchartNodeType;
  /** 表示用テキスト・ラベル */
  label: string;
  /** 対応するPythonソースコードの行番号範囲 [開始行, 終了行] */
  lineRange?: [number, number];
  /** 子ノード一覧（分岐やループブロック内部） */
  children?: FlowchartNode[];
  /** draw.io mxGraph 用の XML スニペット */
  xmlSnippet?: string;
}
```

### 5.3 `src/types/worker.ts`
メインスレッドと Web Worker 間の通信メッセージ構造を定義します。

```typescript
import { TraceResult } from './trace';
import { FlowchartNode } from './flowchart';

/**
 * メインスレッドから Web Worker へのリクエストメッセージ。
 */
export type WorkerRequest =
  | { type: 'INIT' }
  | { type: 'RUN_TRACE'; code: string; maxSteps?: number };

/**
 * Web Worker からメインスレッドへのレスポンスメッセージ。
 */
export type WorkerResponse =
  | { type: 'INIT_COMPLETE' }
  | { type: 'INIT_ERROR'; error: string }
  | {
      type: 'TRACE_SUCCESS';
      result: TraceResult & { flowchartNodes?: FlowchartNode[] };
    }
  | { type: 'TRACE_ERROR'; error: string };
```

---

## 6. サンプルプログラムモジュール設計 (`src/services/samplePrograms.ts`)

要件 R4 および Acceptance Criteria に規定された 3 種類のテスト用プログラムを定数定義として用意します。

```typescript
/**
 * サンプルプログラムの構造定義
 */
export interface SampleProgram {
  id: string;
  name: string;
  description: string;
  code: string;
}

/**
 * 初期プリセットサンプルプログラム一覧
 */
export const SAMPLE_PROGRAMS: SampleProgram[] = [
  {
    id: 'basic-sequential',
    name: '1. 基本的な順次・代入',
    description: '変数の代入と四則演算、出力の基本',
    code: `x = 5
y = 3
total = x + y
print(total)
`,
  },
  {
    id: 'conditional-branch',
    name: '2. 条件分岐 (if / elif / else)',
    description: '条件評価による処理分岐の確認',
    code: `score = 75
if score >= 80:
    grade = "A"
elif score >= 60:
    grade = "B"
else:
    grade = "C"
print(grade)
`,
  },
  {
    id: 'loop-and-function',
    name: '3. ループと関数',
    description: '関数定義・呼び出しと for ループの組み合わせ',
    code: `def add(a, b):
    result = a + b
    return result

total = 0
for i in range(1, 4):
    total = add(total, i)
print(total)
`,
  },
];
```

---

## 7. 2ペイン UI レイアウト設計 (UI Components & Layout)

デザイン基調は「教科書的・明瞭・明るいライトモード（白背景、グレー枠線、青ハイライト）」とします。

### 7.1 `src/components/Header.tsx`
アプリタイトルとサンプル切り替え用ドロップダウンを配置します。

```tsx
import React from 'react';
import { SAMPLE_PROGRAMS, SampleProgram } from '../services/samplePrograms';

interface HeaderProps {
  selectedSampleId: string;
  onSelectSample: (sample: SampleProgram) => void;
}

/**
 * アプリケーションヘッダーコンポーネント
 */
export const Header: React.FC<HeaderProps> = ({
  selectedSampleId,
  onSelectSample,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sample = SAMPLE_PROGRAMS.find((s) => s.id === e.target.value);
    if (sample) {
      onSelectSample(sample);
    }
  };

  return (
    <header className="header-container">
      <div className="header-title">
        <h1>TraceApp - Pythonトレース可視化</h1>
      </div>
      <div className="header-controls">
        <label htmlFor="sample-select">サンプルプログラム: </label>
        <select
          id="sample-select"
          value={selectedSampleId}
          onChange={handleChange}
          className="sample-dropdown"
        >
          {SAMPLE_PROGRAMS.map((sample) => (
            <option key={sample.id} value={sample.id}>
              {sample.name}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
};
```

### 7.2 `src/components/LeftPanel.tsx`
左パネルには「コード」と「流れ図」のタブヘッダーおよび表示枠を構成します。

```tsx
import React, { useState } from 'react';

interface LeftPanelProps {
  code: string;
  onCodeChange: (newCode: string) => void;
}

/**
 * 左パネルコンポーネント (コード / 流れ図 タブ切り替え)
 */
export const LeftPanel: React.FC<LeftPanelProps> = ({
  code,
  onCodeChange,
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'flowchart'>('code');

  return (
    <div className="left-panel">
      <div className="tab-bar">
        <button
          className={`tab-button ${activeTab === 'code' ? 'active' : ''}`}
          onClick={() => setActiveTab('code')}
        >
          コード
        </button>
        <button
          className={`tab-button ${activeTab === 'flowchart' ? 'active' : ''}`}
          onClick={() => setActiveTab('flowchart')}
        >
          流れ図
        </button>
      </div>
      <div className="panel-content">
        {activeTab === 'code' ? (
          <div className="editor-placeholder">
            <textarea
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              className="code-textarea"
              placeholder="Pythonコードを入力してください"
            />
          </div>
        ) : (
          <div className="flowchart-placeholder">
            <p>流れ図プレースホルダー (M4にて実装予定)</p>
          </div>
        )}
      </div>
    </div>
  );
};
```

### 7.3 `src/components/RightPanel.tsx`
右パネル上部（変数履歴表エリア）と下部（print出力エリア）の枠を構成します。

```tsx
import React from 'react';

/**
 * 右パネルコンポーネント (変数履歴表 & print出力表示枠)
 */
export const RightPanel: React.FC = () => {
  return (
    <div className="right-panel">
      <div className="panel-section top-section">
        <h3>変数履歴</h3>
        <div className="variable-table-placeholder">
          <p>変数履歴表プレースホルダー (M3にて実装予定)</p>
        </div>
      </div>
      <div className="panel-section bottom-section">
        <h3>実行出力 (stdout)</h3>
        <div className="console-placeholder">
          <pre>出力プレースホルダー (M3にて実装予定)</pre>
        </div>
      </div>
    </div>
  );
};
```

### 7.4 `src/App.tsx` & `src/index.css`
2ペインレイアウトの全般を制御します。

```tsx
import { useState } from 'react';
import { Header } from './components/Header';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { SAMPLE_PROGRAMS, SampleProgram } from './services/samplePrograms';
import './index.css';

export function App() {
  const [selectedSample, setSelectedSample] = useState<SampleProgram>(
    SAMPLE_PROGRAMS[0]
  );
  const [code, setCode] = useState<string>(SAMPLE_PROGRAMS[0].code);

  const handleSelectSample = (sample: SampleProgram) => {
    setSelectedSample(sample);
    setCode(sample.code);
  };

  return (
    <div className="app-container">
      <Header
        selectedSampleId={selectedSample.id}
        onSelectSample={handleSelectSample}
      />
      <main className="main-content">
        <LeftPanel code={code} onCodeChange={setCode} />
        <RightPanel />
      </main>
    </div>
  );
}

export default App;
```

`src/index.css`:
```css
/* グローバルスタイル・ライトモード教科書風テーマ */
:root {
  --bg-color: #f8fafc;
  --panel-bg: #ffffff;
  --border-color: #cbd5e1;
  --primary-color: #2563eb;
  --text-color: #1e293b;
  --text-muted: #64748b;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
  height: 100vh;
  overflow: hidden;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background-color: var(--panel-bg);
  border-bottom: 1px solid var(--border-color);
}

.header-title h1 {
  font-size: 1.25rem;
  color: var(--primary-color);
}

.sample-dropdown {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  font-size: 0.9rem;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.left-panel, .right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--panel-bg);
  border-right: 1px solid var(--border-color);
}

.tab-bar {
  display: flex;
  background-color: #f1f5f9;
  border-bottom: 1px solid var(--border-color);
}

.tab-button {
  padding: 8px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.9rem;
}

.tab-button.active {
  background-color: var(--panel-bg);
  font-weight: bold;
  border-bottom: 2px solid var(--primary-color);
}

.panel-content {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.code-textarea {
  width: 100%;
  height: 100%;
  font-family: monospace;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  resize: none;
}

.panel-section {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--border-color);
}
```

---

## 8. テスト構成設計 (`src/__tests__/samplePrograms.test.ts`)

Vitest を用いて `samplePrograms.ts` の定数定義が正常であり、要求された 3 つのサンプルが含まれているかを検証します。

```typescript
import { describe, it, expect } from 'vitest';
import { SAMPLE_PROGRAMS } from '../services/samplePrograms';

describe('SAMPLE_PROGRAMS 定数の構造と検証', () => {
  it('3個のプリセットサンプルプログラムが正確に定義されていること', () => {
    expect(SAMPLE_PROGRAMS).toHaveLength(3);
  });

  it('各サンプルプログラムに必要なプロパティが非空で定義されていること', () => {
    SAMPLE_PROGRAMS.forEach((sample) => {
      expect(sample.id).toBeTruthy();
      expect(sample.name).toBeTruthy();
      expect(sample.description).toBeTruthy();
      expect(sample.code).toBeTruthy();
    });
  });

  it('テスト1: 順次・代入プログラムの構文チェック', () => {
    const sample1 = SAMPLE_PROGRAMS.find((s) => s.id === 'basic-sequential');
    expect(sample1).toBeDefined();
    expect(sample1?.code).toContain('x = 5');
    expect(sample1?.code).toContain('print(total)');
  });

  it('テスト2: 条件分岐プログラムの構文チェック', () => {
    const sample2 = SAMPLE_PROGRAMS.find((s) => s.id === 'conditional-branch');
    expect(sample2).toBeDefined();
    expect(sample2?.code).toContain('if score >= 80:');
    expect(sample2?.code).toContain('elif score >= 60:');
  });

  it('テスト3: ループと関数プログラムの構文チェック', () => {
    const sample3 = SAMPLE_PROGRAMS.find((s) => s.id === 'loop-and-function');
    expect(sample3).toBeDefined();
    expect(sample3?.code).toContain('def add(a, b):');
    expect(sample3?.code).toContain('for i in range(1, 4):');
  });
});
```

---

## 9. Implementer に向けた注意事項・品質ルール (Implementation Rules)

1. **ファイル作成順序**:
   - まず `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html` を配置し、必要パッケージ（`npm install` 等）を行う。
   - 次に `src/types/` 配下の 3 つの型定義ファイルを作成する。
   - その後 `src/services/samplePrograms.ts` を実装し、`src/__tests__/samplePrograms.test.ts` を動かす。
   - 最後に UI コンポーネント（`Header`, `LeftPanel`, `RightPanel`, `App`, `main`, `index.css`）を組み上げる。

2. **コーディング規約**:
   - コードコメントはすべて**日本語**で記述すること。
   - 関数・コンポーネontは **30〜50 行を目安**とし、肥大化させないこと。
   - `npx tsc --noEmit` で型エラーが 0 件であることを必ず確認すること。
   - `npm run build` が正常にビルドできることを確認すること。

---

以上が Milestone 1 の包括的実装設計内容です。
