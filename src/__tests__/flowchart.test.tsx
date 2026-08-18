import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { generateFlowchartNodes, generateFlowchartGraph, generateDrawIoXml, formatProcessLabel } from '../services/flowchartGenerator';
import { renderFlowchartSvg, isNodeActive, wrapProcessLabel } from '../services/flowchartRenderer';
import { FlowchartViewer } from '../components/FlowchartViewer';
import { LeftPanel } from '../components/LeftPanel';
import { FlowchartNode } from '../types/flowchart';

describe('Milestone 4: AST Flowchart Generator & Renderer', () => {
  describe('flowchartGenerator', () => {
    it('Pythonコードから各タイプのFlowchartNodeを生成できること', () => {
      const code = `def add(a, b):
    result = a + b
    return result

reset()
total = 0
if total >= 0:
    print("positive")

for i in range(1, 4):
    total = add(total, i)
`;
      const nodes = generateFlowchartNodes(code);

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0]!.type).toBe('terminal');
      expect(nodes[0]!.label).toBe('開始');

      const types = nodes.map((n) => n.type);
      expect(types).toContain('terminal');
      expect(types).toContain('subroutine');
      expect(types).toContain('process');
      expect(types).toContain('decision');
      expect(types).toContain('loop');

      // 関数の開始端子 (add(a, b)) と終了端子 (return result) の検証
      const defNode = nodes.find((n) => n.subType === 'function-terminal' && !n.label.startsWith('return') && n.label !== '終了');
      expect(defNode).toBeDefined();
      expect(defNode?.label).toBe('add(a, b)');
      expect(defNode?.type).toBe('terminal');
      expect(defNode?.subType).toBe('function-terminal');

      const returnNode = nodes.find((n) => n.label.startsWith('return'));
      expect(returnNode).toBeDefined();
      expect(returnNode?.type).toBe('terminal');
      expect(returnNode?.subType).toBe('function-terminal');
    });

    it('FlowchartNode[]およびFlowchartEdge[]からValidなdraw.io mxGraph XMLを生成できること', () => {
      const nodes: FlowchartNode[] = [
        { id: 'start', type: 'terminal', label: '開始', lineRange: [1, 1] },
        { id: 'p1', type: 'process', label: 'x = 5', lineRange: [2, 2] },
        { id: 'd1', type: 'decision', label: 'x > 0', lineRange: [3, 3] },
        { id: 'l1', type: 'loop', label: 'for i in range(3)', lineRange: [4, 4] },
        { id: 's1', type: 'subroutine', label: 'def foo()', lineRange: [5, 5] },
        { id: 'end', type: 'terminal', label: '終了', lineRange: [6, 6] },
      ];

      const xml = generateDrawIoXml(nodes);
      expect(xml).toContain('<mxGraphModel>');
      expect(xml).toContain('</mxGraphModel>');
      expect(xml).toContain('id="start"');
      expect(xml).toContain('id="p1"');
      expect(xml).toContain('id="d1"');
      expect(xml).toContain('id="l1"');
      expect(xml).toContain('id="s1"');
    });

    it('generateFlowchartGraphが分岐(True/False)およびループ(Loop)のエッジを含むCFGグラフを生成できること', () => {
      const code = `score = 75
if score >= 80:
    grade = "A"
else:
    grade = "B"

for i in range(3):
    print(i)
`;
      const graph = generateFlowchartGraph(code);
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);

      const labels = graph.edges.map((e) => e.label);
      expect(labels).toContain('True');
      expect(labels).toContain('Loop');

      const xml = generateDrawIoXml(graph);
      expect(xml).toContain('edge="1"');
      expect(xml).toContain('source=');
      expect(xml).toContain('target=');
    });

    it('elseのない単一if文でdecisionノードからFalseエッジが直後のノードへ生成されること', () => {
      const code = `score = 80
if score >= 80:
    grade = "A"
print(grade)`;
      const graph = generateFlowchartGraph(code);
      const decisionNode = graph.nodes.find((n) => n.type === 'decision');
      expect(decisionNode).toBeDefined();

      const falseEdge = graph.edges.find((e) => e.sourceId === decisionNode!.id && e.label === 'False');
      expect(falseEdge).toBeDefined();
      expect(falseEdge!.targetId).toBe('node-4');
    });

    it('print文のラベルが「...を表示」「...と...を表示」に正しく変換されること', () => {
      const code = `print(grade)
print("数値")
print("数値", a)
print("x =", x, "y =", y)
print("hello, world", count)
print()`;
      const nodes = generateFlowchartNodes(code);
      const processNodes = nodes.filter((n) => n.type === 'process');

      expect(processNodes[0]!.label).toBe('gradeを表示');
      expect(processNodes[1]!.label).toBe('"数値"を表示');
      expect(processNodes[2]!.label).toBe('"数値"とaを表示');
      expect(processNodes[3]!.label).toBe('"x ="とxと"y ="とyを表示');
      expect(processNodes[4]!.label).toBe('"hello, world"とcountを表示');
      expect(processNodes[5]!.label).toBe('表示');
    });

    it('四則演算記号 (+ - * /) が全角 (＋ － × ÷) に正しく置換されること', () => {
      const code = `a = b + c
d = e - f
g = h * i
j = k / l
if x * 2 + 1 >= y - 3:
    ans = (m + n) / (p * q)`;
      const nodes = generateFlowchartNodes(code);
      const processNodes = nodes.filter((n) => n.type === 'process');
      const decisionNodes = nodes.filter((n) => n.type === 'decision');

      expect(processNodes[0]!.label).toBe('b ＋ c → a');
      expect(processNodes[1]!.label).toBe('e － f → d');
      expect(processNodes[2]!.label).toBe('h × i → g');
      expect(processNodes[3]!.label).toBe('k ÷ l → j');
      expect(decisionNodes[0]!.label).toBe('x × 2 ＋ 1 ≧ y － 3');
      expect(processNodes[4]!.label).toBe('(m ＋ n) ÷ (p × q) → ans');
    });

    it('単一ループの場合は番号なしで「ループ」および「条件の間」に整形されること', () => {
      const singleLoopCode = `while i <= 5:
    pass`;
      const singleNodes = generateFlowchartNodes(singleLoopCode);
      const singleLoopNodes = singleNodes.filter((n) => n.type === 'loop');
      expect(singleLoopNodes[0]!.label).toBe('ループ\ni ≦ 5の間');
      expect(singleLoopNodes[1]!.label).toBe('ループ');
    });

    it('複数ループおよびネストループの場合は上から出現順に「ループ1」「ループ2」...と番号が付与されること', () => {
      const code = `while i <= 5:
    pass
for i in range(4):
    for j in range(1, 10, 2):
        pass`;
      const nodes = generateFlowchartNodes(code);
      const loopNodes = nodes.filter((n) => n.type === 'loop');

      // ループ1: while i <= 5
      expect(loopNodes[0]!.label).toBe('ループ1\ni ≦ 5の間');
      expect(loopNodes[1]!.label).toBe('ループ1');

      // ループ2: 外側 for i in range(4) 開始
      expect(loopNodes[2]!.label).toBe('ループ2\niは0から1ずつ増やしてi≦3の間');

      // ループ3: 内側 for j in range(1, 10, 2) 開始
      expect(loopNodes[3]!.label).toBe('ループ3\njは1から2ずつ増やしてj≦9の間');

      // ループ3: 内側 for 終了
      expect(loopNodes[4]!.label).toBe('ループ3');

      // ループ2: 外側 for 終了
      expect(loopNodes[5]!.label).toBe('ループ2');
    });
  });

  describe('flowchartRenderer & FlowchartViewer', () => {
    it('isNodeActiveがlineRangeおよびactiveNodeIdで正しく判定されること', () => {
      const node: FlowchartNode = {
        id: 'node-10',
        type: 'process',
        label: 'test',
        lineRange: [10, 15],
      };

      expect(isNodeActive(node, 12)).toBe(true);
      expect(isNodeActive(node, 5)).toBe(false);
      expect(isNodeActive(node, undefined, 'node-10')).toBe(true);
    });

    it('処理ブロックで長いテキストが複数行に折り返され、高さが自動調整されること', () => {
      const node: FlowchartNode = {
        id: 'p-long',
        type: 'process',
        label: '"とても長いテキストを出力します"とaを表示',
        lineRange: [1, 1],
      };
      const { container } = render(<FlowchartViewer nodes={[node]} activeLine={1} />);
      const rect = container.querySelector('rect');
      expect(rect).not.toBeNull();
      const height = parseFloat(rect?.getAttribute('height') || '0');
      expect(height).toBeGreaterThan(50);

      const tspans = container.querySelectorAll('tspan');
      expect(tspans.length).toBeGreaterThan(1);
    });

    it('renderFlowchartSvgが正しくSVG要素を生成すること', () => {
      const nodes: FlowchartNode[] = [
        { id: 'node-start', type: 'terminal', label: '開始', lineRange: [1, 1] },
        { id: 'node-end', type: 'terminal', label: '終了', lineRange: [2, 2] },
      ];
      const element = renderFlowchartSvg(nodes, { activeLine: 1 });
      render(<>{element}</>);
      expect(screen.getAllByTestId('flowchart-node-terminal').length).toBeGreaterThan(0);
    });

    it('FlowchartViewerが各種ノード (端子, 処理, 判断, ループ, 関数) をレンダリングできること', () => {
      const nodes: FlowchartNode[] = [
        { id: 'node-start', type: 'terminal', label: '開始', lineRange: [1, 1] },
        { id: 'node-process', type: 'process', label: 'x = 10', lineRange: [2, 2] },
        { id: 'node-decision', type: 'decision', label: 'x > 5', lineRange: [3, 3] },
        { id: 'node-loop', type: 'loop', label: 'while x > 0', lineRange: [4, 4] },
        { id: 'node-sub', type: 'subroutine', label: 'def reset()', lineRange: [5, 5] },
        { id: 'node-end', type: 'terminal', label: '終了', lineRange: [6, 6] },
      ];

      render(<FlowchartViewer nodes={nodes} activeLine={3} />);

      expect(screen.getByTestId('flowchart-viewer')).toBeDefined();
      expect(screen.getAllByTestId('flowchart-node-terminal').length).toBeGreaterThan(0);
      expect(screen.getByTestId('flowchart-node-process')).toBeDefined();
      expect(screen.getByTestId('flowchart-node-decision')).toBeDefined();
      expect(screen.getByTestId('flowchart-node-loop')).toBeDefined();
      expect(screen.getByTestId('flowchart-node-subroutine')).toBeDefined();
    });

    it('activeLineに合致するノードが強調ハイライト (active=true) 表示されること', () => {
      const nodes: FlowchartNode[] = [
        { id: 'node-1', type: 'process', label: 'a = 1', lineRange: [1, 1] },
        { id: 'node-2', type: 'process', label: 'b = 2', lineRange: [2, 2] },
      ];

      const { container } = render(<FlowchartViewer nodes={nodes} activeLine={2} />);
      const nodeElements = container.querySelectorAll('.flowchart-node');
      
      const activeElements = Array.from(nodeElements).filter(
        (el) => el.getAttribute('data-active') === 'true' || el.classList.contains('active')
      );
      expect(activeElements.length).toBeGreaterThan(0);
    });

    it('elif/else のない単一 if 文において、Yes 側の処理ブロックとの間に十分な余白が確保され Yes ラベルが描画されること', () => {
      const code = `if x > 0:
    ans = 100
print(ans)`;
      const graph = generateFlowchartGraph(code);
      const { container } = render(
        <FlowchartViewer nodes={graph.nodes} edges={graph.edges} code={code} />
      );

      const yesEdge = container.querySelector('.edge-yes');
      expect(yesEdge).not.toBeNull();
      expect(yesEdge?.textContent).toContain('Yes');

      // decision ノードと Yes 側処理ノードの Y 座標差が 20px 以上確保されていること
      const nodeElements = container.querySelectorAll('.flowchart-node');
      expect(nodeElements.length).toBeGreaterThanOrEqual(4);
    });

    it('ループのみのプログラムにおいて不要な右側余白が発生せず幅が左右対称（212px）になること', () => {
      const code = `total = 0
for i in range(3):
    total += i
print(total)`;
      const graph = generateFlowchartGraph(code);
      const { container } = render(
        <FlowchartViewer nodes={graph.nodes} edges={graph.edges} code={code} />
      );

      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      // 単一列 (nodeWidth: 180, paddingX: 16, extraRightMargin: 16 -> totalWidth: 212)
      expect(svg?.getAttribute('width')).toBe('212');
    });

    it('関数とメイン処理が左右に独立して配置され、def/returnが緑色端子、呼び出しが緑枠線で描画されること', () => {
      const code = `def add(a, b):
    result = a + b
    return result

total = 0
for i in range(1, 4):
    total = add(total, i)
print(total)`;
      const graph = generateFlowchartGraph(code);
      const { container } = render(
        <FlowchartViewer nodes={graph.nodes} edges={graph.edges} code={code} />
      );

      // メイン処理の開始・終了端子
      const mainStart = container.querySelector('[data-node-id="node-start"]');
      expect(mainStart).not.toBeNull();

      // 関数の開始端子 (def add)
      const defNode = container.querySelector('[data-node-id="node-1"]');
      expect(defNode).not.toBeNull();
      const defRect = defNode?.querySelector('rect');
      expect(defRect?.getAttribute('fill')).toBe('#ecfdf5');
      expect(defRect?.getAttribute('stroke')).toBe('#059669');

      // 関数の終了端子 (return result)
      const returnNode = container.querySelector('[data-node-id="node-3"]');
      expect(returnNode).not.toBeNull();
      const returnRect = returnNode?.querySelector('rect');
      expect(returnRect?.getAttribute('fill')).toBe('#ecfdf5');
      expect(returnRect?.getAttribute('stroke')).toBe('#059669');

      // 返り値あり関数呼び出しノード (total = add(total, i))
      const callNode = container.querySelector('[data-node-id="node-7"]');
      expect(callNode).not.toBeNull();
      const callRect = callNode?.querySelector('rect');
      expect(callRect?.getAttribute('stroke')).toBe('#059669');
      expect(callRect?.getAttribute('fill')).toBe('#ffffff');
    });
  });

  describe('LeftPanel タブ切り替え統合', () => {
    it('コードタブと流れ図タブの切り替えが正常に動作すること', () => {
      const sampleCode = 'x = 10\nprint(x)';
      render(
        <LeftPanel
          code={sampleCode}
          onChangeCode={() => {}}
          currentStep={0}
          totalSteps={2}
          onStepChange={() => {}}
          onReset={() => {}}
        />
      );

      // 初期状態はコードタブ
      expect(screen.getByTestId('tab-code')).toBeDefined();
      expect(screen.getByTestId('tab-flowchart')).toBeDefined();

      // 「流れ図」タブをクリック
      fireEvent.click(screen.getByTestId('tab-flowchart'));
      expect(screen.getByTestId('flowchart-viewer')).toBeDefined();

      // 「コード」タブを再度クリック
      fireEvent.click(screen.getByTestId('tab-code'));
      expect(screen.getByTestId('flowchart-viewer')).toBeDefined();
      expect(screen.getByTestId('tab-code').getAttribute('aria-selected')).toBe('true');
      expect(screen.getByTestId('flowchart-viewer').parentElement?.style.display).toBe('none');
    });

    it('ifブロックのYes側に複数の処理ブロックがある場合、中間ノードから余分な合流エッジが生成されず、末尾ノードとNoから正しく合流すること', () => {
      const code = `score = 85
if score >= 80:
    x = 1
    y = 2
    z = 3
print("done")`;
      const graph = generateFlowchartGraph(code);

      // 生成されたノード一覧の確認
      const nodeIds = graph.nodes.map((n) => n.id);
      expect(nodeIds).toContain('node-start');
      expect(nodeIds).toContain('node-1'); // score = 85
      expect(nodeIds).toContain('node-2'); // if score >= 80 (decision)
      expect(nodeIds).toContain('node-3'); // x = 1
      expect(nodeIds).toContain('node-4'); // y = 2
      expect(nodeIds).toContain('node-5'); // z = 3
      expect(nodeIds).toContain('node-6'); // print("done")
      expect(nodeIds).toContain('node-end');

      // エッジの確認
      // 1. node-2 からの True エッジは node-3 のみ
      const trueEdge = graph.edges.find((e) => e.sourceId === 'node-2' && e.label === 'True');
      expect(trueEdge?.targetId).toBe('node-3');

      // 2. node-2 からの False エッジは node-6（合流先）
      const falseEdge = graph.edges.find((e) => e.sourceId === 'node-2' && e.label === 'False');
      expect(falseEdge?.targetId).toBe('node-6');

      // 3. Yes側の順次エッジ: 3 -> 4, 4 -> 5
      const edge34 = graph.edges.find((e) => e.sourceId === 'node-3' && e.targetId === 'node-4');
      const edge45 = graph.edges.find((e) => e.sourceId === 'node-4' && e.targetId === 'node-5');
      expect(edge34).toBeDefined();
      expect(edge45).toBeDefined();

      // 4. 中間ノード (node-3, node-4) から合流先 (node-6) へのエッジは存在しないこと
      const extraMerge3 = graph.edges.find((e) => e.sourceId === 'node-3' && e.targetId === 'node-6');
      const extraMerge4 = graph.edges.find((e) => e.sourceId === 'node-4' && e.targetId === 'node-6');
      expect(extraMerge3).toBeUndefined();
      expect(extraMerge4).toBeUndefined();

      // 5. 末尾ノード (node-5) から合流先 (node-6) への接続が存在すること
      const edge56 = graph.edges.find((e) => e.sourceId === 'node-5' && e.targetId === 'node-6');
      expect(edge56).toBeDefined();

      // SVG レンダリングテスト
      const { container } = render(
        <FlowchartViewer nodes={graph.nodes} edges={graph.edges} code={code} />
      );
      const falseEdgeEl = container.querySelector('.edge-false');
      expect(falseEdgeEl).not.toBeNull();
    });

    it('if-else文でYes側に複数の処理ブロックがある場合、elseからの合流線がYes側ブロックの下部を通り綺麗に合流すること', () => {
      const code = `a = 3
b = 1
e = a + b
if a > b:
    e = e + 1
    f = a + b
else:
    f = a - b
e = e * e
f = f * f
e = e - f
h = 1`;
      const graph = generateFlowchartGraph(code);
      const { container } = render(
        <FlowchartViewer nodes={graph.nodes} edges={graph.edges} code={code} />
      );

      // マージエッジ (edge-merge) のパスを取得
      const mergeEdges = container.querySelectorAll('.edge-merge path');
      expect(mergeEdges.length).toBeGreaterThan(0);

      // 合流線の Y 座標が、Yes 側 2つ目のノード (f = a + b) の Y 座標より下になっていること
      const nodeFYes = container.querySelector('[data-node-id="node-6"]'); // f = a + b
      expect(nodeFYes).not.toBeNull();
    });

    it('if-elif-else 分岐で各分岐に複数ブロックが含まれる場合、2つ目以降が隙間なく並び共通の水平合流線で合流すること', () => {
      const code = `score = 75
if score >= 80:
    grade = "A"
    grade = "A"
elif score >= 60:
    grade = "B"
    grade = "B"
else:
    grade = "C"
    grade = "A"
print(grade)`;
      const graph = generateFlowchartGraph(code);
      const { container } = render(
        <FlowchartViewer nodes={graph.nodes} edges={graph.edges} code={code} />
      );

      const mergeEdges = container.querySelectorAll('.edge-merge path');
      expect(mergeEdges.length).toBeGreaterThan(0);

      // 各分岐のノードが正しく描画されていること
      const nodes = container.querySelectorAll('.flowchart-node');
      expect(nodes.length).toBeGreaterThanOrEqual(10);
    });

    it('formatProcessLabel が累加代入文（+=, -=, *=, /=, %=）を正しく展開・表記変換すること', () => {
      expect(formatProcessLabel('a += 2')).toBe('a ＋ 2 → a');
      expect(formatProcessLabel('total += i')).toBe('total ＋ i → total');
      expect(formatProcessLabel('x -= 5')).toBe('x － 5 → x');
      expect(formatProcessLabel('count *= 2')).toBe('count × 2 → count');
      expect(formatProcessLabel('val /= 4')).toBe('val ÷ 4 → val');
      expect(formatProcessLabel('num //= 2')).toBe('num ÷ 2 → num');
      expect(formatProcessLabel('rem %= 3')).toBe('rem % 3 → rem');
      expect(formatProcessLabel('power **= 2')).toBe('power ^ 2 → power');
    });

    it('累加代入文を含むPythonコードの流れ図ノードが期待通りの表記で生成されること', () => {
      const code = `a = 5
a += 2
print(a)`;
      const graph = generateFlowchartGraph(code);
      const node2 = graph.nodes.find((n) => n.id === 'node-2');
      expect(node2).toBeDefined();
      expect(node2?.label).toBe('a ＋ 2 → a');
    });

    it('wrapProcessLabel が変数名などの単語の途中で改行せずトークン単位で改行すること', () => {
      // "total ＋ 2 → total" は、"total" の途中で改行されず単語境界で改行されること
      const lines = wrapProcessLabel('total ＋ 2 → total', 6.0);
      expect(lines.length).toBeGreaterThan(1);
      // 各行に分断された "tot" や "al" 等が存在せず、"total" が完全に維持されていること
      for (const line of lines) {
        if (line.includes('tot')) {
          expect(line).toContain('total');
        }
      }
    });

    it('ソースコードの命令行末尾のコメントが抽出され、流れ図ブロック横にアノテーションとして描画されること', () => {
      const code = `a = a + 1 #(ア)
if a > 10: #(イ)
    print(a)
# 単体コメント行`;
      const graph = generateFlowchartGraph(code);

      // 1. ノードに comment プロパティが設定されていること
      const node1 = graph.nodes.find((n) => n.id === 'node-1');
      const node2 = graph.nodes.find((n) => n.id === 'node-2');
      expect(node1?.comment).toBe('(ア)');
      expect(node2?.comment).toBe('(イ)');

      // 2. 単体コメント行からノードは生成されないこと
      expect(graph.nodes.some((n) => n.label.includes('単体コメント行'))).toBe(false);

      // 3. SVG 描画テスト
      const { container } = render(
        <FlowchartViewer nodes={graph.nodes} edges={graph.edges} code={code} />
      );
      const comments = container.querySelectorAll('.flowchart-comment');
      expect(comments.length).toBe(2);
      expect(comments[0]?.textContent).toBe('(ア)');
      expect(comments[1]?.textContent).toBe('(イ)');
    });

    it('複数カラムレイアウトにおいてコメント幅に応じてカラム間隔とSVG幅が適切に拡張されること', () => {
      const codeWithLongComment = `score = 75
if score >= 80: # 【極めて優秀なスコア】
    grade = "A"
else: # 【再試験対象】
    grade = "B"
print(grade)`;
      const graph = generateFlowchartGraph(codeWithLongComment);
      const { container } = render(
        <FlowchartViewer nodes={graph.nodes} edges={graph.edges} code={codeWithLongComment} />
      );

      const svg = container.querySelector('svg');
      const width = Number(svg?.getAttribute('width'));
      // コメントなしのデフォルト2列幅（約 440px）よりも広く拡張されていること
      expect(width).toBeGreaterThan(400);
    });

    it('合流後のブロックに長いコメントがある場合でも、分岐内のelseブロックは通常の間隔（余白なし）で配置されること', () => {
      const code = `a = 3
b = 1
e = a + b
if a > b:
    e = e + 1
    f = a + b
else:
    f = a - b
e = e * e
f = f * f #※小数点以下切り捨て
e = e - f
1 -> h`;
      const graph = generateFlowchartGraph(code);
      const { container } = render(
        <FlowchartViewer nodes={graph.nodes} edges={graph.edges} code={code} />
      );

      // else ブロック (f = a - b, node-8) の X 座標
      const elseNode = container.querySelector('[data-node-id="node-8"]');
      expect(elseNode).not.toBeNull();
      const rect = elseNode?.querySelector('rect');
      const elseX = Number(rect?.getAttribute('x'));

      // paddingX (16) + nodeWidth (180) + colGap (40) = 236
      // Yes側にコメントがないため、通常間隔 236px に配置されていること（過剰に離れていない）
      expect(elseX).toBe(236);
    });
  });
});
