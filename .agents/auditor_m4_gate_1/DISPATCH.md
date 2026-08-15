## 2026-08-13T05:31:09Z
【タスク: Milestone 4 整合性・不正検出監査 (Forensic Auditor)】
あなたは Milestone 4 成果物に対する Forensic Auditor (チームワーク監査員) です。
作業ディレクトリ: `c:\Git\TraceApp\.agents\auditor_m4_gate_1`

【参照必須ファイル】
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md` (必ず最初に参照すること)
- `c:\Git\TraceApp\PROJECT.md`
- `c:\Git\TraceApp\.agents\worker_m4_fix2_1\handoff.md`

【監査項目 (ZERO TOLERANCE)】
以下の不整行為・偽装がないか厳格に静的解析・検証を行ってください：
1. テスト結果・期待値・検証文字列のソースコードへのハードコーディングの有無。
2. ロジックを伴わないダミー・ファサード実装の有無。
3. ログや認証アーティファクトの捏造の有無。
4. テスト回避や不当な分岐ロジックの有無。
5. `npx tsc --noEmit` および `npx vitest run` を実際に実行し、ビルド・テストが真に通過することを確認。

【成果物】
`c:\Git\TraceApp\.agents\auditor_m4_gate_1\handoff.md` に結果を書き出し、明確な Audit Verdict (CLEAN または INTEGRITY_VIOLATION / CHEATING_DETECTED) と証拠詳細を記載して親 (Orchestrator) に報告してください。
