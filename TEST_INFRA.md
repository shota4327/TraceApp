# TraceApp E2E テストインフラストラクチャ & テスト仕様書 (`TEST_INFRA.md`)

## 1. 概要とテスト方針

本ドキュメントは、プログラミング教育用 Python トレース可視化 Web アプリケーション「TraceApp」における、要件駆動ブラックボックス E2E (End-to-End) テストの全体アーキテクチャ、機能インベントリマッピング、および 4 階層（Tier 1〜4）のテストケース仕様を定義した標準仕様書です。

### 1.1 テスト方針
- **ブラックボックステスト推進**: テストコードは実装の詳細構造（内部状態やコンポーネントクラス等）に直接依存せず、ユーザーから見た UI 画面（Monaco Editor、ボタン、スライダー、変数履歴表、print出力コンソール、流れ図キャンバス）の操作と視覚的フィードバックを中心に検証します。
- **ロバストな要素識別**: 既存の DOM ID（`#btn-next`, `#preset-select` 等）および将来・React移行後の `data-testid`（`data-testid="btn-next"` 等）の双方に対応可能なフォールバック型要素ロケーター戦略を採用します。
- **Pyodide 非同期ロード対応**: Web Worker および Pyodide WebAssembly のロード完了に合わせた安全な事前待機処理（タイムアウト 60秒設定）を盛り込みます。

---

## 2. 全機能インベントリマッピング (Feature Inventory Mapping)

要求仕様 (`ORIGINAL_REQUEST.md`) およびプロジェクト仕様 (`PROJECT.md`) に基づく全機能と E2E テスト階層 (Tier) の対応マッピング表です。

| 機能ID | 機能名称 | 概要 | 対応 E2E テストファイル / Tier |
|---|---|---|---|
| **F01** | Pyodide 初期化 & ローディング表示 | Web Worker 内での Pyodide 初期化と UI 操作保護 | `tier1_features.spec.ts` (Tier 1), `tier2_boundary.spec.ts` (Tier 2) |
| **F02** | 画面レイアウト | 2ペイン UI 画面と教科書風デザイン表示 | `tier1_features.spec.ts` (Tier 1) |
| **F03** | Python コード入力・編集 | Code Editor でのコード記述とシンタックスハイライト | `tier1_features.spec.ts` (Tier 1), `tier3_combinations.spec.ts` (Tier 3) |
| **F04** | .py ファイルアップロード | `.py` ファイルのロードとエディタ反映 | `tier1_features.spec.ts` (Tier 1), `tier3_combinations.spec.ts` (Tier 3) |
| **F05** | サンプルプログラム切替 | プリセットプログラム選択とコード更新 | `tier1_features.spec.ts` (Tier 1), `tier3_combinations.spec.ts` (Tier 3) |
| **F06** | 事前一括トレース実行 | `sys.settrace()` によるバックグラウンド事前全ステップ実行 | `tier1_features.spec.ts` (Tier 1), `tier4_realworld.spec.ts` (Tier 4) |
| **F07** | 「次へ」ステップ進行 | 1ステップ進み全要素を同期更新 | `tier1_features.spec.ts` (Tier 1), `tier3_combinations.spec.ts` (Tier 3) |
| **F08** | 「前へ」ステップ後退 | 1ステップ戻り全状態を復元 | `tier1_features.spec.ts` (Tier 1), `tier3_combinations.spec.ts` (Tier 3) |
| **F09** | 「リセット」トレース初期化 | トレース状態を初期状態 (ステップ0) へ復帰 | `tier1_features.spec.ts` (Tier 1), `tier3_combinations.spec.ts` (Tier 3) |
| **F10** | ステップスライダー任意ジャンプ | スライダー位置に応じた任意のステップ直接移動 | `tier1_features.spec.ts` (Tier 1), `tier3_combinations.spec.ts` (Tier 3) |
| **F11** | エディタ実行行デコレーション | 現在のステップ行に対する Monaco Editor でのハイライト | `tier1_features.spec.ts` (Tier 1), `tier3_combinations.spec.ts` (Tier 3) |
| **F12** | スプレッドシート型変数履歴表 | 変数名を横・ステップを縦とした変数推移記録表示 | `tier1_features.spec.ts` (Tier 1), `tier4_realworld.spec.ts` (Tier 4) |
| **F13** | 変数変更セル・列ハイライト | 当該ステップで変更されたセルおよび列全体の強調表示 | `tier1_features.spec.ts` (Tier 1), `tier3_combinations.spec.ts` (Tier 3) |
| **F14** | 変数スコープ識別 | グローバル変数とローカル変数の区別 | `tier1_features.spec.ts` (Tier 1), `tier2_boundary.spec.ts` (Tier 2) |
| **F15** | print 出力キャプチャ | `sys.stdout` からの print 出力の段階的累積表示 | `tier1_features.spec.ts` (Tier 1), `tier2_boundary.spec.ts` (Tier 2) |
| **F16** | AST 流れ図生成 | Python AST 解析による流れ図ノード構造の自動構築 | `tier1_features.spec.ts` (Tier 1), `tier2_boundary.spec.ts` (Tier 2) |
| **F17** | 流れ図描画 (SVG/Canvas) | 処理・判断・ループ・関数・端子規格記号によるレンダリング | `tier1_features.spec.ts` (Tier 1), `tier4_realworld.spec.ts` (Tier 4) |
| **F18** | 流れ図アクティブノードハイライト | トレースステップ進行に連動した流れ図ノード強調 | `tier1_features.spec.ts` (Tier 1), `tier3_combinations.spec.ts` (Tier 3) |
| **F19** | 「コード/流れ図」タブ切り替え | 左パネルの表示モードトグル切替とステート保持 | `tier1_features.spec.ts` (Tier 1), `tier3_combinations.spec.ts` (Tier 3) |
| **F20** | 10,000ステップ上限保護 | `TraceLimitExceeded` による無限ループ時のフリーズ防止 | `tier2_boundary.spec.ts` (Tier 2) |
| **F21** | 特殊値 (NaN/Infinity) サニタイズ | `float('nan')`, `float('inf')` の通信・表示安定化 | `tier2_boundary.spec.ts` (Tier 2) |
| **F22** | 構文・実行時エラー捕捉 | SyntaxError, ZeroDivisionError 等の安全な通知 | `tier2_boundary.spec.ts` (Tier 2) |

