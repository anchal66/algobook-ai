# Module 07 — Code Visualizer ("watch my code run")

| Field | Value |
|---|---|
| **Status** | COMPLETE (2026-09-29) — see status log for deferred items |
| Branch | `module/07-visualizer` |
| Depends on | 03 (workspace, `useWorkspace`, Monaco, console panel, custom cases), 02 (`aiCall`, model policy for explanations), 01 (`assemble.ts` prelude/driver layout, `stdin.ts` encoders, quotas) |
| Independent of | Judge0 entirely (Phase 1 traces run in the browser). Works on the free tier with $0 per run. |
| Decisions used | D-23 (Phase 1 Python + JavaScript in-browser; Java/C++ deferred until a self-hosted judge exists), D-04 (quota model for AI explanations) |
| Estimated size | ~5,500 LOC (tracers 1,400 · trace UI 3,000 · AI + routes 400 · tests 700) |

## 0. Context for a fresh assistant
1. Read `00-MASTER-PLAN.md` §4, §7 (model policy — you add one purpose), §8 (tokens), §10 (Definition of Done); `DECISIONS.md` D-23; and **`reference/CODE-VISUALIZER-DISCUSSION.md`** (the why: real execution trace, never AI-simulated; AI only narrates).
2. Read the code you extend:
   - `src/lib/judge/assemble.ts` — how user code, prelude and driver are concatenated per language. The tracer runs the **same assembled program** so the driver parses the canonical stdin (`reference/IO-FORMAT.md`) and calls the user's function exactly as the judge does. Line offsets: Python prelude is a fixed number of lines (count it at build time), JS has no prelude; driver lines follow the user code.
   - `src/lib/judge/human.ts` (`fromHuman`) + `src/lib/judge/stdin.ts` — the workspace's testcase panel already produces canonical stdin per case; you reuse it to feed the tracer.
   - `src/lib/data/problems.ts` `getDrivers` is **server-only** (drivers are private). Phase 1 needs the driver in the browser → add `GET /api/problems/:id/driver?language=` returning the driver **only for `python`/`javascript`** and only to signed-in users (drivers contain no hidden tests; they are harness code — confirm with `git grep` that no driver embeds expected outputs; `IO-FORMAT` says they do not). Never return `private/tests`.
   - `src/store/workspace.ts`, `src/components/workspace/Console/*` (TestcaseTab, TestResultTab, CaseChips), `Layout/layoutRegistry.ts` (panel ids, maximize), `TopBar/RunSubmitCluster.tsx` (where the Visualize button goes), `Code/MonacoEditor.tsx` (read-only Monaco instance for the trace view; decorations API for the current line).
   - `src/lib/ai/models.ts`, `client.ts`, `features.ts`, `prompts/index.ts` — add purpose `trace_explain`.
   - `src/lib/auth/quotas.ts`, `src/lib/plans.ts`, `FeatureKeySchema` — add `visualizeExplain` (free 5/day, pro 200/day). The visualizer itself has **no quota** (client-side only).
   - `src/lib/practice/interview.ts` `assertNotInActiveInterview` (and Module 06's `assertNotInRestrictedSession` when it exists) — AI explanations are refused during interviews/rooms; the visualizer itself stays available (it is the user's own code, no assistance beyond a debugger).
3. Dev: `dev-local` launch config; unit tests with vitest (tracers are testable in Node: the Python tracer via a `python3` subprocess fixture runner, the JS instrumenter directly); browser checklist in §6.

## 1. Goal
One click on **Visualize** turns the console into an interactive, animated, step-by-step replay of the student's own code on the selected test case: current line, call stack with locals, and a memory canvas that draws arrays, hash maps, linked lists, trees, graphs and grids as pictures, with a scrubbable timeline. When a Run failed, the replay marks the exact step where the output stopped matching. An optional AI narration explains any step in plain language. Exact by construction (real execution), free to use, no server round-trip for Python and JavaScript.

