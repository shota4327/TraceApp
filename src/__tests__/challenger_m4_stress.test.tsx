import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { generateFlowchartNodes, generateDrawIoXml } from '../services/flowchartGenerator';
import { renderFlowchartSvg, isNodeActive } from '../services/flowchartRenderer';
import { FlowchartViewer } from '../components/FlowchartViewer';
import { FlowchartNode } from '../types/flowchart';

describe('Challenger M4 Stress & Edge Case Tests (限界・エッジケーステスト)', () => {
  describe('1. 極端な分岐 (Extreme Branching)', () => {
    it('15階層の深層ネスト if-else 条件分岐コードをエラーなくフローチャート化できること', () => {
      let code = 'x = 100\n';
      for (let i = 0; i < 15; i++) {
        const indent = '  '.repeat(i);
        code += `${indent}if x > ${i}:\n`;
        code += `${indent}  x -= 1\n`;
      }
      const nodes = generateFlowchartNodes(code);
      expect(nodes.length).toBeGreaterThan(15);
      
      const decisionNodes = nodes.filter((n) => n.type === 'decision');
      expect(decisionNodes.length).toBe(15);

      // SVG描画テスト
      const { container } = render(<FlowchartViewer nodes={nodes} activeLine={10} />);
      expect(container.querySelector('svg')).not.toBeNull();
      const activeNode = container.querySelector('[data-active="true"]');
      expect(activeNode).not.toBeNull();
    });

    it('20個の連続 elif 分岐コードを正常にノード変換およびハイライトできること', () => {
      let code = 'score = 75\n';
      code += 'if score >= 95:\n  grade = "A+"\n';
      for (let i = 90; i >= 10; i -= 5) {
        code += `elif score >= ${i}:\n  grade = "${i}"\n`;
      }
      code += 'else:\n  grade = "F"\n';

      const nodes = generateFlowchartNodes(code);
      const decisionNodes = nodes.filter((n) => n.type === 'decision');
      expect(decisionNodes.length).toBeGreaterThanOrEqual(18);

      const xml = generateDrawIoXml(nodes);
      expect(xml).toContain('rhombus');
    });

    it('特殊文字（<&">）および長文論理式を含む条件分岐ノードが正しくXML/SVGエスケープされること', () => {
      const code = 'if a < 10 and b > 20 and msg == "<test & \\"quote\\">":\n  print("ok")';
      const nodes = generateFlowchartNodes(code);
      const xml = generateDrawIoXml(nodes);

      expect(xml).toContain('&lt;');
      expect(xml).toContain('&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).not.toContain('<test');

      const { container } = render(<FlowchartViewer nodes={nodes} activeLine={1} />);
      expect(container.textContent).toContain('if a < 10 and b > 20');
    });
  });

  describe('2. 深くネストされたループ (Deeply Nested Loops)', () => {
    it('8重のネストループ（for / while 混合）を正しくループノード群として生成できること', () => {
      let code = '';
      for (let i = 1; i <= 8; i++) {
        const indent = '  '.repeat(i - 1);
        if (i % 2 === 1) {
          code += `${indent}for i${i} in range(5):\n`;
        } else {
          code += `${indent}while i${i} > 0:\n`;
        }
      }
      code += '  '.repeat(8) + 'print("nested")\n';

      const nodes = generateFlowchartNodes(code);
      const loopNodes = nodes.filter((n) => n.type === 'loop');
      expect(loopNodes.length).toBe(16); // 8個のループ開始ノード + 8個のループ終了ノード

      const { container } = render(<FlowchartViewer nodes={nodes} activeLine={5} />);
      expect(container.querySelectorAll('.flowchart-node').length).toBe(nodes.length);
    });

    it('break / continue を含むループ処理でクラッシュせずにレンダリングできること', () => {
      const code = `for i in range(10):
  if i == 5:
    break
  if i % 2 == 0:
    continue
  print(i)`;

      const nodes = generateFlowchartNodes(code);
      expect(nodes.length).toBeGreaterThan(5);

      const { container } = render(<FlowchartViewer nodes={nodes} activeLine={3} />);
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  describe('3. 未対応構文・特殊文法要素 (Unsupported & Edge Syntax)', () => {
    it('型アノテーション(AnnAssign), try-except, import, pass, break などの構文が含まれてもクラッシュしないこと', () => {
      const code = `import math
from os import path

x: int = 10
y: str = "hello"

try:
    result = math.sqrt(x)
except Exception as e:
    pass
finally:
    print("done")
`;

      const nodes = generateFlowchartNodes(code);
      expect(nodes.length).toBeGreaterThan(2);

      const xml = generateDrawIoXml(nodes);
      expect(xml).toContain('<mxGraphModel>');

      const { container } = render(<FlowchartViewer nodes={nodes} activeLine={4} />);
      expect(container.querySelector('svg')).not.toBeNull();
    });

    it('構文エラーを含むコード（不完全なPythonコード）が渡されても開始・終了ノードまたはフォールバックノードを返却すること', () => {
      const invalidCode = `def broken_func(:\n    if x >>> 5\n        return (((`;
      const nodes = generateFlowchartNodes(invalidCode);

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0]!.type).toBe('terminal');
      expect(nodes[nodes.length - 1]!.type).toBe('terminal');

      // UI描画で例外が発生しないこと
      expect(() => {
        render(<FlowchartViewer nodes={nodes} activeLine={1} />);
      }).not.toThrow();
    });
  });

  describe('4. 空コード・空白・コメントのみ (Empty Code & Boundary Inputs)', () => {
    it('完全な空文字列の場合に開始・終了の端子ノードのみ返却すること', () => {
      const nodes = generateFlowchartNodes('');
      expect(nodes.length).toBe(2);
      expect(nodes[0]!.label).toBe('開始');
      expect(nodes[1]!.label).toBe('終了');
    });

    it('空白・タブ・改行のみの文字列の場合に開始・終了の端子ノードのみ返却すること', () => {
      const nodes = generateFlowchartNodes('   \n\n\t  \n  ');
      expect(nodes.length).toBe(2);
      expect(nodes[0]!.label).toBe('開始');
      expect(nodes[1]!.label).toBe('終了');
    });

    it('コメント行のみのコードの場合にコメントが除外され開始・終了ノードのみになること', () => {
      const code = '# Comment 1\n# Comment 2\n   # Indented comment';
      const nodes = generateFlowchartNodes(code);
      expect(nodes.length).toBe(2);
      expect(nodes[0]!.label).toBe('開始');
      expect(nodes[1]!.label).toBe('終了');
    });
  });

  describe('5. 不整合ノード・表示限界テスト (Malformed Nodes & Scale Limits)', () => {
    it('lineRangeが未定義または無効数値のノードでも isNodeActive が安全に false を返すこと', () => {
      const malformedNode1: FlowchartNode = {
        id: 'bad-1',
        type: 'process',
        label: 'test',
        lineRange: undefined as any,
      };
      const malformedNode2: FlowchartNode = {
        id: 'bad-2',
        type: 'process',
        label: 'test',
        lineRange: [100, 10], // 開始 > 終了
      };

      expect(isNodeActive(malformedNode1, 5)).toBe(false);
      expect(isNodeActive(malformedNode2, 5)).toBe(false);
      expect(isNodeActive(malformedNode2, 50)).toBe(false);
    });

    it('極端に長いラベル文字列（500文字）でも表示が切り詰められSVGレンダリングが崩れないこと', () => {
      const longLabel = 'x = ' + 'a'.repeat(500);
      const node: FlowchartNode = {
        id: 'long-node',
        type: 'process',
        label: longLabel,
        lineRange: [1, 1],
      };

      const { container } = render(<FlowchartViewer nodes={[node]} activeLine={1} />);
      const textEl = container.querySelector('text');
      expect(textEl).not.toBeNull();
      // レンダラーで24文字を超えると ellipsis (...) に切られることの確認
      expect(textEl?.textContent?.length).toBeLessThan(30);
      expect(textEl?.textContent).toContain('...');
    });

    it('未知のノード種別 (type: unknown) が渡されてもデフォルト形状で安全にレンダリングされること', () => {
      const unknownNode: FlowchartNode = {
        id: 'unk-1',
        type: 'unknown_type' as any,
        label: 'Custom Node',
        lineRange: [1, 1],
      };

      expect(() => {
        render(<FlowchartViewer nodes={[unknownNode]} activeLine={1} />);
      }).not.toThrow();
    });

    it('500個の大規模ノード配列でもSVG描画がエラーなく完了し領域高さが正しく計算されること', () => {
      const largeNodes: FlowchartNode[] = [];
      largeNodes.push({ id: 'start', type: 'terminal', label: '開始', lineRange: [1, 1] });
      for (let i = 1; i <= 500; i++) {
        largeNodes.push({
          id: `node-${i}`,
          type: 'process',
          label: `step_${i} = ${i}`,
          lineRange: [i + 1, i + 1],
        });
      }
      largeNodes.push({ id: 'end', type: 'terminal', label: '終了', lineRange: [502, 502] });

      const element = renderFlowchartSvg(largeNodes, { activeLine: 250 });
      const { container } = render(<>{element}</>);
      
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      // 高さがノード数に応じてスケールされていること (502ノード * 70 = 35140)
      expect(Number(svg?.getAttribute('height'))).toBeGreaterThan(30000);
    });

    it('activeLine が境界外（0, 境界外の大規模数値, マイナス数値, NaN）でも安全に処理されること', () => {
      const nodes: FlowchartNode[] = [
        { id: 'start', type: 'terminal', label: '開始', lineRange: [1, 1] },
        { id: 'p1', type: 'process', label: 'x = 1', lineRange: [2, 5] },
        { id: 'end', type: 'terminal', label: '終了', lineRange: [6, 6] },
      ];

      expect(() => render(<FlowchartViewer nodes={nodes} activeLine={0} />)).not.toThrow();
      expect(() => render(<FlowchartViewer nodes={nodes} activeLine={99999} />)).not.toThrow();
      expect(() => render(<FlowchartViewer nodes={nodes} activeLine={-50} />)).not.toThrow();
      expect(() => render(<FlowchartViewer nodes={nodes} activeLine={NaN} />)).not.toThrow();
    });
  });
});
