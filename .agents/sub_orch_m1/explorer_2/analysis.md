# Milestone 1 (Infrastructure & Basic Setup) 実装設計書

## 1. 概要 (Overview)
本ドキュメントは、Pythonトレース可視化Webアプリ「TraceApp」の Milestone 1 (Infrastructure & Basic Setup) における技術スタック、ディレクトリ構造、パッケージ依存関係、型定義仕様、UIコンポーネント構成、およびテスト構成を詳細に定義した実装設計書である。

本設計に従うことで、Phase 1 PoC の検証結果に基づいた最新の React 18 + TypeScript + Vite 環境を構築し、以降の Milestone (M2 Worker エンジン, M3 Monaco Editor / ナビゲーション, M4 流れ図描画) へ安全かつ円滑に接続できる強固な基盤を提供する。

---

## 2. ディレクトリ構造とファイル配置 (Directory Layout)

```
c:\Git\TraceApp\
├── index.html                  # HTML エントリポイント (Vite 用)
├── package.json                # パッケージ依存関係およびスクリプト
├── vite.config.ts              # Vite ビルドおよび Vitest テスト設定
├── tsconfig.json               # TypeScript コンパイラ基本設定
├── tsconfig.node.json          # Node 環境用 TS 設定 (Vite 設定ファイル用)
├── src/
│   ├── main.tsx                # React エントリポイント
│   ├── App.tsx                 # メインレイアウトコンポーネント
│   ├── index.css               # グローバルスタイル (ライトモード定義)
│   ├── vite-env.d.ts           # Vite 型定義参照
│   ├── components/             # UI コンポーネント群
│   │   ├── Header.tsx          # ヘッダー (タイトル、サンプル選択)
│   │   ├── LeftPanel.tsx       # 左パネル (タブ切り替え・コード/流れ図表示枠)
│   │   └── RightPanel.tsx      # 右パネル (変数履歴表枠・print出力枠)
│   ├── services/               # サービス・ドメインロジック
│   │   └── samplePrograms.ts   # サンプルプログラムプリセット定義
│   ├── types/                  # 共有インターフェース・型定義
│   │   ├── trace.ts            # トレースデータ型 (`StepSnapshot` 等)
│   │   ├── flowchart.ts        # 流れ図データ型 (`FlowchartNode` 等)
│   │   └── worker.ts           # Worker 通信型 (`WorkerMessage` 等)
│   └── __tests__/              # 単体テスト
│       └── samplePrograms.test.ts # サンプルプログラムモジュールテスト
```

---

## 3. パッケージ構成と環境設定 (Packages & Configurations)

### 3.1 `package.json` 設計案
`package.json` には Vite + React 18 + TS 開発環境に必要な依存パッケージを定義する。

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
    "test:watch": "vitest"
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
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.8",
    "jsdom": "^24.1.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.0",
    "vitest": "^2.0.5",
    "playwright": "^1.62.1"
  }
}
```

### 3.2 `vite.config.ts` 設計案
`vite.config.ts` では React プラグインおよび Vitest テスト環境 (`jsdom`) を設定する。

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
  },
});
```

### 3.3 `tsconfig.json` 設計案 (`strict: true` 設定)
厳格な型チェックを実施し、型エラー0件を保証する。

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting / Strict Flags */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

---

## 4. 型定義仕様 (Type Definitions Specification)

`PROJECT.md` の Interface Contracts に厳密に準拠した型定義を作成する。

### 4.1 トレース型定義 (`src/types/trace.ts`)
```typescript
/**
 * 変数のスナップショット値型
 * 基本型 (number, string, boolean) または特殊値 ("NaN", "Infinity", "-Infinity", "Undefined")
 */
export type VariableValue = number | string | boolean | null;

/**
 * 各変数のキー・値マップ
 */
export interface VariableSnapshot {
  [varName: string]: VariableValue;
}

/**
 * 1ステップあたりの状態スナップショット
 */
export interface StepSnapshot {
  stepIndex: number;
  line: number;
  event: 'line' | 'call' | 'return';
  functionName?: string;
  globals: VariableSnapshot;
  locals: VariableSnapshot;
  changedVars: string[];
  stdoutDelta: string;
  stdoutCumulative: string;
  astNodeId?: string;
}

/**
 * 全ステップのトレース結果構造体
 */
export interface TraceResult {
  snapshots: StepSnapshot[];
  totalSteps: number;
  stdout: string;
  flowchartXml?: string;
  flowchartNodes?: FlowchartNode[];
}
```

### 4.2 流れ図型定義 (`src/types/flowchart.ts`)
```typescript
/**
 * 流れ図のノード種別
 * - terminal: 角丸長方形 (端子: 開始/終了)
 * - process: 長方形 (処理: 代入, print等)
 * - decision: ひし形 (判断: if/elif)
 * - loop: 六角形 (繰り返し: for/while)
 * - subroutine: 二重線長方形 (関数呼び出し/定義)
 */
export type FlowchartNodeType =
  | 'terminal'
  | 'process'
  | 'decision'
  | 'loop'
  | 'subroutine';

/**
 * 流れ図ノード情報
 */
export interface FlowchartNode {
  id: string;
  type: FlowchartNodeType;
  label: string;
  lineRange?: [number, number];
  children?: FlowchartNode[];
  xmlSnippet?: string;
}
```

