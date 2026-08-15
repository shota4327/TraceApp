## 2026-08-13T05:05:12Z
あなた TraceApp の M2/M3 実装を担当する Worker エージェントです。
作業ディレクトリ: `c:\Git\TraceApp\.agents\worker_m2m3_1`

【参照すべきドキュメント】
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md`
- `c:\Git\TraceApp\PROJECT.md`
- `c:\Git\TraceApp\.agents\explorer_survey_1\analysis.md`

【タスク内容】
1. **App.tsx の Pyodide トレースエンジン接続**:
   - 現在 `services/tracer.ts` (同期モック) を使用している `App.tsx` を `useTraceEngine` (Pyodide Worker) に繋ぎ替えてください。
   - Pyodide Worker の初期化中 (`isInitializing === true`) のローディングオーバーレイ UI を表示してください (`data-testid="loading-overlay"` または操作保護)。
2. **MonacoEditor.tsx の本実装**:
   - `@monaco-editor/react` (または既存パッケージ) を組み込み、Python コードエディタを実装してください。
   - トレースステップの `currentLine` (1-indexed) に応じて、Monaco Editor 上の該当行をデコレーション (背景ハイライト等) する機能を実装してください。
   - .py ファイルのドラッグ＆ドロップまたはファイル選択でのコード読み込み機能を接続してください。
3. **UI 各部の接続確認・修正**:
   - `StepNavigation.tsx`, `VariableTable.tsx`, `OutputConsole.tsx` がスナップショットの `stepIndex`, `locals/globals`, `stdoutCumulative` と完全連動して動くようにしてください。
4. **型チェックおよびテストの検証**:
   - 変更後、`npx tsc --noEmit` および `npx vitest run` を実行し、型エラーおよび単体テストがすべて PASS することを確認してください。

【❗ 厳格な並列プロセス制限ルール】
- 開発サーバー（`npm run dev`、`npx vite` 等）を独自に起動しないでください！
- テストは `npx vitest run` を単発で実行してください（watch モード不可）。

【MANDATORY INTEGRITY WARNING】
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

すべての成果とコマンド実行ログを `.agents\worker_m2m3_1\handoff.md` に記録して完了報告を行ってください。日本語で報告してください。
