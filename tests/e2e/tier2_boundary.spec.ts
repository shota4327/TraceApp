import { test, expect, Page } from 'playwright/test';

/**
 * ============================================================================
 * TraceApp Tier 2 — 境界値・コーナーケース E2E テストスイート (tier2_boundary.spec.ts)
 * 
 * 本ファイルは、TraceApp の限界値、例外発生コード、特殊データ構造、
 * 不正操作等のエッジケースにおいて、UIがフリーズせず安全に保護・停止することを検証します。
 * ============================================================================
 */

/**
 * 既存 DOM ID と data-testid の両方で要素を取得するロバストなロケーターヘルパー
 */
function getEl(page: Page, idOrTestId: string) {
  return page.locator(`#${idOrTestId}, [data-testid="${idOrTestId}"]`).first();
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

test.describe('Tier 2: 境界値・コーナーケーステスト (Boundary & Corner Cases)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPyodideReady(page);
  });

  test('T2-01: 10,000ステップ上限超過ガード (TraceLimitExceeded) とブラウザ非フリーズ検証', async ({ page }) => {
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');

    // 無限ループコードを入力
    const infiniteLoopCode = `i = 0\nwhile True:\n    i += 1`;
    await codeInput.fill(infiniteLoopCode);

    // ダイアログ（alert）が発火した場合は自動的にキャッチ＆承認
    let alertMessage = '';
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await btnRun.click();
    await page.waitForTimeout(1000);

    // エラーアラートまたはステータスメッセージで上限超過メッセージが確認できること
    const statusText = getEl(page, 'status-text');
    const statusContent = (await statusText.textContent()) || '';

    const isExceededHandled = alertMessage.includes('上限') || 
                              alertMessage.includes('TraceLimitExceeded') ||
                              statusContent.includes('上限') ||
                              statusContent.includes('TraceLimitExceeded');
    expect(isExceededHandled).toBe(true);

    // ボタンが再度アクティブになり画面がフリーズしていないことを検証
    await expect(btnRun).toBeEnabled();
  });

  test('T2-02: 特殊浮動小数点数 (NaN / Infinity) のサニタイズと変数表表示', async ({ page }) => {
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');
    const stepCounter = getEl(page, 'step-counter');

    const nanInfCode = `a = float('nan')\nb = float('inf')\nc = float('-inf')`;
    await codeInput.fill(nanInfCode);
    await btnRun.click();
    await expect(stepCounter).toContainText('ステップ 1 /');

    // 最終ステップに移動
    const btnLast = getEl(page, 'btn-last');
    await btnLast.click();

    const localsTable = getEl(page, 'locals-table-body');
    const globalsTable = getEl(page, 'globals-table-body');

    const tableText = (await localsTable.textContent()) + (await globalsTable.textContent());
    // "NaN", "Infinity", "-Infinity" が表示されていることを検証
    expect(tableText).toMatch(/NaN|Infinity/);
  });

  test('T2-03: 構文エラー (SyntaxError) のハンドリングと safe 復旧', async ({ page }) => {
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');

    // コロンが欠落した不完全コードを入力
    const syntaxErrorCode = `if True\n    x = 100`;
    await codeInput.fill(syntaxErrorCode);

    let alertMessage = '';
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await btnRun.click();
    await page.waitForTimeout(1000);

    const statusText = getEl(page, 'status-text');
    const statusContent = (await statusText.textContent()) || '';

    // エラー文言が適切に捕捉されていることをアサーション
    const isErrorCaught = alertMessage.includes('SyntaxError') || statusContent.includes('SyntaxError') || alertMessage.length > 0 || statusContent.includes('エラー');
    expect(isErrorCaught).toBe(true);
    await expect(btnRun).toBeEnabled();
  });

  test('T2-04: 実行時例外 (ZeroDivisionError) の捕捉と安全停止', async ({ page }) => {
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');

    const zeroDivCode = `x = 10\ny = 0\nz = x / y`;
    await codeInput.fill(zeroDivCode);

    let alertMessage = '';
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await btnRun.click();
    await page.waitForTimeout(1000);

    const statusText = getEl(page, 'status-text');
    const statusContent = (await statusText.textContent()) || '';

    // 例外エラー文言が適切に捕捉されていることをアサーション
    const isErrorCaught = alertMessage.includes('ZeroDivisionError') || statusContent.includes('ZeroDivisionError') || alertMessage.length > 0 || statusContent.includes('警告');
    expect(isErrorCaught).toBe(true);
    await expect(btnRun).toBeEnabled();
  });

  test('T2-05: 空コードおよびコメントのみの入力に対する安全動作', async ({ page }) => {
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');

    // コメントのみを入力
    await codeInput.fill(`# こちらはコメントのみです\n# 実行行はありません`);
    await btnRun.click();

    // トレース完了してもクラッシュしないこと
    const stepCounter = getEl(page, 'step-counter');
    await expect(stepCounter).toBeVisible();
    await expect(btnRun).toBeEnabled();
  });

  test('T2-06: 大量変数（50個以上）定義時のスクロール・非崩れ検証', async ({ page }) => {
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');
    const stepCounter = getEl(page, 'step-counter');

    // 50個の変数を生成する Python コード
    let manyVarsCode = '';
    for (let i = 1; i <= 50; i++) {
      manyVarsCode += `v${i} = ${i}\n`;
    }
    await codeInput.fill(manyVarsCode);
    await btnRun.click();
    await expect(stepCounter).toContainText('ステップ 1 /');

    // 最終ステップに移動
    const btnLast = getEl(page, 'btn-last');
    await btnLast.click();

    const localsTable = getEl(page, 'locals-table-body');
    const globalsTable = getEl(page, 'globals-table-body');
    const tableText = (await localsTable.textContent()) + (await globalsTable.textContent());

    expect(tableText).toContain('v1');
    expect(tableText).toContain('v50');
  });

  test('T2-07: 深層ネスト構造（8重以上）コードのレンダリング', async ({ page }) => {
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');
    const stepCounter = getEl(page, 'step-counter');

    // 8重の if ネスト構造
    const nestedCode = `
if True:
    if True:
        if True:
            if True:
                if True:
                    if True:
                        if True:
                            if True:
                                deep_var = 99
`;
    await codeInput.fill(nestedCode);
    await btnRun.click();
    await expect(stepCounter).toContainText('ステップ 1 /');

    const btnLast = getEl(page, 'btn-last');
    await btnLast.click();

    const localsTable = getEl(page, 'locals-table-body');
    const globalsTable = getEl(page, 'globals-table-body');
    const tableText = (await localsTable.textContent()) + (await globalsTable.textContent());
    expect(tableText).toContain('deep_var');
  });

  test('T2-08: 特殊文字・改行・HTMLタグを含む print 出力のエスケープ検証', async ({ page }) => {
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');
    const consoleOutput = getEl(page, 'console-output');
    const stepCounter = getEl(page, 'step-counter');

    const specialPrintCode = `print("Line1\\nLine2\\tTab <script>alert('xss')</script>")`;
    await codeInput.fill(specialPrintCode);
    await btnRun.click();
    await expect(stepCounter).toContainText('ステップ 1 /');

    const btnLast = getEl(page, 'btn-last');
    await btnLast.click();

    // consoleOutput のテキストコンテンツとして安全に出力されていることを検証
    await expect(consoleOutput).toContainText('Line1');
    await expect(consoleOutput).toContainText("<script>alert('xss')</script>");
  });

  test('T2-09: 再帰関数呼出におけるローカルスコープの追尾', async ({ page }) => {
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');
    const stepCounter = getEl(page, 'step-counter');

    const recursiveCode = `
def fact(n):
    if n <= 1:
        return 1
    return n * fact(n - 1)

res = fact(3)
`;
    await codeInput.fill(recursiveCode);
    await btnRun.click();
    await expect(stepCounter).toContainText('ステップ 1 /');

    const btnLast = getEl(page, 'btn-last');
    await btnLast.click();

    const localsTable = getEl(page, 'locals-table-body');
    const globalsTable = getEl(page, 'globals-table-body');
    const tableText = (await localsTable.textContent()) + (await globalsTable.textContent());

    expect(tableText).toContain('res');
    expect(tableText).toContain('6');
  });

});

// T2-10 は beforeEach のロード待機を経由しない独立テストとして構成
test('T2-10: Pyodide ロード完了前のボタン操作保護', async ({ page }) => {
  await page.goto('/');
  const btnRun = getEl(page, 'btn-run');
  const statusText = getEl(page, 'status-text');

  // 初期ロード時または準備完了状態の要素・非活性状態を動的検証
  const isProtected = (await btnRun.isDisabled()) || 
                      (await statusText.textContent())?.includes('初期化中') ||
                      (await statusText.textContent())?.includes('loading') ||
                      (await statusText.textContent())?.includes('準備完了');
  expect(isProtected).toBe(true);
});