### 4.3 Web Worker 通信型定義 (`src/types/worker.ts`)
```typescript
import { TraceResult } from './trace';

/**
 * メインスレッド → Web Worker への要求メッセージ
 */
export type WorkerRequest =
  | { type: 'INIT' }
  | { type: 'RUN_TRACE'; code: string; maxSteps?: number };

/**
 * Web Worker → メインスレッド への応答メッセージ
 */
export type WorkerResponse =
  | { type: 'INIT_COMPLETE' }
  | { type: 'INIT_ERROR'; error: string }
  | { type: 'TRACE_SUCCESS'; result: TraceResult }
  | { type: 'TRACE_ERROR'; error: string };
```

---

## 5. サンプルプログラムモジュール (`src/services/samplePrograms.ts`)

`ORIGINAL_REQUEST.md` の検証用テストプログラム (1〜3) をプリセットとして提供する。

```typescript
/**
 * サンプルプログラムの型定義
 */
export interface SampleProgram {
  id: string;
  title: string;
  description: string;
  code: string;
}

/**
 * プリセットサンプルプログラム群
 */
export const SAMPLE_PROGRAMS: SampleProgram[] = [
  {
    id: 'basic_calc',
    title: 'サンプル1: 基本順次・代入',
    description: '変数への代入と簡単な四則演算を行う基本的なプログラム',
    code: `x = 5
y = 3
total = x + y
print(total)`,
  },
  {
    id: 'conditional',
    title: 'サンプル2: 条件分岐',
    description: 'if / elif / else による条件判断の動作を確認するプログラム',
    code: `score = 75
if score >= 80:
    grade = "A"
elif score >= 60:
    grade = "B"
else:
    grade = "C"
print(grade)`,
  },
  {
    id: 'loop_function',
    title: 'サンプル3: ループと関数',
    description: '関数の定義・呼び出しと for ループによる繰り返し処理のプログラム',
    code: `def add(a, b):
    result = a + b
    return result

total = 0
for i in range(1, 4):
    total = add(total, i)
print(total)`,
  },
];

/**
 * ID からサンプルプログラムを取得する
 */
export function getSampleProgramById(id: string): SampleProgram | undefined {
  return SAMPLE_PROGRAMS.find((p) => p.id === id);
}

/**
 * デフォルトのサンプルプログラムを取得する
 */
export function getDefaultSampleProgram(): SampleProgram {
  return SAMPLE_PROGRAMS[0];
}
```

---

## 6. UI コンポーネント設計 (UI Framework Architecture)

ライトモード基調の教科書風デザイン（視認性の高いホワイト・ライトグレー、ブルー系のアクセントカラー）を適用する。
各コンポーネントは 30〜50 行以内に収まるようモジュール分離する。

### 6.1 `src/components/Header.tsx` (ヘッダーコンポーネント)
```tsx
import React from 'react';
import { Code2 } from 'lucide-react';
import { SAMPLE_PROGRAMS } from '../services/samplePrograms';

interface HeaderProps {
  selectedSampleId: string;
  onSelectSample: (id: string) => void;
}

/**
 * アプリケーションヘッダー
 * タイトル表示およびサンプルプログラム選択ドロップダウンを提供
 */
export const Header: React.FC<HeaderProps> = ({
  selectedSampleId,
  onSelectSample,
}) => {
  return (
    <header className="header-container">
      <div className="header-title">
        <Code2 className="icon" size={24} />
        <h1>TraceApp - Pythonトレース可視化</h1>
      </div>
      <div className="header-controls">
        <label htmlFor="sample-select" className="label">
          サンプル選択:
        </label>
        <select
          id="sample-select"
          value={selectedSampleId}
          onChange={(e) => onSelectSample(e.target.value)}
          className="select-box"
        >
          {SAMPLE_PROGRAMS.map((sample) => (
            <option key={sample.id} value={sample.id}>
              {sample.title}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
};
```

