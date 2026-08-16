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
        self.stdout_writer = StepStdoutWriter()
        self.toplevel_def_lines = set(toplevel_def_lines or [])
        self.pending_line = None
        self.pending_func = None
        self.caller_stack = []

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

    def _flush_pending(self, current_globals, current_locals, current_func):
        """
        直前の実行行 (pending_line) の実行完了時点のスナップショットを確定して記録します。
        """
        if self.pending_line is None:
            return

        line_no = self.pending_line
        func_name = self.pending_func

        if func_name is None:
            snap_globals = self._sanitize_scope(current_globals)
            snap_locals = {}
        else:
            snap_globals = self._sanitize_scope(current_globals)
            snap_locals = self._sanitize_scope(current_locals)

        changed_vars = []
        for k, v in snap_globals.items():
            if k not in self.prev_globals or self.prev_globals[k] != v:
                changed_vars.append(k)

        if func_name is not None:
            for k, v in snap_locals.items():
                if k not in self.prev_locals or self.prev_locals[k] != v:
                    if k not in changed_vars:
                        changed_vars.append(k)

        self.prev_globals = snap_globals.copy()
        self.prev_locals = snap_locals.copy() if func_name is not None else {}

        self.step_count += 1
        if self.step_count > self.max_steps:
            self.limit_exceeded = True
            raise TraceLimitExceeded(f"ステップ数上限 ({self.max_steps}) を超過しました。")

        snapshot = {
            "stepIndex": len(self.snapshots),
            "line": line_no,
            "event": "line",
            "functionName": func_name,
            "globals": snap_globals,
            "locals": snap_locals,
            "changedVars": changed_vars,
            "stdoutDelta": self.stdout_writer.get_delta(),
            "stdoutCumulative": self.stdout_writer.get_cumulative(),
            "astNodeId": f"node-{line_no}"
        }
        self.snapshots.append(snapshot)
        self.pending_line = None
        self.pending_func = None

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

        if event == 'call' and not is_module_call:
            # 関数呼び出し行 (caller) の pending を flush
            parent_frame = frame.f_back
            p_globals = parent_frame.f_globals if parent_frame else frame.f_globals
            p_locals = parent_frame.f_locals if parent_frame else {}
            p_func = parent_frame.f_code.co_name if (parent_frame and parent_frame.f_code.co_name != '<module>') else None
            self._flush_pending(p_globals, p_locals, p_func)

            if parent_frame:
                self.caller_stack.append(parent_frame.f_lineno)

            # def 行（引数束縛）を flush
            def_line = frame.f_code.co_firstlineno
            self.pending_line = def_line
            self.pending_func = func_name
            self._flush_pending(frame.f_globals, frame.f_locals, func_name)

        elif event == 'line':
            cur_func = None if func_name == '<module>' else func_name
            self._flush_pending(frame.f_globals, frame.f_locals, cur_func)
            self.pending_line = frame.f_lineno
            self.pending_func = cur_func

        elif event == 'return' and not is_module_call:
            # return 行の pending を flush
            self._flush_pending(frame.f_globals, frame.f_locals, func_name)

            # 呼び出し元復帰行（代入完了行）を pending_line にセット
            if self.caller_stack:
                ret_line = self.caller_stack.pop()
                self.pending_line = ret_line
                self.pending_func = None

        return self.trace_func

    def add_end_snapshot(self, final_globals):
        """
        スクリプト全行実行完了後に最終状態を反映するスナップショットを追加します。
        """
        if self.pending_line is not None:
            self._flush_pending(final_globals, {}, None)

        last_line = self.snapshots[-1]["line"] if self.snapshots else 1
        globals_snap = self._sanitize_scope(final_globals)

        snapshot = {
            "stepIndex": len(self.snapshots),
            "line": last_line,
            "event": "end",
            "functionName": None,
            "globals": globals_snap,
            "locals": {},
            "changedVars": [],
            "stdoutDelta": self.stdout_writer.get_delta(),
            "stdoutCumulative": self.stdout_writer.get_cumulative(),
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

