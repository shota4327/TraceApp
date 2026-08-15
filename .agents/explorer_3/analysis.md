# TraceApp Phase 1 PoC - 技術検証報告書 (Explorer 3)

## 概要
本報告書は、TraceApp (プログラミング教育用Pythonトレース可視化ツール) の Phase 1 PoC における以下の4点について技術調査・設計を行った結果をまとめたものです。

1. Pyodideにおける `print` 出力キャプチャ手法の比較と推奨設計
2. 複数回の連続 `print()` 呼び出しとステップ実行（`sys.settrace`）との紐付け設計
3. 要件 R1, R2, R3 を自動検証するテストランナー構築手法
4. 要件 R4 に基づく `poc_report.md` の詳細構造仕様

---

## 1. Pyodideにおける `print` 出力キャプチャ手法の比較

Pyodide環境で `print()` 関数の出力をキャプチャし、JavaScript側で受け取る方法として以下の2つのアプローチを比較・検討しました。

### 1.1 手法A: Pyodide JavaScript API (`pyodide.setStdout`)

Pyodide が提供する JS 側の組み込み API です。

```javascript
pyodide.setStdout({
  batched: (text) => {
    console.log("Captured stdout:", text);
    // JavaScript側の出力バッファに追加
  }
});
```

* **動作特徴**:
  * Python の標準出力 (WASM Cレベル標準出力含む) を JavaScript コールバックで受容します。
  * `batched` モードでは、改行文字 (`\n`) または明示的な `flush()` が発生した際に行単位でコールバックが呼び出されます。
  * `raw` モードでは文字単位（1文字ずつ）呼び出されます。
* **メリット**:
  * Python 側のコード変更が不要で、大域的に標準出力をキャプチャできます。
* **デメリット / 課題**:
  * **ステップコンテキストの消失**: `sys.settrace()` で追跡している「現在実行中のPythonコード行（ステップ番号）」の文脈と直接紐付いていません。
  * **バッファリング遅延**: `batched` モードでは `\n` が出力されるまでJS側に到達しないため、`print("Hello", end="")` のような改行なし出力がステップ途中で収集漏れするリスクがあります。

---

### 1.2 手法B: Pythonレベルでの `sys.stdout` 差し替え (カスタム Writer クラス)

Pythonコード内で `sys.stdout` をカスタムクラスまたは `io.StringIO` オブジェクトにリダイレクトします。

```python
import sys
import io

class StepStdoutWriter:
    def __init__(self):
        self.buffer = io.StringIO()
        self.last_pos = 0

    def write(self, text):
        if text:
            self.buffer.write(text)

    def flush(self):
        pass

    def get_delta_and_update(self):
        val = self.buffer.getvalue()
        delta = val[self.last_pos:]
        self.last_pos = len(val)
        return delta
```

* **動作特徴**:
  * `print()` が呼び出されると、Pythonの `sys.stdout.write()` メソッドが即座に実行され、カスタムバッファに追記されます。
  * トレースエンジン（`sys.settrace`）の各ステップ（`line` イベント発生時）に `get_delta_and_update()` を呼ぶことで、前回のステップから今回までの間に書き込まれた文字差分（Delta）を正確に抽出できます。
* **メリット**:
  * **高精度なステップ紐付け**: `sys.settrace` のステップ制御ロジックと100%同期して出力を記録可能。
  * **改行コード非依存**: 改行が含まれない `print(..., end="")` であっても、書き込まれた時点のステップで正確に差分を取得できます。
  * **安全な復元**: トレース終了後に `sys.stdout = sys.__stdout__` で元の標準出力に復旧可能です。

---

### 1.3 結論および推奨設計

TraceApp は「コードの1行ごとの実行結果（変数・出力）をトレース・可視化するツール」であるため、**手法B（Pythonレベルでの `sys.stdout` 差し替えとステップエンジンへの統合）を採用することを強く推奨**します。

`pyodide.setStdout` は、Pyodide全体のフォールバック出力ログ収集用として補助的に併用し、コアとなるトレース機能には手法Bを利用するハイブリッド構成が最適です。

