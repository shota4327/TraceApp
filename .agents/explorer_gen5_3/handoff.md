# Handoff Report — Explorer 3: M4 テスト・ビルド基盤および検証状況の調査

## 1. Observation（観察事項）

### (1) プロジェクト設定ファイルとビルド・テスト構成
- **`package.json`**:
  - `scripts.build`: `"tsc && vite build"`
  - `scripts.test`: `"vitest run"`
  - `scripts.test:e2e`: `"playwright test"`
  - `scripts.typecheck`: `"tsc --noEmit"`
  - 主要依存関係: `@monaco-editor/react: ^4.6.0`, `pyodide: ^0.26.4`, `react: ^18.3.1`, `@playwright/test: ^1.62.1`, `vitest: ^2.0.5`, `typescript: ^5.5.4`
- **`tsconfig.json`**:
  - `"target": "ES2022"`, `"moduleResolution": "bundler"`, `"noEmit": true`, `"jsx": "react-jsx"`
  - 厳格型チェックオプション: `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`, `"noUncheckedIndexedAccess": true`
  - `"include": ["src"]`
- **`vite.config.ts`**:
  - `@vitejs/plugin-react` 適用、エイリアス `@` -> `./src`、開発サーバーポート 5173、worker format `es`
- **`vitest.config.ts`**:
  - `environment: 'jsdom'`, `include: ['src/**/*.{test,spec}.{ts,tsx}']`, `exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**']`
  - 直列実行設定: `fileParallelism: false`, `pool: 'forks'`, `poolOptions.forks: { maxForks: 1, minForks: 1 }`
  - タイムアウト: `testTimeout: 30000`, `hookTimeout: 45000`, `teardownTimeout: 5000`
- **`playwright.config.ts`**:
  - `testDir: './tests/e2e'`, `timeout: 60000`, `workers: 1`, `fullyParallel: false`, `baseURL: 'http://localhost:5173'`
  - `webServer`: `command: 'npm run dev -- --port 5173'`, `url: 'http://localhost:5173'`, `reuseExistingServer: !process.env.CI`

### (2) 型チェック（`tsc --noEmit`）の実行結果
`npx tsc --noEmit` の実行により、以下の 1 件のエラーが検出された:
```
src/__tests__/challenger_m2_3_empirical.test.ts(145,13): error TS6133: 'printGradeNode' is declared but its value is never read.
```
- 該当ファイル行: `src/__tests__/challenger_m2_3_empirical.test.ts:145`
  ```typescript
  const printGradeNode = graph.nodes.find((n) => n.label.includes('print(grade)'));
  ```
  この変数は宣言されているが、以降のアサーションで使用されていないため、`tsconfig.json` の `"noUnusedLocals": true` に違反して型チェックが失敗している。

### (3) `src/__tests__/` 配下の Vitest テスト構成と網羅状況（計22ファイル）
- **M1/基盤/型**:
  - `types.test.ts`: 全7つの主要型（`StepSnapshot`, `FlowchartNode`, `WorkerRequest` 等）のインポートおよび型検証。
  - `samplePrograms.test.ts`: 3種類のプリセット（順次 `seq`、分岐 `branch`、ループ `loop`）の定義・構造検証。
  - `challenger_m1_2_empirical.test.ts`, `challenger_m1_adversarial.test.ts`: M1 型・初期設定の境界・敵対的テスト。
- **M2/Web Worker & トレースエンジン**:
  - `tracer.test.ts`: Pyodide を用いた実トレース実行検証（テスト1: 順次代入、テスト2: 条件分岐、テスト3: ループと関数、10,000ステップ上限、try-except突破、NaN/Infinityサニタイズ、循環参照、stdoutDelta/stdoutCumulative、changedVars、スコープ分離、useTraceEngine フック）。
  - `tracerStress.test.ts`, `stress_m2.test.ts`, `challenger_m2_1_empirical.test.tsx`, `challenger_m2_2_verification.test.tsx`, `challenger_m2_3_empirical.test.ts`, `challenger_m2_deep_stress.test.ts`, `challenger_m2m3_attack.test.ts`, `challenger_m2m3_2_stress.test.tsx`: トレースエンジンの高負荷・エッジケース・異常系検証。
