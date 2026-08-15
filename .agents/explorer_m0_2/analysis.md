# TraceApp Python -> 流れ図変換および表示機能 (R3) 調査・解析報告書

**作成日**: 2026-08-13  
**担当**: 流れ図変換および表示機能 調査担当 Explorer (`explorer_m0_2`)  
**対象領域**: `src/services/flowchartGenerator.ts`, `src/services/flowchartRenderer.tsx`, `src/types/flowchart.ts`, `src/worker/pythonTracer.ts`, `src/components/FlowchartViewer.tsx`

---

## 1. 概要・要約

TraceAppにおける「Python -> 流れ図変換および表示機能（R3要求事項）」の現状コードおよびアーキテクチャの全般調査を実施した。

**結論として、流れ図記号のSVGコンポーネント化（描画形状）や基本骨格（単一縦一列の描画）およびテスト環境は整っているものの、制御フローグラフ（CFG）としての構造化・ネスト表現・枝分かれ（If/Loop）描画・エッジ（矢印）接続・自動レイアウト・draw.io XML構造・およびハイライトマッピングにおいて多くの根本的な不足・乖離・不備が存在する。**

---

## 2. 詳細検証報告 (R3 流れ図変換・表示要求事項 7項目)

### 項目1: Python AST解析による流れ図ノード生成ロジックの網羅性

* **Python側 (`src/worker/pythonTracer.ts` の `generate_ast_flowchart`)**:
  * Python標準ライブラリの `ast.NodeVisitor` (`FlowchartVisitor`) を使用してAST解析を行っている。
  * **対応構文状況**:
    * **順次 (代入・代入演算・式)**: `visit_Assign`, `visit_AugAssign`, `visit_Expr` にて `type: 'process'` ノードを生成。
    * **判断 (if / elif / else)**: `visit_If` で `type: 'decision'` ノードを生成。しかし、**`elif` や `else` の明確な枝分かれノード構造や合流ノードは生成されず**、Visitorがフラットに巡回して1本の配列に並べられる。
    * **繰り返し (while / for)**: `visit_For`, `visit_While` でループ開始ノード `type: 'loop'` (ラベル: 条件式) を追加し、本文巡回後に `type: 'loop'` (ラベル: 'ループ終了', ID: `node-loop-end-{el}`) を追加。
    * **関数定義 / 呼び出し (def / call / return)**: `visit_FunctionDef` で `type: 'subroutine'` ノードを生成。しかし、**関数呼び出し (`Call`) や `return` 構文専用のVisitor実装が存在せず**、単なる `process` 扱いまたは無視されている。
* **TypeScriptフロントエンド側 (`src/services/flowchartGenerator.ts`)**:
  * **AST解析を一切行っていない**。`code.split('\n')` で文字列を行ごとに分割し、`def `, `if `, `elif `, `else:`, `for `, `while ` などの行頭文字列を正規表現・パターンマッチで直列分類する簡易的なフォールバック実装になっている。
* **主要課題**:
  * Python AST解析結果がグラフ構造（ノード間接続関係）を持たず、平坦な配列 (`nodes.append(...)`) に突っ込まれているため、複雑なネストや分岐を表現できない。
  * フロントエンド側とPython側で二重実装となっており、ロジックが不一致。

---

### 項目2: 流れ図記号規格の準拠状況

要求規格（JIS/ISOフローチャート規格および基本設計書）との対比:

