# M2残存コードレビュー修正箇所の特定調査 報告書

## 1. Observation（直接観測事実）

### 1.1 TypeScript型エラーと静的解析エラー
`npx tsc --noEmit` を実行したところ、以下のエラーが発生した:
```
src/__tests__/challenger_m2_3_empirical.test.ts(145,13): error TS6133: 'printGradeNode' is declared but its value is never read.
```
- 該当箇所: `src/__tests__/challenger_m2_3_empirical.test.ts` 145行目
  ```typescript
  145: const printGradeNode = graph.nodes.find((n) => n.label.includes('print(grade)'));
  ```
  この変数がテスト内で一度も使用・アサートされていないため、`noUnusedLocals` により型チェックが失敗している。

### 1.2 単一if文（elseなし）および条件分岐のFalseエッジ・合流エッジの挙動
以下の2箇所でフローチャート（CFG）生成ロジックが実装されている:

1. **`src/services/flowchartGenerator.ts` (TypeScript実装)**:
   - 110-153行目: `processPoppedBlock`
     ```typescript
     135: } else if (popped.type === 'if') {
     136:   if (!edges.some((e) => e.sourceId === popped.headerId && (e.label === 'False' || e.label === 'Next'))) {
     137:     edges.push({
     138:       id: `edge-false-${popped.headerId}-${targetId}`,
     139:       sourceId: popped.headerId,
     140:       targetId,
     141:       label: 'False',
     142:     });
     143:   }
     144:   for (const srcId of popped.mergeTargets) {
     145:     edges.push({
     146:       id: `edge-if-merge-${srcId}-${targetId}`,
     147:       sourceId: srcId,
     148:       targetId,
     149:       label: 'Next',
     150:     });
     151:   }
     152: }
     ```
   - 57-62行目: `classifyLine`
     ```typescript
     57: if (trimmed.startsWith('if ') || trimmed.startsWith('elif ')) {
     58:   return { type: 'decision', label: trimmed.replace(/:$/, '') };
     59: }
     60: if (trimmed.startsWith('else:')) {
     61:   return { type: 'decision', label: 'else' };
     62: }
     ```
   - **観測**: `if` の直後に `elif` または `else:` が来ると、行インデントが 0 であるため `popped = blockStack.pop()` が発生し、`targetId` が `elif` / `else:` ノード自身になる。
     その結果、`if` の body（例: `grade = "A"`）から `elif` / `else:` の判断ノード自身へ `edge-if-merge-...`（Next）が接続されてしまう。
     また、`else:` も `decision` 扱いになっているため、`else` ブロック終了時に不要な `edge-false-else-...` が生成される。

2. **`src/worker/pythonTracer.ts` (Python AST Visitor `generate_ast_flowchart`)**:
   - 320-350行目: `visit_If`
     ```python
     320:         def visit_If(self, node):
     ...
     339:             if node.orelse:
     340:                 first_else = node.orelse[0]
     341:                 e_sl = getattr(first_else, 'lineno', el)
     342:                 e_id = f"node-{e_sl}"
     343:                 edges.append({"id": f"edge-false-{nid}-{e_id}", "sourceId": nid, "targetId": e_id, "label": "False"})
     344:                 self.prev_node_id = nid
     345:                 for stmt in node.orelse:
     346:                     self.visit(stmt)
     347:             else:
     348:                 # else / elif ブロックがない場合、次に来るノードへ向かう False エッジのために登録
     349:                 self.pending_false_if_nodes.append(nid)
     ```
   - **観測**: `node.body` の実行後（例: `grade = "A"`）、その末尾ノードから `if` 文全体の次のノード（例: `print(grade)`）へ向かう合流エッジ（Nextエッジ）を記録・接続する処理が存在しない。
     そのため、`if` の条件が真で `node.body` が実行された後の制御フロー矢印が途切れ、孤立ノード（行き止まり）となる。

