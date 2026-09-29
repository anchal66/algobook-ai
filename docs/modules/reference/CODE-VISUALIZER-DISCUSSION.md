# Code Visualizer ("watch my code run") — discussion paper (2026-09-29)

> **Outcome (2026-09-29):** the owner keeps the Judge0 free tier and delegated the choices → D-23 DECIDED: Phase 1 Python + JavaScript in-browser, AI narration Luna `low`, Java/C++ deferred. The build plan is `07-MODULE-CODE-VISUALIZER.md`; this paper stays as the rationale.

Owner's ask: in the normal workspace, show a student **exactly how their own code executes**, line by line, with data flowing (variables, arrays, pointers, recursion frames, trees, graphs), like a debugger/dry-run, so that failures and complex topics (recursion, trees, graphs) become understandable. Must be cheap, high quality, and very easy to read visually. Decide before building (this is a discussion, not a plan).

## 1. Three ways to produce the "trace" (the truth about what happened)

| Option | How | Accuracy | Cost per use | Verdict |
|---|---|---|---|---|
| **A. Real execution trace** (Python Tutor approach) | Run the user's code + the problem's driver under a tracer that records, at every executed line: the line, the call stack, every frame's locals, and the reachable heap (arrays, objects, nodes). Render that. | **Exact.** Shows the bug the user actually has. | $0 in-browser (Python/JS); server compute only for Java/C++ | **Use this as the ground truth.** |
| B. AI "simulated" trace | Ask Luna to emit the step list as JSON. | Wrong on long loops, off-by-one, recursion depth — exactly where students need it. The model tends to "fix" the bug in its head. | $0.005–0.02 / trace | **No** as the source of truth. |
| C. Hybrid: A + AI narration | Real trace is the truth; a cheap Luna `low` call explains a step, a phase ("loop iteration 3"), or "the step where your output diverged", using the real trace as input. | Exact data, human explanation. | $0.001–0.003 per explanation (Luna, cached per code hash + input) | **Recommended.** Pro-only or small free quota (`FeatureKey: "visualize_explain"`). |

## 2. Per-language tracer — what is realistic on this stack

Constraints that decide everything: Vercel (no long-lived processes), Judge0 RapidAPI free tier (45 batches/day, D-05), Judge0 CE has no gdb/valgrind and cannot pass `-javaagent` to the standard Java runner, and drivers read stdin in the canonical format (`reference/IO-FORMAT.md`).

| Language | Tracer | Where it runs | Notes |
|---|---|---|---|
| **Python** | `sys.settrace` tracer (port the well-known Python Tutor `pg_logger` idea: per-line event → frames + heap snapshot with object ids) | **In the browser via Pyodide** (WASM CPython; `settrace` works; `setStdin` feeds the canonical stdin). ~7 MB compressed, downloaded once, lazy-loaded only when the user clicks *Visualize*, cached by the browser/CDN. | Zero server cost, zero Judge0 quota, unlimited clicks. Assembled program = `PYTHON_PRELUDE + user code + driver` (`assemble.ts`); driver lines are hidden from the UI by line offset. |
| **JavaScript** | Source instrumentation: parse with `acorn`, insert `__t(line, scopeSnapshot)` calls at every statement/loop head/call/return, run inside a **Web Worker** with a hard step cap + watchdog (terminate). Heap snapshot via structured walk with object identity map. | In the browser | Zero cost. `require("fs").readFileSync(0)` in drivers is shimmed to return the stdin string. Modern syntax fine (acorn ES2022). |
| **Java** | JVM bytecode instrumentation agent (ASM, bundled in the JDK) injecting a probe at every line-number entry; or a JDI tracer (Java Tutor `traceprinter` approach). Compile with `-g`. | **Server**: a small "tracer" container on the same VPS that D-05 already requires for self-hosted Judge0 (`POST /trace {language, source, stdin}` → JSON). | Cannot run on RapidAPI Judge0 (needs `-javaagent`, and quota). Java is the platform's main language, so the VPS is the real unlock. ~0.5–1.5 s per trace. |
| **C++** | `g++ -g -O0` then `gdb --batch -x trace.py` (gdb Python API steps line-by-line, dumps locals; pointers/`vector`/`unordered_map` need pretty-printers). | Same tracer container | Fragile for STL internals; ship after Java. Alternative: Valgrind-based (Python Tutor C mode) — heavier. |

Recommendation: **Phase 1 = Python + JavaScript entirely in-browser** (no infra, no quota, ships on Vercel as-is). **Phase 2 = Java + C++ via the tracer container on the self-hosted judge VPS** (Hetzner CX22 ≈ €4/mo or DigitalOcean $12/mo, shared with Judge0). Same trace JSON format for all four, so the visualizer is written once.

