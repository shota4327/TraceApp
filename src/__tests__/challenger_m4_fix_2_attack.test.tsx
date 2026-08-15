import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LeftPanel } from '../components/LeftPanel';
import { isNodeActive } from '../services/flowchartRenderer';
import { FlowchartNode } from '../types/flowchart';

describe('Challenger M4 Fix 2: Empirical Verification & Bug Reproduction', () => {

  /**
   * 1. WAI-ARIA aria-controls の参照先 DOM 存在検証 & コンポーネント DOM 共存検証
   */
  describe('WAI-ARIA aria-controls & Tab Panel Coexistence', () => {
    test('Both tab panels must coexist in DOM so aria-controls remains valid and Monaco state is preserved', () => {
      const { container, getByTestId } = render(
        <LeftPanel
          code="x = 1"
          onChangeCode={() => {}}
          currentStep={0}
          totalSteps={1}
          onStepChange={() => {}}
          onReset={() => {}}
        />
      );

      const codeTab = getByTestId('tab-code');
      const flowchartTab = getByTestId('tab-flowchart');

      const codeControlsId = codeTab.getAttribute('aria-controls');
      const flowchartControlsId = flowchartTab.getAttribute('aria-controls');

      expect(codeControlsId).toBe('panel-code');
      expect(flowchartControlsId).toBe('flowchart-viewer');

      // WAI-ARIA 仕様要求: aria-controls の対象要素は DOM 内に同時に存在しなければならない
      const codePanel = container.querySelector(`#${codeControlsId}`);
      const flowchartPanel = container.querySelector(`#${flowchartControlsId}`);

      expect(codePanel, `Element #${codeControlsId} must exist in DOM`).not.toBeNull();
      expect(flowchartPanel, `Element #${flowchartControlsId} must exist in DOM`).not.toBeNull();
    });
  });

  /**
   * 2. 「開始」「終了」端子ノードと 1行目/最終行ステートメントの二重ハイライト検証
   */
  describe('Terminal Node Simultaneous Double Highlighting Bug', () => {
    test('activeLine = 1 must NOT highlight node-start ("開始") simultaneously with line 1 process node', () => {
      const nodes: FlowchartNode[] = [
        { id: 'node-start', type: 'terminal', label: '開始', lineRange: [1, 1] },
        { id: 'node-1', type: 'process', label: 'x = 1', lineRange: [1, 1] },
        { id: 'node-end', type: 'terminal', label: '終了', lineRange: [2, 2] },
      ];

      const activeNodesLine1 = nodes.filter(n => isNodeActive(n, 1));
      
      // Line 1 実行時は 'node-1' のみがアクティブになるべき ('node-start' との二重ハイライトはバグ)
      expect(activeNodesLine1.map(n => n.id), 'activeLine 1 causes simultaneous active state on node-start and node-1').toEqual(['node-1']);
    });

    test('activeLine = lastLine must NOT highlight node-end ("終了") simultaneously with last line process node', () => {
      const nodes: FlowchartNode[] = [
        { id: 'node-start', type: 'terminal', label: '開始', lineRange: [1, 1] },
        { id: 'node-1', type: 'process', label: 'x = 1', lineRange: [1, 1] },
        { id: 'node-2', type: 'process', label: 'print(x)', lineRange: [2, 2] },
        { id: 'node-end', type: 'terminal', label: '終了', lineRange: [2, 2] },
      ];

      const activeNodesLine2 = nodes.filter(n => isNodeActive(n, 2));

      // Line 2 実行時は 'node-2' のみがアクティブになるべき ('node-end' との二重ハイライトはバグ)
      expect(activeNodesLine2.map(n => n.id), 'activeLine 2 causes simultaneous active state on node-2 and node-end').toEqual(['node-2']);
    });
  });
});
