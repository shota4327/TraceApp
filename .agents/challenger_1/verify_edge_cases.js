/**
 * Challenger 1 Edge Case Verification Script for Pyodide Tracer
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 8081;
const ROOT_DIR = path.resolve(__dirname, '../../');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(ROOT_DIR, req.url === '/' ? 'index.html' : req.url);
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
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain; charset=utf-8' });
        res.end(data);
      });
    });
    server.listen(PORT, () => {
      console.log(`[HTTP Server] Running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function runEdgeCaseTests() {
  console.log("=== Edge Case Empirical Verification Starting ===");
  const server = await startServer();
  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') console.error(`[Browser Error] ${msg.text()}`);
    });

    await page.goto(`http://localhost:${PORT}/index.html`);

    // Pyodide 初期化完了待機
    console.log("Waiting for Pyodide initialization...");
    await page.waitForFunction(() => {
      const el = document.getElementById('status-text');
      return el && el.textContent.includes('Pyodide 準備完了');
    }, { timeout: 60000 });
    console.log("Pyodide Ready in index.html");

    // テストヘルパー関数
    const execTracer = async (codeStr, maxSteps = 2000) => {
      return await page.evaluate(async ({ codeStr, maxSteps }) => {
        // tracer の max_steps を一時変更
        await pyodideInstance.runPythonAsync(`_global_tracer.max_steps = ${maxSteps}`);
        const pyScript = `_global_tracer.run_code(${JSON.stringify(codeStr)})`;
        try {
          const jsonStr = await pyodideInstance.runPythonAsync(pyScript);
          return { success: true, raw: jsonStr, parsed: JSON.parse(jsonStr) };
        } catch (err) {
          return { success: false, error: err.message, stack: err.stack };
        }
      }, { codeStr, maxSteps });
    };

    const results = [];

    // --- TEST 1: Empty variables & Complex Data Types ---
    console.log("\n--- TEST 1: Empty & Complex Variables ---");
    const test1Code = `
empty_str = ""
empty_list = []
empty_dict = {}
empty_tup = ()
none_val = None
unicode_str = "こんにちは 🌟 \\n\\t\\r \\"quoted\\""
byte_val = b"hello"
`;
    const res1 = await execTracer(test1Code);
    console.log("Test 1 Result success:", res1.success);
    if (res1.success) {
      console.log("Test 1 parsed success:", res1.parsed.success);
      const lastGlobals = res1.parsed.steps[res1.parsed.steps.length - 1].globals;
      console.log("Globals captured:", JSON.stringify(lastGlobals, null, 2));
      results.push({ name: "Empty & Complex Variables", pass: res1.parsed.success && lastGlobals.empty_str === "" && lastGlobals.none_val === null });
    } else {
      console.error("Test 1 Error:", res1.error);
      results.push({ name: "Empty & Complex Variables", pass: false, error: res1.error });
    }

    // --- TEST 1B: NaN & Infinity floats ---
    console.log("\n--- TEST 1B: Special Floats (NaN / Inf) ---");
    const test1bCode = `
nan_val = float('nan')
inf_val = float('inf')
ninf_val = float('-inf')
`;
    const res1b = await execTracer(test1bCode);
    console.log("Test 1B Result success:", res1b.success);
    if (!res1b.success) {
      console.log("Test 1B JS evaluation crashed as predicted:", res1b.error);
      results.push({ name: "Special Floats (NaN/Inf)", pass: false, bug: "JSON.parse failed due to Python json.dumps outputting NaN/Infinity without quotes" });
    } else {
      console.log("Test 1B parsed success:", res1b.parsed.success);
      results.push({ name: "Special Floats (NaN/Inf)", pass: true });
    }

    // --- TEST 1C: Circular Reference ---
    console.log("\n--- TEST 1C: Circular Reference ---");
    const test1cCode = `
a = []
a.append(a)
`;
    const res1c = await execTracer(test1cCode);
    console.log("Test 1C Result success:", res1c.success);
    if (!res1c.success || !res1c.parsed.success) {
      console.log("Test 1C failed/crashed as predicted:", res1c.error || res1c.parsed.error);
      results.push({ name: "Circular Reference Handling", pass: false, bug: "ValueError in json.dumps is not caught by except (TypeError, OverflowError)" });
    } else {
      console.log("Test 1C handled circular ref successfully");
      results.push({ name: "Circular Reference Handling", pass: true });
    }

    // --- TEST 2A: Nested Loops ---
    console.log("\n--- TEST 2A: Nested Loops ---");
    const test2aCode = `
count = 0
for i in range(2):
    for j in range(3):
        count += 1
`;
    const res2a = await execTracer(test2aCode);
    console.log("Test 2A success:", res2a.parsed?.success);
    if (res2a.parsed?.success) {
      const line4Steps = res2a.parsed.steps.filter(s => s.event === 'line' && s.line === 5);
      console.log("Inner loop executions (line 5 count += 1):", line4Steps.length);
      const lastGlobals = res2a.parsed.steps[res2a.parsed.steps.length - 1].globals;
      console.log("Final count:", lastGlobals.count);
      results.push({ name: "Nested Loops", pass: line4Steps.length === 6 && lastGlobals.count === 6 });
    } else {
      results.push({ name: "Nested Loops", pass: false });
    }

    // --- TEST 2B: Functions calling functions (Call Stack & Return Values) ---
    console.log("\n--- TEST 2B: Functions Calling Functions ---");
    const test2bCode = `
def multiply(a, b):
    res = a * b
    return res

def calculate(x):
    y = multiply(x, 10)
    return y + 5

final_val = calculate(3)
`;
    const res2b = await execTracer(test2bCode);
    console.log("Test 2B success:", res2b.parsed?.success);
    if (res2b.parsed?.success) {
      const steps = res2b.parsed.steps;
      const funcNames = steps.map(s => `${s.event}:${s.funcName}`);
      console.log("Func trace flow:", funcNames.join(' -> '));
      const multReturnStep = steps.find(s => s.funcName === 'multiply' && s.event === 'return');
      const calcReturnStep = steps.find(s => s.funcName === 'calculate' && s.event === 'return');
      console.log("Multiply return val:", multReturnStep?.returnValue);
      console.log("Calculate return val:", calcReturnStep?.returnValue);
      const endStep = steps.find(s => s.event === 'end');
      console.log("Final globals:", JSON.stringify(endStep?.globals));
      results.push({
        name: "Functions Calling Functions",
        pass: multReturnStep?.returnValue === '30' && calcReturnStep?.returnValue === '35' && endStep?.globals?.final_val === 35
      });
    } else {
      results.push({ name: "Functions Calling Functions", pass: false });
    }

    // --- TEST 3: Print stdout capture without newlines (end="") ---
    console.log("\n--- TEST 3: Print output with end='' ---");
    const test3Code = `
print("A", end="")
print("B", end="-")
print("C")
print("D", end="")
`;
    const res3 = await execTracer(test3Code);
    console.log("Test 3 success:", res3.parsed?.success);
    if (res3.parsed?.success) {
      console.log("Total stdout:", JSON.stringify(res3.parsed.stdout));
      const lineSteps = res3.parsed.steps.filter(s => s.event === 'line');
      lineSteps.forEach(s => console.log(`Line ${s.line} stepOutput: ${JSON.stringify(s.stepOutput)} cumulative: ${JSON.stringify(s.cumulativeOutput)}`));
      results.push({
        name: "Print without newline (end='')",
        pass: res3.parsed.stdout === "AB-C\nD"
      });
    } else {
      results.push({ name: "Print without newline (end='')", pass: false });
    }

    // --- TEST 4A: max_steps Guard standard behavior ---
    console.log("\n--- TEST 4A: max_steps Limit Guard Standard ---");
    const test4aCode = `
total = 0
for i in range(100):
    total += 1
`;
    const res4a = await execTracer(test4aCode, 15);
    console.log("Test 4A tracer result:", res4a.parsed?.success, res4a.parsed?.error);
    results.push({
      name: "max_steps Limit Standard Guard",
      pass: res4a.parsed?.success === false && res4a.parsed?.error?.includes('ステップ数上限')
    });

    // --- TEST 4B: max_steps Guard with try...except Exception ---
    console.log("\n--- TEST 4B: max_steps Limit Guard in try...except Exception ---");
    const test4bCode = `
count = 0
try:
    for i in range(100):
        count += 1
except Exception as e:
    caught_err = str(e)
`;
    const res4b = await execTracer(test4bCode, 10);
    console.log("Test 4B tracer result:", res4b.parsed?.success, res4b.parsed?.error);
    if (res4b.parsed?.success) {
      const endStep = res4b.parsed.steps.find(s => s.event === 'end');
      console.log("Test 4B globals:", JSON.stringify(endStep?.globals));
      console.log("CRITICAL FINDING: User code caught RuntimeError, count reached:", endStep?.globals?.count, "caught_err:", endStep?.globals?.caught_err);
      results.push({
        name: "max_steps in try...except",
        pass: false,
        bug: "RuntimeError raised by trace_func is caught by user's try...except Exception, causing tracer limit bypass or unexpected behavior!"
      });
    } else {
      results.push({ name: "max_steps in try...except", pass: true });
    }

    // --- TEST 5: Verify test_runner.html is testing real tracer, not mock data ---
    console.log("\n--- TEST 5: Verify test_runner.html Real vs Mock ---");
    await page.goto(`http://localhost:${PORT}/test_runner.html`);
    await page.waitForFunction(() => window.__TEST_RESULTS__ !== undefined, { timeout: 60000 });
    const testResults = await page.evaluate(() => window.__TEST_RESULTS__);
    
    // Dynamically test changing code passed to runTrace
    const realTracerCheck = await page.evaluate(async () => {
      const runner = new AutomatedTestRunner();
      await runner.init();
      const customRes = await runner.runTrace("custom_var = 12345 * 2");
      const lastStep = customRes.steps[customRes.steps.length - 1];
      return { success: customRes.success, custom_var: lastStep.globals.custom_var };
    });
    console.log("Real tracer test result dynamically:", realTracerCheck);
    results.push({
      name: "test_runner.html Real Tracer Verification",
      pass: testResults.success && realTracerCheck.custom_var === 24690
    });

    console.log("\n==========================================");
    console.log("     EMPIRICAL VERIFICATION SUMMARY       ");
    console.log("==========================================");
    console.dir(results, { depth: null });

    // Output JSON result file for handoff
    fs.writeFileSync(
      path.join(__dirname, 'empirical_results.json'),
      JSON.stringify({ results, testResults }, null, 2),
      'utf-8'
    );

  } catch (err) {
    console.error("Verification script error:", err);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runEdgeCaseTests();
