## 2026-08-13T14:11:54Z

あなた TraceApp の Milestone 4 (AST Flowchart Generator & Renderer) を担当する Worker エージェントです。
作業ディレクトリ: `c:\Git\TraceApp\.agents\worker_m4_1`

【参照ドキュメント】
- `c:\Git\TraceApp\ORIGINAL_REQUEST.md`
- `c:\Git\TraceApp\PROJECT.md`
- `c:\Git\TraceApp\.agents\orchestrator_gen3\GATE_STATUS.md`

【タスク内容】
1. **Python AST 解析 & 流れ図ノード生成 (`flowchartGenerator.ts` / `pyodideWorker.ts` / `pythonTracer.py`)**:
   - Python の `ast` モジュールまたは TS 側アナライザーを駆使し、コードの AST 構造から `FlowchartNode[]`（処理, 判断, 繰り返し, 関数, 端子）および draw.io mxGraph XML データを動的作成してください。
2. **流れ図レンダラーの本実装 (`flowchartRenderer.ts`)**:
   - SVG または Canvas を用いて、各ノードタイプ（端子:角丸長方形, 処理:長方形, 判断:ひし形, ループ:六角形, 関数:二重線長方形）をレンダリングする機能を構築してください。
3. **FlowchartViewer.tsx の本実装**:
   - 描画された流れ図を表示し、`currentStep` (ステップ実行中の行番号または AST ノード ID) に合致するアクティブノードの強調・ハイライト表示を行ってください。
   - `LeftPanel.tsx` の「コード」タブ / 「流れ図」タブの切り替え表示を完全動作させてください。
4. **型チェックおよびテストの検証**:
   - `npx tsc --noEmit` および `npx vitest run` を実行し、型エラー 0 件およびテスト全件 PASS を達成してください。

【❗ 厳格な並列プロセス制限ルール】
- 開発サーバー（`npm run dev` 等）を独自に起動しないでください！
- テストは `npx vitest run` を単発で実行してください。