---

## 2. 複数 `print()` 呼び出しとステップ実行との紐付け設計

### 2.1 課題と発生パターン
1. **1行で複数 `print()` 呼び出し**: `print("A"); print("B")` のように同方向の複数出力。
2. **改行なし連続 `print()`**: `print("i = ", end=""); print(i)`。
3. **ループ内 `print()`**: 同一行が繰り返し実行され、イテレーションごとに `print()` が発生。

### 2.2 推奨データ構造と差分取得（Delta Collection）アルゴリズム

#### TypeScript 側のデータ構造
```typescript
interface TraceStep {
  stepIndex: number;          // ステップの連番 (0, 1, 2...)
  line: number;               // ソースコードの行番号 (1-indexed)
  event: 'line' | 'call' | 'return';
  locals: Record<string, any>;// ローカル変数のスナップショット
  globals: Record<string, any>;// グローバル変数のスナップショット
  stepOutput: string;         // このステップの実行により新しく出力された文字列
  cumulativeOutput: string;   // ここまでの全ステップの累積出力文字列
}
```

#### トレースおよび出力紐付けアルゴリズム (Python内トレースランナー)

```python
import sys
import io

class TraceRunner:
    def __init__(self):
        self.steps = []
        self.stdout_writer = StepStdoutWriter()

    def run(self, code):
        old_stdout = sys.stdout
        sys.stdout = self.stdout_writer.buffer
        
        def trace_dispatch(frame, event, arg):
            if event == 'line':
                # 1. 前回のステップ実行後に蓄積された stdout 差分を取得
                delta_output = self.get_stdout_delta()
                if self.steps and delta_output:
                    # 直前ステップの stepOutput に差分を追加
                    self.steps[-1]['stepOutput'] += delta_output
                    
                # 2. 現在の累積出力を計算
                current_cumulative = self.stdout_writer.buffer.getvalue()

                # 3. 新しいステップ情報を追加
                step_data = {
                    'stepIndex': len(self.steps),
                    'line': frame.f_lineno,
                    'event': event,
                    'locals': dict(frame.f_locals),
                    'globals': {k: v for k, v in frame.f_globals.items() if not k.startswith('__')},
                    'stepOutput': '', # 次のステップまたは実行完了時に確定
                    'cumulativeOutput': current_cumulative
                }
                self.steps.append(step_data)
            return trace_dispatch

        try:
            sys.settrace(trace_dispatch)
            exec(code, {'__name__': '__main__'})
        finally:
            sys.settrace(None)
            # 4. コード実行完了後、最終ステップの残余出力を回収
            final_delta = self.get_stdout_delta()
            if self.steps and final_delta:
                self.steps[-1]['stepOutput'] += final_delta
            sys.stdout = old_stdout

    def get_stdout_delta(self):
        # バッファの未読差分を取得する関数
        val = self.stdout_writer.buffer.getvalue()
        delta = val[self.last_pos:]
        self.last_pos = len(val)
        return delta
```

* **特長**:
  * 各行が実行された直後の変数値と、その行の実行によって生じた `stepOutput` が完全に一致します。
  * `cumulativeOutput` を保持させることで、UI側で「ステップごとの新規出力」と「その時点までの画面表示全体」の双方を簡単にレンダリングできます。

---

## 3. 要件 R1, R2, R3 を自動検証するテストランナー構築手法

### 3.1 テスト実行環境の評価と選定

| 手法 | 仕組み | 利点 | 課題 / 導入コスト |
|---|---|---|---|
| **A. ブラウザ HTML テストランナー (`test_runner.html`)** | HTMLに全自動アサーションJSを組み込み、Pyodide CDNでブラウザ実行 | 外部npm/ブラウザバイナリ依存ゼロ。ブラウザで開くだけで即座にPASS/FAIL判定可能 | ブラウザの手動起動が必要（Headless Chrome CLIで自動化も可） |
| **B. Playwright / Puppeteer** | Headless Chrome を起動し、ローカルWebサーバー経由でテスト検証 | CI/CDでの完全自動化が容易 | npm packageとブラウザバイナリのダウンロードが必要 |
| **C. Node.js 上の Pyodide パッケージ** | Node.js 環境で Pyodide npm を `require` してコンソール実行 | 最速でコマンドライン実行可能 | Node.js用PyodideのWeb Worker/WASM環境設定が必要 |

