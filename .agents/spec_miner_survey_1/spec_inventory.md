# TraceApp Phase 2-4 仕様インベントリ (spec_inventory.md)

本ドキュメントは、`ORIGINAL_REQUEST.md` および `basic_design.md`、PoC検証結果 (`poc_report.md` / `PROJECT.md`) を精査し、TraceApp Phase 2〜4 において実装・担保すべきすべての機能仕様、画面要件、データインターフェース、エッジケース、エラー挙動を完全網羅した仕様インベントリである。

---

## 1. Features Discovered (機能仕様一覧)

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Trace Engine | Web Worker上でのPyodide非同期実行 | Pyodide (v0.26.4) ランタイムおよびPythonトレース実行環境をWeb Worker上に配置し、メインスレッド(UI)をブロックせずに非同期通信(`postMessage`)で実行する。 | メインスレッドからのWorker開始メッセージ | Workerのロード完了通知 (`ready`) | 初期化失敗時、UI側にエラーメッセージを表示 | ORIGINAL_REQUEST §R1, basic_design §3.1 |
| 2 | Trace Engine | 一括事前トレース実行とスナップショット保持 | 実行開始（最初の「次へ」操作）時にプログラム全体を `sys.settrace()` 付きで事前実行し、各ステップの状態（行番号、変数状態、print出力、ASTノードID）を配列に保持する。 | Pythonソースコード文字列 | `StepSnapshot` の配列 (`traceSnapshots`) | 構文エラー時、エラーメッセージをUIに表示し実行中断 | ORIGINAL_REQUEST §R1, basic_design §4.1 |
| 3 | Trace Engine | sys.settrace() による行単位ステップ情報抽出 | Python標準の `sys.settrace()` コールバックをフックし、`line` イベント発生時に `frame.f_lineno`, `frame.f_locals`, `frame.f_globals` を記録する。 | 実行中フレーム (`frame`), イベント名 (`event`) | 行番号 (`lineNumber`), 変数リスト (`variables`) | Pyodide内部フレーム等の不要フレームは絞り込み除外 | ORIGINAL_REQUEST §R1, basic_design §4.3 |
| 4 | Trace Engine | 基本データ型のサポート | 追跡対象の変数を基本型 (`int`, `float`, `str`, `bool`) のみに限定し、文字列表現化および型判定を行う。 | 変数オブジェクト | 変数名、値 (文字列)、型名 (`int`/`float`/`str`/`bool`) | 対応外データ型や非シリアライズ可能オブジェクトは `repr()` 文字列表現にフォールバック | ORIGINAL_REQUEST §R1, basic_design §2.3 |
| 5 | Trace Engine | 変数スコープの判定と分離 | 変数は原則すべて `global` スコープとして扱い、関数内実行時（`f_code.co_name != '<module>'`）のみ `local` スコープとして区別記録する。 | `frame.f_locals`, `frame.f_globals` | スコープ識別子 (`'global'` または `'local'`) | システム変数（`_`で始まる変数等）は除外 | ORIGINAL_REQUEST §R1, basic_design §2.3 |
| 6 | Trace Engine | ステップ数上限ガードと無限ループ防止 | 無限ループやステップ過多によるフリーズを防止するため、最大ステップ数（10,000ステップ）に達した時点で実行を強制中断する。 | ステップ実行カウント | `TraceLimitExceeded` エラー状態 | `TraceLimitExceeded(BaseException)` カスタム例外を発生させ、ユーザーの `try...except Exception:` をすり抜けて安全停止 | ORIGINAL_REQUEST §R1, basic_design §7.3 |
| 7 | Trace Engine | print出力をキャプチャしステップと紐付け | Pythonの `sys.stdout` をキャプチャクラス (`OutputCapture` / `StepStdoutWriter`) に差し替え、各ステップまでの累積出力および差分出力を記録する。 | `print(...)` 呼び出し | ステップごとの `printOutput` 配列 | 特殊文字や改行コードを含む文字列も欠損なくキャプチャ | ORIGINAL_REQUEST §R1, basic_design §4.3 |
| 8 | 2-Pane UI | 2ペイン全体レイアウト構成 | ヘッダー、左パネル（コード/流れ図タブ + ナビゲーション）、右パネル（変数履歴表 + print出力）で構成される画面レイアウト。 | 画面サイズ / リサイズ | 統合UI画面 | ライトモード基調の教科書的デザイン | ORIGINAL_REQUEST §R2, basic_design §2.1 |
| 9 | Header UI | サンプルプログラム選択 | ドロップダウンメニューからプリセットされたサンプルプログラムを選択してエディタに読み込む。 | ドロップダウンの変更イベント | エディタへのソースコード反映 | コード編集中の場合は切り替え確認または状態初期化 | ORIGINAL_REQUEST §R2, §R4, basic_design §2.1 |
| 10 | Header UI | Pythonファイル (.py) アップロード | ローカルPCから `.py` ファイルを読み込み、エディタにソースコードを展開する。 | `.py` ファイル選択 (File API) | エディタへのファイル内容反映 | 非テキストファイルや読み込みエラー時はエラー通知 | ORIGINAL_REQUEST §R2, basic_design §2.1 |
| 11 | Left Panel | Monaco Editor コード表示・編集 | Monaco Editor を使用し、Pythonのシンタックスハイライトおよび直接編集機能を提供する。 | ユーザー入力コード | 更新された `sourceCode` | 構文エラーのリアルタイム表示（Monaco標準） | ORIGINAL_REQUEST §R2, basic_design §2.2 |
| 12 | Left Panel | Monaco Editor 実行行ハイライト | 現在実行中のステップのソース行番号に対応する Monaco エディタ上の行をデコレーション機能でハイライト表示する。 | 現在のステップの `lineNumber` | エディタ上のハイライト行表示 | 行番号が無効な場合はハイライト非表示 | ORIGINAL_REQUEST §R2, basic_design §2.2 |
| 13 | Left Panel | 「コード」/「流れ図」タブ切り替え | 左パネル上部のタブボタンにより、 Monaco Editor と FlowchartViewer の表示を切り替える（同時表示はしない）。 | タブクリックイベント | 左パネルの表示コンテンツ切替 | タブ切替時も実行中のステップ状態やハイライト位置を維持 | ORIGINAL_REQUEST §R2, basic_design §2.2 |
| 14 | Navigation | 「次へ」ステップ進捗ボタン | トレースステップを 1 つ進め、対応するコード行・変数表・流れ図ノード・print出力を更新する。未トレース時はトレースを開始する。 | ボタンクリック | `currentStepIndex` + 1 | 最終ステップ到達時はボタン無効化 | ORIGINAL_REQUEST §R2, basic_design §2.2 |
| 15 | Navigation | 「前へ」ステップ復元ボタン | トレースステップを 1 つ戻し、直前のステップ時点のすべての表示状態（変数表、コードハイライト等）を正確に復元する。 | ボタンクリック | `currentStepIndex` - 1 | 初期ステップ (index 0) の場合はボタン無効化 | ORIGINAL_REQUEST §R2, basic_design §2.2 |
| 16 | Navigation | 「リセット」トレース初期化ボタン | トレース状態を初期化（`currentStepIndex = -1`）し、コードの編集可能状態に戻す。 | ボタンクリック | トレース状態クリア | コードエディタの入力内容は保持される | ORIGINAL_REQUEST §R2, basic_design §2.2 |
| 17 | Navigation | ステップスライダー (Range Input) | 全ステップ中の現在位置を視覚的に表示し、スライダーのドラッグ操作により任意のステップへ即座にジャンプする。 | スライダー位置変更イベント | 任意 `stepIndex` へのジャンプ | トレース未実行時はスライダー非活性 | ORIGINAL_REQUEST §R2, basic_design §2.2 |
| 18 | Right Panel | 変数履歴表 (スプレッドシート型) | 横軸に変数列、縦軸に実行ステップごとの値の変化を表示する表。変数が未定義のステップは「-」と表示する。 | 全 `StepSnapshot` の `variables` | 変数履歴マトリクス | 新規変数が登場した場合は列を動的に追加 | ORIGINAL_REQUEST §R2, basic_design §2.3 |
| 19 | Right Panel | 変数履歴の変更セル・変更列ハイライト | 当該ステップで値が変更されたセル（例: 黄色背景）と、その変数の列全体（例: 薄い背景）を明確に視覚ハイライトする。 | `variables[].changed` フラグ | 強調表示されたテーブルセル・列 | 変化がないステップでは変更セルハイライトなし | ORIGINAL_REQUEST §R2, basic_design §2.3 |
| 20 | Right Panel | print出力パネル | ステップ進行に応じて、時系列順に `print()` の出力をエリア下部に追記表示する。 | `StepSnapshot.printOutput` | ターミナル風出力ビュー | 出力がない場合は空またはプレースホルダーを表示 | ORIGINAL_REQUEST §R2, basic_design §2.3 |
| 21 | Flowchart | Python AST 解析 | Pyodide 上の Python `ast` モジュールを使用して、Python コードから構文木 (AST) を抽出し、JSON 化する。 | Pythonソースコード文字列 | AST データ構造 (JSON) | 構文エラー時、AST解析失敗エラーを通知 | ORIGINAL_REQUEST §R3, basic_design §5.1 |
| 22 | Flowchart | 流れ図データ構造への変換 | AST をパースし、処理・判断・繰り返し・関数呼び出しなどの構造をノードとエッジの流れ図データに変換する。 | AST データ構造 | `FlowchartNode[]`, `flowchartXml` | サポート対象外構文 (クラス等) は汎用処理ノードまたは無視 | ORIGINAL_REQUEST §R3, basic_design §5.2 |
| 23 | Flowchart | 流れ図記号・形状の正規化マッピング | 代入/print=長方形(処理)、if/elif=ひし形(判断)、while/for=六角形(ループ開始/終了)、def/呼び出し=二重線長方形(サブルーチン)、開始/終了=角丸長方形(端子) にマッピングする。 | AST ノード種別 | 正確な記号形状属性を持つノードデータ | クラスやインターフェース記号は非対応（対象外） | ORIGINAL_REQUEST §R3, basic_design §5.2 |
| 24 | Flowchart | draw.io mxGraph XML 保持 | 流れ図内部データを draw.io の mxGraph XML 形式として生成・保持する。 | 流れ図データ | XML 文字列 (`flowchartXml`) | 将来的な `.drawio` ファイルエクスポートに対応可能 | ORIGINAL_REQUEST §R3, basic_design §5.3 |
| 25 | Flowchart | 独自 SVG / Canvas レンダリング | dagre.js 等の自動レイアウトエンジンを活用し、トップダウン方向の自動配置でSVG/Canvasを描画する。 | 流れ図ノード & エッジデータ | 描画された流れ図グラフ | 複雑な分岐・ネストも重ならずに自動配置 | ORIGINAL_REQUEST §R3, basic_design §5.3 |
| 26 | Flowchart | 流れ図ノードのリアルタイムハイライト | ステップ実行時に、実行中のソース行に対応する AST ノード ID を経由して、流れ図上の対応ノードを動的にハイライト表示する。 | 現在のステップの `astNodeId` | 流れ図上の強調ノード表示 | 対応ノードが存在しない場合はハイライトなし | ORIGINAL_REQUEST §R3, basic_design §5.4 |
| 27 | Preset | サンプルプログラム 1: 基本順次・代入 | 起動時プリセット 1 (変数代入、四則演算、print) | ドロップダウン選択 | 順次実行サンプルコード | トレース実行確認 | ORIGINAL_REQUEST §Acceptance Criteria, Test 1 |
| 28 | Preset | サンプルプログラム 2: 条件分岐 | 起動時プリセット 2 (score, if/elif/else, grade判定) | ドロップダウン選択 | 条件分岐サンプルコード | トレース実行確認 | ORIGINAL_REQUEST §Acceptance Criteria, Test 2 |
| 29 | Preset | サンプルプログラム 3: ループと関数 | 起動時プリセット 3 (def add, for loop, 累積加算) | ドロップダウン選択 | ループ・関数サンプルコード | トレース実行確認 | ORIGINAL_REQUEST §Acceptance Criteria, Test 3 |
| 30 | Quality | Vite + React + TypeScript 開発環境 | 全体のビルドと型チェックを TypeScript ( strict モード) で実施し、型エラー 0 件を達成する (`npm run build` 成功)。 | TypeScriptソースコード (.ts, .tsx) | ビルド済みWebアプリケーション | .js / .jsx ファイルの混入を排除 (設定ファイル除く) | ORIGINAL_REQUEST §R5, §Acceptance Criteria |
| 31 | Quality | モジュール分割と関数の行数制限 | 各関数を 1 つの責務に絞り 30〜50 行以内に抑える。ロジック (TraceEngine等) と UI を明確に分離する。 | TypeScriptモジュール群 | 清潔で維持管理しやすいコードベース | 関数の肥大化防止 | ORIGINAL_REQUEST §R5, basic_design §8.2 |
| 32 | Quality | 日本語ドキュメント・コメント化 | コード内の docstring やコメント、UI表示文言、報告書はすべて日本語で記述する。 | ソースコード / コメント | 日本語コメントコード | 英語コメントの混入防止 | ORIGINAL_REQUEST §R5, user_global rule |

