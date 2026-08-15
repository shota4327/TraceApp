import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeftPanel } from '../components/LeftPanel';
import { FlowchartViewer } from '../components/FlowchartViewer';
import { generateFlowchartNodes, generateDrawIoXml } from '../services/flowchartGenerator';
import { renderFlowchartSvg } from '../services/flowchartRenderer';
import { FlowchartNode } from '../types/flowchart';

describe('Challenger M4_2: Accessibility, Performance & Edge Case Attacks', () => {

  /**
   * 1. Accessibility (WAI-ARIA) 検証
   */
  describe('Accessibility (WAI-ARIA & Screen Reader) Verification', () => {
    test('LeftPanel tab controls should comply with WAI-ARIA tablist/tab pattern', () => {
      const { container } = render(
        <LeftPanel
          code="x = 1"
          onChangeCode={() => {}}
          currentStep={0}
          totalSteps={1}
          onStepChange={() => {}}
          onReset={() => {}}
        />
      );

      // tablist ロールの有無
      const tablist = container.querySelector('[role="tablist"]');
      expect(tablist, 'LeftPanel tab container should have role="tablist"').not.toBeNull();

      // tab ロールおよび aria-selected 属性
      const codeTab = screen.getByTestId('tab-code');
      const flowchartTab = screen.getByTestId('tab-flowchart');

      expect(codeTab.getAttribute('role')).toBe('tab');
      expect(flowchartTab.getAttribute('role')).toBe('tab');
      expect(codeTab.getAttribute('aria-selected')).toBe('true');
      expect(flowchartTab.getAttribute('aria-selected')).toBe('false');

      // aria-controls 属性の有無
      expect(codeTab.getAttribute('aria-controls')).toBeTruthy();
      expect(flowchartTab.getAttribute('aria-controls')).toBeTruthy();
    });

    test('FlowchartViewer SVG and nodes should have accessibility attributes (role="img", aria-label, etc.)', () => {
      const sampleNodes: FlowchartNode[] = [
        { id: 'node-start', type: 'terminal', label: '開始', lineRange: [1, 1] },
        { id: 'node-1', type: 'process', label: 'x = 1', lineRange: [1, 1] },
        { id: 'node-end', type: 'terminal', label: '終了', lineRange: [2, 2] },
      ];

      const { container } = render(<FlowchartViewer nodes={sampleNodes} activeLine={1} code="x = 1" />);

      const svgElement = container.querySelector('svg');
      expect(svgElement, 'Flowchart SVG should exist').not.toBeNull();
      expect(svgElement?.getAttribute('role'), 'SVG should have role="img"').toBe('img');
      expect(svgElement?.getAttribute('aria-label'), 'SVG should have descriptive aria-label').toBeTruthy();

      // 各ノード (<g>) がスクリーンリーダーやフォーカスに対応しているか
      const nodeGroups = container.querySelectorAll('.flowchart-node');
      expect(nodeGroups.length).toBe(3);

      nodeGroups.forEach((g) => {
        expect(g.getAttribute('aria-label') || g.getAttribute('role'), 'Flowchart node should have aria-label or role').toBeTruthy();
      });
    });
  });

  /**
   * 2. UI タブ切り替えストレステスト & DOM アンマウント検証
   */
  describe('Tab Switching Stress & State Persistence', () => {
    test('Rapid tab switching (100 iterations) should be stable without throw', () => {
      const { getByTestId } = render(
        <LeftPanel
          code="x = 10\ny = 20\ntotal = x + y"
          onChangeCode={() => {}}
          currentStep={1}
          totalSteps={3}
          onStepChange={() => {}}
          onReset={() => {}}
          activeLine={2}
        />
      );

      const codeTab = getByTestId('tab-code');
      const flowchartTab = getByTestId('tab-flowchart');

      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        fireEvent.click(flowchartTab);
        fireEvent.click(codeTab);
      }
      const endTime = performance.now();

      // 100回の切り替えが 1500ms 以内に完了すること
      const duration = endTime - startTime;
      expect(duration, `100 tab switches took ${duration}ms`).toBeLessThan(1500);
    });
  });

  /**
   * 3. ハイライト更新パフォーマンス・ストレステスト (Performance Benchmark)
   */
  describe('Highlight Updating Performance Benchmark', () => {
    test('SVG rendering performance with large flowchart (100 nodes, 1000 highlight updates)', () => {
      const largeNodes: FlowchartNode[] = [
        { id: 'node-start', type: 'terminal', label: '開始', lineRange: [1, 1] }
      ];

      for (let i = 1; i <= 98; i++) {
        largeNodes.push({
          id: `node-${i}`,
          type: i % 3 === 0 ? 'decision' : i % 5 === 0 ? 'loop' : 'process',
          label: `Operation step line ${i}`,
          lineRange: [i, i]
        });
      }
      largeNodes.push({ id: 'node-end', type: 'terminal', label: '終了', lineRange: [99, 99] });

      const startTime = performance.now();
      for (let step = 1; step <= 1000; step++) {
        const activeLine = (step % 98) + 1;
        renderFlowchartSvg(largeNodes, { activeLine });
      }
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgPerUpdate = totalTime / 1000;

      expect(avgPerUpdate, `Average SVG render time per update: ${avgPerUpdate.toFixed(3)}ms (Total: ${totalTime.toFixed(1)}ms)`).toBeLessThan(2.0);
    });
  });

  /**
   * 4. TSフォールバック parser の誤検知バグ攻撃 (String & Comment Misidentification)
   */
  describe('Fallback Parser False Positive Attacks', () => {
    test('generateFlowchartNodes should NOT misidentify def/if in strings or comments', () => {
      const codeWithLiteralKeywords = [
        'msg = "def hello(): if x > 0: return True"',
        '# if debug_mode: print("def dummy():")'
      ].join('\n');

      const nodes = generateFlowchartNodes(codeWithLiteralKeywords);

      const innerNodes = nodes.filter(n => n.type !== 'terminal');
      
      innerNodes.forEach(node => {
        expect(node.type, `Line "${node.label}" should be 'process' but got '${node.type}'`).toBe('process');
      });
    });
  });

  /**
   * 5. XML エスケープ & 特殊文字構造崩壊攻撃 (XML Injection / Malformed XML Attack)
   */
  describe('XML Escape & Injection Attack', () => {
    test('generateDrawIoXml must produce strictly valid XML even with malicious or quotes/brackets in labels', () => {
      const maliciousNodes: FlowchartNode[] = [
        {
          id: 'node-1',
          type: 'process',
          label: 'x = "<script>alert(1)</script> & \'hello\' "',
          lineRange: [1, 1],
        }
      ];

      const xml = generateDrawIoXml(maliciousNodes);

      expect(xml).not.toMatch(/<script>/);
      expect(xml).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &apos;hello&apos; ');

      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const parseError = doc.querySelector('parsererror');
      expect(parseError, `Generated XML had parse errors: ${parseError?.textContent}`).toBeNull();
    });
  });
});