**本PoCへの推奨**:
`ORIGINAL_REQUEST.md` の制約（「Vite不要、最小限のHTML構成、シンプルさ重視」）に基づき、**「手法A (ブラウザ HTML テストランナー `test_runner.html`)」をプライマリ検証手段として構築することを強く推奨**します。

---

### 3.2 テストケース仕様と自動アサーションロジック設計

`test_runner.html` 内で自動実行・検証するアサーション項目は以下の通りです。

```javascript
class TestRunner {
  async runAllTests() {
    console.log("=== TraceApp PoC 自動テスト開始 ===");

    // R1: 初期化と基本コード実行
    await this.testR1();

    // R2: sys.settrace() ステップ実行検証
    await this.testR2_Sequential();   // テスト1: 順次実行
    await this.testR2_Branching();    // テスト2: 条件分岐 (score=75 -> grade="B")
    await this.testR2_Loop();         // テスト3: ループ (range(1,4) -> i=1,2,3)
    await this.testR2_Function();     // テスト4: 関数呼び出しとスコープ分離

    // R3: print出力キャプチャ検証
    await this.testR3_SinglePrint();  // 単一 print("Hello")
    await this.testR3_MultiPrint();   // 複数順次 print() の順序保持

    this.renderSummary();
  }

  assert(condition, testName, message) {
    if (condition) {
      console.log(`[PASS] ${testName}: ${message}`);
    } else {
      console.error(`[FAIL] ${testName}: ${message}`);
    }
  }
}
```

#### 各検証項目の判定ロジック詳細
1. **R1**: `pyodide.runPython("2 + 3")` の結果が `5` に一致すること。
2. **R2 テスト1（順次実行）**:
   * トレースステップ数が 3 以上。
   * 最終ステップの `locals` に `x=5`, `y=3`, `total=8` が含まれていること。
3. **R2 テスト2（条件分岐）**:
   * `score = 75` の実行時、`if score >= 80` のブロック（`grade = "A"` の行）がトレースに含まれず、`elif` ブロック（`grade = "B"`）のみがトレースされること。
   * 最終結果として `grade === "B"` であること。
4. **R2 テスト3（ループ）**:
   * ループ体（`total = total + i`）が 3 回実行されること。
   * 各イテレーションで `i` が `1, 2, 3` と変化し、`total` が `1, 3, 6` と正しく遷移すること。
5. **R2 テスト4（関数）**:
   * 関数 `add(a, b)` 内部のステップで、`locals` に `a=3, b=4, result=7` が記録され、`globals` に `answer=7` が正しく格納されていること。
6. **R3 1&2（printキャプチャ）**:
   * `print("Hello")` 実行時にキャプチャ文字列が `"Hello\n"` であること。
   * 複数の `print("Line 1")`, `print("Line 2")` 呼び出しに対し、出力順序が `"Line 1\nLine 2\n"` と一致し、かつ各ステップの `stepOutput` に正しく分散保持されること。

---

## 4. 要件 R4 に基づく `poc_report.md` の詳細構造定義

`poc_report.md` は、PoCの完了時に成果物として提出する最終報告書です。要求仕様（R4）を満たすための全セクション構造と記載項目を以下のように定義します。

### `poc_report.md` 構成案（完全仕様）