| 流れ図要素 | 要求記号形状 | `flowchartRenderer.tsx` での実装 | 評価 |
|---|---|---|---|
| **端子 (Terminal)** | 角丸長方形 | `rect` (rx=22, ry=22, fill=#f1f5f9) | ✅ 完全準拠 |
| **処理 (Process)** | 長方形 | `rect` (rx=4, ry=4, fill=#ffffff) | ✅ 完全準拠 |
| **判断 (Decision)** | ひし形 | `polygon` (4点座標指定, fill=#fffbeb) | ✅ 完全準拠 |
| **繰り返し (Loop)** | 六角形（角が取れた長方形） | `polygon` (6点座標指定 offset=20, fill=#faf5ff) | ✅ 完全準拠 |
| **サブルーチン (Subroutine)** | 二重線長方形 | `rect` + 左右に縦線2本 `line` (x+16, x+width-16) | ✅ 完全準拠 |

* **結論**: 記号形状（Visual Representation）そのものは各型ごとにSVG要素として精密に実装されており、規格要件を満足している。

---

### 項目3: draw.io mxGraph XML形式での内部データ保持および構造妥当性

* **実装状況**:
  * 各ノードが `xmlSnippet` フィールドとして `<mxCell id="..." value="..." style="..." vertex="1" parent="1"><mxGeometry x="100" y="..." width="140" height="50" as="geometry"/></mxCell>` を保持。
  * `generateDrawIoXml` にて `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/> ... </root></mxGraphModel>` にパッキング。
* **構造妥当性の欠陥**:
  1. **エッジ (Edge / 矢印) の欠落**: `<mxCell edge="1" source="..." target="...">` という接続要素が**1つも生成されない**。そのため、このXMLを draw.io に読み込ませた場合、ノードが浮遊して矢印が一切描画されない。
  2. **レイアウト座標の不備**: `yPos` が `nodes.length * 60 + 20` の垂直一列固定で計算されているため、分岐・ループ等の2次元レイアウト構造を反映した座標が出力されない。

---

### 項目4: SVG/Canvasレンダリングの実装度と動作

* **実装方式**:
  * SVG直描画方式 (`renderFlowchartSvg`) を採用。Canvas描画は未装填。
* **実績・動作**:
  * Reactコンポーネント `FlowchartViewer.tsx` にてレスポンシブなSVG出力が可能。
  * テストコード (`__tests__/flowchart.test.tsx`, `challenger_m4_2_attack.test.tsx`) においても描画パフォーマンス・アクセシビリティ (`role="graphics-symbol"`) は合格。
* **致命的限界**:
  * 接続線の描画ロジック `renderFlowchartConnections` が、配列で隣り合う `nodes[i]` から `nodes[i+1]` の真下に直線を1本引くだけの**1列垂直直列線**になっている。
  * `If` の分岐線（True/Falseラベル付き矢印）や、`Loop` のループバック線（下から上へ戻る矢印）を描画する仕組みが皆無。

---

### 項目5: トレースステップ実行時のハイライトマッピングの実装状況

* **マッピング機構**:
  * Python側 `pythonTracer.ts` では、各 `StepSnapshot` 生成時に `astNodeId: f"node-{line_no}"` を紐付け。
  * `FlowchartNode` には `lineRange: [sline, eline]` を保持。
  * `isNodeActive` 関数により、`activeNodeId` の一致、または `activeLine` が `lineRange` 範囲内にある場合に `active=true` としてハイライト。
* **問題点**:
  * `isNodeActive` において `node.label === 'ループ終了'` のノードは二重ハイライト防止のために `return false` とハードコードして除外されている。
  * 複数行にわたるブロック（If文やFor文全体の `lineRange: [2, 5]`）が存在する場合、内側の行 (`activeLine=3`) を実行している最中に親の `If` ノードや `For` ノードまで同時にハイライトされてしまう（二重ハイライト問題の根本未解決）。
  * 1行に複数の文が存在する場合、ASTノードID単位での精密ハイライトが機能せず、行番号依存になっている。

---

### 項目6: レイアウト（ノード配置・矢印描画）の崩れや課題

* **現状のレイアウト仕様**:
  * 幅200px、高さ50px、垂直間隔40pxで、X座標40px固定の縦一列配置。
* **主要課題**:
  * 基本設計書 Section 7.5 で検討されていた `dagre.js` や `elkjs` などの自動レイアウトライブラリは**未導入**。
  * If分岐の左右展開、ループのネストインデント、合流地点の再配置などが全く計算されないため、プログラム構造が直感的かつ視覚的に理解できない。

---

### 項目7: 不足している機能、バグ、型定義の不備、修正が必要な具体箇所

#### (A) 型定義の不備 (`src/types/flowchart.ts`)
* `FlowchartNode` にノード位置 (`x`, `y`, `width`, `height`)、接続エッジ (`edges`)、親子のブランチ関係 (`thenBranch`, `elseBranch`, `loopBody`) の定義が存在しない。
* エッジを表す `FlowchartEdge` 型 (`id`, `source`, `target`, `label`) が存在しない。

#### (B) コードの重複・乖離
* `src/services/flowchartGenerator.ts` (フロントエンドの文字列正規表現ベース) と `src/worker/pythonTracer.ts` (Python ASTベース) でノード生成が二重実装されており、構造が異なる。

#### (C) 修正・実装が必要な具体箇所サマリー

1. **`src/types/flowchart.ts`**:
   * `FlowchartEdge` インターフェースの追加
   * `FlowchartNode` への `position`, `parentId`, `edges` 拡張
2. **`src/worker/pythonTracer.ts` (`generate_ast_flowchart`)**:
   * フラット配列生成から、制御フローグラフ (CFG) のノードおよびエッジ構築への変更
   * If分岐の True / False エッジ作成
   * Loop の ループ開始 -> ループ本文 -> ループ終了 -> ループバックエッジ / 抜け出しエッジ作成
3. **`src/services/flowchartGenerator.ts`**:
   * 簡易的な行分解ロジックの改善、または Python AST生成結果の完全採用への一元化
   * draw.io mxGraph XML のエッジ `<mxCell edge="1">` 出力の実装
4. **`src/services/flowchartRenderer.tsx`**:
   * エッジ（直線・折れ線・曲線矢印、Branchラベル "True"/"False"）の描画ロジック追加
   * 階層型レイアウト計算（または dagre ライブラリ連携）の組み込み
5. **`src/components/FlowchartViewer.tsx`**:
   * ハイライトロジックの精密化（AST Node ID優先判定）

---

**報告者**: explorer_m0_2
