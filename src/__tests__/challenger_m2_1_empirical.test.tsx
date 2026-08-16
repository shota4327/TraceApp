import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  generateFlowchartGraph,
  generateDrawIoXml,
} from '../services/flowchartGenerator';
import { renderFlowchartSvg } from '../services/flowchartRenderer';
import { FlowchartGraph } from '../types/flowchart';

describe('Challenger M2_1 Empirical Stress & XML Parsing Verification', () => {
  /**
   * 補助関数: DOMParserを用いてXML文字列を厳格にパースし、エラーがないことを検証する
   */
  function parseAndValidateXml(xmlString: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    // パースエラーのチェック
    const parserError = doc.querySelector('parsererror');
    expect(parserError, `XML Parsing Error: ${parserError?.textContent}`).toBeNull();

    return doc;
  }

  describe('1. 複雑なネスト分岐 (if / elif / else) の CFG 生成 & XML/SVG 検証', () => {
    it('ネストされた if/elif/else 構造に対して正しいCFGノード・エッジが生成され、XMLが正常にパースできること', () => {
      const code = `score = 85
if score >= 90:
    grade = 'A'
elif score >= 80:
    if score >= 85:
        grade = 'A+'
    else:
        grade = 'A-'
else:
    grade = 'F'
print(grade)`;

      const graph: FlowchartGraph = generateFlowchartGraph(code);
      expect(graph.nodes.length).toBeGreaterThan(5);
      expect(graph.edges.length).toBeGreaterThan(5);

      // ノード種別の存在確認
      const types = graph.nodes.map((n) => n.type);
      expect(types).toContain('decision');
      expect(types).toContain('process');
      expect(types).toContain('terminal');

      // draw.io XML 生成と XML パース検証
      const xml = generateDrawIoXml(graph);
      const doc = parseAndValidateXml(xml);

      // vertex="1" および edge="1" の要素を取得
      const root = doc.querySelector('root');
      expect(root).not.toBeNull();

      const vertices = doc.querySelectorAll('mxCell[vertex="1"]');
      const edges = doc.querySelectorAll('mxCell[edge="1"]');

      expect(vertices.length).toBe(graph.nodes.length);
      expect(edges.length).toBe(graph.edges.length);

      // SVG レンダリングのストレステスト
      const svgElement = renderFlowchartSvg(graph.nodes, { edges: graph.edges, activeLine: 5 });
      render(<>{svgElement}</>);
      expect(screen.getByRole('img')).toBeDefined();
    });
  });

  describe('2. ネストループ (for inside while / while inside for) の CFG 生成 & XML/SVG 検証', () => {
    it('while内のforループ構造に対して Loop バックエッジおよび False 退場エッジが生成され、XMLが正常にパースできること', () => {
      const code = `i = 0
while i < 3:
    for j in range(2):
        print(i, j)
    i += 1`;

      const graph = generateFlowchartGraph(code);
      const loopNodes = graph.nodes.filter((n) => n.type === 'loop');
      expect(loopNodes.length).toBe(4); // while, for およびそれぞれのループ終了ノード (計4つ)

      // エッジのラベル検証
      const edgeLabels = graph.edges.map((e) => e.label);
      expect(edgeLabels).toContain('Loop');
      expect(edgeLabels).toContain('False');

      // draw.io XML のパース検証
      const xml = generateDrawIoXml(graph);
      const doc = parseAndValidateXml(xml);

      const vertices = doc.querySelectorAll('mxCell[vertex="1"]');
      const edges = doc.querySelectorAll('mxCell[edge="1"]');

      expect(vertices.length).toBe(graph.nodes.length);
      expect(edges.length).toBe(graph.edges.length);

      // 各 edge の attributes チェック (source, target が存在するか)
      edges.forEach((edgeEl) => {
        expect(edgeEl.getAttribute('source')).toBeTruthy();
        expect(edgeEl.getAttribute('target')).toBeTruthy();
      });

      // SVG レンダリング (JISループ仕様: ループ記号の Loop/False 表記は非表示)
      const svgElement = renderFlowchartSvg(graph.nodes, { edges: graph.edges });
      const { container } = render(<>{svgElement}</>);
      expect(container.querySelectorAll('.flowchart-edge').length).toBeGreaterThan(0);
      expect(container.querySelectorAll('.edge-loop').length).toBe(0);
    });
  });

  describe('3. 再帰関数・複数関数定義の CFG 生成 & XML/SVG 検証', () => {
    it('再帰関数および複数関数定義に対して関数端子および呼び出しノードが生成され、エスケープや特殊文字を含む場合でも XML パースが成功すること', () => {
      const code = `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

def process_data(data):
    for item in data:
        print("Item: " + str(item))

fib(5)`;

      const graph = generateFlowchartGraph(code);
      const funcDefNodes = graph.nodes.filter((n) => n.subType === 'function-terminal');
      expect(funcDefNodes.length).toBeGreaterThanOrEqual(2);

      const subNodes = graph.nodes.filter((n) => n.type === 'subroutine');
      expect(subNodes.length).toBe(1); // fib(5)

      // XML パース検証
      const xml = generateDrawIoXml(graph);
      const doc = parseAndValidateXml(xml);

      const vertices = doc.querySelectorAll('mxCell[vertex="1"]');
      expect(vertices.length).toBe(graph.nodes.length);

      // SVG レンダリング
      const svgElement = renderFlowchartSvg(graph.nodes, { edges: graph.edges });
      render(<>{svgElement}</>);
      expect(screen.getAllByTestId('flowchart-node-subroutine').length).toBe(1);
    });
  });

  describe('4. 特殊文字・エスケープ文字を含むラベルの XML & SVG ストレステスト', () => {
    it('XML特殊文字 (&, <, >, ", \') を含む判定文や代入文がエラーなく XML パースおよび SVG レンダリングされること', () => {
      const code = `if a < b and b > c and (a & 1):
    msg = "A < B & B > C"
elif x == 'test':
    pass`;

      const graph = generateFlowchartGraph(code);
      const xml = generateDrawIoXml(graph);
      const doc = parseAndValidateXml(xml);

      // パースされたノードの value 属性値にアンエスケープ済みの文字列が入っているか
      const vertices = doc.querySelectorAll('mxCell[vertex="1"]');
      expect(vertices.length).toBe(graph.nodes.length);

      const decisionVertex = Array.from(vertices).find((v) =>
        v.getAttribute('value')?.includes('a < b')
      );
      expect(decisionVertex).toBeDefined();

      // SVG描画
      const svgElement = renderFlowchartSvg(graph.nodes, { edges: graph.edges });
      render(<>{svgElement}</>);
      expect(screen.getByRole('img')).toBeDefined();
    });
  });
});