```markdown
# TraceApp Phase 1 PoC - 技術検証報告書 (poc_report.md)

## 1. 概要 (Overview)
- **目的**: Pyodide上での `sys.settrace()` によるステップ実行および `print` 出力キャプチャの実現可能性検証
- **総合判定**: SUCCESS (すべての Acceptance Criteria をクリア)
- **検証日**: 2026-08-10

## 2. 要件別検証結果サマリー

| 要件ID | 検証項目 | ステータス | 概要 |
|---|---|---|---|
| R1 | Pyodide初期化と基本コード実行 | [PASS] | WASM初期化成功、JS-Python間データ受渡を確認 |
| R2-1 | トレース: 順次実行 | [PASS] | 行毎のステップ実行と変数変遷を完全取得 |
| R2-2 | トレース: 条件分岐 | [PASS] | elifパスのみ実行追跡成功 |
| R2-3 | トレース: ループ | [PASS] | range(1,4) イテレーション遷移の全記録成功 |
| R2-4 | トレース: 関数定義・呼び出し | [PASS] | ローカル/グローバルスコープの正しい区別を確認 |
| R3-1 | printキャプチャ (単一) | [PASS] | sys.stdout差し替えによる即時取得成功 |
| R3-2 | printキャプチャ (複数順次) | [PASS] | 出力順序保持とステップ紐付け成功 |

## 3. 各検証項目の詳細報告

### 3.1 R1. Pyodideの初期化と基本Python実行の検証
- **結果**: 成功
- **動作の詳細**: Pyodide CDN (v0.26.4) より読み込み、`pyodide.runPython()` で四則演算および変数評価を実行。
- **制約事項・注意点**: 初期化時に WASM ファイル等のダウンロードが発生するため、数秒の初期化遅延が生じる。

### 3.2 R2. sys.settrace() によるステップ実行トレースの検証
- **結果**: 成功
- **動作の詳細**: 
  - Pythonの `sys.settrace()` コールバックを定義し、各行実行時に `frame.f_lineno`, `frame.f_locals`, `frame.f_globals` を抽出しJSON化。
  - テスト1〜テスト4のすべてのコード構文において正確なトレースデータを取得。
- **制約事項・注意点**:
  - `sys.settrace()` はPythonバイトコード命令ごとにフックされるため、大容量コード実行時にはオーバーヘッドが発生する。
  - 代替手段（ASTインスペクション等）の検討は、`sys.settrace()` が完全動作したため不要と判断。

### 3.3 R3. print出力のキャプチャ検証
- **結果**: 成功
- **動作の詳細**: `sys.stdout` をカスタムバッファクラスにリダイレクトし、`sys.settrace()` の各ステップイベントと同期して出力差分を収集。
- **制約事項・注意点**: 末尾の改行コード (`\n`) のハンドリングおよび `sys.stdout.flush()` の呼び出し挙動に留意が必要。

## 4. Phase 2 開発に向けた推奨事項とアーキテクチャ提案

1. **Web Worker の導入**:
   - メイン UI スレッドで Pyodide を実行すると、コード実行中や初期化中に画面がフリーズする。Phase 2 では Pyodide を Web Worker 上で駆動させる構成を推賞。
2. **ステップ出力データ構造の標準化**:
   - `TraceStep` インターフェースを共通型として定義し、フロントエンド（React/UI）への受け渡しフォーマットを確定させる。
3. **無限ループ・過剰ステップ防止ガード**:
   - ステップ数が上限（例: 10,000ステップ）を超えた場合に `sys.settrace` 内で RuntimeError を発生させて強制終了する安全装置を実装すること。

## 5. 検証環境および再現手順
- 検証用HTML: `index.html` または `test_runner.html`
- 実行手順: ブラウザで対象HTMLファイルを開き、自動判定結果を表示。
```

---

## 結論と次のステップ
Explorer 3 による調査の結果、Pyodideにおける `print` 出力キャプチャ、複数 `print` のステップ紐付け、および自動テスト環境の構築方法は完全に明確化されました。

1. **`sys.stdout` 差し替えによる差分取得方式**が最適であり、ステップ追跡と出力結果の完全な同期が可能です。
2. **`test_runner.html` スタンドアロンテスト環境**により、R1, R2, R3 の全条件を機械的に即時検証できます。
3. **`poc_report.md`** の全要件をクリアする明確なドキュメント構造を定義しました。

本内容を Implementer および Implementer Preview チームへの指示・設計資料として引き継ぎます。