3. **`src/services/flowchartRenderer.tsx` (エッジ描画)**:
   - 244-255行目: `renderFalseEdgeElement`
     ```tsx
     245:   const startX = src.x + src.w;
     246:   const startY = src.y + src.h / 2;
     247:   const rightX = startX + 35;
     248:   const pathD = `M ${startX} ${startY} H ${rightX} V ${tgt.y - 10} H ${tgt.x + tgt.w / 2} V ${tgt.y}`;
     ```
   - **観測**: False エッジは右側に固定オフセット `startX + 35` で迂回し、ターゲットノードの上辺中央（`tgt.x + tgt.w / 2`）に直線で侵入する。複数の False エッジが存在する場合、線が同一X座標で重なり合う。

### 1.3 ノード記号・形状とハイライト仕様の整合性
- `src/services/flowchartRenderer.tsx`:
  - 処理 (`process`): 長方形 (`<rect rx={4} ry={4} />`) -> 仕様合致
  - 判断 (`decision`): ひし形 (`<polygon points="${cx},${y} ${x+w},${cy} ${cx},${y+h} ${x},${cy}" />`) -> 仕様合致
  - ループ (`loop`): 六角形 (`<polygon points="${x+20},${y} ${x+w-20},${y} ${x+w},${cy} ${x+w-20},${y+h} ${x+20},${y+h} ${x},${cy}" />`) -> 仕様合致
  - サブルーチン (`subroutine`): 二重線長方形 (`<rect>` + 左右2本の `<line>`) -> 仕様合致
  - 端子 (`terminal`): 角丸長方形 (`<rect rx={22} ry={22} />`) -> 仕様合致
- **ハイライト連動の観測**:
  - `src/components/FlowchartViewer.tsx` 94-99行目:
    ```tsx
    <FlowchartViewer
      nodes={memoizedGraph.nodes}
      edges={memoizedGraph.edges}
      activeLine={activeLine}
      code={code}
    />
    ```
  - `FlowchartViewer` は `activeLine` のみを受け取っており、`activeNodeId` を props として受け取っていない。
  - `src/services/flowchartRenderer.tsx` 19行目で `node.type === 'terminal'` は `activeLine` 経由ではアクティブにならないようにガードされているため、トレース終了時の `node-end` のハイライトが `activeNodeId` なしでは機能しない。

### 1.4 draw.io mxGraph XML 出力の仕様適合性
- `src/services/flowchartGenerator.ts` 250-286行目 (`generateDrawIoXml`):
  - mxGraphModel の root 直下に cell id 0, 1 を定義し、各ノードに適切な style（`rhombus`, `shape=hexagon`, `shape=process`, `rounded=1`）を設定しており、draw.io の標準XML形式に完全に適合している。
  - 特殊文字は `escapeXml` で `&`, `<`, `>`, `"`, `'` が安全にエスケープされている。

---

## 2. Logic Chain（推論チェーン）

1. **[Observation 1.1 より]** `challenger_m2_3_empirical.test.ts` で `printGradeNode` が未使用であるため、TypeScript コンパイラが `TS6133` を発出する。
   - **推論**: この未使用変数の宣言を削除するか、`expect(printGradeNode).toBeDefined()` を追加することで、型チェックエラーが0件になり、ビルドが通るようになる。

2. **[Observation 1.2 より]** `flowchartGenerator.ts` のブロックスタック方式では、`elif` / `else:` が親 `if` と同じインデントであるために `if` の body から `elif` / `else:` への不正な `Next` エッジを引いてしまう。
   - **推論**: `elif` / `else:` を単なる `decision` ノードとして扱うのではなく、if-elif-else 連鎖全体を 1 つの `ifChain` コンテキストとして管理し、各ブランチの body の末尾ノードは「連鎖全体の終了（合流先）」へ接続するように修正する必要がある。また `else:` ノードは判断ではないため False エッジを出さないようにガードする必要がある。

