import { describe, it, expect } from 'vitest';
import type {
  VariableSnapshot,
  StepSnapshot,
  TraceResult,
  FlowchartNodeType,
  FlowchartNode,
} from '../types';

describe('型定義バレルファイル (src/types/index.ts) および型検証', () => {
  it('主要な型が src/types (index.ts) から正常にインポート可能であること', () => {
    const varSnap: VariableSnapshot = { x: 10, name: 'test', flag: true, val: 'NaN' };
    expect(varSnap.x).toBe(10);

    const fcNode: FlowchartNode = {
      id: 'node-1',
      type: 'process',
      label: 'x = 10',
      lineRange: [1, 2],
    };
    expect(fcNode.type).toBe('process');

    const nodeType: FlowchartNodeType = 'decision';
    expect(nodeType).toBe('decision');

    const stepSnap: StepSnapshot = {
      stepIndex: 0,
      line: 1,
      event: 'line',
      globals: varSnap,
      locals: {},
      changedVars: ['x'],
      stdoutDelta: '',
      stdoutCumulative: '',
    };
    expect(stepSnap.stepIndex).toBe(0);

    const traceRes: TraceResult = {
      snapshots: [stepSnap],
      totalSteps: 1,
      stdout: '',
      flowchartNodes: [fcNode],
    };
    expect(traceRes.flowchartNodes).toHaveLength(1);
    expect(traceRes.flowchartNodes?.[0]?.id).toBe('node-1');
  });

  it('TraceResult.flowchartNodes が FlowchartNode[] 型として厳格に型チェックされること', () => {
    const node: FlowchartNode = {
      id: 'node-2',
      type: 'terminal',
      label: 'End',
    };
    const result: TraceResult = {
      snapshots: [],
      totalSteps: 0,
      stdout: '',
      flowchartNodes: [node],
    };

    expect(result.flowchartNodes).toBeDefined();
    expect(result.flowchartNodes?.[0]?.type).toBe('terminal');
  });
});
