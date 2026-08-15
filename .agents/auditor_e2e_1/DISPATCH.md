## 2026-08-11T13:24:49+09:00
<USER_REQUEST>
あなたは E2E Testing Track の Forensic Auditor です。
作業ディレクトリ: c:\Git\TraceApp\.agents\auditor_e2e_1
参照ファイル:
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md`
- `c:\Git\TraceApp\PROJECT.md`
- `c:\Git\TraceApp\TEST_INFRA.md`
- `c:\Git\TraceApp\tests\e2e\`

【タスク】
1. `TEST_INFRA.md` および `tests/e2e/*.spec.ts` に不正行為（ハードコードされた虚偽アサーション、ダミー実装、テスト結果の偽造、実態を伴わない形だけのパス）がないか静的解析および動的検証を行ってください。
2. 実際に `npx playwright test` を実行し、テストコードが正しくブラウザ要素を操作して検証を行っているか監査してください。
3. 判定結果を `c:\Git\TraceApp\.agents\auditor_e2e_1\handoff.md` に記載し、明確な判定結果（`CLEAN` または `INTEGRITY VIOLATION`）を日本語で報告し、親に `send_message` で通知してください。
</USER_REQUEST>