---

## 2. Edge Cases (エッジケースと例外挙動)

| # | Feature | Input / Condition | Observed / Required Behavior | Discovered Via |
|---|---------|-------------------|------------------------------|----------------|
| 1 | Trace Engine | 無限ループ (`while True:` 等) や10,000ステップ超えのコード | `TraceLimitExceeded(BaseException)` が発生し、実行が即座に安全停止。UI側に「10,000ステップを超えました」のエラーメッセージを表示し、ブラウザがフリーズしない。 | ORIGINAL_REQUEST §R1, basic_design §7.3, poc_report §4.1 |
| 2 | Trace Engine | ユーザーコード内に `try: ... except Exception:` ガードが存在する場合 | `TraceLimitExceeded` が `BaseException` を継承しているため、ユーザーの `except Exception:` をすり抜けて最外周のトレーサーで確実に捕捉され、中断処理が行われる。 | poc_report §4.1 |
| 3 | Trace Engine | 特殊浮動小数点数 (`float('nan')`, `float('inf')`, `float('-inf')`) の評価 | スコープサニタイズ処理にて `math.isnan()` / `math.isinf()` で検出し、JavaScript互換の文字列 (`"NaN"`, `"Infinity"`, `"-Infinity"`) に変換して JSON シリアライズのエラー（クラッシュ）を防止する。 | basic_design §7.4, poc_report §4.2 |
| 4 | Trace Engine | 循環参照オブジェクト (例: `a = []; a.append(a)`) の評価 | シリアライズ時の例外を捕捉し、安全な文字列表現 `repr(v)` (例: `"[[...]]"`) へフォールバックして処理を継続する。 | basic_design §7.4, poc_report §4.3 |
| 5 | Trace Engine | 可変オブジェクト (リスト・辞書等) の状態更新 | スナップショット作成時にオブジェクトの複製 (`json.loads(json.dumps(...))`) を行い、後続ステップでの値変更が過去のステップ履歴に影響を与過ないように参照汚染を防止する。 | poc_report §4.3 |
| 6 | Variable Table | 変数がまだ定義されていないステップでの表示 | 変数履歴表の該当セルには「`-`」を表示し、未定義であることを視覚的に区別する。 | basic_design §2.3 |
| 7 | Variable Table | ステップ実行中に関数内に入り、ローカル変数が生成される場合 | グローバル変数とローカル変数を視覚的（背景色等）に分離・区別して表示する。関数を抜けた後はローカル変数は履歴に保持されるか非活性化される。 | ORIGINAL_REQUEST §R1, basic_design §2.3 |
| 8 | Flowchart | クラス定義 (`class MyClass:`) や未対応の高度な構文 | クラス・インターフェースは流れ図生成の対象外とし、エラーでクラッシュさせずに無視するか単一の汎用処理ブロックとして安全に処理する。 | ORIGINAL_REQUEST §R3, basic_design §5.2 |
| 9 | Flowchart | 実行されなかった `if` / `elif` / `else` ブランチ | トレース実行時に未実行行としてスキップされ、流れ図上でも該当ノードのハイライトは行われない。 | poc_report §2 R2-2 |
| 10 | Header / File | 空のファイルや Python 以外のファイル (.txt, .js) のアップロード | ファイル読み込み時にバリデーションを行い、無効なファイル形式または空ファイルである旨の警告・エラーをダイアログ等で表示する。 | ORIGINAL_REQUEST §Acceptance Criteria |
| 11 | UI Navigation | Pyodide の初回ロード中 | Web Worker 内で Pyodide をロードしている間、画面上に「Pyodide ロード中...」のスピナー/プログレスを表示し、実行ボタン等を無効化して不整合を防ぐ。 | ORIGINAL_REQUEST §Acceptance Criteria, basic_design §7.1 |
| 12 | Navigation | トレース実行後にユーザーがコードを編集した場合 | トレース状態をクリア（「リセット」状態）し、次回「次へ」ボタンが押された際に新しいコードで再トレースを実行する。 | basic_design §6.2 State Diagram |

