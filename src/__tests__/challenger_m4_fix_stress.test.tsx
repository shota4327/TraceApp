import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { isNodeActive, renderFlowchartSvg } from '../services/flowchartRenderer';
import { generateFlowchartNodes, generateDrawIoXml } from '../services/flowchartGenerator';
import { LeftPanel } from '../components/LeftPanel';
import { FlowchartViewer } from '../components/FlowchartViewer';
import { FlowchartNode } from '../types/flowchart';
import fs from 'fs';
import path from 'path';

describe('Challenger M4 Fix: Comprehensive Edge Case & Stress Verification Suite', () => {

  /**
   * 1. 関数の行数上限（最大 50 行以内）の厳格な静的解析チェック
   */
  test('All functions in M4 services and components must not exceed 50 lines', () => {
    const filesToCheck = [
      path.join(process.cwd(), 'src/services/flowchartRenderer.tsx'),
      path.join(process.cwd(), 'src/services/flowchartGenerator.ts'),
      path.join(process.cwd(), 'src/components/FlowchartViewer.tsx'),
      path.join(process.cwd(), 'src/components/LeftPanel.tsx'),
    ];

    const violations: { file: string; functionName: string; lineCount: number }[] = [];

    filesToCheck.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      let currentFnName: string | null = null;
      let fnStartLine = 0;
      let braceDepth = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] || '';
        const match = line.match(
          /(?:export\s+)?(?:function\s+([A-Za-z0-9_]+)|const\s+([A-Za-z0-9_]+)\s*=\s*(?:React\.FC|function|\([^)]*\)\s*=>))/
        );

        if (match && !currentFnName) {
          currentFnName = match[1] || match[2] || null;
          fnStartLine = i + 1;
          braceDepth = 0;
        }

        if (currentFnName) {
          for (const char of line) {
            if (char === '{') braceDepth++;
            if (char === '}') braceDepth--;
          }

          if (braceDepth === 0 && (line.includes('}') || line.includes(');'))) {
            const lineCount = i + 1 - fnStartLine + 1;
            if (lineCount > 50) {
              violations.push({
                file: path.relative(process.cwd(), filePath),
                functionName: currentFnName,
                lineCount,
              });
            }
            currentFnName = null;
          }
        }
      }
    });

    expect(
      violations.length,
      `Functions exceeding 50-line limit: ${JSON.stringify(violations, null, 2)}`
    ).toBe(0);
  });

  /**
   * 2. ループ終了ノードの二重ハイライト防止ロジックの検証
   */
  describe('isNodeActive highlighting logic', () => {
    test('Loop end node is excluded from activeLine automatic highlighting', () => {
      const loopEndNode: FlowchartNode = {
        id: 'node-loop-end-5',
        type: 'loop',
        label: 'ループ終了',
        lineRange: [5, 5],
      };

      // activeLine 指定のみの場合は false
      expect(isNodeActive(loopEndNode, 5)).toBe(false);

      // activeNodeId が直接指定された場合は true
      expect(isNodeActive(loopEndNode, 5, 'node-loop-end-5')).toBe(true);
    });

    test('Normal process node highlights on activeLine match', () => {
      const processNode: FlowchartNode = {
        id: 'node-5',
        type: 'process',
        label: 'x = 10',
        lineRange: [5, 5],
      };

      expect(isNodeActive(processNode, 5)).toBe(true);
      expect(isNodeActive(processNode, 4)).toBe(false);
      expect(isNodeActive(processNode, 6)).toBe(false);
    });

    test('Invalid or out-of-order lineRange is safely handled', () => {
      const invalidNode: FlowchartNode = {
        id: 'node-invalid',
        type: 'process',
        label: 'invalid',
        lineRange: [10, 5], // start > end
      };

      expect(isNodeActive(invalidNode, 7)).toBe(false);
    });
  });

  /**
   * 3. 流れ図 AST 生成のエッジケース & ストレス検証
   */
  describe('generateFlowchartNodes edge cases', () => {
    test('Handles empty and whitespace-only code gracefully', () => {
      const nodesEmpty = generateFlowchartNodes('');
      expect(nodesEmpty.length).toBe(2);
      expect(nodesEmpty[0]?.label).toBe('開始');
      expect(nodesEmpty[1]?.label).toBe('終了');

      const nodesWhitespace = generateFlowchartNodes('   \n\n\t  ');
      expect(nodesWhitespace.length).toBe(2);
    });

    test('Escapes XML special characters in labels and xmlSnippet', () => {
      const code = 'if a < 5 and b > 10:\n    print("Hello & World")';
      const nodes = generateFlowchartNodes(code);
      const xml = generateDrawIoXml(nodes);

      expect(xml).toContain('&lt;');
      expect(xml).toContain('&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).not.toContain('< 5');
    });

    test('Classifies nodes correctly for Python constructs', () => {
      const code = [
        'def add(a, b):',
        '    return a + b',
        'if x > 0:',
        '    y = 1',
        'elif x == 0:',
        '    y = 0',
        'else:',
        '    y = -1',
        'while y < 10:',
        '    y += 1',
        'for i in range(3):',
        '    print(i)',
      ].join('\n');

      const nodes = generateFlowchartNodes(code);
      const types = nodes.map((n) => n.type);

      expect(types).toContain('subroutine');
      expect(types).toContain('decision');
      expect(types).toContain('loop');
      expect(types).toContain('process');
    });
  });

  /**
   * 4. SVG レンダラーのストレス・パフォーマンス検証
   */
  test('Renders large flowcharts with 100 nodes without error', () => {
    const largeNodes: FlowchartNode[] = Array.from({ length: 100 }, (_, i) => ({
      id: `node-${i + 1}`,
      type: i % 2 === 0 ? 'process' : 'decision',
      label: `Node ${i + 1}`,
      lineRange: [i + 1, i + 1],
    }));

    const svgElement = renderFlowchartSvg(largeNodes, { activeLine: 50 });
    expect(svgElement).toBeTruthy();
  });

  /**
   * 5. WAI-ARIA アクセシビリティ属性の DOM 検証
   */
  describe('WAI-ARIA Accessibility Attributes', () => {
    test('LeftPanel renders tablist and tabs with correct aria attributes', () => {
      render(
        <LeftPanel
          code="x = 1"
          onChangeCode={() => {}}
          currentStep={0}
          totalSteps={1}
          onStepChange={() => {}}
          onReset={() => {}}
        />
      );

      const tablist = screen.getByRole('tablist', { name: '表示モード切り替え' });
      expect(tablist).toBeDefined();

      const codeTab = screen.getByRole('tab', { name: 'コード(Python)' });
      const flowchartTab = screen.getByRole('tab', { name: '流れ図' });

      expect(codeTab.getAttribute('aria-selected')).toBe('true');
      expect(codeTab.getAttribute('aria-controls')).toBe('panel-code');

      expect(flowchartTab.getAttribute('aria-selected')).toBe('false');
      expect(flowchartTab.getAttribute('aria-controls')).toBe('flowchart-viewer');

      // 流れ図タブに切り替え
      fireEvent.click(flowchartTab);

      expect(flowchartTab.getAttribute('aria-selected')).toBe('true');
      expect(codeTab.getAttribute('aria-selected')).toBe('false');

      const flowchartViewer = screen.getByRole('tabpanel', { name: '流れ図' });
      expect(flowchartViewer).toBeDefined();
      expect(flowchartViewer.getAttribute('aria-labelledby')).toBe('tab-flowchart');
    });

    test('FlowchartViewer renders SVG root with role="img" and nodes with role="graphics-symbol"', () => {
      const nodes: FlowchartNode[] = [
        { id: 'node-start', type: 'terminal', label: '開始', lineRange: [1, 1] },
        { id: 'node-1', type: 'process', label: 'x = 1', lineRange: [1, 1] },
        { id: 'node-end', type: 'terminal', label: '終了', lineRange: [2, 2] },
      ];

      render(<FlowchartViewer nodes={nodes} activeLine={1} />);

      const svgImg = screen.getByRole('img', { name: 'アルゴリズム流れ図' });
      expect(svgImg).toBeDefined();

      const symbols = screen.getAllByRole('graphics-symbol');
      expect(symbols.length).toBe(3);
      expect(symbols[0]?.getAttribute('aria-label')).toBe('ノード 開始 (terminal)');
      expect(symbols[1]?.getAttribute('aria-label')).toBe('ノード x = 1 (process)');
    });
  });
});
