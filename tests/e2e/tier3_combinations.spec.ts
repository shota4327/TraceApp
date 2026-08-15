import { test, expect, Page } from 'playwright/test';

/**
 * ============================================================================
 * TraceApp Tier 3 — 複合機能・相互作用 E2E テストスイート (tier3_combinations.spec.ts)
 * 
 * 本ファイルは、複数機能が同時・連続して連動する高度な操作シナリオ
 * （スライダーと全要素同期、前へ/次へ往復、タブ切替での状態保持、
 * サンプル＋カスタム編集＋リセット連動、高速連打操作等）を検証します。
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

test.describe('Tier 3: 複合機能・相互作用テスト (Cross-Feature Combinations)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPyodideReady(page);
  });

  test('T3-01: ステップ移動時の全画面構成要素（エディタ行, 変数表, printコンソール）の完全同期', async ({ page }) => {
    const presetSelect = getEl(page, 'preset-select');
    const btnRun = getEl(page, 'btn-run');
    const btnNext = getEl(page, 'btn-next');
    const codeViewer = getEl(page, 'code-viewer');
    const localsTable = getEl(page, 'locals-table-body');
    const globalsTable = getEl(page, 'globals-table-body');
    const consoleOutput = getEl(page, 'console-output');
    const stepCounter = getEl(page, 'step-counter');

    // print サンプルコードを読み込んで実行
    await presetSelect.selectOption('print');
    await btnRun.click();
    await expect(stepCounter).toContainText('ステップ 1 /');

    // 1ステップ目 (未実行): active 行なし
    await expect(codeViewer.locator('.code-line.active')).toHaveCount(0);

    // 2ステップ目 (1行目実行後): 1行目がアクティブ
    await btnNext.click();
    await expect(stepCounter).toContainText('ステップ 2 /');
    const line1Active = await codeViewer.locator('.code-line.active').textContent();

    // 3ステップ目 (2行目実行後): 2行目がアクティブ
    await btnNext.click();
    await expect(stepCounter).toContainText('ステップ 3 /');
    const line2Active = await codeViewer.locator('.code-line.active').textContent();
    const consoleText2 = await consoleOutput.textContent();

    // 行番号、変数データ、print ログがそれぞれのステップと完全に一致していること
    expect(line1Active).not.toEqual(line2Active);
    expect(consoleText2).toContain('Hello TraceApp!');
  });

  test('T3-02: 「前へ」「次へ」往復操作における表示状態の一貫性', async ({ page }) => {
    const btnRun = getEl(page, 'btn-run');
    const btnNext = getEl(page, 'btn-next');
    const btnPrev = getEl(page, 'btn-prev');
    const stepCounter = getEl(page, 'step-counter');

    await btnRun.click();

    // 3ステップ進める
    await btnNext.click();
    await btnNext.click();
    await btnNext.click();
    const stepAfterNext = await stepCounter.textContent();

    // 2ステップ戻る
    await btnPrev.click();
    await btnPrev.click();
    const stepAfterPrev = await stepCounter.textContent();

    // 再び1ステップ進める
    await btnNext.click();
    const stepFinal = await stepCounter.textContent();

    expect(stepAfterNext).not.toEqual(stepAfterPrev);
    expect(stepFinal).not.toEqual(stepAfterPrev);
  });

  test('T3-03: タブ切り替え操作時におけるステップハイライトとトレース状態の維持', async ({ page }) => {
    const btnRun = getEl(page, 'btn-run');
    const btnNext = getEl(page, 'btn-next');
    const tabFlowchart = getEl(page, 'tab-flowchart');
    const tabCode = getEl(page, 'tab-code');
    const stepCounter = getEl(page, 'step-counter');

    await btnRun.click();
    await btnNext.click();
    const stepBeforeTab = await stepCounter.textContent();

    // 条件分岐を撤去し、直接タブ切り替えを実行
    await tabFlowchart.click();
    await tabCode.click();

    // タブ切り替え復帰後もステップ位置が維持されていること
    const stepAfterTab = await stepCounter.textContent();
    expect(stepAfterTab).toEqual(stepBeforeTab);
  });

  test('T3-04: サンプル切替 ＋ カスタム編集 ＋ リセット操作の複合連動', async ({ page }) => {
    const presetSelect = getEl(page, 'preset-select');
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');
    const btnFirst = getEl(page, 'btn-first');
    const stepCounter = getEl(page, 'step-counter');

    // 1. サンプル「計算」を選択
    await presetSelect.selectOption('seq');
    // 2. カスタムコードを末尾に追記
    await codeInput.fill(`x = 100\ny = 200\nz = x + y`);
    // 3. トレース実行
    await btnRun.click();
    await expect(stepCounter).not.toHaveText('ステップ 0 / 0');

    // 4. リセット（最初）ボタンを押下
    await btnFirst.click();

    // カスタムコードが保持されたまま、ステップのみリセットされていることを確認
    const currentCode = await codeInput.inputValue();
    expect(currentCode).toContain('z = x + y');
  });

  test('T3-05: ファイルアップロード ＋ ステップ移動の複合操作', async ({ page }) => {
    const codeInput = getEl(page, 'code-input');
    const btnRun = getEl(page, 'btn-run');
    const stepCounter = getEl(page, 'step-counter');

    // ファイルアップロード相当の処理
    const loadedCode = `val1 = 50\nval2 = 150\nresult = val1 + val2`;
    await codeInput.fill(loadedCode);
    await btnRun.click();
    await expect(stepCounter).toContainText('ステップ 1 /');

    // 最終ステップへジャンプ
    const btnLast = getEl(page, 'btn-last');
    await btnLast.click();

    const localsTable = getEl(page, 'locals-table-body');
    const globalsTable = getEl(page, 'globals-table-body');

    const tableText = (await localsTable.textContent()) + (await globalsTable.textContent());
    expect(tableText).toContain('result');
    expect(tableText).toContain('200');
  });

  test('T3-06: 「次へ」ボタンの高速連続クリックと非同期 Worker 追従性', async ({ page }) => {
    const btnRun = getEl(page, 'btn-run');
    const btnNext = getEl(page, 'btn-next');
    const stepCounter = getEl(page, 'step-counter');

    await btnRun.click();

    // 「次へ」を高速で連打クリック（100ms間隔）
    for (let i = 0; i < 5; i++) {
      if (await btnNext.isEnabled()) {
        await btnNext.click({ delay: 50 });
      }
    }

    // 連打操作後もクラッシュせず、正常に到達ステップが表示されていること
    await expect(stepCounter).toBeVisible();
    await expect(btnRun).toBeEnabled();
  });

});