---

## 3. Data Structures & Interfaces (主要データ構造・インターフェース)

### 3.1 ステップスナップショット (`StepSnapshot`)

```typescript
export type DataType = 'int' | 'float' | 'str' | 'bool';

export interface VariableState {
  name: string;              // 変数名
  value: string;             // 値（文字列表現）
  type: DataType;            // データ型
  scope: 'global' | 'local'; // スコープ
  changed: boolean;          // このステップで変更されたか
}

export interface StepSnapshot {
  stepIndex: number;          // ステップ番号（0始まり）
  lineNumber: number;         // 実行中のPythonソースコードの行番号
  variables: VariableState[]; // 変数スナップショット
  stepOutput: string;         // このステップで新しく出力された文字列 (Delta)
  printOutput: string[];      // このステップまでのprint累積出力
  astNodeId: string | null;   // 対応する流れ図ノードID
}
```

### 3.2 トレース実行結果 (`TraceResult`)

```typescript
export interface TraceResult {
  success: boolean;
  snapshots: StepSnapshot[];
  totalSteps: number;
  stdout: string;
  error?: string;
  astData?: object;
  flowchartNodes?: FlowchartNode[];
  flowchartXml?: string;
}
```

### 3.3 メインスレッド ↔ Web Worker 通信メッセージ

