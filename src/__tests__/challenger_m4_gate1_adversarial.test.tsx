import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { generateFlowchartNodes, generateDrawIoXml } from '../services/flowchartGenerator';
import { renderFlowchartSvg, isNodeActive } from '../services/flowchartRenderer';
import { FlowchartViewer } from '../components/FlowchartViewer';
import { LeftPanel } from '../components/LeftPanel';
import { FlowchartNode } from '../types/flowchart';

describe('Challenger 1 M4 Gate Verification - Adversarial & Stress Harness', () => {
  // -------------------------------------------------------------
  // 観点1: AST 流れ図生成・レンダリングのストレステスト
  // -------------------------------------------------------------
  describe('観点1: AST 流れ図生成・レンダリングのストレステスト', () => {
    it('複雑なネスト・ループ・関数呼び出し・特殊文字を含むPythonコードから正常にノードとXMLを生成できること', () => {
      const complexPythonCode = `
# 複雑なPythonコードのストレステスト
def calculate_complex_matrix(matrix, threshold=10):
    """マトリックス計算関数"""
    total_sum = 0
    row_count = len(matrix)
    
    for r in range(row_count):
        row = matrix[r]
        if row is None:
            continue
        elif len(row) == 0:
            print("Empty row <warning>")
        else:
            for c in range(len(row)):
                val = row[c]
                if val > threshold and val < 100:
                    total_sum += val * 2
                elif val >= 100:
                    while val > 100:
                        val -= 10
                        if val % 2 == 0:
                            break
                else:
                    total_sum += val
    return total_sum

# メイン処理
data = [[1, 2, 105], [5, 15, 20], None, []]
result = calculate_complex_matrix(data, threshold=5)
print(f"Result: {result} & completed!")
`;
      const nodes = generateFlowchartNodes(complexPythonCode);

      expect(nodes.length).toBeGreaterThan(15);
      expect(nodes[0]!.type).toBe('terminal');
      expect(nodes[0]!.label).toBe('開始');
      expect(nodes[nodes.length - 1]!.type).toBe('terminal');
      expect(nodes[nodes.length - 1]!.label).toBe('終了');

      // ノード種別の存在確認
      const types = new Set(nodes.map((n) => n.type));
      expect(types.has('subroutine')).toBe(true);
      expect(types.has('decision')).toBe(true);
      expect(types.has('loop')).toBe(true);
      expect(types.has('process')).toBe(true);
      expect(types.has('terminal')).toBe(true);

      // XMLエスケープと生成の検証
      const xml = generateDrawIoXml(nodes);
      expect(xml).toContain('<mxGraphModel>');
      expect(xml).toContain('&lt;warning&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).toContain('</mxGraphModel>');

      // 大規模SVG描画のクラッシュテスト
      const svgElement = renderFlowchartSvg(nodes, { activeLine: 10 });
      const { container } = render(<>{svgElement}</>);
      expect(container.querySelectorAll('.flowchart-node').length).toBe(nodes.length);
    });

    it('超極長（100行以上）コードや空コードに対するパフォーマンステスト', () => {
      const emptyNodes = generateFlowchartNodes('');
      expect(emptyNodes.length).toBe(2); // 開始・終了のみ

      const whitespaceNodes = generateFlowchartNodes('   \n\n  \n');
      expect(whitespaceNodes.length).toBe(2);

      // 150行の代入コード
      const longLines = Array.from({ length: 150 }, (_, i) => `var_${i} = ${i} * 2`).join('\n');
      const longNodes = generateFlowchartNodes(longLines);
      expect(longNodes.length).toBe(152); // 開始 + 150行 + 終了

      const longXml = generateDrawIoXml(longNodes);
      expect(longXml).toContain('id="node-150"');

      // レンダリングで例外が発生しないこと
      expect(() => {
        renderFlowchartSvg(longNodes, { activeLine: 75 });
      }).not.toThrow();
    });
  });

  // -------------------------------------------------------------
  // 観点2: 端子ノード (terminal) ハイライト境界値検証
  // -------------------------------------------------------------
  describe('観点2: 端子ノード (terminal) の境界値ハイライト検証', () => {
    it('isNodeActiveは node.type === "terminal" のノードを activeLine で自動ハイライトしないこと', () => {
      const startNode: FlowchartNode = {
        id: 'node-start',
        type: 'terminal',
        label: '開始',
        lineRange: [1, 1],
      };
      const endNode: FlowchartNode = {
        id: 'node-end',
        type: 'terminal',
        label: '終了',
        lineRange: [10, 10],
      };
      const loopEndNode: FlowchartNode = {
        id: 'node-loop-end',
        type: 'process',
        label: 'ループ終了',
        lineRange: [5, 5],
      };

      // activeLine 1 でも startNode は false
      expect(isNodeActive(startNode, 1)).toBe(false);
      // activeLine 10 でも endNode は false
      expect(isNodeActive(endNode, 10)).toBe(false);
      // activeLine 5 でも ループ終了 ノードは false
      expect(isNodeActive(loopEndNode, 5)).toBe(false);

      // activeNodeId が直接指定された場合は true
      expect(isNodeActive(startNode, 1, 'node-start')).toBe(true);
      expect(isNodeActive(endNode, 10, 'node-end')).toBe(true);
    });

    it('stepIndex 1 (line 1) または最終 stepIndex (最終行) 実行時に端子ノードが不当にアクティブ表示されないこと', () => {
      const code = 'x = 10\ny = 20\nprint(x + y)';
      const nodes = generateFlowchartNodes(code);

      // Step 1 (activeLine: 1) の場合
      const { container: container1 } = render(<FlowchartViewer nodes={nodes} activeLine={1} />);
      const activeNodes1 = Array.from(container1.querySelectorAll('.flowchart-node')).filter(
        (el) => el.getAttribute('data-active') === 'true'
      );
      // ハイライトされるノードは 1つ (line 1 の node-1 のみ)。terminalノード (node-start) はハイライトされない
      expect(activeNodes1.length).toBe(1);
      expect(activeNodes1[0]?.getAttribute('data-node-id')).toBe('node-1');

      // 最終行 (activeLine: 3) の場合
      const { container: container3 } = render(<FlowchartViewer nodes={nodes} activeLine={3} />);
      const activeNodes3 = Array.from(container3.querySelectorAll('.flowchart-node')).filter(
        (el) => el.getAttribute('data-active') === 'true'
      );
      // ハイライトされるノードは 1つ (line 3 の node-3 のみ)。terminalノード (node-end) はハイライトされない
      expect(activeNodes3.length).toBe(1);
      expect(activeNodes3[0]?.getAttribute('data-node-id')).toBe('node-3');
    });
  });

  // -------------------------------------------------------------
  // 観点3: DOM 常存化・タブ連打・Monaco/FlowchartViewer同期検証
  // -------------------------------------------------------------
  describe('観点3: DOM 常存化・タブ連打・Monaco/FlowchartViewer同期検証', () => {
    it('タブを50回連続切替してもDOM常存化が維持され、ARIA属性とスタイルの同期が壊れないこと', () => {
      const sampleCode = 'a = 1\nb = 2';
      render(
        <LeftPanel
          code={sampleCode}
          onChangeCode={() => {}}
          currentStep={1}
          totalSteps={2}
          onStepChange={() => {}}
          onReset={() => {}}
          activeLine={1}
        />
      );

      const tabCode = screen.getByTestId('tab-code');
      const tabFlowchart = screen.getByTestId('tab-flowchart');

      const panelCodeDom = document.getElementById('panel-code');
      const flowchartViewerDom = document.getElementById('flowchart-viewer');

      expect(panelCodeDom).not.toBeNull();
      expect(flowchartViewerDom).not.toBeNull();

      // 高速50回連打ループ
      for (let i = 0; i < 50; i++) {
        if (i % 2 === 0) {
          fireEvent.click(tabFlowchart);
          expect(tabFlowchart.getAttribute('aria-selected')).toBe('true');
          expect(tabCode.getAttribute('aria-selected')).toBe('false');
          expect(panelCodeDom?.style.display).toBe('none');
          expect(flowchartViewerDom?.parentElement?.style.display).toBe('block');
        } else {
          fireEvent.click(tabCode);
          expect(tabCode.getAttribute('aria-selected')).toBe('true');
          expect(tabFlowchart.getAttribute('aria-selected')).toBe('false');
          expect(panelCodeDom?.style.display).toBe('block');
          expect(flowchartViewerDom?.parentElement?.style.display).toBe('none');
        }
      }

      // 連打後も両方のDOM要素がDOMツリー上に存在し続けていること
      expect(document.getElementById('panel-code')).not.toBeNull();
      expect(document.getElementById('flowchart-viewer')).not.toBeNull();
    });

    it('タブ非表示時も activeLine の変更が FlowchartViewer および MonacoEditor に正常に伝達されること', () => {
      const code = 'x = 100\ny = 200';
      const { rerender, container } = render(
        <LeftPanel
          code={code}
          onChangeCode={() => {}}
          currentStep={0}
          totalSteps={2}
          onStepChange={() => {}}
          onReset={() => {}}
          activeLine={1}
        />
      );

      // 初期状態で activeLine 1 が反映されていること
      let activeSvgNode = container.querySelector('[data-node-id="node-1"]');
      expect(activeSvgNode?.getAttribute('data-active')).toBe('true');

      // activeLine を 2 に変更
      rerender(
        <LeftPanel
          code={code}
          onChangeCode={() => {}}
          currentStep={1}
          totalSteps={2}
          onStepChange={() => {}}
          onReset={() => {}}
          activeLine={2}
        />
      );

      activeSvgNode = container.querySelector('[data-node-id="node-2"]');
      expect(activeSvgNode?.getAttribute('data-active')).toBe('true');
      const prevSvgNode = container.querySelector('[data-node-id="node-1"]');
      expect(prevSvgNode?.getAttribute('data-active')).toBe('false');
    });
  });
});
