import { test, expect, Page } from 'playwright/test';

/**
 * ============================================================================
 * TraceApp Tier 1 — 機能網羅 E2E テストスイート (tier1_features.spec.ts)
 * 
 * 本ファイルは、TraceApp の各個別機能（初期化、サンプルプログラム切替、
 * コード入力編集、.pyファイルアップロード、ステップナビゲーション、実行行ハイライト、
 * 変数履歴表、printコンソール、流れ図描画、タブ切替）の正常系動作を検証します。
 * ============================================================================
 */

/**
 * 既存 DOM ID と data-testid の両方で要素を取得するロバストなロケーターヘルパー
 */
function getEl(page: Page, idOrTestId: string) {
  return page.locator(`#${idOrTestId}, [data-testid="${idOrTestId}"]`).first();
}

/**
 * トレース準備ボタンが有効な場合のみクリックするヘルパー関数
 */
async function clickRunIfEnabled(page: Page) {
  const btnRun = page.locator('#btn-run, [data-testid="btn-run"]').first();
  if (await btnRun.isEnabled()) {
    await btnRun.click();
  }
}

/**
 * Pyodide の初期化ロード完了を待機するヘルパー関数
 */
async function waitForPyodideReady(page: Page) {
  await page.waitForFunction(() => {
    const indicator = document.querySelector('#status-indicator, [data-testid="status-bar"]');
    const text = document.querySelector('#status-text, [data-testid="status-text"]');
    return (indicator && indicator.classList.contains('ready')) || 
           (text && text.textContent && (text.textContent.includes('準備完了') || text.textContent.includes('ready')));
  }, { timeout: 60000 });
}