---

## 3. テストアーキテクチャ & セレクター設計

### 3.1 テストスタック
- **テストフレームワーク**: Playwright (`@playwright/test`)
- **テスト言語**: TypeScript (`.ts`)
- **実行環境**: Headless Chromium
- **ベース URL**: `http://localhost:8080` (または `http://localhost:5173`)

### 3.2 二重識別要素セレクター仕様 (Dual-Selector Strategy)
あらゆる環境（Phase 1 PoC の DOM ID と Phase 2-4 の `data-testid` 属性）において同一のテストコードで動作するよう、以下のフォールバック定義ルールを使用します。

```typescript
// ロバストな要素取得用ヘルパー関数
function locator(page: Page, testIdOrDomId: string) {
  return page.locator(`#${testIdOrDomId}, [data-testid="${testIdOrDomId}"]`).first();
}
```

| 対象要素 | 定義 ID (`id`) | 推奨 `data-testid` | Playwright ロケーターパターン |
|---|---|---|---|
| Pyodide インジケータ | `#status-indicator` | `status-bar` | `locator('#status-indicator, [data-testid="status-bar"]')` |
| サンプル選択 | `#preset-select` | `preset-select` | `locator('#preset-select, [data-testid="preset-select"]')` |
| .py アップロード | `#file-upload-input` | `file-upload-input` | `locator('#file-upload-input, [data-testid="file-upload-input"]')` |
| コード入力エリア | `#code-input` | `monaco-editor` | `locator('#code-input, [data-testid="monaco-editor"], textarea')` |
| トレース実行ボタン | `#btn-run` | `btn-run` | `locator('#btn-run, [data-testid="btn-run"]')` |
| 「前へ」ボタン | `#btn-prev` | `btn-prev` | `locator('#btn-prev, [data-testid="btn-prev"]')` |
| 「次へ」ボタン | `#btn-next` | `btn-next` | `locator('#btn-next, [data-testid="btn-next"]')` |
| 「リセット」ボタン | `#btn-reset`, `#btn-first` | `btn-reset` | `locator('#btn-reset, #btn-first, [data-testid="btn-reset"]')` |
| ステップカウンター | `#step-counter` | `step-counter` | `locator('#step-counter, [data-testid="step-counter"]')` |
| ステップスライダー | `#step-slider` | `step-slider` | `locator('#step-slider, [data-testid="step-slider"], input[type="range"]')` |
| 変数履歴表 | `#locals-table-body` | `variable-table` | `locator('#locals-table-body, [data-testid="variable-table"]')` |
| print 出力パネル | `#console-output` | `output-console` | `locator('#console-output, [data-testid="output-console"]')` |
| 流れ図タブ | `#tab-flowchart` | `tab-flowchart` | `locator('#tab-flowchart, [data-testid="tab-flowchart"]')` |
| コードタブ | `#tab-code` | `tab-code` | `locator('#tab-code, [data-testid="tab-code"]')` |
| 流れ図ビューア | `#flowchart-viewer` | `flowchart-viewer` | `locator('#flowchart-viewer, [data-testid="flowchart-viewer"]')` |

