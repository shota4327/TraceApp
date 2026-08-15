# TraceApp Milestone 1 (Infrastructure & Basic Setup) 設計・調査分析レポート

## 1. エグゼクティブサマリー

本レポートは、プログラミング教育用 Python トレース可視化 Web アプリ「TraceApp」の Milestone 1 (Infrastructure & Basic Setup) における現状調査、技術設計、パッケージ依存関係、型定義仕様、UI 構成、およびテスト構成案をまとめた分析報告書です。

Phase 1 PoC において Pyodide + `sys.settrace()` によるステップトレース機能の完動が実証されたのを受け、Milestone 1 では今後の全機能（Pyodide Web Worker エンジン、Monaco Editor、変数履歴表、AST 流れ図生成等）を支える **Vite + React + TypeScript 開発基盤、堅牢な共通型定義、サンプルプログラム定義、および教科書風 2 ペイン UI レイアウト構造**の基本枠組みを確立することを目的とします。

---

## 2. リポジトリ現況分析

### 2.1 現状の構成
- リポジトリ直下 (`c:\Git\TraceApp`) には、Phase 1 PoC 開発時の成果物である `index.html`（Pyodide 単一 HTML 検証用）、`test_runner.html`、`run_tests.js`、`poc_report.md` が存在します。
- `package.json` は現状 Playwright のみが登録されており、Vite, React, TypeScript, Monaco Editor, Pyodide 等の依存パッケージや、`vite.config.ts`, `tsconfig.json` などの設定ファイル、および `src/` ソースディレクトリは未構築の状態です。

### 2.2 Milestone 1 のゴール
1. **プロジェクト基盤環境構築**: Vite + React + TypeScript + Vitest のビルド・テスト・型検証環境の完成。
2. **型定義・共有インターフェース**: `PROJECT.md` のインターフェース契約に完全準拠した TypeScript 型定義の提供。
3. **サンプルプログラムの定義**: トレース検証用 3 プリセットプログラムの共通モジュール化。
4. **2ペイン UI フレームワーク**: ライトモード（教科書風）基調の React レイアウト枠組みの構築。
5. **テスト・ビルド検証**: Vitest による単体テストの実行と `npx tsc --noEmit` / `npm run build` のエラーゼロ達成。

---

## 3. ファイル構造とディレクトリ設計

`PROJECT.md` および `SCOPE.md` に準拠したディレクトリ配置設計は以下の通りです。
`src/` 配下に責務ごとに明確に分離し、`.agents/` 内にはエージェント用メタデータ（設計・進捗・ハンズオフ等）のみを格納します（ソースコードやテストコードの `.agents/` 配置は禁止）。

```
c:\Git\TraceApp\
├── .agents/                        # Agent metadata files (NO source code here)
│   └── sub_orch_m1/
│       └── explorer_1/
│           ├── analysis.md         # 本分析レポート
│           ├── BRIEFING.md         # BRIEFING 記憶管理
│           ├── DISPATCH.md         # 指示書
│           ├── handoff.md          # 完了ハンドオフ報告
│           └── progress.md         # リアルタイム進捗ログ
├── public/                         # 静的アセット（ファビコン等）
├── src/
│   ├── assets/                     # 基本スタイル・画像
│   ├── components/                 # React UI コンポーネント群
│   │   ├── Header.tsx              # ヘッダー（タイトル・サンプル切替ドロップダウン）
│   │   ├── LeftPanel.tsx           # 左パネル（コード / 流れ図 タブ切り替え枠）
│   │   ├── RightPanel.tsx          # 右パネル（変数履歴表 / print出力 容器）
│   │   ├── MonacoEditor.tsx        # Monaco エディタ受入用プレースホルダー
│   │   ├── StepNavigation.tsx     # ナビゲーション操作バープレースホルダー
│   │   ├── VariableTable.tsx       # 変数履歴表プレースホルダー
│   │   ├── OutputConsole.tsx       # print 出力表示プレースホルダー
│   │   └── FlowchartViewer.tsx     # 流れ図表示プレースホルダー
│   ├── hooks/                      # カスタム React フック
│   │   ├── useTraceEngine.ts       # Worker 通信フック受入用スタブ
│   │   └── useStepNavigation.ts    # ステップ状態管理フックスタブ
│   ├── services/                   # 共通サービス & データ定義
│   │   ├── samplePrograms.ts       # プリセットサンプルプログラム 3 種
│   │   ├── flowchartGenerator.ts   # AST 解析エンジンスタブ (M4)
│   │   └── flowchartRenderer.ts    # SVG/Canvas レンダラースタブ (M4)
│   ├── types/                      # 共通型定義モジュール
│   │   ├── trace.ts                # StepSnapshot, VariableSnapshot, TraceResult
│   │   ├── flowchart.ts            # FlowchartNode, FlowchartNodeType
│   │   └── worker.ts               # WorkerRequest, WorkerResponse
│   ├── worker/                     # Pyodide Web Worker ディレクトリ
│   │   ├── pyodideWorker.ts        # Worker エントリポイントスタブ (M2)
│   │   └── pythonTracer.py         # sys.settrace Python トレーサー (M2)
│   ├── App.tsx                     # 全体レイアウト & 状態統合コンポーネント
│   ├── main.tsx                    # React エントリポイント
│   ├── index.css                   # Tailwind / CSS グローバルスタイル
│   └── __tests__/                  # 単体テストディレクトリ
│       └── samplePrograms.test.ts # サンプルプログラム構造検証テスト
├── index.html                      # HTML5 エントリポイント
├── package.json                    # npm パッケージ設定
├── tsconfig.json                   # TypeScript strict モード設定
├── tsconfig.node.json              # Vite Node 用 TypeScript 設定
├── vite.config.ts                  # Vite ビルド・開発サーバー設定
└── vitest.config.ts                # Vitest テスト設定
```