### 6.2 `src/components/LeftPanel.tsx` (左パネルコンポーネント)
```tsx
import React from 'react';

interface LeftPanelProps {
  activeTab: 'code' | 'flowchart';
  onTabChange: (tab: 'code' | 'flowchart') => void;
  code: string;
  onCodeChange: (newCode: string) => void;
}

/**
 * 左パネル: コードエディタ/流れ図のタブ切り替えと表示エリア
 */
export const LeftPanel: React.FC<LeftPanelProps> = ({
  activeTab,
  onTabChange,
  code,
  onCodeChange,
}) => {
  return (
    <div className="left-panel">
      <div className="tab-header">
        <button
          className={`tab-btn ${activeTab === 'code' ? 'active' : ''}`}
          onClick={() => onTabChange('code')}
        >
          コード
        </button>
        <button
          className={`tab-btn ${activeTab === 'flowchart' ? 'active' : ''}`}
          onClick={() => onTabChange('flowchart')}
        >
          流れ図
        </button>
      </div>
      <div className="tab-content">
        {activeTab === 'code' ? (
          <textarea
            className="code-textarea"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="Pythonコードを入力してください..."
          />
        ) : (
          <div className="flowchart-placeholder">
            <p>流れ図表示エリア (Milestone 4にて実装)</p>
          </div>
        )}
      </div>
    </div>
  );
};
```

### 6.3 `src/components/RightPanel.tsx` (右パネルコンポーネント)
```tsx
import React from 'react';

/**
 * 右パネル: 変数履歴表表示エリアおよび print 出力表示エリア
 */
export const RightPanel: React.FC = () => {
  return (
    <div className="right-panel">
      <div className="panel-section variable-section">
        <h3>変数履歴表</h3>
        <div className="table-placeholder">
          <p>トレース実行後に変数履歴が表示されます (Milestone 3にて実装)</p>
        </div>
      </div>
      <div className="panel-section output-section">
        <h3>print 出力</h3>
        <div className="console-placeholder">
          <pre className="console-output">出力結果がここに表示されます...</pre>
        </div>
      </div>
    </div>
  );
};
```

### 6.4 `src/App.tsx` (メインコンポーネント)
```tsx
import React, { useState } from 'react';
import { Header } from './components/Header';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import {
  SAMPLE_PROGRAMS,
  getSampleProgramById,
} from './services/samplePrograms';

/**
 * メインアプリケーションコンポーネント
 */
export const App: React.FC = () => {
  const [selectedSampleId, setSelectedSampleId] = useState<string>(
    SAMPLE_PROGRAMS[0].id
  );
  const [code, setCode] = useState<string>(SAMPLE_PROGRAMS[0].code);
  const [activeTab, setActiveTab] = useState<'code' | 'flowchart'>('code');

  const handleSelectSample = (id: string) => {
    setSelectedSampleId(id);
    const sample = getSampleProgramById(id);
    if (sample) {
      setCode(sample.code);
    }
  };

  return (
    <div className="app-container">
      <Header
        selectedSampleId={selectedSampleId}
        onSelectSample={handleSelectSample}
      />
      <main className="main-content">
        <LeftPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          code={code}
          onCodeChange={setCode}
        />
        <RightPanel />
      </main>
    </div>
  );
};
```

---

## 7. 単体テスト構成 (Unit Testing Setup)

Vitest を用いたサンプルプログラムモジュールの単体テスト構成。

### 7.1 `src/__tests__/samplePrograms.test.ts` 設計案
```typescript
import { describe, it, expect } from 'vitest';
import {
  SAMPLE_PROGRAMS,
  getSampleProgramById,
  getDefaultSampleProgram,
} from '../services/samplePrograms';

describe('samplePrograms モジュールテスト', () => {
  it('プリセットサンプルが最侎3種類定義されていること', () => {
    expect(SAMPLE_PROGRAMS.length).toBeGreaterThanOrEqual(3);
  });

  it('指定した ID のサンプルプログラムが正しく取得できること', () => {
    const sample = getSampleProgramById('conditional');
    expect(sample).toBeDefined();
    expect(sample?.title).toContain('条件分岐');
    expect(sample?.code).toContain('score = 75');
  });

  it('存在しない ID の場合は undefined を返すこと', () => {
    const sample = getSampleProgramById('non_existent');
    expect(sample).toBeUndefined();
  });

  it('デフォルトサンプルが取得できること', () => {
    const defaultSample = getDefaultSampleProgram();
    expect(defaultSample).toBeDefined();
    expect(defaultSample.id).toBe('basic_calc');
  });
});
```

---

## 8. 検証・品質チェック手順 (Verification Procedures)

Milestone 1 実装完了時に以下のコマンドを順次実行し、品質基準を満たしていることを検証する。

1. **型チェック**:
   `npx tsc --noEmit` を実行し、型エラーが **0件** であることを確認。
2. **単体テスト**:
   `npm run test` (または `npx vitest run`) を実行し、全テストケースが **PASS** することを確認。
3. **プロダクションビルド**:
   `npm run build` を実行し、`dist/` ディレクトリにエラーなくアセットが出力されることを確認。

---

## 9. 結論と Implementer への引継ぎ事項 (Conclusion & Instructions for Implementers)

本設計により、Milestone 1 の実装範囲（パッケージ初期導入、厳格な TypeScript 型定義、サンプルプログラム定義、2ペイン画面のスケルトンUI、単体テスト環境）が完全に明確化された。
Implementer 1 / Implementer 2 は本設計書をガイドラインとして、ファイルの作成・配置・コード記述を行われたい。
