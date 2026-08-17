import { test, expect, Page } from '@playwright/test';

/**
 * 補助関数: 指定した data-testid または id の要素を取得
 */
function getEl(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"], #${testId}`).first();
}

/**
 * 補助関数: Pyodide の初期化完了を待機
 */
async function waitForPyodideReady(page: Page) {
  await page.goto('/');
  await expect(page.locator('#loading-overlay, [data-testid="loading-overlay"]')).toHaveCount(0, { timeout: 30000 });
  const statusIndicator = getEl(page, 'status-indicator');
  await expect(statusIndicator).toBeVisible({ timeout: 15000 });
}

test.describe('条件分岐ブロック (if) の Yes 側複数処理ブロック描画検証', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPyodideReady(page);
  });

  test('Yes 側に3個の処理ブロックがある if 文で、流れ図が崩れず No 合流線が正しく描画されること', async ({ page }) => {
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');
    const tabFlowchart = getEl(page, 'tab-flowchart');
    const flowchartViewer = getEl(page, 'flowchart-viewer');
    const stepCounter = getEl(page, 'step-counter');

    // Yes 側に 3 つの代入処理ブロックがある Python コードを入力
    const customCode = `score = 85
if score >= 80:
    x = 10
    y = 20
    z = 30
print("Finished")`;

    await codeInput.fill(customCode);
    await btnRun.click();
    await expect(stepCounter).toContainText('ステップ 0 /');

    // 「流れ図」タブに切り替え
    await tabFlowchart.click();
    await expect(flowchartViewer).toBeVisible();

    // 流れ図内の SVG 要素の検証
    const svg = flowchartViewer.locator('svg');
    await expect(svg).toBeVisible();

    // 各ノード（開始、1行目、2行目(if)、3行目、4行目、5行目、6行目(print)、終了）が存在すること
    const nodes = flowchartViewer.locator('.flowchart-node');
    await expect(nodes).toHaveCount(8);

    // No (False) 分岐エッジが存在すること
    const falseEdge = flowchartViewer.locator('.edge-false');
    await expect(falseEdge).toBeVisible();

    // No テキストラベルが表示されていること
    const noLabel = falseEdge.locator('text');
    await expect(noLabel).toHaveText('No');

    // エッジのパス (d 属性) が途切れず正常に生成されていること
    const pathD = await falseEdge.locator('path').getAttribute('d');
    expect(pathD).toBeTruthy();
    expect(pathD).toContain('M ');
    expect(pathD).toContain('H ');
    expect(pathD).toContain('V ');
  });
});
