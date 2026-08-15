# Milestone 1 対立的検証報告書 (challenger_m1_2)

## 判定: APPROVE (承認)

---

## 1. Observation (直接観察事実)

以下の通り、検証対象コードの動作、検証用テストコードの実行結果を直接確認しました。

### 検証対象ファイル
- `src/worker/pythonTracer.ts`: Python `sys.settrace()` スクリプト、`PyodideTracer` クラス、`TraceLimitExceeded` (BaseException 継承)
- `src/worker/pyodideWorker.ts`: Pyodide Worker メッセージハンドラ、`RUN_TRACE` 処理、`truncated: true` 部分結果の返却処理
- `src/hooks/useTraceEngine.ts`: `useTraceEngine` フック、`isTracing` ガード、`truncated` 時のエラー状態・結果保持

### 作成した実機検証テストコード
`src/__tests__/challenger_m1_2_empirical.test.ts` を追加し、以下の観点を全自動テストとして実装・確認しました。

### 実行コマンドおよび出力結果
```bash
npx vitest run src/__tests__/challenger_m1_2_empirical.test.ts
```
**実行ログ（全パス）**:
```
 RUN  v2.1.9 C:/Git/TraceApp

 ✓ src/__tests__/challenger_m1_2_empirical.test.ts (9 tests) 1888ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  21:14:47
   Duration  3.45s (transform 88ms, setup 0ms, collect 256ms, tests 1.89s, environment 631ms, prepare 105ms)
```

全スイート実行:
```bash
npx vitest run
```
**実行ログ**:
```
 ✓ src/__tests__/types.test.ts (2 tests) 4ms
 ✓ src/__tests__/samplePrograms.test.ts (4 tests) 4ms
 ✓ src/__tests__/challenger_m4_2_deep.test.tsx (2 tests) 6ms
 ✓ src/__tests__/challenger_m4_fix_2_attack.test.tsx (3 tests) 156ms
 ✓ src/__tests__/flowchart.test.tsx (7 tests) 285ms
 ✓ src/__tests__/challenger_m4_fix_stress.test.tsx (10 tests) 325ms
 ✓ src/__tests__/m3_ui.test.tsx (3 tests) 273ms
 ✓ src/__tests__/challenger_m3_ui_boundary.test.tsx (7 tests) 343ms
 ✓ src/__tests__/challenger_m4_stress.test.tsx (15 tests) 578ms
 ✓ src/__tests__/challenger_m4_gate1_adversarial.test.tsx (6 tests) 485ms
 ✓ src/__tests__/challenger_m2m3_2_stress.test.tsx (6 tests) 487ms
 ✓ src/__tests__/challenger_m4_2_attack.test.tsx (6 tests) 2119ms
 ✓ src/__tests__/challenger_m2m3_attack.test.ts (12 tests) 2868ms
 ✓ src/__tests__/challenger_m1_2_empirical.test.ts (9 tests) 2710ms
 ✓ src/__tests__/challenger_m2_deep_stress.test.ts (10 tests) 2710ms
 ✓ src/__tests__/tracer.test.ts (16 tests) 3022ms
 ✓ src/__tests__/tracerStress.test.ts (9 tests) 3039ms
 ✓ src/__tests__/challenger_m1_adversarial.test.ts (10 tests) 3146ms
```

---

## 2. Logic Chain (論理的根拠チェーン)

1. **検証用プログラム1 (基本順次代入 `x=5`, `y=3`, `total=x+y`, `print(total)`)**:
   - `pythonTracer.ts` の `PyodideTracer` は `x=5`, `y=3`, `total=x+y` の各代入行でステップスナップショットを正確に生成し、`changedVars` に独立して変数を記録することを確認。
   - `add_end_snapshot` により `event: "end"`, `astNodeId: "node-end"` の最終行スナップショットが追加され、`globals` に `{ x: 5, y: 3, total: 8 }` が保持され、`stdoutCumulative` が `"8\n"` に一致することを確認。

2. **検証用プログラム2 (条件分岐 `score=75`, `if/elif/else`, `print(grade)`)**:
   - `score=75` において成立する `elif score >= 60:` ブロックのみがトレースされ、不成立の `grade = "A"` (4行目) や `grade = "C"` (8行目) は実行行パスに含まれないことを確認。
   - 最終行スナップショットの `globals` に `grade: "B"` が記録され、未通過分岐の変数がスコープに混入しないことを確認。

3. **検証用プログラム3 (ループと関数呼び出し `def add(a, b)`, `for i in range(1, 4): total = add(total, i)`)**:
   - トップレベル実行時は `functionName: null`, `locals: {}` であり、`add` 関数内では `functionName: "add"`, `locals: { a, b, result }` としてスコープが明確に分離されていることを確認。
   - グローバル `total` の推移 (0 → 1 → 3 → 6) および `i` の推移 (1 → 2 → 3) が最終行スナップショットまで正確に追尾されていることを確認。

4. **スコープ変化判定 (`changedVars` & Variable Shadowing)**:
   - `PyodideTracer` は前回ステップの `prev_globals` / `prev_locals` と比較し、値に変化があった変数のみを `changedVars` に格納。
   - 同名のグローバル変数 `val = 100` とローカル変数 `val = 200` (シャドウイング) において、ローカルステップの `changedVars` に `val` が記録されつつ、グローバル `val` の値 (100) は安全に保護・隔離されることを確認。

5. **上限オーバー挙動 (`TraceLimitExceeded` Guard)**:
   - `TraceLimitExceeded` は Python の `BaseException` を継承しているため、ユーザーコード内に `try...except Exception:` や `try...except:` があっても捕捉されずにトレースを即座に停止することを確認。
   - `pyodideWorker.ts` は上限到達時に集計済みの部分スナップショット配列を破棄せず `truncated: true` および `error` メッセージと共に返却。
   - `useTraceEngine.ts` は `truncated: true` 受信時に `traceResult` に結果を保持しつつ `error` ステートに警報メッセージを設定し、UIがフリーズせずにステップ表示・エラー警告を行えることを確認。

---

## 3. Caveats (留意事項)

- 本単体・結合テスト環境 (Vitest / Node.js) では `node_modules/pyodide` を利用して Pyodide WebAssembly のロードを行っています。ブラウザ環境における CDN ダウンロード失敗やネットワーク遅延時のエラーハンドリングは別途 E2E テスト等で担保されています。

---

## 4. Conclusion (結論)

検証対象コード (`src/worker/pythonTracer.ts`, `src/worker/pyodideWorker.ts`, `src/hooks/useTraceEngine.ts`) は、要求仕様に定められた以下の全要件を完全かつ堅牢に満たしています。

1. 基本順次代入、条件分岐、ループと関数呼び出しの3パターンにおける正常かつ正確なトレース収集
2. `event: "end"` を含む最終行スナップショットの正確な保持
3. グローバル/ローカルスコープの明確な分離と `changedVars` 変化検知の正当性
4. 10,000ステップ上限オーバー時の `TraceLimitExceeded` (BaseException) による確実な停止と `truncated: true` 部分結果の復旧
5. `npx vitest run` 全18テストファイルのオールグリーンパス

したがって、判定は **APPROVE** とします。

---

## 5. Verification Method (検証方法)

以下のコマンドを実行することで、本検証結果を即座に再検証可能です。

```bash
# 1. 本検証担当が作成した対立的単体・結合テストの実行
npx vitest run src/__tests__/challenger_m1_2_empirical.test.ts

# 2. 全単体・結合テストスイートの実行
npx vitest run
```
