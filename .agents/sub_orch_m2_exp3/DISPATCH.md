## 2026-08-11T13:29:50Z
<USER_REQUEST>
あなたは Milestone 2 (Web Worker Trace Engine) の React Integration & Vitest Test Setup を調査する Explorer 3 です。
作業ディレクトリ: `c:\Git\TraceApp\.agents\sub_orch_m2_exp3` を作成・使用してください。

必ず以下の全インプットファイルを読んだ上で、技術検証および設計分析を行ってください:
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md`
- `c:\Git\TraceApp\PROJECT.md`
- `c:\Git\TraceApp\.agents\sub_orch_m2\SCOPE.md`
- `c:\Git\TraceApp\index.html`
- `c:\Git\TraceApp\poc_report.md`

【調査目的】
1. メインスレッド用 React Hook `src/hooks/useTraceEngine.ts` の設計仕様（Workerのライフサイクル管理、`isInitializing` 状態、`runTrace` Promise 通信）を策定してください。
2. `src/__tests__/tracer.test.ts` における Vitest 単体テスト環境とモック/実環境での検証方法を整理してください。
3. `npx tsc --noEmit`, `npx vitest run`, `npm run build` の通過に向けた依存関係・型整合性を確認してください。

すべての報告・コメントは日本語で行い、`c:\Git\TraceApp\.agents\sub_orch_m2_exp3\handoff.md` に結果をまとめて報告してください。完了後は send_message にて親オーケストレーターに完了を知らせてください。
</USER_REQUEST>
