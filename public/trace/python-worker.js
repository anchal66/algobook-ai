/**
 * AlgoBook visualizer — Python worker (Module 07 §3.2). Served as a static file so it runs as a real
 * ES-module worker: Pyodide refuses classic workers, and the bundled worker chunk is classic.
 * The tracer source and the prelude arrive with every request (strings), so nothing here is generated.
 *
 * Messages in:  { type: "run", id, tracer, prelude, user, driver, stdin, maxSteps, maxHeap, wallMs }
 * Messages out: { type: "progress", id, phase, detail? } | { type: "result", id, trace } | { type: "error", id, message }
 */
const PYODIDE_VERSION = "314.0.7";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodidePromise = null;
let tracerLoaded = false;

async function loadPython(post, id) {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      post({ type: "progress", id, phase: "loading-python", detail: "Downloading the Python runtime (once per session)…" });
      const mod = await import(`${INDEX_URL}pyodide.mjs`);
      return mod.loadPyodide({ indexURL: INDEX_URL });
    })().catch((e) => { pyodidePromise = null; throw e; });
  }
  return pyodidePromise;
}

self.onmessage = async (e) => {
  const msg = e.data;
  if (!msg || msg.type !== "run") return;
  const post = (m) => self.postMessage(m);
  try {
    const py = await loadPython(post, msg.id);
    if (!tracerLoaded) { py.runPython(msg.tracer); tracerLoaded = true; }
    if (!msg.user && !msg.driver) { post({ type: "result", id: msg.id, trace: null }); return; } // warm-up only
    post({ type: "progress", id: msg.id, phase: "running" });
    const fn = py.globals.get("run_trace");
    let json;
    try {
      json = fn(msg.prelude, msg.user, msg.driver, msg.stdin, msg.maxSteps, msg.maxHeap, msg.wallMs);
    } finally {
      if (fn && typeof fn.destroy === "function") fn.destroy();
    }
    post({ type: "result", id: msg.id, trace: JSON.parse(String(json)) });
  } catch (err) {
    post({ type: "error", id: msg.id, message: (err && err.message) || "The Python visualizer failed" });
  }
};