---

## 4. パッケージ構成 & 設定ファイル仕様

### 4.1 `package.json` の設計

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
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@monaco-editor/react": "^4.6.0",
    "monaco-editor": "^0.50.0",
    "lucide-react": "^0.420.0",
    "pyodide": "^0.26.4"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.1",
    "playwright": "^1.62.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.1",
    "vitest": "^2.0.5"
  }
}
```

### 4.2 `tsconfig.json` の設計 (`strict: true` 徹底)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Strict Type-Checking Options */
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    /* Additional Checks */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src"]
}
```

### 4.3 `vite.config.ts` の設計

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vite 設定: React プラグイン有効化およびパスエイリアス設定
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  worker: {
    format: 'es',
  },
});
```

### 4.4 `vitest.config.ts` の設計

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vitest 設定: jsdom 環境およびパスエイリアスの統合
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

---

## 5. 型定義詳細仕様 (`src/types/`)

`PROJECT.md` の「Interface Contracts」に規定された全インターフェースを完全実装します。

### 5.1 `src/types/trace.ts`
```typescript
/**
 * 変数スナップショット型
 * 変数名をキーとし、基本型 (int, float, str, bool) または特殊文字列 ("NaN", "Infinity", "-Infinity", "Undefined") を保持
 */
export interface VariableSnapshot {
  [varName: string]: string | number | boolean | null;
}

/**
 * ステップスナップショット型
 * 1ステップごとの実行行番号、各種変数スコープ、差分・累積出力文字列を保持
 */
export interface StepSnapshot {
  /** ステップインデックス（0始まりの連番） */
  stepIndex: number;
  /** 実行中のPythonコード行番号（1始まり） */
  line: number;
  /** トレースイベント（'line' | 'call' | 'return'） */
  event: 'line' | 'call' | 'return';
  /** 関数実行中の場合の関数名 */
  functionName?: string;
  /** グローバル変数のスナップショット */
  globals: VariableSnapshot;
  /** ローカル変数のスナップショット */
  locals: VariableSnapshot;
  /** 本ステップで値が更新・追加された変数名の一覧 */
  changedVars: string[];
  /** 本ステップで新規に出力された標準出力文字列 */
  stdoutDelta: string;
  /** ここまでの累積標準出力文字列 */
  stdoutCumulative: string;
  /** 対応する流れ図のASTノードID (M4用) */
  astNodeId?: string;
}

/**
 * トレース全体実行結果型
 * Worker からメインスレッドへ返却される結果データ構造
 */
export interface TraceResult {
  /** 全ステップのスナップショット配列 */
  snapshots: StepSnapshot[];
  /** 総ステップ数 */
  totalSteps: number;
  /** 全体の累積標準出力 */
  stdout: string;
  /** draw.io mxGraph XML形式データ (M4用) */
  flowchartXml?: string;
  /** 流れ図ノード一覧 (M4用) */
  flowchartNodes?: any[];
}
```

### 5.2 `src/types/flowchart.ts`
```typescript
/**
 * 流れ図ノード種別型
 * - terminal: 端子（開始・終了: 角丸長方形）
 * - process: 処理（代入・四則演算・print等: 長方形）
 * - decision: 判断（if/elif: ひし形）
 * - loop: 繰り返し（while/for: 六角形/角取れ長方形）
 * - subroutine: サブルーチン（関数定義・呼び出し: 二重線長方形）
 */