3. **[Observation 1.2 より]** `pythonTracer.ts` の `visit_If` では、`node.body` の末尾ノードを `pending_merge_nodes` 等に収集して if 文の外側の次ステートメントへ接続する処理が欠けている。
   - **推論**: `visit_If` において、`node.body` の最後の文のノードIDおよび各 `orelse` の最後の文のノードIDをリストに保持し、`If` 全体の訪問が完了した後に、次のステートメント（または `node-end`）への `Next` エッジ（合流エッジ）として一括接続する設計にする必要がある。

4. **[Observation 1.3 より]** `FlowchartViewer` に `activeNodeId` が渡されていないため、`StepSnapshot.astNodeId` を利用した高精度ハイライトがスキップされている。
   - **推論**: `LeftPanelProps` および `FlowchartViewerProps` に `activeNodeId?: string` を追加し、`App.tsx` から `activeSnapshot?.astNodeId` を渡すことで、`node-end` を含む正確なノードハイライトが可能になる。

---

## 3. Caveats（制約・考慮事項）

1. **調査のみの制約**: 本調査エージェント（Explorer 1）は read-only であり、ソースコードの直接編集は行わない。
2. **既存テストとの互換性**: 既存の22個のテストファイル（特に `challenger_m2_*.test.ts`, `flowchart.test.tsx`）は現在のエッジ生成仕様をアサートしている部分があるため、CFGエッジ修正時は既存テストが壊れないよう後方互換性を保つ必要がある。

---

## 4. Conclusion（調査結論・修正箇所と安全な修正方針）

### 修正対象ファイル・関数・行番号および修正方針

| # | 対象ファイル | 修正箇所 | 修正内容・方針 |
|---|---|---|---|
| 1 | `src/__tests__/challenger_m2_3_empirical.test.ts` | 145行目 | 未使用変数 `printGradeNode` のアサート（`expect(printGradeNode).toBeDefined();`）を追加して `TS6133` を解消する。 |
| 2 | `src/worker/pythonTracer.ts` | 320-350行目 (`visit_If`) | `node.body` および `node.orelse` の末尾ノードを `pending_join_nodes` に蓄積し、`If` ノード全体を抜けた後の次ステートメント（または `node-end`）へ合流 `Next` エッジを接続する。 |
| 3 | `src/services/flowchartGenerator.ts` | 57-62行目 (`classifyLine`), 110-153行目 (`processPoppedBlock`, `processLineNodeEdge`) | `elif`/`else` を if 連鎖として識別し、`if` body から `elif` への誤接続を防止。`else` ノードからの不要な False エッジ生成を抑制する。 |
| 4 | `src/components/FlowchartViewer.tsx` & `LeftPanel.tsx` | Props 定義および呼び出し部 | `activeNodeId?: string` を Props に追加し、`renderFlowchartSvg(..., { activeLine, activeNodeId, edges })` へ伝搬させる。 |
| 5 | `src/App.tsx` | 158-161行目 (`LeftPanel` 呼出部) | `activeNodeId={activeSnapshot?.astNodeId}` を `LeftPanel` に渡し、端子ノード（`node-end` 等）のハイライトを完全同期させる。 |
| 6 | `src/worker/pyodideWorker.ts` | 31行目, 94行目 | `catch (err: any)` を `catch (err: unknown)` に改修し、TypeScript の strict 型安全性を強化する。 |

---

## 5. Verification Method（独立検証手順）

1. **TypeScript 型チェックの検証**:
   ```pwsh
   npx tsc --noEmit
   ```
   - 期待結果: エラー 0 件で正常終了すること。

2. **ユニット・統合テストの検証**:
   ```pwsh
   npx vitest run
   ```
   - 期待結果: 22個のテストスイート（全テスト）が PASS すること。

3. **単一if文および if-elif-else の CFG エッジ検証**:
   - `pythonTracer.ts` および `flowchartGenerator.ts` で以下のコードを入力した際のグラフ構造を確認:
     - 単一if: `if x > 0: y = 1` -> Falseエッジが次ノードへ、Trueブランチの `y = 1` からも次ノードへ合流エッジが接続されること。
     - 分岐: `if ...: A elif ...: B else: C` -> A, B, C のいずれからも `print` ノードへの合流エッジが存在すること。