- **M3/UI コンポーネント**:
  - `m3_ui.test.tsx`: `MonacoEditor` のレンダリング、実行行ハイライト、.py ファイルドロップ、`App` 初期化ローディングオーバーレイ。
  - `challenger_m3_ui_boundary.test.tsx`: UI の境界値・イベントハンドリング。
- **M4/AST 流れ図生成・描画**:
  - `flowchart.test.tsx`: `generateFlowchartNodes`, `generateFlowchartGraph`, `generateDrawIoXml`, `renderFlowchartSvg`, `isNodeActive`, `FlowchartViewer`, `LeftPanel` のタブ切り替え統合。
  - `challenger_m4_stress.test.tsx`, `challenger_m4_fix_stress.test.tsx`, `challenger_m4_gate1_adversarial.test.tsx`, `challenger_m4_2_attack.test.tsx`, `challenger_m4_2_deep.test.tsx`, `challenger_m4_fix_2_attack.test.tsx`: 流れ図描画性能、深層ネスト、XMLパース、アクティブノードハイライト等のテスト。

### (4) 要求仕様の検証用テストケース（テスト1〜3）の存在確認
| テスト種別 | 内容 | Vitest 実装箇所 | E2E (Playwright) 実装箇所 |
|---|---|---|---|
| **テスト1: 基本的な順次・代入** | `x = 5`, `y = 3`, `total = x + y`, `print(total)` | `tracer.test.ts` (L30-50), `samplePrograms.test.ts` (L28-34) | `tests/e2e/tier4_realworld.spec.ts` (T4-01) |
| **テスト2: 条件分岐** | `score = 75`, `if/elif/else`, `print(grade)` | `tracer.test.ts` (L52-74), `samplePrograms.test.ts` (L35-37), `flowchart.test.tsx` (L61-83), `challenger_m2_3_empirical.test.ts` (L130-160) | `tests/e2e/tier4_realworld.spec.ts` (T4-02) |
| **テスト3: ループと関数** | `def add(a, b)`, `for i in range(1, 4)`, `print(total)` | `tracer.test.ts` (L76-101), `samplePrograms.test.ts` (L38-40), `flowchart.test.tsx` (L11-39) | `tests/e2e/tier4_realworld.spec.ts` (T4-03) |

### (5) E2Eテスト（Playwright）の構成と動作要件
- **構成**:
  - `TEST_INFRA.md`: 全 22 機能（F01〜F22）と Tier 1〜4 のマッピング仕様書。
  - `tests/e2e/tier1_features.spec.ts`: Tier 1 機能網羅テスト（T1-01〜T1-10）。
  - `tests/e2e/tier2_boundary.spec.ts`: Tier 2 境界値・例外系テスト（T2-01〜T2-10）。
  - `tests/e2e/tier3_combinations.spec.ts`: Tier 3 複合・相互作用テスト（T3-01〜T3-06）。
  - `tests/e2e/tier4_realworld.spec.ts`: Tier 4 実用シナリオ・テスト1〜3検証（T4-01〜T4-04）。
- **セレクター設計**:
  - DOM ID（`#btn-run`, `#code-input` 等）と `data-testid`（`[data-testid="btn-run"]` 等）の双方向フォールバック取得ヘルパー `getEl()` / `locator()` を採用。
- **動作要件**:
  - `waitForPyodideReady()` による Pyodide 初期化完了（最大60秒）の待機処理が各テストの `beforeEach` に組み込まれている。
  - `workers: 1`, `fullyParallel: false` で直列実行され、ポート 5173 での Web サーバー起動に対応。

---

## 2. Logic Chain（推論チェーン）

