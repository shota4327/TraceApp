import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * dist/index.html 単一ファイルとしての動作検証
 * file:/// プロトコルおよびローカル単一ファイル起動で真っ白にならず正常に動作するかを検証
 */
test('単一 index.html ファイルを直接開いた際の起動およびトレース実行検証', async ({ page }) => {
  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', (err) => console.log('BROWSER ERROR:', err.message));

  const htmlPath = 'file:///' + path.resolve('dist/index.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  // 1. Pyodide 初期化完了および自動初回トレース完了を待機
  const statusText = page.locator('#status-text, [data-testid="status-text"]').first();
  await expect(statusText).toContainText('準備完了', { timeout: 60000 });

  // 2. 初期画面構成要素（エディタ、変数表、コンソール）が表示されていること（真っ白でないこと）
  const header = page.locator('#header, [data-testid="header"]').first();
  const variableTable = page.locator('#variable-table, [data-testid="variable-table"]').first();
  const consoleOutput = page.locator('#console-output, [data-testid="console-output"]').first();
  await expect(header).toBeVisible();
  await expect(variableTable).toBeVisible();
  await expect(consoleOutput).toBeVisible();

  // 3. 初期状態のステップカウンター確認 & 変数履歴表に不要な [L] バッジがないことの確認
  const stepCounter = page.locator('#step-counter, [data-testid="step-counter"]').first();
  await expect(stepCounter).toBeVisible();
  const localBadges = variableTable.locator('span:text-is("L")');
  await expect(localBadges).toHaveCount(0);

  // 4. 「次へ」ボタンでステップ進行
  const btnNext = page.locator('#btn-next, [data-testid="btn-next"]').first();
  await btnNext.click();
  await expect(stepCounter).toContainText('ステップ 1 /');

  // 5. 「前へ」ボタンでステップを戻す
  const btnPrev = page.locator('#btn-prev, [data-testid="btn-prev"]').first();
  await btnPrev.click();
  await expect(stepCounter).toContainText('ステップ 0 /');

  // 6. 「トレース準備」ボタンが無効化（ready状態）であることを確認
  const btnRun = page.locator('#btn-run, [data-testid="btn-run"]').first();
  await expect(btnRun).toBeDisabled();
});
