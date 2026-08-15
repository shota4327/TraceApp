# Pyodide環境における `sys.settrace()` を用いたステップ実行トレース技術検証レポート

## 1. 概要 (Executive Summary)

本レポートは、プログラミング教育用Pythonトレース可視化ツール「TraceApp」のPhase 1 PoCにおける、Pyodide環境下での `sys.settrace()` を用いたステップ実行トレースの技術検証結果をまとめたものです。

結論として、**Pyodide（WebAssembly上のCPython）において `sys.settrace()` は問題なくネイティブに動作します**。特別なパッチや独自のコンパイルオプションは不要であり、CPython標準のフレーム検査機構を利用して、行番号・イベントタイプ・ローカル変数・グローバル変数を正確に取得可能です。

---

## 2. Pyodideにおける `sys.settrace()` の動作検証

### 2.1 Pyodideでの動作可否
PyodideはCPythonインタープリタ本体をEmscriptenでWebAssemblyにビルドした環境です。CPythonのバイトコード評価ループ（`PyEval_SetTrace` / `sys.settrace`）はWasm環境でもそのまま維持されているため、標準のPython環境と全く同様に `sys.settrace()` を設定・実行できます。

### 2.2 トレースコールバックの引数構造
`sys.settrace(trace_func)` に渡すコールバック関数 `trace_func(frame, event, arg)` のパラメーター仕様は以下の通りです。

- **`frame` (FrameType)**: 現在実行中のスタックフレームオブジェクト
  - `frame.f_lineno`: 現在実行されようとしている行番号 (1-based int)
  - `frame.f_code.co_filename`: 実行中のコードのファイル名 (`<string>` や指定した識別子)
  - `frame.f_code.co_name`: 現在のスコープ名 (`<module>` または関数名)
  - `frame.f_locals`: 現在のスコープにおけるローカル変数の辞書 (`dict`)
  - `frame.f_globals`: グローバル変数の辞書 (`dict`)
- **`event` (str)**: 発生したイベント種別
  - `'line'`: 新しい行が実行される直前
  - `'call'`: 関数にエントリした直前
  - `'return'`: 関数からリターンする直前（`arg` に戻り値が格納される）
  - `'exception'`: 例外が発生した時（`arg` に `(exception, value, traceback)` タプルが格納される）
- **`arg`**: イベントに依存する追加情報 (`return` イベント時の戻り値など)

### 2.3 フィルタリングの必要性
`sys.settrace()` を設定すると、Pyodide内部のモジュールロードや標準ライブラリのコール等、すべてのPython実行に対してイベントが発生します。そのため、ユーザーコードのみを抽出するには、`frame.f_code.co_filename` を用いたフィルタリングが必須となります。

---

## 3. 各構文テストに対する Python トレース構造設計

以下に、PoC要件で提示された4つのテストケースに対する動作解析と、それを補足するトレース関数の設計を示します。

### 3.1 テストケース別の動作検証解析

#### **テスト1: 順次実行（代入文）**
```python
x = 5
y = 3
total = x + y
```
- **動作挙動**: 
  1. `line 1`: 行番号1で `'line'` イベント発生。実行前のため `locals={}`。
  2. `line 2`: 行番号2で `'line'` イベント発生。前行が完了しているため `globals={'x': 5}`。
  3. `line 3`: 行番号3で `'line'` イベント発生。`globals={'x': 5, 'y': 3}`。
  4. 実行終了後、最終状態として `total = 8` が確定。

#### **テスト2: 条件分岐（if / elif / else）**
```python
score = 75
if score >= 80:
    grade = "A"
elif score >= 60:
    grade = "B"
else:
    grade = "C"
```
- **動作挙動**:
  1. `line 1`: `score = 75` の実行前イベント。
  2. `line 2`: `if score >= 80` の評価（False と判定）。
  3. `line 4`: 評価がFalseのため `line 3` (grade = "A") はスキップされ、`elif score >= 60` にジャンプして評価（True と判定）。
  4. `line 5`: `grade = "B"` の実行前イベント（`score=75`）。
  5. `else` 節 (line 6-7) は実行されずに通過。
  - **評価点**: 条件を満たさなかった非実行ブロックの行イベントは発生せず、実際の実行パス（Line 1 -> 2 -> 4 -> 5）のみが記録されます。

#### **テスト3: ループ（for）**
```python
total = 0
for i in range(1, 4):
    total = total + i
```
- **動作挙動**:
  1. `line 1`: `total = 0`
  2. `line 2`: `for i in range(1, 4):` (1回目の評価, `i=1`)
  3. `line 3`: `total = total + i` (`total=0, i=1`)
  4. `line 2`: `for i in range(1, 4):` (2回目の評価, `i=2`)
  5. `line 3`: `total = total + i` (`total=1, i=2`)
  6. `line 2`: `for i in range(1, 4):` (3回目の評価, `i=3`)
  7. `line 3`: `total = total + i` (`total=3, i=3`)
  8. `line 2`: ループ終了判定。
  - **評価点**: ループの各イテレーションで変数の推移（`i` と `total` の変化）がステップ順に正確にトラッキングされます。

