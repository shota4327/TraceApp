# Forensic Audit Report — Milestone 2

**Work Product**: `src/types/flowchart.ts`, `src/services/flowchartGenerator.ts`, `src/services/flowchartRenderer.tsx`, `src/worker/pythonTracer.ts`, `src/components/FlowchartViewer.tsx`  
**Profile**: General Project (Forensic Integrity Check)  
**Integrity Mode**: Demo  
**Verdict**: CLEAN  

---

## 1. Observation (観察結果)

### 静的コード解析対象ファイル
1. **`src/types/flowchart.ts`** (75行)
   - 流れ図用データ型定義 (`FlowchartNodeType`, `FlowchartEdgeLabel`, `FlowchartEdge`, `FlowchartNode`, `FlowchartGraph`)。
   - すべて適切なTypeScript型・インターフェースとして定義されており、ハードコードされた期待値等は存在しない。
2. **`src/services/flowchartGenerator.ts`** (279行)
   - Pythonコードのテキスト解析およびASTパースに基づき、CFGノード・エッジ (`FlowchartGraph`) および draw.io mxGraph XML (`generateDrawIoXml`) を動的生成するアルゴリズムが実装されている。
   - `getMxStyleForType` により各ノード種別に応じた draw.io スタイルが設定されている。固定XMLの直接返却などのファサード実装は一切存在しない。
3. **`src/services/flowchartRenderer.tsx`** (391行)
   - SVG要素を用いた流れ図レンダリング関数 (`renderFlowchartSvg`)。
   - `renderTerminalNode` (角丸長方形), `renderProcessNode` (長方形), `renderDecisionNode` (ひし形), `renderLoopNode` (六角形), `renderSubroutineNode` (二重線長方形) など、要件 R3 で定められた形状記号が動的に描画される。
   - `isNodeActive` によりステップ実行中の行・ノードに対する動的なハイライト表示が実装されている。
4. **`src/worker/pythonTracer.ts`** (494行)
   - Pyodide 内で実行される Python スクリプト (`PYTHON_TRACER_SCRIPT`)。
   - `PyodideTracer` クラスによる `sys.settrace()` のステータス追尾、`TraceLimitExceeded` 例外による10,000ステップガード、`StepStdoutWriter` による stdout キャプチャを実装。
   - `generate_ast_flowchart` 内で Python の `ast` モジュール (`ast.NodeVisitor`) を使用して `FunctionDef`, `If`, `For`, `While`, `Assign` 等のASTノードから CFGグラフ (nodes, edges) および draw.io mxGraph XML を真正に生成している。
5. **`src/components/FlowchartViewer.tsx`** (99行)
   - React UIコンポーネント。受け取った `nodes`, `edges`, `code`, `activeLine` に基づいて `renderFlowchartSvg` を経由した SVG レンダリングを行う。

### コマンド実行結果
1. **TypeScript型チェック (`npx tsc --noEmit`)**:
   - コマンド終了コード: `0`
   - エラー検出件数: `0` 件
2. **ユニット・結合テスト (`npx vitest run`)**:
   - `src/__tests__/flowchart.test.tsx` をはじめ、全テストスイートが PASS (8/8 passed for flowchart test suite)。

---

## 2. Logic Chain (推論過程)

1. **改ざん・固定応答の非存在**:
   - 静的コード解析により、ハードコードされたテスト期待値、ダミー/ファサード実装 (`return constant` 等)、固定文字列XMLレスポンスの存在を探索した。
   - 解析の結果、`flowchartGenerator.ts` および `pythonTracer.ts` の双方において、入力コードに対する制御フロー解析と型情報に基づく完全動的生成ロジックが組み込まれていることを確認した。
2. **要件整合性とアルゴリズムの真正性**:
   - 要件 R3 (形状定義、AST解析、draw.io XML生成、アクティブハイライト) のアルゴリズムを追跡した。
   - 端子 (terminal) = 角丸長方形 (`rx=22, ry=22` / `arcSize=50`)
   - 処理 (process) = 長方形 (`rect`)
   - 判断 (decision) = ひし形 (`polygon points="cx,y ..."` / `rhombus`)
   - ループ (loop) = 六角形 (`polygon points="x+offset,y ..."` / `hexagon`)
   - サブルーチン (subroutine) = 二重線長方形 (`rect + line x2` / `shape=process`)
   - 上記記号の生成、`isNodeActive` によるアクティブ判定、`generateDrawIoXml` および `generate_ast_flowchart` による draw.io XML 生成ロジックが真正に機能している。
3. **実行妥当性**:
   - 型チェックおよびユニットテストを実際にコマンドラインから動的に実行し、エラーなく完了することを実証確認した。

---

## 3. Caveats (注意・免責事項)

- 本監査は Milestone 2 の指定対象ファイル (`src/types/flowchart.ts`, `src/services/flowchartGenerator.ts`, `src/services/flowchartRenderer.tsx`, `src/worker/pythonTracer.ts`, `src/components/FlowchartViewer.tsx`) に対する静的解析・実行検証・ロジック真正性検証を中心に実施しました。
- Pyodide のWebWorkerロード（WASMダウンロード）自体はブラウザ環境依存ですが、Worker内部スクリプト (`pythonTracer.ts`) の追跡・AST解析ロジックは単体テストおよびWorker定義レベルで真正性が検証されています。

---

## 4. Conclusion (判定結論)

**判定: CLEAN**

Milestone 2 における流れ図・Web Workerトレースエンジン実装対象ファイルには、改ざん・詐称・ダミー実装・固定XML出力等の不正行為は一切認められず、全ての機能が正規かつ真正なアルゴリズムにより実装されています。

---

## 5. Verification Method (独立検証手順)

以下のコマンドを実行することで、本監査結果を独立して再検証可能です。

1. **型チェックの検証**:
   ```bash
   npx tsc --noEmit
   ```
   (期待結果: Exit Code 0, エラー 0件)

2. **流れ図および関連モジュールテストの検証**:
   ```bash
   npx vitest run src/__tests__/flowchart.test.tsx
   ```
   (期待結果: 1 Passed, 8 Tests Passed)
