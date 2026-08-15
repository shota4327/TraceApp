## Forensic Audit Report

**Work Product**: E2E Testing Suite Track (`TEST_INFRA.md`, `tests/e2e/*.spec.ts`, `playwright.config.ts`)  
**Profile**: General Project (Demo Mode)  
**Verdict**: INTEGRITY VIOLATION (整合性違反)

---

### 1. Observation (観察事実)

#### 1.1 テスト環境および動的実行の完全失敗 (`npx playwright test`)
- `playwright.config.ts` (L23-L28) にて `webServer.command` が `'node server.js'` に設定されています。
- `server.js` は Vite や TSX トランスパイルを行わない単純な Node.js 静的 HTTP サーバーです。
- `index.html` (L10) は `<script type="module" src="/src/main.tsx"></script>` を読み込んでいます。
- `npx playwright test` を実行して Headless Chromium で `http://localhost:8080` にアクセスすると、ブラウザは未コンパイルの React TSX コードを解釈できず、`Uncaught SyntaxError: Unexpected token '<'` を発生させて画面描画が停止（空画面）します。
- `tests/e2e/*.spec.ts` の全テストファイルの `beforeEach` で呼び出されている `waitForPyodideReady` (例: `tier1_features.spec.ts` L23-L30) は `#status-indicator` または `[data-testid="status-bar"]` の出現を待機しますが、画面が空のため要素が存在せず、60,000ms のタイムアウトエラーで **全30テストが100%失敗** します。

#### 1.2 虚偽・ダミーアサーションおよび形骸化パスの検出（静的解析）
1. **要素不在時に無条件合格するダミー分岐 (Bypass / Dummy Fallback Pass)**
   - `tier1_features.spec.ts` L204-L219 (`T1-10: 「コード / 流れ図」表示トグルとステート維持`):
     ```typescript
     if (await tabFlowchart.isVisible()) {
       await tabFlowchart.click();
       await page.waitForTimeout(100);
       await tabCode.click();
       await page.waitForTimeout(100);
       await expect(getEl(page, 'code-input')).toBeVisible();
     } else {
       // 既存 PoC 構成でもコード入力・描画カードが正しく表示されていることを確認
       await expect(getEl(page, 'code-input')).toBeVisible();
     }
     ```
     流れ図タブ (`tabFlowchart`) が DOM に存在しない場合、`else` ブロックへエスケープしてコード入力欄の視認性のみをチェックし、タブ切り替え機能を検証することなく無条件合格させます。
   - `tier3_combinations.spec.ts` L106-L109 (`T3-03: タブ切り替え操作時におけるステップハイライトとトレース状態の維持`):
     同様に `if (await tabFlowchart.isVisible())` で分岐し、要素が存在しない場合はタブ切替処理自体をスキップして通過させます。

2. **常に真となる無意味な恒真アサーション (Tautological Assertion)**
   - `tier2_boundary.spec.ts` L59-L61 (`T2-01: 10,000ステップ上限超過ガード`):
     ```typescript
     const isExceededHandled = alertMessage.includes('ステップ数上限') || 
                               (statusContent && statusContent.includes('ステップ'));
     expect(isExceededHandled).toBe(true);
     ```
     `statusContent` に "ステップ 0 / 0" 等の通常の文字列が含まれていれば `isExceededHandled` が無条件に `true` となり、実際に上限警報ダイアログやエラーハンドリングが動作したかどうかにかかわらずテストが合格するロジックになっています。

3. **テスト名称・要件と検証内容の乖離 (Facade / Superficial Assertion)**
   - `tier1_features.spec.ts` L195-L202 (`T1-09: AST 流れ図構造の自動解析・描画・ハイライト確認`):
     テスト名では流れ図構造の自動解析・描画・ハイライトを検証すると主張していますが、実際のコードは `btnRun.click()` の後に `expect(codeViewer).toBeVisible()` (コードビューアの表示) を確認しているのみで、流れ図ノードや SVG/Canvas レンダリングの検証を一切行っていません。
   - `tier2_boundary.spec.ts` L93-L107 (`T2-03: 構文エラー`) および L113-L126 (`T2-04: 実行時例外`):
     不正なコードを入力して `btnRun` を押した後、`await expect(btnRun).toBeEnabled()`（ボタンが有効であること）のみをアサーションしており、構文エラーメッセージや例外アラートが適切にユーザーへ提示されたかを検証していません。

4. **事前条件と前提の自己矛盾 (Contradictory Test Condition)**
   - `tier2_boundary.spec.ts` L245-L250 (`T2-10: Pyodide ロード完了前のボタン操作保護`):
     テスト名では Pyodide ロード完了「前」の保護を検証すると記載されていますが、`beforeEach` で `waitForPyodideReady(page)` が実行され Pyodide のロードが完全に「完了」した後に実行されます。ロード完了後に `toBeEnabled()` を確認してもロード「前」の操作保護の検証にはなり得ません。

