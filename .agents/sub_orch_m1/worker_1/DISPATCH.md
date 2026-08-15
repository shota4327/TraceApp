# DISPATCH — worker_1

- **Role**: Worker (`teamwork_preview_worker`)
- **Working Directory**: `c:\Git\TraceApp\.agents\sub_orch_m1\worker_1`
- **Target Repository Root**: `c:\Git\TraceApp`
- **Scope**: Milestone 1 — Infrastructure & Basic Project Setup の実装と検証

## Mandatory Reference Documents
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md`
- `c:\Git\TraceApp\PROJECT.md`
- `c:\Git\TraceApp\.agents\sub_orch_m1\SCOPE.md`
- `c:\Git\TraceApp\.agents\sub_orch_m1\explorer_1\analysis.md`

## Mandatory Rules & Quality Standards
- **MANDATORY INTEGRITY WARNING**:
  > DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
- すべてのコードコメント・docstringは**日本語**で記述してください。
- 各関数・コンポーネントは **30〜50行以内** を目安に適度に分割してください。
- TypeScript の `strict: true` 設定で型エラー 0 件であること。
- 設定ファイル以外に `.js`/`.jsx` ファイルを一切作成しないこと。`.ts`/`.tsx` のみを使用すること。
- `.agents/` ディレクトリ配下にはソースコードやテストコードを置かず、メタデータのみを保持すること。

## Target Deliverables & File Boundaries
以下のファイルをリポジトリルート `c:\Git\TraceApp` 配下に作成・構築してください:
1. プロジェクト設定・パッケージ管理:
   - `package.json`
   - `tsconfig.json`
   - `vite.config.ts`
   - `vitest.config.ts`
   - `index.html`
2. 共有型定義:
   - `src/types/trace.ts`
   - `src/types/flowchart.ts`
   - `src/types/worker.ts`
3. サンプルプログラムモジュール:
   - `src/services/samplePrograms.ts`
4. UI レンダリングコンポーネント (ライトモード教科書風デザイン):
   - `src/components/Header.tsx`
   - `src/components/LeftPanel.tsx`
   - `src/components/RightPanel.tsx`
   - `src/components/MonacoEditor.tsx`
   - `src/components/StepNavigation.tsx`
   - `src/components/VariableTable.tsx`
   - `src/components/OutputConsole.tsx`
   - `src/components/FlowchartViewer.tsx`
   - `src/App.tsx`
   - `src/main.tsx`
   - `src/index.css`
5. 単体テスト:
   - `src/__tests__/samplePrograms.test.ts`

## Command Verification Requirements
実装完了後、必ずターミナルで以下のコマンドを実行し、結果をハンドオフレポート `c:\Git\TraceApp\.agents\sub_orch_m1\worker_1\handoff.md` に記録してください:
- `npm install`
- `npx vitest run` (全テスト PASS)
- `npx tsc --noEmit` (型エラー 0 件)
58: 
59: ## 2026-08-11T13:22:54Z
60: あなたは Milestone 1 (Infrastructure & Basic Setup) の Worker です。
61: 作業ディレクトリ: c:\Git\TraceApp\.agents\sub_orch_m1\worker_1
62: 指示書: c:\Git\TraceApp\.agents\sub_orch_m1\worker_1\DISPATCH.md
63: 参考設計書:
64: - c:\Git\TraceApp\ORIGINAL_REQUEST.md
65: - c:\Git\TraceApp\PROJECT.md
66: - c:\Git\TraceApp\.agents\sub_orch_m1\SCOPE.md
67: - c:\Git\TraceApp\.agents\sub_orch_m1\explorer_1\analysis.md