#### **テスト4: 関数定義と呼び出し**
```python
def add(a, b):
    result = a + b
    return result

answer = add(3, 4)
```
- **動作挙動**:
  1. `line 1`: `def add(...)` の定義。モジュールスコープに `add` 関数オブジェクトが登録される。
  2. `line 5`: `answer = add(3, 4)` の実行。
  3. `'call'` イベント (`add` 関数フレーム): `line 1`, `co_name='add'`, `f_locals={'a': 3, 'b': 4}`。
  4. `line 2` (関数内): `result = a + b` の実行前（`a=3, b=4`）。
  5. `line 3` (関数内): `return result` の実行前（`a=3, b=4, result=7`）。
  6. `'return'` イベント (`add` 関数フレーム): `arg=7`, `f_locals={'a': 3, 'b': 4, 'result': 7}`。
  7. モジュールスコープ復帰: `answer` に 7 が格納される。
  - **評価点**: 関数呼出時のローカル変数（`a`, `b`, `result`）とモジュールレベルのグローバル変数（`add`, `answer`）がフレームの `f_locals` / `f_globals` によって明確に分離取得できます。

---

## 4. 構造化ステップトレースデータの抽出と JavaScript 連携

### 4.1 Pyodideにおける Python / JS 連携パターン
PyodideでPythonオブジェクトを直接JavaScript側に返却すると、`PyProxy` オブジェクトが生成され、JavaScript側で明示的な `destroy()` 呼び出しを行わない限りWasmメモリリークの原因となります。

そのため、**Python側でトレース結果を `json.dumps()` によりJSON文字列にシリアライズし、JavaScript側で `JSON.parse()` する方式**が最も安全かつ高速です。

### 4.2 標準実装パターンコード（Python側トレーサー）

```python
import sys
import json
import io

class PyodideTracer:
    def __init__(self, target_filename="<string>", max_steps=1000):
        self.target_filename = target_filename
        self.max_steps = max_steps
        self.steps = []
        self.stdout_buffer = io.StringIO()
        self.step_count = 0

    def trace_func(self, frame, event, arg):
        # ターゲットファイルのフレームのみを対象
        if frame.f_code.co_filename != self.target_filename:
            return self.trace_func

        self.step_count += 1
        if self.step_count > self.max_steps:
            raise RuntimeError(f"Execution step limit exceeded ({self.max_steps} steps).")

        if event in ('line', 'call', 'return'):
            # スコープ変数のサニタイズ（シリアライズ可能な形式に変換）
            locals_clean = self._sanitize_scope(frame.f_locals)
            globals_clean = self._sanitize_scope(frame.f_globals)

            step_data = {
                'step': self.step_count,
                'event': event,
                'line': frame.f_lineno,
                'function': frame.f_code.co_name,
                'locals': locals_clean,
                'globals': globals_clean,
                'stdout': self.stdout_buffer.getvalue()
            }
            if event == 'return':
                step_data['return_value'] = repr(arg)

            self.steps.append(step_data)

        return self.trace_func

    def _sanitize_scope(self, scope_dict):
        clean = {}
        for k, v in scope_dict.items():
            # 特殊変数および内部オブジェクトの除外
            if k.startswith('__') and k.endswith('__'):
                continue
            if k in ('sys', 'json', 'io', 'PyodideTracer', 'tracer'):
                continue
            
            # 基本型はそのまま、非シリアライズ型は repr() 文字列化
            if isinstance(v, (int, float, str, bool, type(None))):
                clean[k] = v
            elif isinstance(v, (list, dict, tuple, set)):
                try:
                    json.dumps(v)
                    clean[k] = v
                except (TypeError, OverflowError):
                    clean[k] = repr(v)
            else:
                clean[k] = repr(v)
        return clean

    def run_code(self, code_str):
        old_stdout = sys.stdout
        sys.stdout = self.stdout_buffer
        compiled_code = compile(code_str, self.target_filename, 'exec')
        
        # グローバルスコープの準備
        exec_globals = {'__name__': '__main__'}
        
        sys.settrace(self.trace_func)
        try:
            exec(compiled_code, exec_globals)
        finally:
            sys.settrace(None)
            sys.stdout = old_stdout

        # 最終実行後状態のキャプチャ（最後の行の反映状態）
        final_globals = self._sanitize_scope(exec_globals)
        if self.steps:
            self.steps.append({
                'step': self.step_count + 1,
                'event': 'end',
                'line': self.steps[-1]['line'],
                'function': '<module>',
                'locals': {},
                'globals': final_globals,
                'stdout': self.stdout_buffer.getvalue()
            })

        return json.dumps(self.steps)
```

