import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import path from 'path';

import {
  generateFlowchartGraph,
  generateFlowchartNodes,
  generateDrawIoXml,
} from '../services/flowchartGenerator';
import {
  renderNodeShape,
  renderFlowchartSvg,
} from '../services/flowchartRenderer';
import { FlowchartViewer } from '../components/FlowchartViewer';
import { PYTHON_TRACER_SCRIPT } from '../worker/pythonTracer';
import { FlowchartNode, FlowchartEdge } from '../types/flowchart';

/**
 * Milestone 2 Challenger (challenger_m2_2) Empirical Verification Suite
 * 
 * 検証対象:
 * 1. src/services/flowchartGenerator.ts
 * 2. src/services/flowchartRenderer.tsx
 * 3. src/worker/pythonTracer.ts
 * 
 * 検証3プログラム:
 * - 1. 順次・代入 (Sequential & Assignment)
 * - 2. 条件分岐 (Conditional Branching)
 * - 3. ループと関数 (Loop and Function)
 */

const PROGRAM_1_SEQ = `x = 5
y = 3
total = x + y
print(total)`;

const PROGRAM_2_BRANCH = `score = 75
if score >= 80:
    grade = "A"
elif score >= 60:
    grade = "B"
else:
    grade = "C"
print(grade)`;

const PROGRAM_3_LOOP_FUNC = `def add(a, b):
    result = a + b
    return result

total = 0
for i in range(1, 4):
    total = add(total, i)
print(total)`;