export type FlowchartNodeType =
  | 'terminal'
  | 'process'
  | 'decision'
  | 'loop'
  | 'subroutine';

/**
 * 流れ図ノード構造体
 */
export interface FlowchartNode {
  /** ノード固有識別子 (例: "node_1") */
  id: string;
  /** ノード種別 */
  type: FlowchartNodeType;
  /** ノード内に表示するテキストラベル */
  label: string;
  /** 対応するソースコードの行番号範囲 [開始行, 終了行] */
  lineRange?: [number, number];
  /** 子ノード配列（条件分岐やループブロックのネスト表現用） */
  children?: FlowchartNode[];
  /** draw.io mxGraph XMLスニペット */
  xmlSnippet?: string;
}
```

### 5.3 `src/types/worker.ts`
```typescript
import { TraceResult } from './trace';

/**
 * メインスレッドから Web Worker へのリクエストメッセージ型
 */
export type WorkerRequest =
  | { type: 'INIT' }
  | { type: 'RUN_TRACE'; code: string; maxSteps?: number };

/**
 * Web Worker からメインスレッドへのレスポンスメッセージ型
 */
export type WorkerResponse =
  | { type: 'INIT_COMPLETE' }
  | { type: 'INIT_ERROR'; error: string }
  | { type: 'TRACE_SUCCESS'; result: TraceResult }
  | { type: 'TRACE_ERROR'; error: string };
```

---

## 6. サンプルプログラムモジュール仕様 (`src/services/samplePrograms.ts`)

ORIGINAL_REQUEST.md および SCOPE.md で要求されている 3 種類の検証用サンプルプログラムをプリセットとして共通定義します。

```typescript
/**
 * サンプルプログラム構造体
 */
export interface SampleProgram {
  id: string;
  name: string;
  description: string;
  code: string;
}

/**
 * プリセットサンプルプログラム 3 種
 */
export const SAMPLE_PROGRAMS: SampleProgram[] = [
  {
    id: 'sample1',
    name: '1. 基本的な順次・代入',
    description: '変数の代入と四則演算、計算結果の出力',
    code: `x = 5\ny = 3\ntotal = x + y\nprint(total)`
  },
  {
    id: 'sample2',
    name: '2. 条件分岐',
    description: 'if / elif / else による数値評価と条件分岐',
    code: `score = 75\nif score >= 80:\n    grade = "A"\nelif score >= 60:\n    grade = "B"\nelse:\n    grade = "C"\nprint(grade)`
  },
  {
    id: 'sample3',
    name: '3. ループと関数',
    description: '関数定義・呼び出しと for ループによる累積処理',
    code: `def add(a, b):\n    result = a + b\n    return result\n\ntotal = 0\nfor i in range(1, 4):\n    total = add(total, i)\nprint(total)`
  }
];

/** デフォルトで選択されるサンプルプログラム */
export const DEFAULT_SAMPLE = SAMPLE_PROGRAMS[0];
```

---

## 7. UI レイアウト & コンポーネント構造設計

教科書風（Light Mode / Academic Theme）デザイン基調を実現する 2 ペイン構造コンポーネント設計です。

### 7.1 スタイルガイドライン (`src/index.css`)
- 背景色: オフホワイト / ライトグレー (`#F8FAFC` / `#FFFFFF`)
- 枠線・区切り: 細いグレー線 (`1px solid #E2E8F0`)
- プライマリカラー: アカデミックブルー (`#2563EB`)
- 変更・強調表示: マイルドイエロー (`#FEF08A` / `#FDE047`)
- フォント: モノスペース (`Consolas`, `Monaco`, `Courier New`) をコード・テーブル・コンソール領域に採用

### 7.2 コンポーネントツリーと役割

1. **`App.tsx`**:
   - アプリ全体のレイアウトコンテナ。
   - 選択中サンプルプログラム、現在のタブ選択（'code' | 'flowchart'）などの主要 UI 状態を保持。
   - 上部に `Header`、中央に左右 2 ペイン分割エリアを配置。

2. **`Header.tsx`**:
   - アプリケーションロゴ / タイトル表示 (`TraceApp - Python学習トレース可視化ツール`)。
   - サンプルプログラム選択ドロップダウンメニュー (`<select>`)。
   - サンプル変更時に `App.tsx` のコード状態を更新するイベントを発行。

3. **`LeftPanel.tsx`**:
   - 左パネル領域。上部に「コード (Code)」と「流れ図 (Flowchart)」の切り替えタブを配置。
   - 「コード」タブ選択時: `MonacoEditor.tsx` を表示。
   - 「流れ図」タブ選択時: `FlowchartViewer.tsx` を表示。
   - 下部: ステップナビゲーションバー (`StepNavigation.tsx` - 「前へ」「次へ」「リセット」ボタン、ステップスライダー)。

