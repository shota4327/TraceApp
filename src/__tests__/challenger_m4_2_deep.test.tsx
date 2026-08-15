import { describe, test, expect } from 'vitest';
import { isNodeActive } from '../services/flowchartRenderer';
import { FlowchartNode } from '../types/flowchart';
import fs from 'fs';
import path from 'path';

describe('Challenger M4_2: Deep Logic & Code Quality Audits', () => {

  /**
   * 1. ループ終了ノードの lineRange 重なりによるダブルハイライト防止の検証
   */
  test('Loop end node sharing lineRange with last loop statement causes simultaneous highlighting', () => {
    const nodes: FlowchartNode[] = [
      { id: 'node-start', type: 'terminal', label: '開始', lineRange: [1, 1] },
      { id: 'node-2', type: 'loop', label: 'for i in range(3)', lineRange: [2, 2] },
      { id: 'node-3', type: 'process', label: 'print(i)', lineRange: [3, 3] },
      { id: 'node-loop-end-3', type: 'loop', label: 'ループ終了', lineRange: [3, 3] },
      { id: 'node-end', type: 'terminal', label: '終了', lineRange: [4, 4] },
    ];

    const activeLine3Nodes = nodes.filter(n => isNodeActive(n, 3));
    
    expect(activeLine3Nodes.length, 'Line 3 should only match print(i) process node').toBe(1);
    expect(activeLine3Nodes.map(n => n.id)).toEqual(['node-3']);
  });

  /**
   * 2. 各関数の行数上限（概ね50行以内）の静的解析チェック
   */
  test('Functions in M4 components/services should adhere to the ~50-line limit constraint', () => {
    const filesToCheck = [
      path.join(process.cwd(), 'src/services/flowchartRenderer.tsx'),
      path.join(process.cwd(), 'src/services/flowchartGenerator.ts'),
      path.join(process.cwd(), 'src/components/FlowchartViewer.tsx'),
      path.join(process.cwd(), 'src/components/LeftPanel.tsx'),
    ];

    const violations: { file: string; functionName: string; lineCount: number }[] = [];

    filesToCheck.forEach((filePath) => {
      if (!fs.existsSync(filePath)) return;
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      let currentFnName: string | null = null;
      let fnStartLine = 0;
      let braceDepth = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] || '';
        const match = line.match(/(?:export\s+)?(?:function\s+([A-Za-z0-9_]+)|const\s+([A-Za-z0-9_]+)\s*=\s*(?:React\.FC|function|\([^)]*\)\s*=>))/);
        
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
            if (lineCount > 60) {
              violations.push({
                file: path.basename(filePath),
                functionName: currentFnName,
                lineCount,
              });
            }
            currentFnName = null;
          }
        }
      }
    });

    console.log('Function Line Count Violations:', violations);
    expect(violations.length, `Found functions exceeding 60 lines: ${JSON.stringify(violations)}`).toBe(0);
  });
});