```typescript
// メインスレッド → Worker
export type WorkerRequest = 
  | { type: 'INIT' }
  | { type: 'RUN_TRACE'; code: string; maxSteps?: number };

// Worker → メインスレッド
export type WorkerResponse =
  | { type: 'READY' }
  | { type: 'TRACE_SUCCESS'; result: TraceResult }
  | { type: 'TRACE_ERROR'; error: string };
```

### 3.4 流れ図ノード定義 (`FlowchartNode`)

```typescript
export type NodeType = 
  | 'start'       // 端子 (開始)
  | 'end'         // 端子 (終了)
  | 'process'     // 処理 (長方形)
  | 'decision'    // 判断 (ひし形)
  | 'loopStart'   // ループ開始 (六角形)
  | 'loopEnd'     // ループ終了 (六角形)
  | 'subroutine'; // 関数定義/呼び出し (二重線長方形)

export interface FlowchartNode {
  id: string;             // ユニークノードID
  type: NodeType;         // 記号タイプ
  label: string;          // ノード内テキスト
  lineNumber?: number;    // 対応するPython行番号
  children?: string[];    // 遷移先ノードIDリスト
  yesBranch?: string;     // True分岐の遷移先 (判断ノード用)
  noBranch?: string;      // False分岐の遷移先 (判断ノード用)
}
```

### 3.5 アプリ全体の状態 (`AppState`)

```typescript
export interface AppState {
  sourceCode: string;
  traceSnapshots: StepSnapshot[];
  currentStepIndex: number;
  isTraceReady: boolean;
  flowchartData: FlowchartNode[];
  flowchartXml: string;
  activeTab: 'code' | 'flowchart';
  pyodideReady: boolean;
  isLoading: boolean;
  errorMessage: string | null;
}
```

---

## 4. 検証用テストプログラム要件

以下 3 つのサンプルプログラムが正しくトレースされ、全ステップナビゲーション、変数変化ハイライト、流れ図描画、print出力が意図通り動作すること。

### テスト 1: 基本順次・代入
```python
x = 5
y = 3
total = x + y
print(total)
```

### テスト 2: 条件分岐
```python
score = 75
if score >= 80:
    grade = "A"
elif score >= 60:
    grade = "B"
else:
    grade = "C"
print(grade)
```

### テスト 3: ループと関数
```python
def add(a, b):
    result = a + b
    return result

total = 0
for i in range(1, 4):
    total = add(total, i)
print(total)
```
