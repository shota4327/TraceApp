# Handoff Report — explorer_3 (Milestone 1)

## 1. Observation (観察事実)
- リポジトリの現況（`c:\Git\TraceApp`）には、`package.json`（Playwright依存のみの初期ファイル）、`index.html`（PoC用コード）、`ORIGINAL_REQUEST.md`、`PROJECT.md`、`.agents/sub_orch_m1/SCOPE.md`、`poc_report.md` が存在しています。
- 現状は Vite + React + TypeScript + Vitest の統合開発環境が構築されておらず、`src/` ディレクトリが存在していません。
- `SCOPE.md` により、Milestone 1 に必要な全タスク（Vite/React/TS環境設定、`trace.ts`/`flowchart.ts`/`worker.ts` 型定義、`samplePrograms.ts` サンプルモジュール、`Header`/`LeftPanel`/`RightPanel`/`App` UIフレームワーク、`samplePrograms.test.ts` 単体テスト）が定義されています。

## 2. Logic Chain (論理展開)
1. **環境構築設計**: Phase 2 以降で Monaco Editor、Web Worker Pyodide、AST 生成器等の高度なモジュールを統合するため、まず Node.js + Vite 5 + React 18 + TypeScript 5 の強固な開発環境と型チェック (`strict: true`) を導入することが必須である。
2. **型定義設計**: `PROJECT.md` に記載のインターフェース契約（`WorkerRequest`/`WorkerResponse`, `StepSnapshot`/`VariableSnapshot`, `FlowchartNode`）に基づき、`src/types/` 配下に 3 ファイルに分割して定義することで、M2（Web Worker）および M3/M4（UI/流れ図）で型競合を起こさず安全に参照・拡張可能とする。
3. **サンプルプログラム設計**: 要件 R4 に従って 3 つの事前定義プログラム（順次、条件分岐、ループ/関数）を `SAMPLE_PROGRAMS` 配列としてモジュール化し、UIコンポーネントおよびテストコードの両方から参照できる構造とする。
4. **UIフレームワーク設計**: 全体画面をヘッダーと 2 ペイン（左: コード/流れ図タブ、右: 変数履歴/stdout）に分割し、教科書的なライトモードデザイン（`src/index.css`）を定義。M3 以降の Monaco Editor や 変数履歴表の組み込みが円滑に行えるプレースホルダー構成とする。
5. **テスト構成設計**: Vitest と `@testing-library/react` を `vite.config.ts` に設定し、`samplePrograms.test.ts` によってプリセットデータが非空かつ構文要件を満たしているかを非同期・高速に検証できる体制を作る。

## 3. Caveats (注意点・制約事項)
- 本報告は Explorer（調査・設計担当）による設計ドキュメントの出力であり、`src/` 配下や `package.json` へのプロジェクトコードの実際の変更・ファイル生成は実装者（Implementer）が行う必要があります。
- Web Worker (`pyodideWorker.ts`) や Pyodide トレーススクリプト本体の実装は Milestone 2 のスコープであり、Monaco Editor の組み込みおよび詳細コンポーネント実装は Milestone 3 のスコープとなります。
- `npm install` 実行環境によっては依存パッケージのネットワークダウンロードが必要となる場合があります。

## 4. Conclusion (結論)
Milestone 1 の全タスク（プロジェクト基盤、型定義、サンプル定義、UIフレームワーク、テスト構成）に対する具体的実装仕様、TypeScript コード案、および検証方法を `c:\Git\TraceApp\.agents\sub_orch_m1\explorer_3\analysis.md` にまとめました。
Implementer 1 は本設計書および `handoff.md` に基づき、直ちに環境構築および基本コンポーネント実装に着手することが可能です。

## 5. Verification Method (検証方法)
Implementer が実装を完了した後、以下の手順で独立検証を実施します:

1. **型チェック検証**:
   ```bash
   npx tsc --noEmit
   ```
   → 型エラーが 0 件で完了すること。

2. **単体テスト検証**:
   ```bash
   npm run test
   ```
   → `src/__tests__/samplePrograms.test.ts` の全テスト（4件以上）が PASS すること。

3. **ビルド検証**:
   ```bash
   npm run build
   ```
   → ビルドがエラーなく成功し、`dist/` ディレクトリが正常生成されること。
