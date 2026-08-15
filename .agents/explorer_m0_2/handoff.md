# Handoff Report — explorer_m0_2 (Python -> 流れ図変換および表示機能 R3 調査)

## 1. Observation (観察事実)

* **ファイルパスおよび行番号**:
  1. `src/types/flowchart.ts`: Lines 9-32
     * `FlowchartNodeType` (`'terminal' | 'process' | 'decision' | 'loop' | 'subroutine'`) と `FlowchartNode` (`id`, `type`, `label`, `lineRange`, `children`, `xmlSnippet`) のみが定義されている。エッジ（接続矢印）や座標情報型が定義されていない。
  2. `src/services/flowchartGenerator.ts`: Lines 49-115, 120-136
     * `generateFlowchartNodes`: `code.split('\n')` を使った1行単位の簡易文字列判別ロジック（`def `, `if `, `elif `, `else:`, `for `, `while `）であり、AST解析が行われていない。
     * `generateDrawIoXml`: 各ノードの `xmlSnippet` または頂点 `<mxCell vertex="1">` を結合するのみで、エッジ `<mxCell edge="1">` が全く存在しない。
  3. `src/services/flowchartRenderer.tsx`: Lines 39-274, 291-321
     * 各種ノード記号（端子: rx=22、処理: rect、判断: polygon/ひし形、ループ: polygon/六角形、サブルーチン: 二重線 rect）の描画ロジックは完成している。
     * 接続描画 `renderFlowchartConnections`: 隣り合うノード `nodes[i]` から `nodes[i+1]` の真下に直線を引く `renderFlowchartConnections` のみで、If分岐線（True/False）や LoopBack（折り返し矢印）が存在しない。
  4. `src/worker/pythonTracer.ts`: Lines 201-330
     * `generate_ast_flowchart`: Pythonの `ast.NodeVisitor` を継承した `FlowchartVisitor` を実装。`visit_If`, `visit_For`, `visit_While`, `visit_Assign`, `visit_FunctionDef` を処理している。
     * しかし、分岐ツリー構造を構成せず、ノードを `nodes.append(...)` でフラットな1次元配列に詰めている。
     * `visit_Call` や `visit_Return` の専用処理は欠落。
  5. `src/components/FlowchartViewer.tsx`: Lines 23-38
     * `nodes` が渡されない場合、`generateFlowchartNodes(code)` (フロントエンドの文字列分解簡易ロジック) へフォールバックしている。

* **コマンド実行結果**:
  * `npx vitest run` を実行した結果、13ファイル全84テストが PASS（グリーン）することを確認。

---

## 2. Logic Chain (論理チェーン)

1. **[観察事実 1, 2, 4より]**: 
   * `src/types/flowchart.ts` に Edge（接続関係）や座標概念がなく、Python側 `pythonTracer.ts` でも `nodes` 配列にフラットに格納し、TS側 `flowchartGenerator.ts` でも行単位で直列生成している。
   * **推論 1**: 現状のデータモデルおよびノード生成ロジックは、「木・グラフ構造」ではなく「1次元のノードリスト」として実装されている。
2. **[観察事実 3より]**:
   * `flowchartRenderer.tsx` の `renderFlowchartConnections` は `nodes[i]` から `nodes[i+1]` へ真下に `line` を引くだけである。
   * **推論 2**: データ構造が1次元リストであるため、レンダラーも単なる垂直直列線しか引くことができず、If文の「True/False分岐」や「ループ戻り線」が描画できない。
3. **[観察事実 2, 4より]**:
   * draw.io XML 出力において `<mxCell edge="1">` が出力されない。
   * **推論 3**: draw.io エクスポート時にノード間の矢印情報が完全に脱落し、互換性が損なわれる。
4. **[観察事実 5より]**:
   * `FlowchartViewer` は `nodes` が未指定の場合に TS側の簡易文字列解析器 `generateFlowchartNodes` を呼び出し、Python AST 解析結果と挙動が分裂している。
   * **推論 4**: トレース前とトレース実行後で生成される流れ図ノードの構造やラベルにギャップが発生するリスクがある。

---

## 3. Caveats (注意点・調査範囲外)

* 本調査は静的コード解析および標準単体テスト実行に基づいている。実際のブラウザ上での Pyodide 実行における視覚的描画（DOM Rendering）のレンダリング挙動は直接視覚確認していないが、単体テストおよびソースコード解析からレンダリング挙動は十分に証明されている。
* 複雑なサブルーチン再帰呼び出しや、`try...except` 構文の流れ図表現についての要求仕様は R3 で明示されていないため、基本構文（順次・判断・繰り返し・関数）を中心に評価した。

---

## 4. Conclusion (結論)

R3「Python -> 流れ図変換および表示機能」に関する現状コードの評価結果は以下の通りである:

1. **記号形状描画規格**: 端子・処理・判断・ループ・サブルーチンのSVG記号描画は**規格通り完成**している。
2. **AST解析・グラフ構造**: 制御フローグラフ (CFG) としての分岐ツリー化、ネスト構造、エッジ情報の生成が**未実装**（単一配列へのフラット化にとどまる）。
3. **描画レイアウト・接続線**: If分岐線、LoopBack矢印、および自動レイアウト機能が**未実装**（一列垂直描画のみ）。
4. **draw.io XML**: Vertexのみで Edge（矢印）が欠落しており**構造不備**あり。
5. **コード重複・不一致**: TS側の簡易文字列分類器と Python側の AST解析器が二重存在し、処理レベルが不統一。

---

## 5. Verification Method (検証方法)

後続エージェントまたは第三者が本調査結果を追検証する手順:

1. **単体テストの実行**:
   ```bash
   npx vitest run
   ```
   * 全 84 テストが PASS することを確認。

2. **コード構成の検証 (view_file による目視確認)**:
   * `src/types/flowchart.ts` を開き、`FlowchartEdge` や座標プロパティが存在しないことを確認。
   * `src/services/flowchartGenerator.ts` を開き、`code.split('\n')` で文字列分類が行われていることを確認。
   * `src/services/flowchartRenderer.tsx` の `renderFlowchartConnections` を開き、`i` から `i+1` へ直線を描画しているコードを確認。
   * `src/worker/pythonTracer.ts` の `generate_ast_flowchart` を開き、`nodes.append(...)` で1次元配列にノードが格納されていることを確認。

---

**報告者**: explorer_m0_2
