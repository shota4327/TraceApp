# Orchestration Plan - TraceApp Phase 1 PoC

## Mission
Validate Pyodide, `sys.settrace()` step execution tracing, print output capture, and produce `poc_report.md` as specified in `ORIGINAL_REQUEST.md`.

## Milestones & Execution Strategy

### Milestone M1: Phase 1 PoC Code & Automated Verification (R1, R2, R3)
- **Goal**: Implement minimal HTML + JavaScript verification code and automated test runner.
- **Files to Create**:
  - `index.html`: PoC UI allowing interactive execution and tracing visualization.
  - `test_runner.html`: Standalone browser test runner executing automated assertions for R1, R2 (Tests 1-4), R3 (single & multiple print).
- **Execution Loop**:
  1. Dispatch **Worker** (`teamwork_preview_worker`) to write `index.html` and `test_runner.html` adhering to Japanese code comments constraint and explicit `sys.settrace()` + `sys.stdout` delta collection logic.
  2. Dispatch **Reviewers** (`teamwork_preview_reviewer`) & **Challengers** (`teamwork_preview_challenger`) to independently review implementation and execute tests in browser / headless browser runner.
  3. Dispatch **Forensic Auditor** (`teamwork_preview_auditor`) to verify zero cheating / genuine logic.
  4. Gate check: proceed if all pass.

### Milestone M2: Verification Report Generation (R4)
- **Goal**: Generate `poc_report.md` in project root.
- **File to Create**:
  - `c:\Git\TraceApp\poc_report.md`
- **Execution Loop**:
  1. Dispatch **Worker** (`teamwork_preview_worker`) to generate `poc_report.md` based on verified test outcomes from M1.
  2. Dispatch **Reviewer** (`teamwork_preview_reviewer`) & **Auditor** (`teamwork_preview_auditor`) to check report completeness against ORIGINAL_REQUEST §R4.
  3. Final Human Reporting.

## Verification Pipeline
- Worker runs automated test runner / headless checks and reports exact assertion logs.
- Reviewer & Challenger verify HTML/JS execution, trace output formats, line numbers, local/global scope isolation, and print order.
- Auditor performs static & runtime integrity verification.
