# Project: TraceApp

## Architecture
- **Web Worker Layer**: `pyodideWorker.ts` runs Pyodide (v0.26.4), executes Python user code using `sys.settrace()` in `pythonTracer.ts`, captures snapshots, AST flowcharts, and stdout.
- **Service Layer**: `tracer.ts` (TS trace types/utilities), `flowchartGenerator.ts` (CFG and draw.io XML generation), `flowchartRenderer.tsx` (SVG flowchart rendering with SVG shapes and connection arrows), `samplePrograms.ts` (preset Python programs).
- **UI Layer**: `App.tsx` (2-pane split), `Header.tsx` (sample dropdown, file loader), `LeftPanel.tsx` (tab switcher, Monaco Editor, FlowchartViewer, StepNavigation slider/controls), `RightPanel.tsx` (VariableTable spreadsheet view, OutputConsole).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Web Worker Pyodide Async Execution | Pyodide in Web Worker via postMessage, non-blocking UI | M1 | Survey |
| 2 | sys.settrace() Snapshot Engine | Pre-execute all steps, record line, vars, stdout | M1 | Survey |
| 3 | TraceLimitExceeded & Partial Snapshots | Prevent infinite loop with 10k limit and return partial trace | M1 | Survey |
| 4 | Edge Case Sanitization | Handle NaN, Infinity, circular refs without crash | M1 | Survey |
| 5 | Scope-Aware Variable Change Detection | Separate global/local variable scope comparison | M1 | Survey |
| 6 | Flowchart AST CFG Data Model | Tree/Graph structure with nodes, True/False edges, LoopBacks | M2 | Survey |
| 7 | Flowchart SVG Renderer & Highlighting | Draw shapes (rect, diamond, hexagon, double-rect, rounded-rect), arrows, highlight line | M2 | Survey |
| 8 | draw.io mxGraph XML Exporter | Export nodes (vertex) and arrows (edge) in valid draw.io XML | M2 | Survey |
| 9 | 2-Pane UI & Tab Switching | Split 50:50 left (Code/Flowchart tabs), right (Vars/Console) | M3 | Survey |
| 10| Monaco Editor & Line Decoration | Python syntax highlight, edit, D&D upload, line highlight | M3 | Survey |
| 11| Step Navigation & Slider | Prev, Next, Reset, First, Last, Range slider | M3 | Survey |
| 12| Spreadsheet Variable Table & Column Highlight | Spreadsheet view, cell highlight, column highlight, scope badges | M3 | Survey |
| 13| Print Output Console | Chronological stdout cumulative logging | M3 | Survey |
| 14| Preset Sample Programs | 4 presets (Seq, Branch, Loop+Func, Print) dropdown | M3 | Survey |
| 15| Type Safety, Build & E2E Validation | 0 TS errors, clean build, Playwright/Vitest pass, Auditor clean | M4 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Web Worker & Pyodide Engine Hardening | Fix pythonTracer.ts newline split bug, TraceLimitExceeded partial snapshots, event: 'end' step, scope comparison | none | DONE |
| 2 | M2: Flowchart AST CFG Engine & Branch Renderer | CFG tree edges (True/False/LoopBack), SVG branch arrows, draw.io XML edge exporter, FlowchartViewer alignment | M1 | IN_PROGRESS (Pending Gate 2 re-verification) |
| 3 | M3: Variable Table Column Highlight & Scope Badges | VariableTable column highlight, scope badges/colors, TS6133 test import cleanup | M2 | PLANNED |
| 4 | M4: Final Verification, Build, Audit & Handoff | Full typecheck, Vitest, 3 Python test programs verification, Forensic Audit, handoff.md | M3 | PLANNED |

## Interface Contracts
### Main Thread <-> Web Worker Communication
- **WorkerRequest**: `{ type: 'INIT' } | { type: 'RUN_TRACE', code: string, maxSteps?: number }`
- **WorkerResponse**: `{ type: 'INIT_COMPLETE' } | { type: 'INIT_ERROR', error: string } | { type: 'TRACE_SUCCESS', snapshots: StepSnapshot[], flowchart: FlowchartNode[], xml: string, truncated?: boolean } | { type: 'TRACE_ERROR', error: string, partialSnapshots?: StepSnapshot[] }`

### Flowchart CFG Node & Edge Structure
- `FlowchartNode`: `{ id: string, type: FlowchartNodeType, label: string, lineRange?: [number, number], x?: number, y?: number, width?: number, height?: number }`
- `FlowchartEdge`: `{ id: string, sourceId: string, targetId: string, label?: 'True' | 'False' | 'Loop' | 'Next', style?: string }`

## Code Layout
- `src/worker/pythonTracer.ts`: Python Pyodide tracer script
- `src/worker/pyodideWorker.ts`: Web Worker message router
- `src/services/flowchartGenerator.ts`: CFG & draw.io XML generator
- `src/services/flowchartRenderer.tsx`: SVG renderer for flowchart shapes & arrows
- `src/components/VariableTable.tsx`: Variable history table component
- `src/types/flowchart.ts`: Flowchart types and edge definitions