### 4.3 JavaScript側の呼び出しインターフェース

```typescript
// JavaScript (TypeScript) 側での実行例
async function runTrace(pyodide: any, pythonCode: string) {
  // Python側にトレーサー関数を登録
  const setupScript = `
tracer = PyodideTracer()
result_json = tracer.run_code(${JSON.stringify(pythonCode)})
result_json
  `;
  
  const jsonResult: string = await pyodide.runPythonAsync(setupScript);
  const traceSteps = JSON.parse(jsonResult);
  return traceSteps;
}
```

---

## 5. エッジケース・制約事項とフォールバック検討

### 5.1 発見された注意点と制約

1. **'line' イベントの発行タイミング（実行前状態）**
   - `sys.settrace()` の `'line'` イベントは、該当行のバイトコードが実行される**直前**に発火します。
   - したがって、Line 1 で `x = 5` を実行するステップでは、Line 1 発火時の `f_locals` にはまだ `x` は含まれません。`x` が反映されるのは Line 2 発火時、または実行完了時の最終ステップになります。
   - **対向策**: UI可視化の際、「ステップ N の実行前状態」として表示するか、前後の差分を計算して「Line 1 の実行結果」として表示するようフロントエンド側でモデル化を行う。

2. **無限ループ / 長時間実行によるメインスレッドフリーズ**
   - ブラウザのメインスレッドで `pyodide.runPython()` を同期実行すると、Python内の無限ループ（`while True:` など）によってブラウザUIが完全にフリーズします。
   - **対向策**:
     - ① トレースコールバック内でステップ数制限（例: 最大1,000〜5,000ステップ）を設定し、超過時は `RuntimeError` を発生させて安全に中断する。
     - ② Phase 2 では Pyodide の実行を Web Worker に分離し、メインスレッドの応答性を確保するとともに、必要に応じて Worker を terminate できる構造にする。

3. **print 出力のリアルタイム性とキャプチャ**
   - `sys.stdout` を `io.StringIO` にリダイレクトすることで、各ステップ時点での蓄積出力 (`self.stdout_buffer.getvalue()`) を簡単に取得できます。

4. **複合オブジェクトのシリアライズ**
   - クラスインスタンスや循環参照を持つオブジェクトが変数に含まれる場合、そのまま `json.dumps()` を行うと例外が発生します。
   - **対向策**: トレースコールバック内のサニタイズ処理にて `repr()` 変換または型チェックを挟む。

---

### 5.2 ASTベース・インストルメンテーション手法との比較と代替性評価

`sys.settrace()` が動作しない場合のフォールバックとして検討された AST（構文解析木）書き換えによるステップ挿入手法（例: 各文の前に `trace_step(line_no, locals())` を注入する手法）との比較を以下に示します。

| 評価項目 | `sys.settrace()` 方式 (採用推奨) | AST インストルメンテーション方式 (代替案) |
| :--- | :--- | :--- |
| **精度と信頼性** | CPythonの純正機構のため100%正確 | 複雑な制御構文や内包表記等で構文木の再現漏れリスクあり |
| **コード変形** | 不要（元のコードをそのまま実行） | 必須（実行前にコードをパースして挿入） |
| **ステップ発火** | line / call / return / exception を網羅 | 自前で各構文ノードに挿入が必要 |
| **実装コスト** | 極めて低い（数十行の標準Pythonコード） | 高い（Python `ast` モジュールでの全構文対応が必要） |
| **式レベルトレース** | 不可（行単位のみ） | 可能（ノード単位にフックを挟めば式レベルも可） |

#### 結論:
Pyodideにおいて `sys.settrace()` は完全にネイティブ動作するため、**Phase 1 PoC および Phase 2 本実装においては `sys.settrace()` 方式を採用するのが最適解**です。AST変形方式は「1行の中の式評価プロセス（例: `a + b` の計算課程）」など、より高度な式レベルの視覚化が必要になった場合の将来拡張オプションとして位置付けるのが妥当です。

---

## 6. Phase 2 への推奨事項

1. **PyodideTracer クラスの共通 Python モジュール化**
   - トレースロジックを独立した `.py` ファイル（例: `tracer.py`）として管理し、Pyodide初期化時に `pyodide.FS.writeFile` などで仮想ファイルシステムへ読み込ませる構成を推奨します。

2. **JSONシリアライズ層の堅牢化**
   - Pythonの各種データ型（`set`, `datetime`, `custom class` など）を直感的に表現できるように、JSONエンコーダーのカスタムサニタイザーを強化する。

3. **Web Worker 構成への移行**
   - UIの快適性と安全なコード実行（無限ループ検知・強制停止）のため、Pyodideの読み込みおよびトレース実行を Web Worker 内で行う設計とする。