---

## 4. 4階層（Tier 1〜4）のカバレッジ目標とテストケース仕様

### 4.1 Tier 1 — 機能網羅テスト (`tests/e2e/tier1_features.spec.ts`)
- **カバレッジ目標**: アプリケーションの全個別機能（初期化、サンプル切替、編集、アップロード、ステップナビゲーション、デコレーション、変数表、printコンソール、流れ図、タブ切替）の正常系挙動を 100% カバーする。
- **テストケース一覧**:
  1. `T1-01`: **Pyodide 初期化とローディング表示**: アプリ起動時に初期化処理が行われ、準備完了状態になること。
  2. `T1-02`: **サンプルプログラム選択とコード反映**: ドロップダウン切り替えでコードが更新されること。
  3. `T1-03`: **コードエディタ編集とトレース実行**: エディタ入力した Python コードが正常にトレース実行されること。
  4. `T1-04`: **.py ファイルのアップロード**: `.py` ファイルを読み込み、エディタにコンテンツが展開されること。
  5. `T1-05`: **ステップナビゲーション (次へ, 前へ, リセット)**: ボタン操作に応じたステップ数の進行・後退・初期化。
  6. `T1-06`: **実行行デコレーションハイライト**: ステップ進行に伴い、対応する行番号が強調表示されること。
  7. `T1-07`: **スプレッドシート型変数履歴表**: 各ステップでの変数名・値・変更セルの表示更新。
  8. `T1-08`: **print 出力コンソールキャプチャ**: `print()` 実行ステップでの累積ログ出力。
  9. `T1-09`: **AST 流れ図描画とノードハイライト**: 流れ図ノード生成とアクティブノードの強調。
  10. `T1-10`: **「コード/流れ図」タブ切り替え**: タブ切り替え後も状態が維持されること。

### 4.2 Tier 2 — 境界値・エッジケーステスト (`tests/e2e/tier2_boundary.spec.ts`)
- **カバレッジ目標**: 限界値、例外発生コード、特殊データ構造、不正操作などのエッジケースにおいて、ブラウザフリーズを起こさず安全にハンドリングされることを検証する。
- **テストケース一覧**:
  1. `T2-01`: **10,000ステップ上限超過 (`TraceLimitExceeded`)**: 無限ループ `while True` 等で 10,000 ステップを超えた場合、上限警報が出力されブラウザがフリーズしないこと。
  2. `T2-02`: **特殊浮動小数点数 (NaN / Infinity) サニタイズ**: `float('nan')` や `float('inf')` が文字列として変数表に安定表示されること。
  3. `T2-03`: **構文エラー (SyntaxError) ハンドリング**: コロン欠損などの構文エラー時に安全にエラー表示され、復旧可能であること。
  4. `T2-04`: **実行時例外 (ZeroDivisionError) ハンドリング**: ゼロ除算等の実行時例外発生時に直前ステップまで保持して安全停止すること。
  5. `T2-05`: **空コードおよびコメントのみの入力**: 実行可能コードがない場合でもクラッシュせず安全待機すること。
  6. `T2-06`: **大量変数（50個以上）のスクロール表示**: 多重変数定義時にもレイアウトが破綻しないこと。
  7. `T2-07`: **深層ネスト構造（8重以上）の流れ図**: 深い制御構造でも流れ図レンダリングが成功すること。
  8. `T2-08`: **特殊文字・HTMLエスケープ print 出力**: `<script>` や改行・タブを含む print が安全に描画されること。
  9. `T2-09`: **再帰関数とマルチスタックフレーム**: 再帰呼出でスコープ履歴が追尾されること。
  10. `T2-10`: **Pyodide 初期化中のボタン操作保護**: ロード中の不正操作がガードされていること。