## 2. Scope
**In (Phase 1):** Python (Pyodide + `sys.settrace`) and JavaScript (acorn instrumentation in a Web Worker) tracers, shared trace format, trace UI (code · frames · memory canvas · timeline · output strip), failure-divergence marker, AI explanations, first-run tour, settings (speed, reduced motion), telemetry.
**Out:** Java and C++ (need a tracer service next to a self-hosted judge — spec kept in the discussion doc §2, revisit with D-05), video/GIF export, sharing traces by URL, visualizing reference solutions (cheap follow-up: same pipeline on `content/editorial` code — tick as a stretch task V-21), mobile layout (desktop ≥ 1024 px; mobile shows "open on a larger screen").

## 3. Technical specification

### 3.1 Trace format — `src/lib/trace/types.ts` (+ zod for the AI route)
```ts
interface Trace {
  lang: "python" | "javascript";
  userLines: [from: number, to: number];        // 1-based lines of the user's code in the editor
  entry: { fn: string; args: Record<string, Value> }; // the harness call, e.g. twoSum(nums=@1, target=9)
  steps: Step[];                                 // step 0 is complete; later steps are deltas
  stdout: string; expected?: string; divergeAt?: number;  // first step whose stdout prefix no longer matches expected
  exception?: { step: number; type: string; message: string };
  truncated: false | "steps" | "heap" | "time";
}
interface Step { i: number; line: number; ev: "line" | "call" | "return" | "exception";
  stack?: Frame[];               // full stack when it changed shape, else omitted
  locals?: Record<frameId, Record<name, Value>>;   // only changed names
  heap?: Record<id, HeapObj | null>;               // changed/new objects (null = unreachable now)
  ret?: Value; out?: string;     // return value on "return"; stdout appended in this step
  changed: string[];             // names/ids that changed → UI flashes them
}
type Value = number | string | boolean | null | { ref: string } | { special: "undefined" | "inf" | "-inf" | "nan" };
type HeapObj =
  | { t: "list"; items: Value[] } | { t: "tuple"; items: Value[] } | { t: "set"; items: Value[] }
  | { t: "dict"; entries: [Value, Value][] } | { t: "str"; v: string }
  | { t: "node"; cls: string; fields: Record<string, Value> }   // ListNode/TreeNode/any instance
  | { t: "func"; name: string } | { t: "matrix"; rows: Value[][] } | { t: "other"; cls: string; repr: string };
```
Caps: 3,000 steps, 500 live heap objects, 50 elements shown per container (rest collapsed with "+N"), 20 KB stdout, 5 s wall time. Reason for truncation is shown in the UI with the advice "try a smaller custom case".
Shape hints: the UI reads the problem's `params[].type` / `returnType` (`ListNode`, `TreeNode`, `int[][]`, …) and the object's field names (`next`, `left/right`, `neighbors`/`children`) to pick the renderer; a `node` graph with `next` only → linked list; `left/right` → binary tree; adjacency `dict`/`list[list]` referenced by a variable named like `graph|adj|edges` → graph view (user can switch renderer manually in a dropdown per object).

