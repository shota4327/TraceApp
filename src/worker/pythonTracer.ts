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

    def __init__(self, max_steps=10000):
        self.max_steps = max_steps
        self.step_count = 0
        self.limit_exceeded = False
        self.target_filename = "<string>"
        self.snapshots = []
        self.prev_globals = {}
        self.prev_locals = {}
        self.prev_func = None
        self.stdout_writer = StepStdoutWriter()

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
        スコープ辞書から内部予約変数やモジュール名を除外し、数値をサニタイズします。
        """
        clean = {}
        for k, v in scope_dict.items():
            if k in self.EXCLUDED_NAMES or k.startswith('__tracer_') or k.startswith('_pyodide_'):
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

        if (event in ('line', 'call', 'return')) and not is_module_call:
            self.step_count += 1
            if self.step_count > self.max_steps:
                self.limit_exceeded = True
                raise TraceLimitExceeded(f"ステップ数上限 ({self.max_steps}) を超過しました。")

            line_no = frame.f_lineno

            if func_name == "<module>":
                globals_snap = self._sanitize_scope(frame.f_globals)
                locals_snap = {}
                display_func_name = None
            else:
                globals_snap = self._sanitize_scope(frame.f_globals)
                locals_snap = self._sanitize_scope(frame.f_locals)
                display_func_name = func_name

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

def generate_ast_flowchart(code_str):
    """
    ast モジュールを用いて Python コードから FlowchartNode[], FlowchartEdge[] および draw.io mxGraph XML を自動生成します。
    """
    import ast

    code_lines = code_str.split("\\n")

    def _get_mx_style(node_type):
        styles = {
            'terminal': 'rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#e2e8f0;strokeColor=#475569;',
            'process': 'rounded=0;whiteSpace=wrap;html=1;fillColor=#eff6ff;strokeColor=#2563eb;',
            'decision': 'rhombus;whiteSpace=wrap;html=1;fillColor=#fef3c7;strokeColor=#d97706;',
            'loop': 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fixedSize=1;fillColor=#f3e8ff;strokeColor=#9333ea;',
            'subroutine': 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;fillColor=#ecfdf5;strokeColor=#059669;'
        }
        return styles.get(node_type, 'whiteSpace=wrap;html=1;')

    def _escape_xml(s):
        return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&apos;')

    nodes = []
    edges = []
    start_style = _get_mx_style('terminal')
    start_node = {
        "id": "node-start",
        "type": "terminal",
        "label": "開始",
        "lineRange": [1, 1],
        "x": 100, "y": 20, "width": 180, "height": 50,
        "xmlSnippet": f'<mxCell id="node-start" value="開始" style="{start_style}" vertex="1" parent="1"><mxGeometry x="100" y="20" width="180" height="50" as="geometry"/></mxCell>'
    }
    nodes.append(start_node)

    class FlowchartVisitor(ast.NodeVisitor):
        def __init__(self):
            self.counter = 1
            self.prev_node_id = "node-start"
            self.pending_false_if_nodes = []
            self.pending_join_nodes = []

        def _add(self, ntype, label, sline, eline, custom_id=None):
            nid = custom_id if custom_id else f"node-{sline}"
            self.counter += 1
            y_pos = len(nodes) * 60 + 20
            escaped = _escape_xml(label)
            style = _get_mx_style(ntype)
            xml_snip = f'<mxCell id="{nid}" value="{escaped}" style="{style}" vertex="1" parent="1"><mxGeometry x="100" y="{y_pos}" width="180" height="50" as="geometry"/></mxCell>'
            nobj = {
                "id": nid,
                "type": ntype,
                "label": label,
                "lineRange": [sline, eline],
                "x": 100, "y": y_pos, "width": 180, "height": 50,
                "xmlSnippet": xml_snip
            }
            nodes.append(nobj)

            # If文の各ブランチ末尾からの合流エッジを接続
            if self.pending_join_nodes:
                for j_id in list(self.pending_join_nodes):
                    if j_id != nid and not any(e['sourceId'] == j_id and e['targetId'] == nid for e in edges):
                        edges.append({"id": f"edge-join-{j_id}-{nid}", "sourceId": j_id, "targetId": nid, "label": "Next"})
                self.pending_join_nodes.clear()

            # else/elif が存在しない if 文からの False 分岐エッジを接続
            if self.pending_false_if_nodes:
                for p_id in list(self.pending_false_if_nodes):
                    if p_id != nid and not any(e['sourceId'] == p_id and e['targetId'] == nid for e in edges):
                        edges.append({"id": f"edge-false-{p_id}-{nid}", "sourceId": p_id, "targetId": nid, "label": "False"})
                self.pending_false_if_nodes.clear()

            return nid

        def visit_FunctionDef(self, node):
            args_str = ", ".join(a.arg for a in node.args.args)
            label = f"def {node.name}({args_str})"
            sl = getattr(node, 'lineno', 1)
            el = getattr(node, 'end_lineno', sl)
            nid = self._add("subroutine", label, sl, el)
            if self.prev_node_id and self.prev_node_id != nid and not any(e['sourceId'] == self.prev_node_id and e['targetId'] == nid for e in edges):
                edges.append({"id": f"edge-{self.prev_node_id}-{nid}", "sourceId": self.prev_node_id, "targetId": nid, "label": "Next"})
            self.prev_node_id = nid
            self.generic_visit(node)

        def visit_If(self, node):
            sl = getattr(node, 'lineno', 1)
            el = getattr(node, 'end_lineno', sl)
            label = code_lines[sl - 1].strip() if sl <= len(code_lines) else "if condition"
            label = label.rstrip(":")
            nid = self._add("decision", label, sl, el)
            if self.prev_node_id and self.prev_node_id != nid and not any(e['sourceId'] == self.prev_node_id and e['targetId'] == nid for e in edges):
                edges.append({"id": f"edge-{self.prev_node_id}-{nid}", "sourceId": self.prev_node_id, "targetId": nid, "label": "Next"})
            
            if node.body:
                first_stmt = node.body[0]
                t_sl = getattr(first_stmt, 'lineno', sl + 1)
                t_id = f"node-{t_sl}"
                edges.append({"id": f"edge-true-{nid}-{t_id}", "sourceId": nid, "targetId": t_id, "label": "True"})
            
            self.prev_node_id = nid
            for stmt in node.body:
                self.visit(stmt)
            body_end_node = self.prev_node_id

            if node.orelse:
                first_else = node.orelse[0]
                e_sl = getattr(first_else, 'lineno', el)
                e_id = f"node-{e_sl}"
                edges.append({"id": f"edge-false-{nid}-{e_id}", "sourceId": nid, "targetId": e_id, "label": "False"})
                self.prev_node_id = nid
                for stmt in node.orelse:
                    self.visit(stmt)
                else_end_node = self.prev_node_id
            else:
                # else / elif ブロックがない場合、次に来るノードへ向かう False エッジのために登録
                self.pending_false_if_nodes.append(nid)
                else_end_node = None

            # If全体の合流候補ノードを収集
            if body_end_node and body_end_node != nid:
                self.pending_join_nodes.append(body_end_node)
            if else_end_node and else_end_node != nid and not (node.orelse and isinstance(node.orelse[0], ast.If)):
                self.pending_join_nodes.append(else_end_node)

            self.prev_node_id = None

        def visit_For(self, node):
            sl = getattr(node, 'lineno', 1)
            el = getattr(node, 'end_lineno', sl)
            label = code_lines[sl - 1].strip() if sl <= len(code_lines) else "for loop"
            label = label.rstrip(":")
            loop_id = self._add("loop", label, sl, sl)
            if self.prev_node_id and self.prev_node_id != loop_id and not any(e['sourceId'] == self.prev_node_id and e['targetId'] == loop_id for e in edges):
                edges.append({"id": f"edge-{self.prev_node_id}-{loop_id}", "sourceId": self.prev_node_id, "targetId": loop_id, "label": "Next"})
            
            self.prev_node_id = loop_id
            for stmt in node.body:
                self.visit(stmt)
            body_last_id = self.prev_node_id

            end_id = self._add("loop", "ループ終了", el, el, custom_id=f"node-loop-end-{el}")
            if body_last_id and body_last_id != end_id and not any(e['sourceId'] == body_last_id and e['targetId'] == end_id for e in edges):
                edges.append({"id": f"edge-{body_last_id}-{end_id}", "sourceId": body_last_id, "targetId": end_id, "label": "Next"})
            edges.append({"id": f"edge-loopback-{body_last_id}-{loop_id}", "sourceId": body_last_id, "targetId": loop_id, "label": "Loop"})
            edges.append({"id": f"edge-loop-exit-{loop_id}-{end_id}", "sourceId": loop_id, "targetId": end_id, "label": "False"})
            self.prev_node_id = end_id

        def visit_While(self, node):
            sl = getattr(node, 'lineno', 1)
            el = getattr(node, 'end_lineno', sl)
            label = code_lines[sl - 1].strip() if sl <= len(code_lines) else "while loop"
            label = label.rstrip(":")
            loop_id = self._add("loop", label, sl, sl)
            if self.prev_node_id and self.prev_node_id != loop_id and not any(e['sourceId'] == self.prev_node_id and e['targetId'] == loop_id for e in edges):
                edges.append({"id": f"edge-{self.prev_node_id}-{loop_id}", "sourceId": self.prev_node_id, "targetId": loop_id, "label": "Next"})
            
            self.prev_node_id = loop_id
            for stmt in node.body:
                self.visit(stmt)
            body_last_id = self.prev_node_id

            end_id = self._add("loop", "ループ終了", el, el, custom_id=f"node-loop-end-{el}")
            if body_last_id and body_last_id != end_id and not any(e['sourceId'] == body_last_id and e['targetId'] == end_id for e in edges):
                edges.append({"id": f"edge-{body_last_id}-{end_id}", "sourceId": body_last_id, "targetId": end_id, "label": "Next"})
            edges.append({"id": f"edge-loopback-{body_last_id}-{loop_id}", "sourceId": body_last_id, "targetId": loop_id, "label": "Loop"})
            edges.append({"id": f"edge-loop-exit-{loop_id}-{end_id}", "sourceId": loop_id, "targetId": end_id, "label": "False"})
            self.prev_node_id = end_id

        def visit_Assign(self, node):
            sl = getattr(node, 'lineno', 1)
            el = getattr(node, 'end_lineno', sl)
            label = code_lines[sl - 1].strip() if sl <= len(code_lines) else "Assign"
            nid = self._add("process", label, sl, el)
            if self.prev_node_id and self.prev_node_id != nid and not any(e['sourceId'] == self.prev_node_id and e['targetId'] == nid for e in edges):
                edges.append({"id": f"edge-{self.prev_node_id}-{nid}", "sourceId": self.prev_node_id, "targetId": nid, "label": "Next"})
            self.prev_node_id = nid

        def visit_AugAssign(self, node):
            sl = getattr(node, 'lineno', 1)
            el = getattr(node, 'end_lineno', sl)
            label = code_lines[sl - 1].strip() if sl <= len(code_lines) else "AugAssign"
            nid = self._add("process", label, sl, el)
            if self.prev_node_id and self.prev_node_id != nid and not any(e['sourceId'] == self.prev_node_id and e['targetId'] == nid for e in edges):
                edges.append({"id": f"edge-{self.prev_node_id}-{nid}", "sourceId": self.prev_node_id, "targetId": nid, "label": "Next"})
            self.prev_node_id = nid

        def visit_Expr(self, node):
            sl = getattr(node, 'lineno', 1)
            el = getattr(node, 'end_lineno', sl)
            label = code_lines[sl - 1].strip() if sl <= len(code_lines) else "Expr"
            nid = self._add("process", label, sl, el)
            if self.prev_node_id and self.prev_node_id != nid and not any(e['sourceId'] == self.prev_node_id and e['targetId'] == nid for e in edges):
                edges.append({"id": f"edge-{self.prev_node_id}-{nid}", "sourceId": self.prev_node_id, "targetId": nid, "label": "Next"})
            self.prev_node_id = nid

    visitor = None
    try:
        tree = ast.parse(code_str)
        visitor = FlowchartVisitor()
        visitor.visit(tree)
    except Exception:
        pass

    last_l = max(len(code_lines), 1)
    end_y = len(nodes) * 60 + 20
    end_node = {
        "id": "node-end",
        "type": "terminal",
        "label": "終了",
        "lineRange": [last_l, last_l],
        "x": 100, "y": end_y, "width": 180, "height": 50,
        "xmlSnippet": f'<mxCell id="node-end" value="終了" style="{start_style}" vertex="1" parent="1"><mxGeometry x="100" y="{end_y}" width="180" height="50" as="geometry"/></mxCell>'
    }
    nodes.append(end_node)
    if visitor is not None and visitor.pending_join_nodes:
        for j_id in list(visitor.pending_join_nodes):
            if j_id != "node-end" and not any(e['sourceId'] == j_id and e['targetId'] == "node-end" for e in edges):
                edges.append({"id": f"edge-join-{j_id}-node-end", "sourceId": j_id, "targetId": "node-end", "label": "Next"})
        visitor.pending_join_nodes.clear()
    if visitor is not None and visitor.pending_false_if_nodes:
        for p_id in list(visitor.pending_false_if_nodes):
            edges.append({"id": f"edge-false-{p_id}-node-end", "sourceId": p_id, "targetId": "node-end", "label": "False"})
        visitor.pending_false_if_nodes.clear()
    if visitor is not None and visitor.prev_node_id and visitor.prev_node_id != "node-end":
        edges.append({"id": f"edge-{visitor.prev_node_id}-node-end", "sourceId": visitor.prev_node_id, "targetId": "node-end", "label": "Next"})

    node_snips = [n.get("xmlSnippet", "") for n in nodes]
    edge_snips = [f'<mxCell id="{e["id"]}" value="{_escape_xml(e.get("label", ""))}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="{e["sourceId"]}" target="{e["targetId"]}"><mxGeometry relative="1" as="geometry"/></mxCell>' for e in edges]
    cell_snips = "\\n    ".join(node_snips + edge_snips)
    mx_xml = f'<mxGraphModel>\\n  <root>\\n    <mxCell id="0"/>\\n    <mxCell id="1" parent="0"/>\\n    {cell_snips}\\n  </root>\\n</mxGraphModel>'

    return nodes, edges, mx_xml

def run_trace(code_str, max_steps=10000):
    """
    Pythonコードを sys.settrace() 付きで実行し、トレース結果および流れ図データの JSON 文字列を返却します。
    """
    tracer = PyodideTracer(max_steps=max_steps)
    old_stdout = sys.stdout
    sys.stdout = tracer.stdout_writer

    flowchart_nodes, flowchart_edges, flowchart_xml = generate_ast_flowchart(code_str)

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
            "flowchartNodes": flowchart_nodes,
            "flowchartEdges": flowchart_edges,
            "flowchartXml": flowchart_xml
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
            "flowchartNodes": flowchart_nodes,
            "flowchartEdges": flowchart_edges,
            "flowchartXml": flowchart_xml
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
            "flowchartNodes": flowchart_nodes,
            "flowchartEdges": flowchart_edges,
            "flowchartXml": flowchart_xml
        })
    finally:
        sys.settrace(None)
        sys.stdout = old_stdout
`;