### 4.3 Tier 3 — 複合機能・相互作用テスト (`tests/e2e/tier3_combinations.spec.ts`)
- **カバレッジ目標**: 複数機能が同時に連動・相互作用する高度なユースケースにおいて、状態不一致や表示破綻が起きないことを検証する。
- **テストケース一覧**:
  1. `T3-01`: **スライダー移動時の4点全要素完全同期**: スライダー操作時に (1)エディタ行, (2)変数表, (3)printコンソール, (4)流れ図ノード が同時同期更新されること。
  2. `T3-02`: **「前へ」「次へ」往復時の状態整合性**: 前後に何度も往復しても、常に表示中のステップ番号と各コンポーネントが完全一致すること。
  3. `T3-03`: **タブ切り替え時のハイライト保持**: 流れ図タブでステップ進行後、コードタブに戻っても実行行ハイライトが追従維持されていること。
  4. `T3-04`: **サンプル切替＋カスタム編集＋リセット連動**: プリセット読み込み後に手修正し、リセットを押してもカスタムコードが保持されること。
  5. `T3-05`: **ファイルアップロード＋スライダー任意移動**: `.py` アップロード後にスライダーで任意ステップに移動し最終ログを確認できること。
  6. `T3-06`: **高速ナビゲーション連打とWorker非同期追従**: ボタンをミリ秒単位で連打しても通信キューが破綻せず最終状態に安定着地すること。

### 4.4 Tier 4 — 実用アプリケーションシナリオ (`tests/e2e/tier4_realworld.spec.ts`)
- **カバレッジ目標**: `ORIGINAL_REQUEST.md` に記載された検証用プログラム1〜3およびユーザー総合デバッグシナリオを通じた実用価値を総合検証する。
- **テストケース一覧**:
  1. `T4-01`: **検証用テスト1 (順次・代入)**: `x=5`, `y=3`, `total=x+y`, `print(total)` の全ステップ変遷と最終出力 `8` のトレース完了。
  2. `T4-02`: **検証用テスト2 (条件分岐)**: `score=75` による `if/elif/else` 分岐追尾。不成立ブロックのスキップと `grade="B"` 出力検証。
  3. `T4-03`: **検証用テスト3 (ループと関数)**: `def add(a,b)` の繰り返し呼び出し。ローカルスコープ計算と最終結果 `6` の確認。
  4. `T4-04`: **ユーザースモールデバッグ演習シナリオ**: 自分で作成したコードのバグをトレース後退（「前へ」ボタン）によって特定し、エディタで修正して再実行成功する一連のデバッグ体験フロー。

---

## 5. テスト実行方法

```bash
# 依存パッケージの確認
npm install

# Playwright E2E テストの全実行
npx playwright test

# 特定ファイルごとの実行
npx playwright test tests/e2e/tier1_features.spec.ts
npx playwright test tests/e2e/tier2_boundary.spec.ts
npx playwright test tests/e2e/tier3_combinations.spec.ts
npx playwright test tests/e2e/tier4_realworld.spec.ts

# テスト結果レポートの参照
npx playwright show-report
```

---

## 6. まとめ

本仕様書 `TEST_INFRA.md` に従い、全 4 階層の Playwright E2E テストコードを構築し、TraceApp の品質と堅牢性を自動テスト環境下で保証します。