### 3.2 Python tracer — `src/lib/trace/python/tracer.py` + `runner.ts`
- Pyodide pinned (`pyodide@0.27.x` or the current stable at build time) loaded from jsDelivr **only when Visualize is first clicked**; `loadPyodide({ indexURL })`; progress bar from fetch events; keep the instance for the session (`window.__algobookPyodide`). Fallback message if WebAssembly is unavailable.
- Program = `PYTHON_PRELUDE + userCode` compiled with filename `<user>` and the driver compiled with filename `<driver>`; both `exec`'d in one globals dict so the driver sees the user's function (mirrors `assemble()`); `sys.stdin = io.StringIO(stdin)`; `sys.stdout` captured.
- `sys.settrace` handler records events only for frames whose `co_filename == "<user>"` (plus the single driver→user `call` as the entry). Locals serialised with `id()`-based heap ids; primitives inline; containers and instances into `heap`; cycle-safe; `__dict__`-based instance capture for ListNode/TreeNode-like classes; functions/classes as `func`. Deltas computed in Python (previous snapshot kept) to keep the transferred JSON small; result handed to JS as a string (`pyodide.runPythonAsync` return) then `JSON.parse`.
- Step cap raises `TraceLimit`; wall-time guard via the worker (§3.4). Recursion limit stays the prelude's 10,000 but `sys.settrace` overhead means deep recursion hits the step cap first — fine.
- Exceptions: the `exception` event records type/message and the trace ends at that step (the UI shows the red step and the message, same wording as the console).
- Tests (`tracer.test.ts`, Node + local `python3`): fixtures for loops, nested functions, recursion (fib, permutations), list mutation, dict growth, ListNode/TreeNode traversal, exception, step-cap, stdout capture.

### 3.3 JavaScript tracer — `src/lib/trace/js/instrument.ts` + `runtime.ts`
- Parse with `acorn` (ES2022, `sourceType: "script"`), walk with `acorn-walk`, generate with `astring`. Transform the **user code only** (driver appended untouched, but its calls into user functions are still traced because the probes live in the user functions).
- Instrumentation: `__t.line(n, {a, b, c})` before every statement and loop test (locals object built from variables **declared textually before this point** in the enclosing function/blocks — avoids TDZ; parameters included; `this` omitted); function bodies wrapped `__t.enter("name", n, {params}) … finally { __t.exit() }`; `return e` → `return __t.ret(e)`; `throw` recorded in the enter/exit wrapper's catch. Arrow functions with expression bodies are converted to block bodies. Class methods and generators supported; `async/await` not traced (rare in DSA code; recorded as `other`).
- Runtime (`__t`): step counter with the 3,000 cap (throws `TraceLimit`), heap identity via `WeakMap`, snapshots of arrays/objects/Map/Set/class instances (constructor name → `cls`), deltas against the previous snapshot, `console.log` capture, `require("fs").readFileSync(0)` shim returning the stdin string, `process.stdout.write` shim.
- Execution in a **Web Worker** (`new Worker(new URL("./worker.ts", import.meta.url))`): `new Function("__t", "require", "process", "console", code)`; the main thread terminates the worker after 5 s (wall time) → `truncated: "time"`.
- Tests: same fixture set as Python plus JS specifics (closures in loops with `let`, destructuring, class-based ListNode, `Map`/`Set`, arrow functions, TDZ safety).

### 3.4 Orchestration — `src/lib/trace/run.ts` + `src/store/trace.ts`
`visualize(caseIndex)`: reads the workspace store (problem, language, code, cases), builds stdin with `fromHuman` → canonical encoding, fetches the driver (`/api/problems/:id/driver`, cached per problem+language in memory), runs the language tracer, computes `divergeAt` when the case has `expected` (compare stdout prefix per step), stores `Trace` in `useTrace` (zustand): `status`, `trace`, `cursor`, `playing`, `speed`, `breakpoints`, `selected` (object/variable focus), `explanations` cache. Python and JS both run off the main thread (Pyodide inside the same worker module; one worker per language kept warm).

