# DISPATCH — auditor_1

- **Role**: Forensic Auditor (`teamwork_preview_auditor`)
- **Working Directory**: `c:\Git\TraceApp\.agents\sub_orch_m1\auditor_1`
- **Scope**: Milestone 1 実装の正当性・フォレンジック監査

## Inputs
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md`
- `c:\Git\TraceApp\PROJECT.md`
- `c:\Git\TraceApp\.agents\sub_orch_m1\SCOPE.md`
- `c:\Git\TraceApp\.agents\sub_orch_m1\worker_1\handoff.md`

## Focus
1. ワークスペース `c:\Git\TraceApp` 配下のすべてのソースコードおよびテストコードにおいて、ダミー実装、ハードコードされた偽のテスト結果、偽造されたログ、不誠実な迂回処理が存在しないかを精査・監査してください。
2. 判定結果 (`CLEAN` または `INTEGRITY VIOLATION`) を詳細な証拠とともに `c:\Git\TraceApp\.agents\sub_orch_m1\auditor_1\handoff.md` に全日本語で出力し、親オーケストレーターへ報告してください。