4. **`RightPanel.tsx`**:
   - 右パネル領域。縦に 2 分割（上部 60% : 変数履歴表、下部 40% : print出力コンソール）。
   - 上部: `VariableTable.tsx`（スプレッドシート型変数履歴表示枠）。
   - 下部: `OutputConsole.tsx`（標準出力キャプチャ表示枠）。

---

## 8. テスト構成 & ビルド検証計画

### 8.1 Vitest 単体テスト (`src/__tests__/samplePrograms.test.ts`)
`SAMPLE_PROGRAMS` の構造と内容を検証する単体テストを構築します。

```typescript
import { describe, it, expect } from 'vitest';
import { SAMPLE_PROGRAMS, DEFAULT_SAMPLE } from '../services/samplePrograms';

describe('samplePrograms Service Test', () => {
  it('プリセットサンプルが正確に3種類定義されていること', () => {
    expect(SAMPLE_PROGRAMS).toHaveLength(3);
  });

  it('デフォルトサンプルが定義されていること', () => {
    expect(DEFAULT_SAMPLE).toBeDefined();
    expect(DEFAULT_SAMPLE.id).toBe('sample1');
  });

  it('全サンプルプログラムに必須プロパティ(id, name, code)が含まれていること', () => {
    SAMPLE_PROGRAMS.forEach((sample) => {
      expect(sample.id).toBeTypeOf('string');
      expect(sample.name).toBeTypeOf('string');
      expect(sample.code).toBeTypeOf('string');
      expect(sample.code.length).toBeGreaterThan(0);
    });
  });

  it('サンプルプログラムの内容が要求仕様コードを含んでいること', () => {
    expect(SAMPLE_PROGRAMS[0]?.code).toContain('x = 5');
    expect(SAMPLE_PROGRAMS[1]?.code).toContain('if score >= 80:');
    expect(SAMPLE_PROGRAMS[2]?.code).toContain('def add(a, b):');
  });
});
```

### 8.2 ビルド & 型チェック検証コマンド
Implementer の作業完了時には、以下の検証をすべて通過する必要があります。
1. `npx vitest run`: 全テスト PASS
2. `npx tsc --noEmit`: 型エラー 0 件
3. `npm run build`: Vite ビルド正常完了 (`dist/` 出力確認)

---

## 9. インプレメンター (Implementer) 向け実装ロードマップ

Implementer が Milestone 1 の作業を迷いなく進めるための推薦順序です。

1. **[Step 1] ルート設定ファイル & `package.json` の配置・インストール**:
   - `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html` の作成
   - `npm install` の実行
2. **[Step 2] 型定義ファイルの作成**:
   - `src/types/trace.ts`
   - `src/types/flowchart.ts`
   - `src/types/worker.ts`
3. **[Step 3] サンプルプログラムモジュールの作成**:
   - `src/services/samplePrograms.ts`
4. **[Step 4] UI レイアウトコンポーネントの実装**:
   - `src/index.css`（ライトモード・スタイル）
   - `src/components/Header.tsx`
   - `src/components/LeftPanel.tsx`
   - `src/components/RightPanel.tsx`
   - `src/components/MonacoEditor.tsx` (M3受け口プレースホルダー)
   - `src/components/StepNavigation.tsx` (M3受け口プレースホルダー)
   - `src/components/VariableTable.tsx` (M3受け口プレースホルダー)
   - `src/components/OutputConsole.tsx` (M3受け口プレースホルダー)
   - `src/components/FlowchartViewer.tsx` (M4受け口プレースホルダー)
   - `src/App.tsx`
   - `src/main.tsx`
5. **[Step 5] 単体テストの作成と実行**:
   - `src/__tests__/samplePrograms.test.ts`
   - `npx vitest run` 実行と PASS 確認
6. **[Step 6] ビルド & 型チェックの実行**:
   - `npx tsc --noEmit`
   - `npm run build`

---

## 10. 品質管理・制約チェックリスト

- [x] すべてのコードコメント・解説文は**日本語**で記述する設計となっているか？
- [x] 各関数およびコンポーネントは **30〜50 行以内** を目安に適切に分割されているか？
- [x] `src/` 内に JavaScript (.js/.jsx) ファイルを一切作成しない構成となっているか？
- [x] `.agents/` ディレクトリ配下にはメタデータのみを置き、ソースコードやテストコードを含めない設計になっているか？
- [x] TypeScript の `strict: true` 設定を適用し、型エラーが一切発生しない型定義となっているか？
