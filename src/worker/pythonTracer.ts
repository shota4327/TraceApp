/**
 * Pyodide 内で実行される Python sys.settrace() トレース収集スクリプト
 * 10,000ステップ上限ガード、NaN/Infinity変換、循環参照フォールバック、
 * print出力キャプチャ、変数の変更検知などを提供します。
 */

export const PYTHON_TRACER_SCRIPT = `
import sys
import io
import math
import json
import types

class TraceLimitExceeded(BaseException):
    """
    10,000ステップ上限超過ガード用のカスタム例外。
    BaseException を継承することで、ユーザーコードの try...except Exception: を突破します。
    """
    pass

class StepStdoutWriter:
    """
    print() 出力をキャプチャし、ステップごとの差分 (stdoutDelta) および
    累積出力 (stdoutCumulative) を管理するライタークラス。
    """
    def __init__(self):
        self.cumulative_buffer = []
        self.delta_buffer = []

    def write(self, text):
        if text:
            self.cumulative_buffer.append(text)
            self.delta_buffer.append(text)

    def flush(self):
        pass

    def get_delta(self):
        delta = "".join(self.delta_buffer)
        self.delta_buffer.clear()
        return delta

    def get_cumulative(self):
        return "".join(self.cumulative_buffer)

class PyodideTracer:
    """
    sys.settrace() を用いてステップ単位の実行状態を収集するトレーサークラス。
    """
    EXCLUDED_NAMES = {
        '__name__', '__doc__', '__package__', '__loader__', '__spec__',
        '__annotations__', '__builtins__', '__file__', '__cached__',
        'TraceLimitExceeded', 'StepStdoutWriter', 'PyodideTracer', 'run_trace',
        'sys', 'io', 'math', 'json', 'tracer_instance', 'exec_globals', 'compiled_code'
    }

    def __init__(self, max_steps=10000, toplevel_def_lines=None):
        self.max_steps = max_steps
        self.step_count = 0
        self.limit_exceeded = False
        self.target_filename = "<string>"
        self.snapshots = []
        self.prev_globals = {}
        self.prev_locals = {}
        self.prev_func = None
        self.stdout_writer = StepStdoutWriter()
        self.toplevel_def_lines = set(toplevel_def_lines or [])
        self.last_executed_line = None
        self.call_caller_lines = []

    def _safe_repr(self, v):
        """
        循環参照や repr() 内で例外が発生するオブジェクトの安全な文字列表現を取得します。
        """
        try:
            return repr(v)
        except Exception:
            try:
                return f"<{type(v).__name__} object at {hex(id(v))}>"
            except Exception:
                return "<Unrepresentable Object>"

    def _sanitize_value(self, v, depth=0, max_depth=5, seen=None):
        """
        変数値を JavaScript に適合する形式へサニタイズします。
        - int, str, bool, None はそのまま保持
        - float の NaN/Infinity を "NaN", "Infinity", "-Infinity" に変換
        - 循環参照や深すぎるネストは _safe_repr() へフォールバック
        """
        if seen is None:
            seen = set()

        if v is None or isinstance(v, (int, str, bool)):
            return v

        if isinstance(v, float):
            if math.isnan(v):
                return "NaN"
            elif math.isinf(v):
                return "-Infinity" if v < 0 else "Infinity"
            return v

        obj_id = id(v)
        if obj_id in seen or depth >= max_depth:
            return self._safe_repr(v)

        if isinstance(v, (list, tuple)):
            seen.add(obj_id)
            try:
                res = [self._sanitize_value(item, depth + 1, max_depth, seen) for item in v]
                seen.remove(obj_id)
                return res
            except Exception:
                seen.discard(obj_id)
                return self._safe_repr(v)

        if isinstance(v, dict):
            seen.add(obj_id)
            try:
                res = {}
                for k, val in v.items():
                    res[str(k)] = self._sanitize_value(val, depth + 1, max_depth, seen)
                seen.remove(obj_id)
                return res
            except Exception:
                seen.discard(obj_id)
                return self._safe_repr(v)

        if isinstance(v, set):
            seen.add(obj_id)
            try:
                res = [self._sanitize_value(item, depth + 1, max_depth, seen) for item in v]
                seen.remove(obj_id)
                return res
            except Exception:
                seen.discard(obj_id)
                return self._safe_repr(v)

        return self._safe_repr(v)

    def _sanitize_scope(self, scope_dict):
        """
        スコープ辞書から内部予約変数やモジュール名、関数オブジェクトを除外し、数値をサニタイズします。
        """
        clean = {}
        for k, v in scope_dict.items():
            if k in self.EXCLUDED_NAMES or k.startswith('__tracer_') or k.startswith('_pyodide_'):
                continue
            if callable(v) or isinstance(v, (types.FunctionType, types.BuiltinFunctionType, types.MethodType, types.ModuleType)):
                continue
            clean[k] = self._sanitize_value(v)
        return clean

    def trace_func(self, frame, event, arg):
        """
        sys.settrace コールバック関数
        """
        if frame.f_code.co_filename != self.target_filename:
            return self.trace_func

        if self.limit_exceeded:
            raise TraceLimitExceeded(f"ステップ数上限 ({self.max_steps}) を超過しました。")

        func_name = frame.f_code.co_name
        is_module_call = (event == 'call' and func_name == '<module>')

        # トップレベル（<module>）での初期 def 宣言行の line イベントはスキップ
        if func_name == "<module>" and event == 'line' and frame.f_lineno in self.toplevel_def_lines:
            return self.trace_func

        # 記録対象のイベント判定
        # - line: 各実行行
        # - call (関数内への突入時): def 行を記録
        # - return: return 文のない関数の暗黙リターン等
        if (event in ('line', 'call')) and not is_module_call:
            self.step_count += 1
            if self.step_count > self.max_steps:
                self.limit_exceeded = True
                raise TraceLimitExceeded(f"ステップ数上限 ({self.max_steps}) を超過しました。")

            if func_name == "<module>":
                globals_snap = self._sanitize_scope(frame.f_globals)
                locals_snap = {}
                display_func_name = None
            else:
                globals_snap = self._sanitize_scope(frame.f_globals)
                locals_snap = self._sanitize_scope(frame.f_locals)
                display_func_name = func_name

            if event == 'call':
                line_no = frame.f_code.co_firstlineno
                caller_line = self.last_executed_line
                self.call_caller_lines.append(caller_line)
                executed_line = line_no
            else:
                line_no = frame.f_lineno
                if self.prev_func is not None and display_func_name is None:
                    # 関数から戻ってきた直後の行: 呼び出し元代入行を実行完了行とする
                    executed_line = self.call_caller_lines.pop() if self.call_caller_lines else self.last_executed_line
                else:
                    executed_line = self.last_executed_line if self.last_executed_line is not None else line_no

            self.last_executed_line = line_no

            changed_vars = []

            # グローバル変数の独立変化判定
            for k, v in globals_snap.items():
                if k not in self.prev_globals or self.prev_globals[k] != v:
                    changed_vars.append(k)

            # ローカル変数の独立変化判定（関数スコープ内実行時のみ）
            if display_func_name is not None:
                same_func = (self.prev_func == display_func_name)
                for k, v in locals_snap.items():
                    if not same_func or k not in self.prev_locals or self.prev_locals[k] != v:
                        if k not in changed_vars:
                            changed_vars.append(k)

            self.prev_globals = globals_snap.copy()
            self.prev_locals = locals_snap.copy() if display_func_name is not None else {}
            self.prev_func = display_func_name

            stdout_delta = self.stdout_writer.get_delta()
            stdout_cumulative = self.stdout_writer.get_cumulative()

            snapshot = {
                "stepIndex": len(self.snapshots),
                "line": line_no,
                "executedLine": executed_line,
                "event": event,
                "functionName": display_func_name,
                "globals": globals_snap,
                "locals": locals_snap,
                "changedVars": changed_vars,
                "stdoutDelta": stdout_delta,
                "stdoutCumulative": stdout_cumulative,
                "astNodeId": f"node-{line_no}"
            }
            self.snapshots.append(snapshot)

        return self.trace_func

    def add_end_snapshot(self, final_globals):
        """
        スクリプト全行実行完了後に最終状態を反映する event: 'end' のスナップショットを追加します。
        """
        last_line = self.snapshots[-1]["line"] if self.snapshots else 1
        executed_line = self.last_executed_line if self.last_executed_line is not None else last_line
        globals_snap = self._sanitize_scope(final_globals)
        locals_snap = {}

        changed_vars = []
        for k, v in globals_snap.items():
            if k not in self.prev_globals or self.prev_globals[k] != v:
                changed_vars.append(k)

        stdout_delta = self.stdout_writer.get_delta()
        stdout_cumulative = self.stdout_writer.get_cumulative()

        snapshot = {
            "stepIndex": len(self.snapshots),
            "line": last_line,
            "executedLine": executed_line,
            "event": "end",
            "functionName": None,
            "globals": globals_snap,
            "locals": locals_snap,
            "changedVars": changed_vars,
            "stdoutDelta": stdout_delta,
            "stdoutCumulative": stdout_cumulative,
            "astNodeId": "node-end"
        }
        self.snapshots.append(snapshot)

def run_trace(code_str, max_steps=10000):
    """
    Pythonコードを sys.settrace() 付きで実行し、トレース結果の JSON 文字列を返却します。
    """
    toplevel_def_lines = set()
    try:
        import ast
        tree = ast.parse(code_str)
        for node in tree.body:
            if isinstance(node, ast.FunctionDef):
                toplevel_def_lines.add(node.lineno)
    except Exception:
        pass

    tracer = PyodideTracer(max_steps=max_steps, toplevel_def_lines=toplevel_def_lines)
    old_stdout = sys.stdout
    sys.stdout = tracer.stdout_writer

    try:
        sys.settrace(tracer.trace_func)
        compiled_code = compile(code_str, "<string>", "exec")
        exec_globals = {"__name__": "__main__"}
        exec(compiled_code, exec_globals)
        sys.settrace(None)
        sys.stdout = old_stdout

        tracer.add_end_snapshot(exec_globals)

        return json.dumps({
            "success": True,
            "snapshots": tracer.snapshots,
            "totalSteps": len(tracer.snapshots),
            "stdout": tracer.stdout_writer.get_cumulative(),
            "flowchartNodes": [],
            "flowchartEdges": [],
            "flowchartXml": ""
        })
    except TraceLimitExceeded as e:
        sys.settrace(None)
        sys.stdout = old_stdout
        return json.dumps({
            "success": False,
            "error": str(e),
            "snapshots": tracer.snapshots,
            "totalSteps": len(tracer.snapshots),
            "stdout": tracer.stdout_writer.get_cumulative(),
            "flowchartNodes": [],
            "flowchartEdges": [],
            "flowchartXml": ""
        })
    except Exception as e:
        sys.settrace(None)
        sys.stdout = old_stdout
        return json.dumps({
            "success": False,
            "error": f"{type(e).__name__}: {str(e)}",
            "snapshots": tracer.snapshots,
            "totalSteps": len(tracer.snapshots),
            "stdout": tracer.stdout_writer.get_cumulative(),
            "flowchartNodes": [],
            "flowchartEdges": [],
            "flowchartXml": ""
        })
    finally:
        sys.settrace(None)
        sys.stdout = old_stdout
`;