### 3.5 UI — `src/components/workspace/Trace/*`
Trigger: a **Visualize** button in `RunSubmitCluster` (keyboard `⌘⇧V`), enabled for `python`/`javascript`; other languages show a tooltip "Available for Python and JavaScript" (a small "why" link → docs). Uses the currently selected case chip; after a failed Run, the Test Result tab shows "Visualize this case" next to the failing case.
The console panel switches to a `trace` tab and the layout maximises it (the existing maximize mechanism); Esc restores.
- **Code column**: read-only Monaco (`MonacoEditor` with `readOnly`), current-line decoration + gutter arrow, next-line dim, execution-count heat tint (opacity by count), click a line → next step on it, gutter click → breakpoint (play stops there).
- **Frames column**: stack cards newest on top; locals as `name = value` rows, refs rendered as small chips that highlight the object on the canvas on hover/click; changed values flash (`animate` 320 ms) with the old value struck through; recursion depth badge; a collapsible **call tree** (built from call/return events: `fib(5) → fib(4) → …` with return values filling in) for recursive traces.
- **Memory canvas** (SVG): renderers `ArrayView` (cells, indices, pointer flags for variables that hold an index into that array — detected when an integer local is used as `arr[i]` in the source, else shown as plain locals), `MatrixView` (grid, heat by value optional), `DictView` (key → value table; `set` as chips), `ListView` (nodes + arrows, `next` pointers, cycle-safe, variables pointing at nodes shown as labelled arrows), `TreeView` (`d3-hierarchy` tidy layout, `left/right`, null slots faint), `GraphView` (`d3-force`, layout computed once and frozen; adjacency from dict/list), `StackQueueView` for lists whose only mutations are push/pop/shift (auto-detected from access pattern; user can switch). Objects keep a stable position across steps (`layoutId`), so changes animate: swaps slide, a pointer glides, nodes appear/disappear. Framer Motion `LayoutGroup` in this panel only; `prefers-reduced-motion` → no motion.
- **Timeline** (bottom): scrubber with step ticks coloured by event (call/return/exception), play/pause, speed 0.25×–4×, step ←/→ (`←`/`→` keys), "next call", "next return", "next change of <selected variable>", "jump to failure" (`divergeAt` / exception), chapters strip auto-derived (function calls, loop iterations by detecting back-edges: a `line` step whose line ≤ previous line inside the same frame starts "iteration k").
- **Output strip**: stdout so far vs expected (diff-highlighted from `divergeAt`), the verdict chip of the last Run for this case.
- **Explain (AI)**: button on the current step and on each chapter; "Why does it fail?" when `divergeAt`/exception exists. Streams into a side note (SSE like tutor chat). Pro/free quota via `visualizeExplain`; refused in interview/room mode (403 → hidden).
- **Empty/edge states**: trace truncated (banner + tip), exception (red step + message), Pyodide loading (progress with size), WebAssembly unavailable, worker crash (retry).
- **First-run tour**: 5 tooltips (line, frames, memory, timeline, explain), stored in `users.settings.tours.trace` via `PATCH /api/me/settings`.
- **Beginner wording** in labels: "Where we are" (stack), "What's in memory" (heap), "Step through" (timeline). Tokens from Master Plan §8; one accent per concept: current line brand, changed value amber, failure red, return green.

### 3.6 AI explanation — purpose `trace_explain`
`MODEL_POLICY.trace_explain = { model: "gpt-5.6-luna", reasoning: "low", verbosity: "low", maxOutputTokens: 400 }`. Route `POST /api/problems/:id/trace-explain` `{ language, code, caseIndex, window: Step[] (±10 steps around the cursor, ≤ 8 KB), question: "step" | "chapter" | "failure", expected?, stdoutSoFar }` → SSE text. Instructions: explain **only what the trace shows**, refer to variable names and line numbers, ≤ 120 words, never propose full solutions (hint-level at most), for `failure` point to the first step where state diverges from what a correct approach needs without giving the fix. Cache key `sha256(code + caseIndex + question + cursorStep)` in `traceExplanations/{hash}` (text, model, createdAt; 30-day TTL cleanup in the daily cron). Log to `aiUsage`. Cost ≈ $0.001–0.003 per call.

### 3.7 Telemetry & settings
`track("visualize", { lang, steps, truncated, ms })`, `track("visualize_explain")`. Settings modal: playback speed default, motion on/off, "auto-open after failed Run" (off by default).