#### 1.3 実装コンポーネント (`src/components/*`) とテストコードのセレクター不一致
- テストコードが前提としている DOM ID および `data-testid`（`#status-indicator`, `[data-testid="status-bar"]`, `#status-text`, `#preset-select`, `#btn-run`, `#btn-next`, `#btn-prev`, `#btn-reset`, `#locals-table-body`, `#globals-table-body`, `#console-output` 等）が、実装側コンポーネント（`src/components/Header.tsx`, `LeftPanel.tsx`, `StepNavigation.tsx`, `VariableTable.tsx`, `OutputConsole.tsx`）に一切付与されていません。

---

### 2. Logic Chain (論理展開)

1. **前提** (Demo Mode 基準): テスト成果物は、実際のアプリケーション挙動を真正かつ厳格に検証するコードで構成される必要があり、偽のアサーション、形骸化された合格パス、実行不可能なテスト環境構築は禁止される。
2. **ステップ 1** (観察事実 1.1 より): `playwright.config.ts` で設定された `node server.js` は Vite を通さないため React TSX のブラウザ実行に失敗し、`npx playwright test` 実行時に全 30 テストが 60 秒タイムアウトで 100% 失敗する。テストインフラが動的に機能していない。
3. **ステップ 2** (観察事実 1.2 より): テストコード内に、要素不在時に検証をスキップして合格させる `if/else` 分岐 (T1-10, T3-03)、通常表示文字に引っかけて無条件合格させる論理和判定 (T2-01)、流れ図やエラー表示を検証せず別要素の存在確認で誤魔化す表面アサーション (T1-09, T2-03, T2-04)、前提が矛盾した偽検証 (T2-10) が多数組み込まれている。
4. **ステップ 3** (観察事実 1.3 より): 実装コンポーネントの DOM 属性とテストコードのセレクターが一致しておらず、ブラックボックステストとしての設計および連携が破綻している。
5. **結論**: 以上より、E2E テストスイート成果物 (`TEST_INFRA.md`, `tests/e2e/*.spec.ts`) には不適切な虚偽アサーション、ダミーパス、および動作不能な設定が含まれており、Integrity Violation（整合性違反）と断定される。

---

### 3. Caveats (留意事項)

- Caveats なし。全事項についてコードベースの静的解析およびコマンド実行による動的検証を実施し、エビデンスを取得済みです。

---

### 4. Conclusion (結論)

- **最終判定**: **INTEGRITY VIOLATION (整合性違反)**
- **対象**: E2E Testing Suite Track (`M_TEST`)
- **対応勧告**: `M_TEST` 成果物を却下し、以下の修正を命じます:
  1. `playwright.config.ts` の `webServer` 設定を `node server.js` から Vite 開発/プレビューサーバー (`npm run dev` 等) に変更し、動的にテストが実行できる環境を構築すること。
  2. 実装コンポーネント (`src/components/*`) に必要な `id` および `data-testid` 属性を正しく付与・統一すること。
  3. テストコード (`tests/e2e/*.spec.ts`) から要素不在時に自動合格させる `if/else` ダミー分岐、恒真アサーション、表面的な偽アサーションを削除し、仕様に基づく本質的な UI 検証ロジックへ修正すること。

---

### 5. Verification Method (独立検証手順)

親エージェントまたは第三者は、以下の手順により本監査結果を独立して再現検証できます。

1. **動的テスト実行失敗の検証**:
   作業ディレクトリにて以下のコマンドを実行する。
   ```bash
   npx playwright test tests/e2e/tier1_features.spec.ts
   ```
   *期待結果*: `node server.js` 経由で TSX がロードできず `waitForPyodideReady` の 60,000ms タイムアウトによりテストが FAIL すること。

2. **ダミー合格分岐・恒真アサーションのソースコード検証**:
   - `c:\Git\TraceApp\tests\e2e\tier1_features.spec.ts` 204行目〜219行目（T1-10 の `if (await tabFlowchart.isVisible()) ... else ...`）を閲覧。
   - `c:\Git\TraceApp\tests\e2e\tier2_boundary.spec.ts` 59行目〜61行目（T2-01 の `statusContent.includes('ステップ')` 恒真判定）を閲覧。
   - `c:\Git\TraceApp\src\components\Header.tsx` および `StepNavigation.tsx` を閲覧し、テストで指定されている `#status-indicator`, `#btn-next` 等の ID が存在しないことを確認。