## 3. Trace format (shared by all tracers, rendered by one UI)
```
{ "lang":"python", "userLineRange":[12,40], "steps":[
  { "i":0, "line":14, "event":"line|call|return|exception", "stack":[ {"fn":"twoSum","line":14,"locals":{"nums":"@1","target":9,"i":0}} ],
    "heap":{ "@1":{"type":"list","items":[2,7,11,15]}, "@2":{"type":"dict","entries":[[2,0]]}, "@3":{"type":"ListNode","val":1,"next":"@4"} },
    "stdout":"", "changed":["i","@2"] } ], "truncated":false, "exception":null }
```
- Steps are stored as **deltas** after step 0 (only changed frames/objects) — keeps a 2,000-step trace under ~300 KB.
- Caps: 3,000 steps, 500 heap objects, 20 KB stdout; beyond that the UI says "input too large for a visual run — try a smaller custom case" (the workspace already has custom cases).
- Driver frames are filtered out; the trace starts at the first call into the user's function and shows the driver only as "Test harness → calls `twoSum(nums=[2,7,11,15], target=9)`".
- Because every problem declares `params[] {name,type}` and `returnType` (`ListNode`, `TreeNode`, `int[][]`…), the renderer **knows the shapes** and draws trees as trees, lists as node chains, matrices as grids — an advantage Python Tutor never had.

## 4. The UI (what the student sees)
A "Visualize" button next to Run (workspace `Console` area) → the console panel expands into a 3-column **Trace view** (the workspace layout system already supports maximize):
1. **Code** (Monaco, read-only copy): current line highlighted, an arrow in the gutter, next line dimmed, executed lines get a faint heat tint; click a line to jump to its next execution; breakpoints by clicking the gutter.
2. **Frames**: the call stack as stacked cards (newest on top) with locals; recursion shows depth visually (indent + a mini call-tree on the side: `fib(5) → fib(4) → fib(3)…` with return values filled in as they come back). Values that changed in this step flash and show the previous value struck through.
3. **Memory canvas**: heap objects drawn by type — arrays as cell rows with index labels and pointer markers (`i`, `left`, `right` hover above the cells they point at), dicts/sets as key→value tables, linked lists as boxes with arrows, trees as tidy trees (Reingold–Tilford), graphs as force layouts (frozen after first layout), 2-D grids as heatmaps, stacks/queues/heaps with their shape. Framer-style layout animation so a swap slides, a pointer glides, a node appears.
4. **Timeline** at the bottom: scrubber with step ticks, play/pause, speed 0.25×–4×, step ←/→, "next call / next return / next change of `x`", chapters (auto-detected: function calls, loop iterations, exception) — this is the "slide show" the owner mentioned, without rendering a video.
5. **Output & verdict strip**: stdout so far, expected vs actual for the chosen case, and — when launched from a failed Run — a red marker on the timeline at the step where stdout first diverged from expected ("your output stopped matching here").
6. **Explain (AI)**: per step, per chapter, or "why did this fail?" — Luna `low`, input = problem summary + user code + the ±10 steps around the cursor (never the full trace), output ≤ 300 tokens, cached by `(codeHash, caseIndex, step)`. Optional voice-over later (browser TTS, free).

Keep it beginner-first: plain-language labels ("call stack" → "where we are"), one highlight colour per concept, dark/light tokens from Master Plan §8, and a first-run 20-second guided tour. Exporting a GIF/MP4 of the timeline can come later (client-side canvas capture) if people want to share it; not needed for learning.

## 5. Cost summary
| Item | Cost |
|---|---|
| Python/JS traces | $0 per run (browser CPU). One-time payload: Pyodide ~7 MB compressed (CDN cached), acorn ~30 KB. |
| Java/C++ traces | VPS shared with self-hosted Judge0 (≈ $5–12/mo); ~1 s CPU per trace; rate-limit 10 traces/min/user. |
| AI explanations | ≈ $0.001–0.003 each (Luna `low`, ~2–3k input tokens, ≤ 300 output). 1,000 explanations/day ≈ $2/day worst case; caching and a free-tier quota (e.g. 5/day) keep it lower. |
| Storage | Traces are not stored (recomputed on demand); explanations cached in Firestore `traceExplanations/{hash}` (tiny). |
| Build effort | Trace format + visualizer UI ≈ 3–4 weeks; Python tracer + Pyodide ≈ 1 week; JS instrumentation ≈ 1.5 weeks; Java agent + tracer service ≈ 2 weeks; C++ gdb ≈ 1.5 weeks. |

## 6. Risks / honest limits
- Pyodide first load (a few seconds on a slow connection) — show a progress bar and pre-warm it after the workspace is idle.
- Infinite loops: hard step cap + worker `terminate()`; server tracers get a 5-s wall limit.
- Java in the browser is not viable today (CheerpJ has a commercial licence and no debugger API); Java therefore waits for the VPS.
- Traces of very large inputs are unreadable by design — the product should nudge toward small custom cases, which is also good pedagogy.
- The AI explanation is the only non-deterministic part; keep it clearly labelled and always secondary to the real trace.

## 7. Questions for the owner before this becomes Module 07
1. Phase 1 languages: agree with Python + JavaScript first (works today on Vercel, $0), Java once the judge VPS exists?
2. Is the VPS for self-hosted Judge0 (D-05) going to happen? It unlocks both this feature's Java/C++ and Module 06 (rooms).
3. Free vs Pro: visualizer free for everyone (it is a strong acquisition feature and costs nothing for Python/JS) with AI explanations Pro-only — agree?
4. Any preference for the visual style: Python-Tutor-like (boxes and arrows) vs a more animated "memory canvas" (recommended, more work)?
5. Should the visualizer also be usable on the reference/editorial solution (not just the user's code)? Cheap to add, useful for learning the intended approach.