### 3.8 Bundle & performance
Trace UI, acorn/astring, d3-hierarchy/d3-force and the workers are in a lazy chunk (`next/dynamic`) loaded on first Visualize; Pyodide from CDN pinned. Target: no change to the workspace's initial JS; trace of 1,000 steps renders scrub at 60 fps (virtualise the frames list if > 30 frames; SVG object count capped at 500).

## 4. Tasks
- [x] V-01 Trace types + zod + delta/undelta helpers + tests (`src/lib/trace/`)
- [x] V-02 Driver route `GET /api/problems/:id/driver` (python/javascript only, auth, cached), audit that drivers contain no expected outputs
- [x] V-03 Python tracer (`tracer.py`) + Node fixture tests
- [x] V-04 Pyodide loader (pinned CDN, progress, warm instance, stdin/stdout wiring) in a worker
- [x] V-05 JS instrumenter (acorn → probes, scope-aware locals, function wrappers) + tests
- [x] V-06 JS runtime (`__t`, snapshots, deltas, shims, caps) + worker + tests
- [x] V-07 Orchestrator `visualize()` + `useTrace` store + divergence detection
- [x] V-08 Visualize button, shortcut, case selection, "Visualize this case" on failures, `trace` console tab + maximize
- [x] V-09 Code column (read-only Monaco, decorations, heat tint, click-to-step, breakpoints)
- [x] V-10 Frames column (stack cards, change flashes, ref chips, call tree)
- [x] V-11 Memory canvas core (layout registry, stable ids, LayoutGroup, renderer switcher)
- [x] V-12 Renderers: Array/Matrix/Dict/Set
- [x] V-13 Renderers: LinkedList/Tree (d3-hierarchy)/Graph (d3-force)/StackQueue + shape detection from `params`
- [x] V-14 Timeline (scrubber, play/speed, step/next-call/next-return/next-change, jump-to-failure, chapters)
- [x] V-15 Output strip + divergence diff
- [x] V-16 AI explain: purpose, prompt, route (SSE), cache doc + cron cleanup, quota `visualizeExplain`, restricted-mode refusal, UI
- [x] V-17 Edge states, reduced motion, telemetry — **tour and the playback-default settings deferred** (playback speed lives in the timeline; the first-run tour is a follow-up)
- [x] V-18 Lazy chunking + perf pass (1,000-step trace scrub, 500 objects)
- [x] V-19 Unit + component tests (renderers with fixtures; timeline reducer)
- [x] V-20 Browser checklist (§6) run in the desktop Browser pane (see status log); **QA captures under `qa/07/` deferred** (verified interactively, no screenshot set); docs + memory; Ship it
- [ ] V-21 *(stretch, deferred)* Visualize the editorial's reference solution (Pro) with the same pipeline

## 5. Acceptance criteria
1. Two Sum in Python and in JavaScript: Visualize on sample 1 produces a trace whose final stdout equals the Run output; the array, the dict growing per iteration, and `i` pointing at cells are visible; scrubbing is smooth.
2. A recursive Python solution (e.g. permutations or tree DFS) shows the call tree filling with return values; a TreeNode input renders as a tree; a ListNode input renders as a chain with pointer arrows.
3. A wrong solution: "Visualize this case" from the failed Run opens with the timeline stopped at the divergence step; "Why does it fail?" streams an explanation that references real variable names and lines without giving the solution.
4. Infinite loop → trace truncated at 3,000 steps within 5 s, UI usable; exception → red step with the same message as the console.
5. Pyodide loads once per session with a progress bar; second Visualize is instant; no Judge0 call is made (network tab).
6. `visualizeExplain` quota: free user gets 5/day then 429 with the standard message; Pro 200; refused in interview mode.
7. Workspace initial JS unchanged (route size diff); axe 0 serious/critical; dark + light; reduced motion honoured; keyboard: ←/→, space, Esc.
8. Java/C++ show the "Available for Python and JavaScript" tooltip, nothing else breaks.

