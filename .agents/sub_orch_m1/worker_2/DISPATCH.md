# DISPATCH — worker_2

- **Role**: Worker (`teamwork_preview_worker`)
- **Working Directory**: `c:\Git\TraceApp\.agents\sub_orch_m1\worker_2`
- **Target Repository Root**: `c:\Git\TraceApp`
- **Scope**: Milestone 1 Iteration 2 — 型定義修正と検証

## Mandatory Reference Documents
- `c:\Git\TraceApp\PROJECT.md`
- `c:\Git\TraceApp\.agents\sub_orch_m1\reviewer_2\handoff.md`
- `c:\Git\TraceApp\.agents\sub_orch_m1\explorer_4\analysis.md`

## Mandatory Rules & Quality Standards
- **MANDATORY INTEGRITY WARNING**:
  > DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
- すべてのコードコメントは**日本語**で記述してください。
- TypeScript の `strict: true` 設定で型エラー 0 件であること。

## Target Tasks
1. `src/types/trace.ts` の修正:
   - `import { FlowchartNode } from './flowchart';` を追加。
   - `TraceResult.flowchartNodes?: FlowchartNode[];` に修正（`any[]` を排除）。
   - `VariableSnapshot` を `[varName: string]: any;` に修正。
2. `src/types/index.ts` の作成:
   - `trace.ts`, `flowchart.ts`, `worker.ts` から全型を再エクスポート。
3. 検証の実行:
   - `npx vitest run` (全テスト PASS)
   - `npx tsc --noEmit` (型エラー 0 件)
   - `npm run build` (ビルド成功)

完了後、`c:\Git\TraceApp\.agents\sub_orch_m1\worker_2\handoff.md` に全日本語で結果を出力してください。