describe('challenger_m2_2: 流れ図生成・描画・Pyodide ASTの対立的検証スイート', () => {
  let pyodide: PyodideInterface;

  beforeAll(async () => {
    const pyodidePath = path.resolve(process.cwd(), 'node_modules/pyodide');
    pyodide = await loadPyodide({ indexURL: pyodidePath });
    await pyodide.runPythonAsync(PYTHON_TRACER_SCRIPT);
  }, 30000);

  /* -------------------------------------------------------------------
   * 1. flowchartGenerator.ts 単体・結合検証
   * ------------------------------------------------------------------- */
  describe('1. flowchartGenerator.ts のノード種別・エッジ検証', () => {
    it('1.1 順次・代入プログラム: terminal(角丸長方形) と process(長方形) が正しく生成されること', () => {
      const graph = generateFlowchartGraph(PROGRAM_1_SEQ);
      expect(graph.nodes.length).toBe(6); // 開始, x=5, y=3, total=..., print, 終了

      // ノード種別の検証
      expect(graph.nodes[0]!.type).toBe('terminal');
      expect(graph.nodes[0]!.label).toBe('開始');

      expect(graph.nodes[1]!.type).toBe('process');
      expect(graph.nodes[1]!.label).toBe('5 → x');

      expect(graph.nodes[2]!.type).toBe('process');
      expect(graph.nodes[2]!.label).toBe('3 → y');

      expect(graph.nodes[3]!.type).toBe('process');
      expect(graph.nodes[3]!.label).toBe('x ＋ y → total');

      expect(graph.nodes[4]!.type).toBe('process');
      expect(graph.nodes[4]!.label).toBe('totalを表示');

      expect(graph.nodes[5]!.type).toBe('terminal');
      expect(graph.nodes[5]!.label).toBe('終了');

      // エッジの検証 (すべてのエッジが Next ラベルで順次接続)
      expect(graph.edges.length).toBe(5);
      graph.edges.forEach((edge) => {
        expect(edge.label).toBe('Next');
      });

      // draw.io XML 生成検証
      const xml = generateDrawIoXml(graph);
      expect(xml).toContain('rounded=1;whiteSpace=wrap;html=1;arcSize=50'); // terminal スタイル
      expect(xml).toContain('rounded=0;whiteSpace=wrap;html=1;'); // process スタイル
    });

    it('1.2 条件分岐プログラム: decision(ひし形) と分岐エッジ(True/Next)が正しく生成されること', () => {
      const graph = generateFlowchartGraph(PROGRAM_2_BRANCH);
      
      const nodeTypes = graph.nodes.map((n) => n.type);
      expect(nodeTypes).toContain('terminal');
      expect(nodeTypes).toContain('process');
      expect(nodeTypes).toContain('decision');

      const decisionNodes = graph.nodes.filter((n) => n.type === 'decision');
      expect(decisionNodes.length).toBeGreaterThanOrEqual(2);
      expect(decisionNodes[0]!.label).toBe('score ≧ 80');
      expect(decisionNodes[1]!.label).toBe('score ≧ 60');

      // エッジラベルに True が含まれること
      const edgeLabels = graph.edges.map((e) => e.label);
      expect(edgeLabels).toContain('True');

      // draw.io XML に rhombus スタイルが含まれること
      const xml = generateDrawIoXml(graph);
      expect(xml).toContain('rhombus;whiteSpace=wrap;html=1');
    });

    it('1.3 ループと関数プログラム: 関数端子(def/return) と loop(六角形) および Loop/False エッジが生成されること', () => {
      const graph = generateFlowchartGraph(PROGRAM_3_LOOP_FUNC);

      const nodeTypes = graph.nodes.map((n) => n.type);
      expect(nodeTypes).toContain('loop');
      expect(nodeTypes).toContain('process');
      expect(nodeTypes).toContain('terminal');

      // 関数の開始端子 (add(a, b)) と終了端子 (return result)
      const defNode = graph.nodes.find((n) => n.subType === 'function-terminal' && !n.label.startsWith('return') && n.label !== '終了');
      expect(defNode).toBeDefined();
      expect(defNode?.label).toBe('add(a, b)');
      expect(defNode?.type).toBe('terminal');
      expect(defNode?.subType).toBe('function-terminal');

      const returnNode = graph.nodes.find((n) => n.label.startsWith('return'));
      expect(returnNode).toBeDefined();
      expect(returnNode?.type).toBe('terminal');
      expect(returnNode?.subType).toBe('function-terminal');

      // 返り値あり関数呼び出しノード (total = add(total, i))
      const callNode = graph.nodes.find((n) => n.label.includes('add(total, i)'));
      expect(callNode).toBeDefined();
      expect(callNode?.subType).toBe('function-call-return');

      // ループのノード種別
      const loopNode = graph.nodes.find((n) => n.type === 'loop');
      expect(loopNode).toBeDefined();
      expect(loopNode!.label).toContain('iは1から1ずつ増やしてi≦3の間');

      // Loop バックエッジおよび Loop エグジット (False) エッジの確認
      const edgeLabels = graph.edges.map((e) => e.label);
      expect(edgeLabels).toContain('Loop');
      expect(edgeLabels).toContain('False');

      const xml = generateDrawIoXml(graph);
      expect(xml).toContain('shape=hexagon');
    });
  });

  /* -------------------------------------------------------------------
   * 2. flowchartRenderer.tsx SVGレンダラーのノード種別・形状描画検証
   * ------------------------------------------------------------------- */
  describe('2. flowchartRenderer.tsx ノード種別 (5種) のSVG要素検証', () => {
    it('2.1 端子 (terminal): 角丸長方形 (rx=22, ry=22) が描画されること', () => {
      const node: FlowchartNode = { id: 'node-start', type: 'terminal', label: '開始', lineRange: [1, 1] };
      const { container } = render(<svg>{renderNodeShape(node, 100, 20, 180, 50, false)}</svg>);

      const rect = container.querySelector('rect');
      expect(rect).not.toBeNull();
      expect(rect?.getAttribute('rx')).toBe('22');
      expect(rect?.getAttribute('ry')).toBe('22');
      expect(container.querySelector('g')?.getAttribute('data-testid')).toBe('flowchart-node-terminal');
    });

    it('2.2 処理 (process): 長方形 (rx=4, ry=4) が描画されること', () => {
      const node: FlowchartNode = { id: 'node-proc', type: 'process', label: 'x = 5', lineRange: [2, 2] };
      const { container } = render(<svg>{renderNodeShape(node, 100, 80, 180, 50, false)}</svg>);

      const rect = container.querySelector('rect');
      expect(rect).not.toBeNull();
      expect(rect?.getAttribute('rx')).toBe('4');
      expect(rect?.getAttribute('ry')).toBe('4');
      expect(container.querySelector('g')?.getAttribute('data-testid')).toBe('flowchart-node-process');
    });

    it('2.3 判断 (decision): ひし形 (4頂点 polygon) が描画されること', () => {
      const node: FlowchartNode = { id: 'node-dec', type: 'decision', label: 'score >= 80', lineRange: [3, 3] };
      const { container } = render(<svg>{renderNodeShape(node, 100, 140, 180, 50, false)}</svg>);

      const polygon = container.querySelector('polygon');
      expect(polygon).not.toBeNull();
      const points = polygon?.getAttribute('points')?.split(' ');
      expect(points?.length).toBe(4); // ひし形は 4 頂点
      expect(container.querySelector('g')?.getAttribute('data-testid')).toBe('flowchart-node-decision');
    });

    it('2.4 ループ (loop): 六角形 (6頂点 polygon) が描画されること', () => {
      const node: FlowchartNode = { id: 'node-loop', type: 'loop', label: 'for i in range(1, 4)', lineRange: [4, 4] };
      const { container } = render(<svg>{renderNodeShape(node, 100, 200, 180, 50, false)}</svg>);

      const polygon = container.querySelector('polygon');
      expect(polygon).not.toBeNull();
      const points = polygon?.getAttribute('points')?.split(' ');
      expect(points?.length).toBe(6); // 六角形は 6 頂点
      expect(container.querySelector('g')?.getAttribute('data-testid')).toBe('flowchart-node-loop');
    });

    it('2.5 サブルーチン (subroutine): 二重線長方形 (rect + 2本の垂直線) が描画されること', () => {
      const node: FlowchartNode = { id: 'node-sub', type: 'subroutine', label: 'def add(a, b)', lineRange: [5, 5] };
      const { container } = render(<svg>{renderNodeShape(node, 100, 260, 180, 50, false)}</svg>);

      const rect = container.querySelector('rect');
      const lines = container.querySelectorAll('line');
      expect(rect).not.toBeNull();
      expect(lines.length).toBe(2); // 両サイドの二重線用 2 本
      expect(container.querySelector('g')?.getAttribute('data-testid')).toBe('flowchart-node-subroutine');
    });

    it('2.6 エッジの描画: False, True, Next エッジが正しいカラーと直線・折れ線でレンダリングされること', () => {
      const nodes: FlowchartNode[] = [
        { id: 'n1', type: 'decision', label: 'if x > 0', lineRange: [1, 1], x: 100, y: 20, width: 180, height: 50 },
        { id: 'n2', type: 'process', label: 'print("yes")', lineRange: [2, 2], x: 100, y: 100, width: 180, height: 50 },
        { id: 'n3', type: 'process', label: 'print("no")', lineRange: [3, 3], x: 300, y: 100, width: 180, height: 50 },
      ];
      const edges: FlowchartEdge[] = [
        { id: 'e-true', sourceId: 'n1', targetId: 'n2', label: 'True' },
        { id: 'e-false', sourceId: 'n1', targetId: 'n3', label: 'False' },
        { id: 'e-next', sourceId: 'n2', targetId: 'n3', label: 'Next' },
      ];

      const { container } = render(<>{renderFlowchartSvg(nodes, { edges })}</>);
      
      const trueEdge = container.querySelector('.edge-True') || container.querySelector('.edge-true');
      const falseEdge = container.querySelector('.edge-false');
      const nextEdge = container.querySelector('.edge-next') || container.querySelector('.edge-Next');

      expect(trueEdge).not.toBeNull();
      expect(falseEdge).not.toBeNull();
      expect(nextEdge).not.toBeNull();

      expect(trueEdge?.querySelector('line')).not.toBeNull();
      expect(falseEdge?.querySelector('path')).not.toBeNull();
      expect(nextEdge?.querySelector('line')).not.toBeNull();
    });
  });

  /* -------------------------------------------------------------------
   * 3. 一本化された流れ図生成エンジン (generateFlowchartGraph) 実用動作検証
   * ------------------------------------------------------------------- */
  describe('3. 一本化された流れ図生成エンジン (generateFlowchartGraph) 実用動作検証', () => {
    it('3.1 順次・代入プログラムから AST ノードとエッジを取得できること', () => {
      const graph = generateFlowchartGraph(PROGRAM_1_SEQ);

      expect(graph.nodes).toBeDefined();
      expect(graph.nodes.length).toBeGreaterThan(0);

      const types = graph.nodes.map((n) => n.type);
      expect(types).toContain('terminal');
      expect(types).toContain('process');
    });

    it('3.2 条件分岐プログラムから decision ノードと True/False エッジを取得できること', () => {
      const graph = generateFlowchartGraph(PROGRAM_2_BRANCH);
      const types = graph.nodes.map((n) => n.type);
      expect(types).toContain('decision');

      const edgeLabels = graph.edges.map((e) => e.label);
      expect(edgeLabels).toContain('True');
      expect(edgeLabels).toContain('False');
    });

    it('3.3 ループと関数プログラムから loop ノードと関数端子および Loop エッジを取得できること', () => {
      const graph = generateFlowchartGraph(PROGRAM_3_LOOP_FUNC);

      const types = graph.nodes.map((n) => n.type);
      expect(types).toContain('loop');
      expect(types).toContain('terminal');
      expect(types).toContain('process');

      const defNode = graph.nodes.find((n) => n.subType === 'function-terminal' && !n.label.startsWith('return') && n.label !== '終了');
      expect(defNode?.subType).toBe('function-terminal');
      expect(defNode?.label).toBe('add(a, b)');

      const edgeLabels = graph.edges.map((e) => e.label);
      expect(edgeLabels).toContain('Loop');
      expect(edgeLabels).toContain('False');
    });
  });

  /* -------------------------------------------------------------------
   * 4. FlowchartViewer 統合コンポーネントでの完全レンダリング検証
   * ------------------------------------------------------------------- */
  describe('4. FlowchartViewer 全画面コンポーネント統合検証', () => {
    it('4.1 3種類のプログラムノードを FlowchartViewer に渡して正しく表示されること', () => {
      const nodes1 = generateFlowchartNodes(PROGRAM_1_SEQ);
      const { unmount: unmount1 } = render(<FlowchartViewer nodes={nodes1} activeLine={1} />);
      expect(screen.getByTestId('flowchart-viewer')).toBeDefined();
      unmount1();

      const nodes2 = generateFlowchartNodes(PROGRAM_2_BRANCH);
      const { unmount: unmount2 } = render(<FlowchartViewer nodes={nodes2} activeLine={2} />);
      expect(screen.getByTestId('flowchart-viewer')).toBeDefined();
      unmount2();

      const nodes3 = generateFlowchartNodes(PROGRAM_3_LOOP_FUNC);
      const { unmount: unmount3 } = render(<FlowchartViewer nodes={nodes3} activeLine={4} />);
      expect(screen.getByTestId('flowchart-viewer')).toBeDefined();
      unmount3();
    });
  });
});