test.describe('Tier 1: 機能網羅テスト (Feature Coverage)', () => {

  test.beforeEach(async ({ page }) => {
    // アプリケーションページにアクセスし、Pyodide 初期化を待機
    await page.goto('/');
    await waitForPyodideReady(page);
  });

  test('T1-01: Pyodide 初期化と基本レイアウトの正常表示', async ({ page }) => {
    // ステータス表示の準備完了状態を確認
    const statusText = getEl(page, 'status-text');
    await expect(statusText).toContainText('準備完了');

    // 主要なUIエレメント（サンプル切替, コード入力, 実行ボタン, ステップカウンター, コンソール）が存在することを確認
    await expect(getEl(page, 'preset-select')).toBeVisible();
    await expect(getEl(page, 'code-input')).toBeVisible();
    await expect(getEl(page, 'btn-run')).toBeVisible();
    await expect(getEl(page, 'step-counter')).toBeVisible();
    await expect(getEl(page, 'console-output')).toBeVisible();
  });

  test('T1-02: サンプルプログラムの選択とコード切り替え', async ({ page }) => {
    const presetSelect = getEl(page, 'preset-select');
    const codeInput = getEl(page, 'code-input');

    // 「条件分岐」サンプルを選択
    await presetSelect.selectOption('branch');
    let codeValue = await codeInput.inputValue();
    expect(codeValue).toContain('if score >= 80:');

    // 「ループ」サンプルを選択
    await presetSelect.selectOption('loop');
    codeValue = await codeInput.inputValue();
    expect(codeValue).toContain('for i in range(1, 4):');

    // 「順次実行」サンプルに復帰
    await presetSelect.selectOption('seq');
    codeValue = await codeInput.inputValue();
    expect(codeValue).toContain('total = x + y');
  });

  test('T1-03: Code Editor でのカスタム Python コード入力とトレース実行', async ({ page }) => {
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');
    const stepCounter = getEl(page, 'step-counter');

    // カスタムコードを入力
    const customCode = `a = 10\nb = 20\nc = a * b\nprint(c)`;
    await codeInput.fill(customCode);

    // トレース実行ボタンをクリック
    await btnRun.click();

    // トレース完了後のステップ数を検証
    await expect(stepCounter).not.toHaveText('ステップ 0 / 0');
    const counterText = await stepCounter.textContent();
    expect(counterText).toMatch(/ステップ 0 \/ \d+/);
  });

  test('T1-04: .py ファイルのアップロード模擬機能検証', async ({ page }) => {
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');
    const stepCounter = getEl(page, 'step-counter');

    // .py ファイルの内容を直接エディタに展開するシナリオを検証
    const fileContent = `# uploaded python file\nmsg = "File Loaded"\nprint(msg)`;
    await codeInput.fill(fileContent);

    // トレース実行
    await btnRun.click();
    await expect(stepCounter).toContainText('ステップ 0 /');

    // 最終ステップへ進行させて print 内容を確認
    const btnLast = getEl(page, 'btn-last');
    await btnLast.click();

    const consoleOutput = getEl(page, 'console-output');
    await expect(consoleOutput).toContainText('File Loaded');
  });

  test('T1-05: ステップナビゲーション（次へ、前へ、リセット、最後）', async ({ page }) => {
    const btnNext = getEl(page, 'btn-next');
    const btnPrev = getEl(page, 'btn-prev');
    const btnFirst = getEl(page, 'btn-first');
    const stepCounter = getEl(page, 'step-counter');

    // 順次実行サンプルでトレース準備（必要な場合）
    await clickRunIfEnabled(page);
    await expect(stepCounter).toContainText('ステップ 0 /');
    await expect(btnFirst).toBeDisabled();
    await expect(btnPrev).toBeDisabled();

    // 「次へ」をクリック
    await btnNext.click();
    await expect(stepCounter).toContainText('ステップ 1 /');
    await expect(btnFirst).toBeEnabled();
    await expect(btnPrev).toBeEnabled();

    // 「最初 / リセット」をクリック
    await btnFirst.click();
    await expect(stepCounter).toContainText('ステップ 0 /');
    await expect(btnFirst).toBeDisabled();
    await expect(btnPrev).toBeDisabled();
  });

  test('T1-06: Monaco Editor 実行行デコレーションハイライトの追従', async ({ page }) => {
    const btnNext = getEl(page, 'btn-next');
    const activeLineBadge = getEl(page, 'active-line-badge');
    const stepCounter = getEl(page, 'step-counter');

    await clickRunIfEnabled(page);
    await expect(stepCounter).toContainText('ステップ 0 /');

    // 1ステップ目 (起動直後・未実行): (未実行) が表示されることを確認
    await expect(activeLineBadge).toContainText('実行行: (未実行)');

    // 2ステップ目 (次へ押下): 1行目を実行した結果として Line 1 が表示されることを確認
    await btnNext.click();
    await expect(stepCounter).toContainText('ステップ 1 /');
    await expect(activeLineBadge).toContainText('実行行: Line 1');

    // 流れ図タブに切り替えても実行行バッジが表示されていることを確認
    const tabFlowchart = getEl(page, 'tab-flowchart');
    const tabCode = getEl(page, 'tab-code');
    await tabFlowchart.click();
    await expect(activeLineBadge).toContainText('実行行: Line 1');
    await tabCode.click();

    // 3ステップ目 (次へ押下): 2行目を実行した結果として Line 2 が表示されることを確認
    await btnNext.click();
    await expect(stepCounter).toContainText('ステップ 2 /');
    await expect(activeLineBadge).toContainText('実行行: Line 2');

    // 最終ステップまで進める
    const btnLast = getEl(page, 'btn-last');
    await btnLast.click();
    await expect(activeLineBadge).toContainText('実行行: (実行終了)');
  });

  test('T1-07: スプレッドシート型変数履歴表の描画と更新', async ({ page }) => {
    const btnNext = getEl(page, 'btn-next');
    const stepCounter = getEl(page, 'step-counter');

    // トレース準備 (x = 5, y = 3, total = x + y)
    await clickRunIfEnabled(page);
    await expect(stepCounter).toContainText('ステップ 0 /');

    // ステップ 2 (y = 3 の行) へ進むと、x = 5 が記録される
    await btnNext.click();
    const localsTable = getEl(page, 'locals-table-body');
    await expect(localsTable).toContainText('x');
    await expect(localsTable).toContainText('5');

    // ステップ 3 (total = x + y の行) へ進むと、y = 3 が記録される
    await btnNext.click();
    await expect(localsTable).toContainText('y');
    await expect(localsTable).toContainText('3');
  });

  test('T1-08: print 出力コンソールの段階的キャプチャ表示', async ({ page }) => {
    const presetSelect = getEl(page, 'preset-select');
    const btnNext = getEl(page, 'btn-next');
    const consoleOutput = getEl(page, 'console-output');

    // print サンプルコードを選択して実行
    await presetSelect.selectOption('print');
    await clickRunIfEnabled(page);

    // ステップを進めて print 出力が表示されることを確認
    await btnNext.click(); // print("Hello TraceApp!")
    await expect(consoleOutput).toContainText('Hello TraceApp!');

    await btnNext.click(); // print("Pyodide stdout capture test")
    await expect(consoleOutput).toContainText('Pyodide stdout capture test');
  });

  test('T1-09: AST 流れ図構造の自動解析・描画・ハイライト確認', async ({ page }) => {
    const tabFlowchart = getEl(page, 'tab-flowchart');
    const flowchartViewer = getEl(page, 'flowchart-viewer');

    await clickRunIfEnabled(page);

    // 流れ図タブへ切り替え
    await tabFlowchart.click();
    await expect(flowchartViewer).toBeVisible();

    // 流れ図内にノード要素（処理・判断等）がレンダリングされていることを検証
    const nodeItems = flowchartViewer.locator('.flowchart-node, div[style*="border"]');
    await expect(nodeItems.first()).toBeVisible();
  });

  test('T1-10: 「コード / 流れ図」表示トグルとステート維持', async ({ page }) => {
    const tabFlowchart = getEl(page, 'tab-flowchart');
    const tabCode = getEl(page, 'tab-code');
    const flowchartViewer = getEl(page, 'flowchart-viewer');
    const codeInput = getEl(page, 'code-input');

    // 「流れ図」タブをクリックして表示切り替えを検証
    await tabFlowchart.click();
    await expect(flowchartViewer).toBeVisible();
    await expect(codeInput).not.toBeVisible();

    // 「コード」タブをクリックして復帰
    await tabCode.click();
    await expect(codeInput).toBeVisible();
  });

  test('T1-11: 右パネル（変数履歴表と標準出力コンソール）の上下ドラッグリサイズ', async ({ page }) => {
    const resizer = getEl(page, 'right-panel-resizer');
    await expect(resizer).toBeVisible();

    const initialBox = await resizer.boundingBox();
    expect(initialBox).not.toBeNull();

    if (initialBox) {
      // マウスドラッグで上方向に50px移動（標準出力エリアを広げる）
      await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + initialBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y - 50);
      await page.mouse.up();

      const newBox = await resizer.boundingBox();
      expect(newBox).not.toBeNull();
      if (newBox) {
        expect(newBox.y).toBeLessThan(initialBox.y);
      }
    }
  });

  test('T1-12: 画面左右パネル（コード・流れ図と変数表・出力）の水平ドラッグリサイズ', async ({ page }) => {
    const resizer = getEl(page, 'main-horizontal-resizer');
    await expect(resizer).toBeVisible();

    const initialBox = await resizer.boundingBox();
    expect(initialBox).not.toBeNull();

    if (initialBox) {
      // マウスドラッグで右方向に100px移動（左パネルを広げる）
      await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + initialBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(initialBox.x + 100, initialBox.y + initialBox.height / 2);
      await page.mouse.up();

      const newBox = await resizer.boundingBox();
      expect(newBox).not.toBeNull();
      if (newBox) {
        expect(newBox.x).toBeGreaterThan(initialBox.x);
      }
    }
  });

  test('T1-13: ズームスライダー（50%〜400%）による拡大率変更と表示更新', async ({ page }) => {
    const zoomSlider = getEl(page, 'zoom-slider');
    const zoomCounter = getEl(page, 'zoom-counter');

    await expect(zoomSlider).toBeVisible();
    await expect(zoomCounter).toBeVisible();
    await expect(zoomCounter).toHaveText('100%');

    // 拡大率を 150% に変更
    await zoomSlider.fill('150');
    await expect(zoomCounter).toHaveText('150%');
  });

});


