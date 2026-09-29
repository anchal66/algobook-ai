/**
 * Python tracer source (Module 07 §3.2). Runs inside Pyodide (or CPython for the tests) and returns a JSON
 * `Trace` (types.ts) with per-step deltas. Kept as a TypeScript string so the worker can ship it without a
 * loader rule. `run_trace(prelude, user, driver, stdin, max_steps, max_heap, wall_ms)` → JSON string.
 *
 * Only frames of the `<user>` file are traced; the prelude and the driver run untraced (so the trace
 * starts at the harness call into the student's function). The tracer aborts the program with a
 * BaseException subclass when a limit is hit — `except Exception` in user code cannot swallow it.
 */
export const PYTHON_TRACER = String.raw`
import sys, io, json, time, math, types, collections

class _TraceLimit(BaseException):
    def __init__(self, reason):
        BaseException.__init__(self, reason)
        self.reason = reason

_MAX_ITEMS = 50
_MAX_STR = 200
_MAX_STDOUT = 20000
_LIVE_FRAMES = 40

_SKIP_NAMES = {"__builtins__", "__name__", "__doc__", "__package__", "__loader__", "__spec__", "__file__", "__cached__"}

class _Tracer:
    def __init__(self, max_steps, max_heap, wall_ms):
        self.max_steps = max_steps
        self.max_heap = max_heap
        self.wall_ms = wall_ms
        self.started = time.time()
        self.steps = []
        self.stack = []          # list of dict(id, fn, line, frame, locals, locals_json)
        self.frame_ids = {}      # id(frame) -> seq
        self.frame_seq = 0
        self.ids = {}            # id(obj) -> "@n"
        self.keep = {}           # "@n" -> obj (strong refs keep ids stable)
        self.heap_full = False
        self.prev_heap_json = {}
        self.stack_dirty = True
        self.out = io.StringIO()
        self.out_mark = 0
        self.entry = None
        self.exception = None
        self.truncated = False
        self.limit = None
        self.last_exc = None

    # ── limits ──────────────────────────────────────────────
    def _check(self):
        if self.limit is not None:
            raise self.limit
        if len(self.steps) >= self.max_steps:
            self.truncated = "steps"; self.limit = _TraceLimit("steps"); raise self.limit
        if (time.time() - self.started) * 1000 > self.wall_ms:
            self.truncated = "time"; self.limit = _TraceLimit("time"); raise self.limit

    # ── serialisation ───────────────────────────────────────
    def _id(self, o):
        k = id(o)
        i = self.ids.get(k)
        if i is None:
            if len(self.ids) >= self.max_heap:
                self.heap_full = True
                return None
            i = "@%d" % (len(self.ids) + 1)
            self.ids[k] = i
            self.keep[i] = o
        return i

    def _val(self, v, heap, pending):
        if v is None or v is True or v is False:
            return v
        t = type(v)
        if t is int:
            if -9007199254740991 <= v <= 9007199254740991:
                return v
            return {"sp": "bigint", "v": str(v)}
        if t is float:
            if math.isnan(v): return {"sp": "nan"}
            if math.isinf(v): return {"sp": "inf" if v > 0 else "-inf"}
            return v
        if t is str:
            return v if len(v) <= _MAX_STR else v[:_MAX_STR] + "…"
        if t is bytes or t is bytearray:
            return repr(v)[:_MAX_STR]
        i = self._id(v)
        if i is None:
            return {"sp": "undefined"}
        if i not in heap:
            heap[i] = None
            pending.append(v)
        return {"ref": i}

    def _describe(self, o, heap, pending):
        s = lambda x: self._val(x, heap, pending)
        t = type(o)
        if t is list:
            return {"t": "list", "items": [s(x) for x in o[:_MAX_ITEMS]], "n": len(o)}
        if t is tuple:
            return {"t": "tuple", "items": [s(x) for x in o[:_MAX_ITEMS]], "n": len(o)}
        if t is set or t is frozenset:
            items = list(o)
            try:
                items = sorted(items)
            except Exception:
                pass
            return {"t": "set", "items": [s(x) for x in items[:_MAX_ITEMS]], "n": len(o)}
        if isinstance(o, dict):
            items = list(o.items())
            return {"t": "dict", "entries": [[s(k), s(v)] for k, v in items[:_MAX_ITEMS]], "n": len(o)}
        if isinstance(o, collections.deque):
            items = list(o)
            return {"t": "list", "items": [s(x) for x in items[:_MAX_ITEMS]], "n": len(o)}
        if isinstance(o, (types.FunctionType, types.BuiltinFunctionType, types.MethodType, type, types.ModuleType)):
            return {"t": "func", "name": getattr(o, "__name__", "?")}
        if isinstance(o, (list, tuple)):
            return {"t": "list", "items": [s(x) for x in list(o)[:_MAX_ITEMS]], "n": len(o)}
        d = getattr(o, "__dict__", None)
        if d is not None:
            fields = {}
            n = 0
            for k, v in d.items():
                if n >= _MAX_ITEMS: break
                if k.startswith("__"): continue
                fields[k] = s(v); n += 1
            return {"t": "node", "cls": t.__name__, "fields": fields}
        slots = getattr(t, "__slots__", None)
        if slots:
            fields = {}
            for k in slots:
                if hasattr(o, k): fields[k] = s(getattr(o, k))
            return {"t": "node", "cls": t.__name__, "fields": fields}
        try:
            r = repr(o)
        except Exception:
            r = "?"
        return {"t": "other", "cls": t.__name__, "repr": r[:80]}

    def _complete(self, heap, pending):
        while pending:
            o = pending.pop()
            heap[self.ids[id(o)]] = self._describe(o, heap, pending)

    def _locals(self, frame, heap, pending):
        out = {}
        try:
            items = list(frame.f_locals.items())
        except Exception:
            return out
        for k, v in items:
            if k in _SKIP_NAMES or k.startswith("__"): continue
            if k == "self" and not getattr(v, "__dict__", None): continue
            if isinstance(v, types.ModuleType): continue
            out[k] = self._val(v, heap, pending)
        return out

    # ── steps ───────────────────────────────────────────────
    def _push(self, ev, line, extra=None):
        self._check()
        changed = []
        step = {"i": len(self.steps), "line": line, "ev": ev, "changed": changed}
        if extra: step.update(extra)
        heap = {}
        pending = []
        locals_delta = {}
        first = max(0, len(self.stack) - _LIVE_FRAMES)
        for k, f in enumerate(self.stack):
            if k >= first:
                loc = self._locals(f["frame"], heap, pending)
                j = json.dumps(loc, sort_keys=True)
                if j != f["locals_json"] or not self.steps:
                    f["locals_json"] = j
                    f["locals"] = loc
                    locals_delta[str(f["id"])] = loc
                    for name in loc: changed.append("%d:%s" % (f["id"], name))
            else:
                for v in f["locals"].values():
                    if isinstance(v, dict) and "ref" in v and v["ref"] not in heap:
                        o = self.keep.get(v["ref"])
                        if o is not None:
                            heap[v["ref"]] = None; pending.append(o)
        if extra and "ret" in extra:
            r = extra["ret"]
            if isinstance(r, dict) and "ref" in r and r["ref"] not in heap:
                o = self.keep.get(r["ref"])
                if o is not None:
                    heap[r["ref"]] = None; pending.append(o)
        self._complete(heap, pending)
        heap_json = {}
        delta = {}
        for i, obj in heap.items():
            j = json.dumps(obj, sort_keys=True)
            heap_json[i] = j
            if self.prev_heap_json.get(i) != j:
                delta[i] = obj; changed.append(i)
        for i in self.prev_heap_json:
            if i not in heap: delta[i] = None
        self.prev_heap_json = heap_json
        if locals_delta: step["locals"] = locals_delta
        if delta: step["heap"] = delta
        if self.stack_dirty or not self.steps:
            step["stack"] = [{"id": f["id"], "fn": f["fn"], "line": f["line"]} for f in self.stack]
            self.stack_dirty = False
        text = self.out.getvalue()
        if len(text) > self.out_mark:
            step["out"] = text[self.out_mark:]
            self.out_mark = len(text)
        self.steps.append(step)

    # ── sys.settrace hooks ──────────────────────────────────
    def global_trace(self, frame, event, arg):
        if frame.f_code.co_filename != "<user>":
            return None
        if frame.f_code.co_name == "<module>":
            return None
        if event == "call":
            self.frame_seq += 1
            fid = self.frame_seq
            self.frame_ids[id(frame)] = fid
            fn = frame.f_code.co_name
            self.stack.append({"id": fid, "fn": fn, "line": frame.f_lineno, "frame": frame, "locals": {}, "locals_json": ""})
            self.stack_dirty = True
            if self.entry is None:
                heap = {}; pending = []
                args = self._locals(frame, heap, pending)
                self._complete(heap, pending)
                self.entry = {"fn": fn, "args": args}
            self._push("call", frame.f_lineno)
            return self.local_trace
        return None

    def local_trace(self, frame, event, arg):
        if self.limit is not None:
            raise self.limit
        top = self.stack[-1] if self.stack else None
        if top is None or top["frame"] is not frame:
            # frames we did not see enter (should not happen) — ignore
            return self.local_trace
        if event == "line":
            top["line"] = frame.f_lineno
            self._push("line", frame.f_lineno)
        elif event == "return":
            heap = {}; pending = []
            v = self._val(arg, heap, pending)
            self._push("return", top["line"], {"ret": v})
            self.stack.pop()
            self.stack_dirty = True
        elif event == "exception":
            etype, evalue, tb = arg
            if etype is not _TraceLimit and evalue is not self.last_exc and not (isinstance(evalue, (StopIteration, GeneratorExit))):
                self.last_exc = evalue
                msg = str(evalue)
                if len(msg) > _MAX_STR: msg = msg[:_MAX_STR] + "…"
                try:
                    self._push("exception", frame.f_lineno, {"exc": {"type": etype.__name__, "message": msg}})
                    if self.exception is None:
                        self.exception = {"step": len(self.steps) - 1, "type": etype.__name__, "message": msg}
                except _TraceLimit:
                    pass
        return self.local_trace

    def finish(self, fatal=None):
        if self.heap_full and not self.truncated:
            self.truncated = "heap"
        if fatal is not None and not isinstance(fatal, _TraceLimit) and self.exception is None:
            msg = str(fatal)
            if len(msg) > _MAX_STR: msg = msg[:_MAX_STR] + "…"
            self.exception = {"step": max(0, len(self.steps) - 1), "type": type(fatal).__name__, "message": msg}
        text = self.out.getvalue()
        if len(text) > _MAX_STDOUT: text = text[:_MAX_STDOUT]
        if len(text) > self.out_mark and self.steps:
            last = self.steps[-1]
            last["out"] = last.get("out", "") + text[self.out_mark:]
            self.out_mark = len(text)
        return {
            "lang": "python", "entry": self.entry, "steps": self.steps, "stdout": text,
            "exception": self.exception, "truncated": self.truncated,
            "ms": int((time.time() - self.started) * 1000),
        }


def run_trace(prelude, user, driver, stdin, max_steps=3000, max_heap=500, wall_ms=5000):
    tracer = _Tracer(max_steps, max_heap, wall_ms)
    g = {"__name__": "__main__"}
    old_stdin, old_stdout = sys.stdin, sys.stdout
    sys.stdin = io.StringIO(stdin)
    sys.stdout = tracer.out
    fatal = None
    try:
        exec(compile(prelude, "<prelude>", "exec"), g)
        exec(compile(user, "<user>", "exec"), g)
        sys.settrace(tracer.global_trace)
        try:
            exec(compile(driver, "<driver>", "exec"), g)
        finally:
            sys.settrace(None)
    except _TraceLimit as e:
        fatal = e
    except SyntaxError as e:
        fatal = e
        if tracer.exception is None:
            tracer.exception = {"step": 0, "type": "SyntaxError", "message": "%s (line %s)" % (e.msg, e.lineno)}
    except BaseException as e:
        fatal = e
    finally:
        sys.settrace(None)
        sys.stdin, sys.stdout = old_stdin, old_stdout
    return json.dumps(tracer.finish(fatal))
`;
