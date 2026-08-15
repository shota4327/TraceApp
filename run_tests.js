/**
 * TraceApp Phase 1 PoC - テスト実行スクリプト (Node.js + Playwright)
 * 
 * 本スクリプトは以下の自動化処理を行います:
 * 1. Node.js 組み込み `http` モジュールによりローカル HTTP サーバーを起動
 * 2. Playwright (Headless Chromium) を起動し `test_runner.html` にアクセス
 * 3. ブラウザ上のアサーション実行完了 (`window.__TEST_RESULTS__`) を検知
 * 4. コンソールへテスト結果およびログを出力し、合否判定に応じて終了コードを返却
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 8080;
const ROOT_DIR = __dirname;

// Mime type マッピング
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

// 1. ローカル HTTP 静的ファイルサーバーの作成
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(ROOT_DIR, req.url === '/' ? 'index.html' : req.url);
      
      // パストラバーサル対策
      if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('403 Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('404 Not Found');
          return;
        }
        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'text/plain; charset=utf-8';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });

    server.listen(PORT, () => {
      console.log(`[HTTP Server] http://localhost:${PORT} でローカルサーバーを起動しました。`);
      resolve(server);
    });
  });
}

// 2. Playwright による自動テスト実行メイン関数
async function runTests() {
  console.log("=== TraceApp Phase 1 PoC 自動テスト実行開始 ===");

  const server = await startServer();
  let browser = null;
  let exitCode = 0;

  try {
    // Headless Chromium ブラウザの起動
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // ブラウザのコンソールログをリアルタイム転送
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.error(`[Browser Error] ${text}`);
      } else {
        console.log(`[Browser Log] ${text}`);
      }
    });

    page.on('pageerror', err => {
      console.error(`[Browser Uncaught Error] ${err.message}`);
    });

    // test_runner.html へ移動
    const targetUrl = `http://localhost:${PORT}/test_runner.html`;
    console.log(`[Playwright] ${targetUrl} へアクセス中...`);
    await page.goto(targetUrl);

    // テスト結果オブジェクトが設定されるまで待機 (タイムアウト 60秒)
    console.log("[Playwright] Pyodide のロードおよびテスト結果の確定を待機中...");
    await page.waitForFunction(() => window.__TEST_RESULTS__ !== undefined, { timeout: 60000 });

    // テスト結果オブジェクトの取得
    const results = await page.evaluate(() => window.__TEST_RESULTS__);

    console.log("\n==========================================");
    console.log("         自動テスト実行サマリー           ");
    console.log("==========================================");
    console.log(`ステータス: ${results.success ? '成功 (PASS)' : '失敗 (FAIL)'}`);
    console.log(`総テスト数: ${results.total}`);
    console.log(`成功 (PASS): ${results.passed}`);
    console.log(`失敗 (FAIL): ${results.failed}`);
    console.log(`実行時間: ${results.elapsedTime} ms`);
    console.log("------------------------------------------");

    results.details.forEach(test => {
      const symbol = test.passed ? '✔ PASS' : '✖ FAIL';
      console.log(`[${symbol}] [${test.id}] ${test.name}`);
      test.logs.forEach(l => {
        console.log(`   ${l.condition ? '✔' : '✖'} ${l.message}`);
      });
    });

    if (!results.success) {
      exitCode = 1;
    }

  } catch (err) {
    console.error(`[Test Execution Error] テスト実行中に例外が発生しました: ${err.message}`);
    exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
    server.close(() => {
      console.log("[HTTP Server] ローカルサーバーを停止しました。");
    });
    
    process.exit(exitCode);
  }
}

// テスト実行
runTests();
