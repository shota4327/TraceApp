# Pyodide初期化および基本Python実行（R1）技術調査レポート

## 概要

本レポートは、TraceApp Phase 1 PoC における **R1: Pyodideの初期化と基本Python実行の検証** に向けた技術調査結果をまとめたものです。
ブラウザ環境（HTML/JS/TS）において、Pyodide v0.26.4 を読み込み、JavaScriptからPythonコードを実行・データ連携を行うための仕様と推奨コード構造を規定します。

---

## 1. Minimal Browser HTMLにおけるPyodideの読み込み方法

Pyodideをブラウザで読み込む方法は主に以下の2種類が存在します。

### (1) CDN経由の `<script>` タグ読み込み（PoC推奨）
最もシンプルでビルドツール（Vite, Webpack等）を必要としない方法です。
グローバルスコープ（`window`）に `loadPyodide` 関数が定義されます。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>TraceApp PoC - Pyodide R1</title>
  <!-- Pyodide v0.26.4 CDN -->
  <script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"></script>
</head>
<body>
  ...
</body>
</html>
```

### (2) ES Module (mjs) 経由の読み込み
`<script type="module">` 内で直接 Pyodide ESM をインポートします。

```html
<script type="module">
  import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.mjs";
  
  const pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
  });
</script>
```

### indexURL の重要性
`loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/" })` の `indexURL` オプションを指定することで、WebAssemblyバイナリ（`pyodide.asm.wasm`）や標準ライブラリ（`python_stdlib.zip`）の配信元を明示的に指定します。CDN script経由の場合は自動補完されますが、明示指定することが推奨されます。

---

## 2. JavaScriptでのPyodide初期化とPythonコード実行

### (1) 初期化 (`loadPyodide()`)
`loadPyodide()` は `Promise<PyodideInterface>` を返します。

```typescript
const pyodide = await loadPyodide({
  indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
  stdout: (text: string) => console.log("[Python stdout]", text),
  stderr: (text: string) => console.error("[Python stderr]", text),
});
```

主なオプション:
- `indexURL`: WASM / stdlib 資産の取得元URL
- `stdout`: `sys.stdout` への書き込みをキャプチャするコールバック関数
- `stderr`: `sys.stderr` への書き込みをキャプチャするコールバック関数
- `fullStdLib`: `boolean` (デフォルト `false`)。フル標準ライブラリをあらかじめロードするか否か

### (2) Pythonコードの実行 (`runPython` / `runPythonAsync`)

| メソッド | 特徴・用途 |
|---|---|
| `pyodide.runPython(code, options)` | 同期的にPythonコードを実行。コードブロックの最後の評価式の値を返す。 |
| `pyodide.runPythonAsync(code, options)` | 非同期的にPythonコードを実行。Top-level `await` や Python coroutine/future をサポート。 |

#### オプション (`RunPythonOptions`):
- `globals`: 実行に使用するグローバル名前空間 (`PyProxy`)
- `locals`: 実行に使用するローカル名前空間 (`PyProxy`)
- `filename`: スタックトレースのファイル名指定 (デフォルト: `"<exec>"`)

---

## 3. Pythonの戻り値とJSオブジェクトの相互転送・アクセス

### (1) 基本型（プリミティブ）の自動変換
Pythonの基本データ型はJavaScriptのプリミティブ型に自動変換されます。
- `int` / `float` → JS `number`
- `str` → JS `string`
- `bool` → JS `boolean`
- `None` → JS `undefined`

### (2) 複合オブジェクトと `PyProxy`
リスト、辞書、関数、オブジェクトなどの複合型は JavaScript 側に **`PyProxy`** オブジェクトとして渡されます。

#### `PyProxy` から JSオブジェクトへの変換 (`toJs`)
`pyProxy.toJs()` を呼び出すことで、PythonオブジェクトをJSの型（Array, Map, Object）に深層変換できます。

```typescript
const pyDict = pyodide.runPython("{ 'x': 5, 'y': 3, 'total': 8 }");
// dict_converter を指定して Plain JS Object に変換
const jsObj = pyDict.toJs({ dict_converter: Object.fromEntries });
pyDict.destroy(); // 使用後に必ず破棄
```

