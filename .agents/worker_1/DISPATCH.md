## 2026-08-10T11:19:54Z
Task: Implement Milestone M1: Phase 1 PoC Implementation & Verification in c:\Git\TraceApp.

Files to create in c:\Git\TraceApp\:
1. `index.html`: Interactive PoC web page demonstrating Pyodide initialization, Python code execution, sys.settrace() step tracing, and stdout print capture.
2. `test_runner.html`: Automated browser test suite running assertions for:
   - R1: Pyodide initialization and basic Python execution.
   - R2 Test 1 (Sequential execution): `x = 5`, `y = 3`, `total = x + y` (3 steps with lineno and variables x, y, total).
   - R2 Test 2 (Conditional execution): `score = 75`, `if/elif/else` (verifies score=75, grade="B", only elif path traced).
   - R2 Test 3 (Loop execution): `total = 0`, `for i in range(1, 4): total = total + i` (verifies i=1,2,3 step iterations and total accumulation).
   - R2 Test 4 (Function definition & call): `def add(a, b): result = a + b; return result`, `answer = add(3, 4)` (verifies local vs global scope isolation).
   - R3-1 (Single print capture): `print("Hello")`.
   - R3-2 (Multiple sequential print capture): multiple print calls in order.
3. Test execution setup: A test runner script (e.g. Node script using Puppeteer / Playwright or jsdom or HTTP server test trigger) that can run `test_runner.html` or execute the test logic automatically, verify all assertions pass, and output logs.

Constraints:
- ALL comments in HTML / JavaScript / TypeScript MUST be written in Japanese (日本語).
- Use Pyodide v0.26.4 via CDN (`https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js`).
- Clean Python tracer implementation using `sys.settrace()` and `sys.stdout` delta redirection, returning serialized JSON via `json.dumps()` to avoid `PyProxy` memory leaks.
