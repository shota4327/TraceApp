import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { generateFlowchartNodes, generateFlowchartGraph, generateDrawIoXml } from '../services/flowchartGenerator';
import { renderFlowchartSvg, isNodeActive } from '../services/flowchartRenderer';
import { FlowchartViewer } from '../components/FlowchartViewer';
import { LeftPanel } from '../components/LeftPanel';
import { FlowchartNode } from '../types/flowchart';

describe('Milestone 4: AST Flowchart Generator & Renderer', () => {
  describe('flowchartGenerator', () => {
    it('Pythonコードから各タイプのFlowchartNodeを生成できること', () => {
      const code = `def add(a, b):
    result = a + b
    return result

total = 0
if total >= 0:
    print("positive")

for i in range(1, 4):
    total += i
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

      const lastNode = nodes[nodes.length - 1]!;
      expect(lastNode.type).toBe('terminal');
      expect(lastNode.label).toBe('終了');
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
  });
});