## 6. Browser test checklist
1. [ ] Python Two Sum sample 1: Visualize → dict grows, pointer flags, final output matches.
2. [ ] JS Two Sum: same; closures in a `for (let …)` loop trace correctly.
3. [ ] Python recursion (fib(6) custom case): call tree, depth badges, return values.
4. [ ] TreeNode problem (e.g. max depth): tree renders, current node highlights per step.
5. [ ] ListNode problem (reverse list): pointers `prev/curr/next` glide; final chain reversed.
6. [ ] Graph BFS problem: adjacency → graph view, visited set chips grow, queue view.
7. [ ] Failed Run → "Visualize this case" → divergence marker; Explain step; Why does it fail.
8. [ ] Infinite loop truncation; raised exception; Pyodide progress on a throttled network; WebAssembly disabled message (Chrome flag).
9. [ ] Breakpoints, chapters, next-change-of-variable, speed 4×, Esc restores layout, shortcut ⌘⇧V.
10. [ ] Quota: 6th explain on a free account → 429 toast; Pro OK; interview mode hides Explain.
11. [ ] Java/C++ selected → tooltip only.
12. [ ] Dark/light captures; reduced motion; 1024-px layout; mobile notice; axe clean; build green; no Judge0 requests during visualization.

## 7. Status log
| Date | Status | Notes |
|---|---|---|
| 2026-09-29 | NOT STARTED | Planned after the owner chose to stay on the Judge0 free tier: Phase 1 is fully in-browser (Python via Pyodide, JavaScript via acorn instrumentation), $0 per run; AI explanations Luna `low` under a new `visualizeExplain` quota; Java/C++ deferred (D-23). |
| 2026-09-29 | STARTED → IN PROGRESS → COMPLETE | Built on `module/07-visualizer` (base `main` fcb4e8c). Delivered: shared delta trace format + `Replayer`/chapters/divergence (`src/lib/trace/`), JavaScript tracer (acorn instrumentation with TDZ-safe getter closures, `__t` runtime, worker), Python tracer (`sys.settrace` inside Pyodide 314.0.7 from jsDelivr; runs in the static module worker `public/trace/python-worker.js` because Turbopack emits classic workers and Pyodide refuses them), `GET /api/problems/:id/driver` (python/javascript only), `POST /api/problems/:id/trace-explain` (SSE, Luna `low`, purpose `trace_explain`, quota `visualizeExplain` free 5 / pro 200, cache `traceExplanations`), workspace integration (Visualize button replaces the old disabled Debug placeholder, shortcut ⌘⌥', console tab "Visualize" auto-maximised, "Visualize this case / See why this case fails" on Test Result), trace UI (read-only Monaco with current-line/heat/breakpoint decorations, frames column with flashes + return values, memory canvas: arrays with index pointers, matrices, maps, sets, linked-list chains, trees, graphs; timeline with play/speed/step/next-call/next-return/next-change/jump-to-failure + chapters; output vs expected strip; AI explain panel). Tests: 29 new (JS tracer 11, Python tracer 7 via host python3, replay 5, shapes 6) → 209 total; tsc clean; lint 0 errors; `next build` green. **Browser-verified (desktop Browser pane, owner account, `dev-local`):** Python Two Sum → 11 exact steps, dict growth, return value, output = expected; buggy Python (reversed indices) opens at the divergence step with the red marker, `i ▲` under the array cell, "Why does it fail?" reaches the route (OpenAI answered "no credits remaining" on the owner's account, surfaced as a friendly error, no quota consumed); JavaScript one-liner → 12 steps, Map entries, playback advances and stops at the end, stale banner after editing. Fixed during verification: single-line loops were mis-detected as iterations (chapters now require a strictly backward jump); a stale Turbopack CSS chunk hid the line highlight until a recompile. **Deferred:** first-run tour, `qa/07` screenshot set + light-theme captures (tokens are shared with the workspace), V-21 reference-solution replay, Java/C++ (D-23). Merged into `main` — SHA in `STATUS.md`. |