### (3) メモリ管理（`PyProxy.destroy()`）
- `PyProxy` は WebAssembly C-Heap（Pythonメモリ管理）を参照しています。
- JavaScriptのガベージコレクション（GC）のみではWASMメモリが即座に解放されず、**メモリリークの原因**となります。
- 使用が完了した `PyProxy` は必ず **`pyProxy.destroy()`** で破棄する必要があります。

### (4) Pythonグローバル名前空間へのアクセス (`pyodide.globals`)
JavaScriptからPythonのグローバルスコープの変数を直接操作できます。
- `pyodide.globals.get('var_name')`: 変数取得
- `pyodide.globals.set('var_name', value)`: 変数設定
- `pyodide.globals.has('var_name')`: 存在チェック

---

## 4. R1検証用最小コード構造 (Minimal Code Structure)

以下は R1 の要件（Pyodide初期化と四則演算・変数代入の検証）を満たす最小限のコード構造です。

### HTMLファイル (`index.html`)

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TraceApp Phase 1 PoC - R1 Validation</title>
  <!-- Pyodide v0.26.4 -->
  <script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"></script>
</head>
<body>
  <h1>TraceApp Phase 1 PoC - R1 検証</h1>
  
  <div id="status">Pyodideを初期化中...</div>
  <button id="run-btn" disabled>Pythonコード実行</button>
  
  <pre id="output"></pre>

  <script src="main.js"></script>
</body>
</html>
```

### JavaScriptファイル (`main.js` またはコンパイル後TS)

```javascript
/**
 * TraceApp Phase 1 PoC - R1 検証スクリプト
 * Pythonコードの変数代入・四則演算とJavaScriptへの結果取得を検証
 */
let pyodide = null;

const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run-btn");
const outputEl = document.getElementById("output");

// 1. Pyodideの初期化
async function init() {
  try {
    statusEl.textContent = "Pyodideの読み込み中...";
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
      stdout: (text) => appendOutput(`[stdout] ${text}`),
      stderr: (text) => appendOutput(`[stderr] ${text}`),
    });
    statusEl.textContent = "Pyodideの初期化完了！";
    runBtn.disabled = false;
  } catch (err) {
    statusEl.textContent = `初期化エラー: ${err.message}`;
  }
}

// Outputログ出力補助
function appendOutput(msg) {
  outputEl.textContent += msg + "\n";
}

// 2. Pythonコードの実行と結果検証
runBtn.addEventListener("click", () => {
  if (!pyodide) return;

  appendOutput("--- Pythonコード実行開始 ---");
  
  const pythonCode = `
x = 5
y = 3
total = x + y
total
`;

  try {
    // 実行結果の評価（最後の式 'total' の評価値が返る）
    const result = pyodide.runPython(pythonCode);
    appendOutput(`runPythonの戻り値: ${result}`);

    // pyodide.globals からPython変数を直接取得
    const totalVal = pyodide.globals.get("total");
    appendOutput(`pyodide.globals.get('total'): ${totalVal}`);

    appendOutput("R1検証: 成功 (変数代入・四則演算・値取得を確認)");
  } catch (err) {
    appendOutput(`実行エラー: ${err.message}`);
  }
});

// 初期化開始
init();
```

---

## 5. 制約・注意点・Phase 2への推奨事項

1. **スクリプト読み込み順序**
   `pyodide.js` が `main.js` より前に読み込まれる必要があります。
2. **`PyProxy` のメモリリーク対策**
   辞書やリストなどのPythonオブジェクトを `pyodide.globals.get()` や `runPython()` で取得した場合は、使用完了後に `.destroy()` を明示的に呼び出すよう実装ルールを統一すること。
3. **同期実行 (`runPython`) vs 非同期実行 (`runPythonAsync`)**
   単発の短いスクリプトは `runPython` で問題ありませんが、今後の `sys.settrace()` や複雑なステップ実行においては非同期呼び出しが必要になるケースを視野に入れる必要があります。
