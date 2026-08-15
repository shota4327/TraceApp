import { test, expect, Page } from 'playwright/test';

/**
 * ============================================================================
 * TraceApp Tier 4 — 実用アプリケーションシナリオ E2E テストスイート (tier4_realworld.spec.ts)
 * 
 * 本ファイルは、ORIGINAL_REQUEST.md に定義された3つの検証用テストプログラム、
 * および実世界における学習者のスモールデバッグ演習シナリオを総合的に検証します。
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

test.describe('Tier 4: 実用アプリケーションシナリオ (Real-World Application Scenarios)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPyodideReady(page);
  });

  test('T4-01: 検証用テスト1 — 基本的な順次・代入プログラムのトレース', async ({ page }) => {
    const presetSelect = getEl(page, 'preset-select');
    const btnRun = getEl(page, 'btn-run');
    const btnNext = getEl(page, 'btn-next');
    const btnLast = getEl(page, 'btn-last');
    const localsTable = getEl(page, 'locals-table-body');
    const globalsTable = getEl(page, 'globals-table-body');
    const stepCounter = getEl(page, 'step-counter');

    // テスト1: 順次実行サンプルを選択
    await presetSelect.selectOption('seq');
    await btnRun.click();
    await expect(stepCounter).toContainText('ステップ 1 /');

    // ステップ2: x = 5 が記録される
    await btnNext.click();
    let tableText = (await localsTable.textContent()) + (await globalsTable.textContent());
    expect(tableText).toContain('x');
    expect(tableText).toContain('5');

    // ステップ3: y = 3 が記録される
    await btnNext.click();
    tableText = (await localsTable.textContent()) + (await globalsTable.textContent());
    expect(tableText).toContain('y');
    expect(tableText).toContain('3');

    // ステップ4: total = x + y
    await btnNext.click();
    tableText = (await localsTable.textContent()) + (await globalsTable.textContent());
    expect(tableText).toContain('total');
    expect(tableText).toContain('8');

    // 最終ステップへジャンプし print 結果を確認
    await btnLast.click();
    const consoleOutput = getEl(page, 'console-output');
    await expect(consoleOutput).toContainText('8');
  });

  test('T4-02: 検証用テスト2 — 条件分岐（if / elif / else）の分岐判定追尾', async ({ page }) => {
    const presetSelect = getEl(page, 'preset-select');
    const btnRun = getEl(page, 'btn-run');
    const btnLast = getEl(page, 'btn-last');
    const localsTable = getEl(page, 'locals-table-body');
    const globalsTable = getEl(page, 'globals-table-body');
    const stepCounter = getEl(page, 'step-counter');

    // テスト2: 条件分岐サンプルを選択 (score = 75)
    await presetSelect.selectOption('branch');
    await btnRun.click();
    await expect(stepCounter).toContainText('ステップ 1 /');

    // ステップ進行し、elif score >= 60 が評価され grade = "B" になることを検証
    await btnLast.click();

    const tableText = (await localsTable.textContent()) + (await globalsTable.textContent());
    expect(tableText).toContain('score');
    expect(tableText).toContain('75');
    expect(tableText).toContain('grade');
    expect(tableText).toContain('B');
  });

  test('T4-03: 検証用テスト3 — ループと関数呼び出し（def add / for ループ）の推移可視化', async ({ page }) => {
    const presetSelect = getEl(page, 'preset-select');
    const btnRun = getEl(page, 'btn-run');
    const btnLast = getEl(page, 'btn-last');
    const localsTable = getEl(page, 'locals-table-body');
    const globalsTable = getEl(page, 'globals-table-body');
    const stepCounter = getEl(page, 'step-counter');

    // テスト3: ループサンプルを選択
    await presetSelect.selectOption('loop');
    await btnRun.click();
    await expect(stepCounter).toContainText('ステップ 1 /');

    // 最終結果 total = 6 に到達することを確認
    await btnLast.click();

    const tableText = (await localsTable.textContent()) + (await globalsTable.textContent());
    expect(tableText).toContain('total');
    expect(tableText).toContain('6');
  });

  test('T4-04: シナリオ4 — ユーザー学習デバッグ演習（問題コード発見〜修正〜再トレース完了）', async ({ page }) => {
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');
    const btnPrev = getEl(page, 'btn-prev');
    const btnFirst = getEl(page, 'btn-first');
    const btnLast = getEl(page, 'btn-last');
    const consoleOutput = getEl(page, 'console-output');
    const stepCounter = getEl(page, 'step-counter');

    // 1. 誤った計算ロジックを持つコードを入力 (total = 100 * i)
    const buggyCode = `total = 0\nfor i in range(1, 3):\n    total = 100 * i\nprint(f"Final: {total}")`;
    await codeInput.fill(buggyCode);
    await btnRun.click();
    await expect(stepCounter).toContainText('ステップ 1 /');

    // 2. トレースを実行し最終確認
    await btnLast.click();
    await expect(consoleOutput).toContainText('Final: 200');

    // 3. 学習者が「前へ」ボタンで戻り、誤りのあるステップをデバッグ観察
    await btnPrev.click();
    await btnPrev.click();

    // 4. コードを正しい加算ロジック `total = total + i` に修正
    await btnFirst.click();
    const fixedCode = `total = 0\nfor i in range(1, 3):\n    total = total + i\nprint(f"Final: {total}")`;
    await codeInput.fill(fixedCode);

    // 5. 再度トレース実行
    await btnRun.click();
    await expect(stepCounter).toContainText('ステップ 1 /');
    await btnLast.click();

    // 正しい結果 `Final: 3` が出力されていることを確認
    await expect(consoleOutput).toContainText('Final: 3');
  });

});