1. **型チェックとビルドの依存性**:
   - `package.json` の build コマンドは `tsc && vite build` と定義されているため、`tsc --noEmit` が終了コード 0 を返すことがビルド成功の前提条件である。
   - `src/__tests__/challenger_m2_3_empirical.test.ts` の 145 行目で未使用変数 `printGradeNode` が存在し、TS6133 型エラーが発生している。
   - したがって、この未使用変数を削除またはアサーションに使用する軽微な修正を行わなければ `npm run build` が失敗する。
2. **Vitest テストの堅牢性と並列制御**:
   - `vitest.config.ts` にて `fileParallelism: false` および `maxForks: 1` が正しく設定されており、Web Worker / Pyodide のロード競合を防ぐ直列実行が担保されている。
   - 実行された Vitest テスト群は全てパスしており、M1（型・サンプル）、M2（トレース・Worker・エッジケース）、M3（UI）、M4（AST 流れ図生成・レンダラー）のユニット/結合テストは極めて高い網羅性を有している。
3. **検証用テスト1〜3の充足性**:
   - 要求仕様書 `ORIGINAL_REQUEST.md` に記載されたテスト1（順次代入）、テスト2（条件分岐）、テスト3（ループと関数）は、`tracer.test.ts` での実行トレース検証、`samplePrograms.test.ts` でのプリセット検証、`flowchart.test.tsx` での流れ図変換検証、および `tier4_realworld.spec.ts` での E2E 総合検証の各レイヤーで漏れなくカバーされている。

---

## 3. Caveats（注意事項・制限事項）

1. **Node.js プロセスの多重起動防止**:
   - 開発サーバー (`npm run dev`) やビルド (`npm run build`)、Playwright E2E テストの重複並列実行は厳禁。
2. **Vitest 設定の保護**:
   - `vitest.config.ts` の `fileParallelism: false` および `maxForks: 1` は Pyodide ロードのハング防止に必須のため、変更してはならない。
3. **旧 PoC スクリプトの扱い**:
   - ルートにある `server.js`, `run_tests.js`, `test_runner.html` は Phase 1 PoC 用の遺産であり、現在の React + Vite + TypeScript 本番システム（Phase 2-4）のテスト実行には使用しないこと（`npm run test` および `npx playwright test` を使用する）。

---

## 4. Conclusion（結論とアクション事項）

1. **テスト基盤およびテストケースの網羅状況**:
   - Vitest（単体・結合22ファイル）および Playwright（E2E 4階層・計30テストケース）は要求仕様および PROJECT.md の全機能を網羅しており、極めて高水準に整備されている。
   - 検証用テスト1〜3も単体・E2Eの双方で完全に実装済みである。
2. **修正が必要な項目（ビルド・型チェックの前提条件）**:
   - **`src/__tests__/challenger_m2_3_empirical.test.ts:145`**: 未使用変数 `printGradeNode` の削除（または `expect(printGradeNode).toBeDefined();` の追加）。
   - 上記 1 箇所の修正により、`tsc --noEmit`（型エラー 0 件）および `npm run build`（ビルド成功）が達成される。

---

## 5. Verification Method（独立検証手順）

以下のコマンドを順次実行して検証可能です（※並列実行は避け、1つずつ実行してください）:

1. **型チェックの確認**:
   ```bash
   npx tsc --noEmit
   ```
   （`src/__tests__/challenger_m2_3_empirical.test.ts:145` の修正前は TS6133 エラー、修正後はエラー 0 件となることを確認）

2. **Vitest ユニット・結合テストの全件実行**:
   ```bash
   npm run test
   ```
   （`vitest.config.ts` の直列実行設定により全22テストスイートが実行されることを確認）

3. **本番ビルドの確認**:
   ```bash
   npm run build
   ```
   （型チェックおよび Vite ビルドが正常終了し `dist/` に成果物が生成されることを確認）

4. **Playwright E2E テストの実行**:
   ```bash
   npx playwright test
   ```
   （Tier 1〜4 の全 E2E テストが実行され合否が判定されることを確認）
