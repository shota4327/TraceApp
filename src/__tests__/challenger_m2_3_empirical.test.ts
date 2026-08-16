import { describe, it, expect } from 'vitest';
import { generateFlowchartGraph, generateDrawIoXml } from '../services/flowchartGenerator';

describe('Challenger M2-3: Empirical Verification for CFG & False Edges', () => {
  describe('1. 単一 if 文 (直後にステートメントあり)', () => {
    it('label: "False" が存在し、直後のステートメントノードに接続していること', () => {
      const code = `if x > 0:
    print(x)
print("done")`;

      const graph = generateFlowchartGraph(code);
      const decisionNode = graph.nodes.find((n) => n.type === 'decision' && n.label === 'x > 0');
      const printXNode = graph.nodes.find((n) => n.label.includes('xを表示'));
      const printDoneNode = graph.nodes.find((n) => n.label.includes('"done"を表示'));

      expect(decisionNode).toBeDefined();
      expect(printXNode).toBeDefined();
      expect(printDoneNode).toBeDefined();

      // True edge: decision -> print(x)
      const trueEdge = graph.edges.find((e) => e.sourceId === decisionNode!.id && e.label === 'True');
      expect(trueEdge).toBeDefined();
      expect(trueEdge!.targetId).toBe(printXNode!.id);

      // False edge: decision -> print("done")
      const falseEdge = graph.edges.find((e) => e.sourceId === decisionNode!.id && e.label === 'False');
      expect(falseEdge).toBeDefined();
      expect(falseEdge!.targetId).toBe(printDoneNode!.id);

      // Next edge: print(x) -> print("done") (merge)
      const mergeEdge = graph.edges.find((e) => e.sourceId === printXNode!.id && e.targetId === printDoneNode!.id);
      expect(mergeEdge).toBeDefined();
    });
  });

  describe('2. 単一 if 文 (ファイル末尾・直後にステートメントなし)', () => {
    it('label: "False" が存在し、終了ノード (node-end) に接続していること', () => {
      const code = `if x > 0:
    print(x)`;

      const graph = generateFlowchartGraph(code);
      const decisionNode = graph.nodes.find((n) => n.type === 'decision' && n.label === 'x > 0');
      const printXNode = graph.nodes.find((n) => n.label.includes('xを表示'));
      const endNode = graph.nodes.find((n) => n.type === 'terminal' && n.label === '終了');

      expect(decisionNode).toBeDefined();
      expect(printXNode).toBeDefined();
      expect(endNode).toBeDefined();

      // False edge: decision -> endNode
      const falseEdge = graph.edges.find((e) => e.sourceId === decisionNode!.id && e.label === 'False');
      expect(falseEdge).toBeDefined();
      expect(falseEdge!.targetId).toBe(endNode!.id);

      // Next edge: print(x) -> endNode
      const mergeEdge = graph.edges.find((e) => e.sourceId === printXNode!.id && e.targetId === endNode!.id);
      expect(mergeEdge).toBeDefined();
    });
  });

  describe('3. ネストした if 文 (直後にステートメントあり)', () => {
    it('外側・内側それぞれの if ノードから正しく False エッジが生成され対象ノードに接続していること', () => {
      const code = `x = 10
if x > 0:
    if x > 5:
        print("large")
    print("positive")
print("done")`;

      const graph = generateFlowchartGraph(code);

      const outerIf = graph.nodes.find((n) => n.label === 'x > 0');
      const innerIf = graph.nodes.find((n) => n.label === 'x > 5');
      const printLarge = graph.nodes.find((n) => n.label.includes('"large"を表示'));
      const printPositive = graph.nodes.find((n) => n.label.includes('"positive"を表示'));
      const printDone = graph.nodes.find((n) => n.label.includes('"done"を表示'));

      expect(outerIf).toBeDefined();
      expect(innerIf).toBeDefined();
      expect(printLarge).toBeDefined();
      expect(printPositive).toBeDefined();
      expect(printDone).toBeDefined();

      // 内側 if の False edge -> print("positive")
      const innerFalseEdge = graph.edges.find((e) => e.sourceId === innerIf!.id && e.label === 'False');
      expect(innerFalseEdge).toBeDefined();
      expect(innerFalseEdge!.targetId).toBe(printPositive!.id);

      // 内側 if の True edge -> print("large")
      const innerTrueEdge = graph.edges.find((e) => e.sourceId === innerIf!.id && e.label === 'True');
      expect(innerTrueEdge).toBeDefined();
      expect(innerTrueEdge!.targetId).toBe(printLarge!.id);

      // 外側 if の False edge -> print("done")
      const outerFalseEdge = graph.edges.find((e) => e.sourceId === outerIf!.id && e.label === 'False');
      expect(outerFalseEdge).toBeDefined();
      expect(outerFalseEdge!.targetId).toBe(printDone!.id);
    });
  });

  describe('4. ネストした if 文 (末尾で終了する場合)', () => {
    it('外側・内側両方の False エッジが終了ノード (node-end) に接続していること', () => {
      const code = `if a > 0:
    if b > 0:
        print("both")`;

      const graph = generateFlowchartGraph(code);

      const outerIf = graph.nodes.find((n) => n.label === 'a > 0');
      const innerIf = graph.nodes.find((n) => n.label === 'b > 0');
      const endNode = graph.nodes.find((n) => n.type === 'terminal' && n.label === '終了');

      expect(outerIf).toBeDefined();
      expect(innerIf).toBeDefined();
      expect(endNode).toBeDefined();

      // 内側 if の False edge -> endNode
      const innerFalseEdge = graph.edges.find((e) => e.sourceId === innerIf!.id && e.label === 'False');
      expect(innerFalseEdge).toBeDefined();
      expect(innerFalseEdge!.targetId).toBe(endNode!.id);

      // 外側 if の False edge -> endNode
      const outerFalseEdge = graph.edges.find((e) => e.sourceId === outerIf!.id && e.label === 'False');
      expect(outerFalseEdge).toBeDefined();
      expect(outerFalseEdge!.targetId).toBe(endNode!.id);
    });
  });

  describe('5. if-elif-else 構造と draw.io XML 出力', () => {
    it('if / elif ノードそれぞれから False エッジが生成され、draw.io XML に正しく反映されること', () => {
      const code = `score = 75
if score >= 80:
    grade = "A"
elif score >= 60:
    grade = "B"
else:
    grade = "C"
print(grade)`;

      const graph = generateFlowchartGraph(code);

      const ifNode = graph.nodes.find((n) => n.label === 'score ≧ 80');
      const elifNode = graph.nodes.find((n) => n.label === 'score ≧ 60');
      const elseGradeNode = graph.nodes.find((n) => n.label.includes('grade'));
      const printGradeNode = graph.nodes.find((n) => n.label.includes('gradeを表示'));

      expect(ifNode).toBeDefined();
      expect(elifNode).toBeDefined();
      expect(elseGradeNode).toBeDefined();
      expect(printGradeNode).toBeDefined();

      // if の False edge -> elifNode
      const ifFalseEdge = graph.edges.find((e) => e.sourceId === ifNode!.id && e.label === 'False');
      expect(ifFalseEdge).toBeDefined();
      expect(ifFalseEdge!.targetId).toBe(elifNode!.id);

      // elif の False edge -> else 内の最初の処理ノード (node-7: "C" → grade)
      const elifFalseEdge = graph.edges.find((e) => e.sourceId === elifNode!.id && e.label === 'False');
      expect(elifFalseEdge).toBeDefined();
      expect(elifFalseEdge!.targetId).toBe('node-7');

      // draw.io XML の検証
      const xml = generateDrawIoXml(graph);
      expect(xml).toContain('value="False"');
      expect(xml).toContain(`source="${ifNode!.id}"`);
      expect(xml).toContain(`target="${elifNode!.id}"`);
    });
  });
});
