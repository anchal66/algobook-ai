import "server-only";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { JUDGE0_STATUS, type BatchItem, type RawSubmission } from "@/lib/judge/judge0";
import { LANGUAGES } from "@/lib/judge/languages";

/**
 * Local execution backend (`JUDGE_BACKEND=local`): compiles and runs programs with the
 * host toolchain (javac/java, python3, g++, node). Same `runBatch` contract as Judge0.
 * For development, the evaluation script and CI only — no sandboxing. Never use in production.
 */

interface Runner {
  compile?: (dir: string, src: string) => Promise<{ ok: true } | { ok: false; output: string }>;
  run: (dir: string) => { cmd: string; args: string[] };
  file: string;
}

const RUNNERS: Record<number, Runner> = {
  [LANGUAGES.java.id]: {
    file: "Main.java",
    compile: (dir, src) => exec("javac", ["-encoding", "UTF-8", "-d", dir, src], dir, 60_000).then((r) => (r.code === 0 ? { ok: true } : { ok: false, output: r.stderr || r.stdout })),
    run: (dir) => ({ cmd: "java", args: ["-Xss64m", "-Xmx512m", "-cp", dir, "Main"] }),
  },
  [LANGUAGES.python.id]: { file: "main.py", run: (dir) => ({ cmd: "python3", args: [path.join(dir, "main.py")] }) },
  [LANGUAGES.cpp.id]: {
    file: "main.cpp",
    compile: (dir, src) => exec("g++", ["-O2", "-std=c++17", "-o", path.join(dir, "prog"), src], dir, 60_000).then((r) => (r.code === 0 ? { ok: true } : { ok: false, output: r.stderr || r.stdout })),
    run: (dir) => ({ cmd: path.join(dir, "prog"), args: [] }),
  },
  [LANGUAGES.javascript.id]: { file: "main.js", run: (dir) => ({ cmd: "node", args: [path.join(dir, "main.js")] }) },
};

interface ExecResult { code: number | null; stdout: string; stderr: string; timedOut: boolean; ms: number }

function exec(cmd: string, args: string[], cwd: string, timeoutMs: number, stdin = ""): Promise<ExecResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = "", stderr = "", timedOut = false;
    const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.stdout.on("data", (d) => { if (stdout.length < 1_000_000) stdout += d.toString(); });
    child.stderr.on("data", (d) => { if (stderr.length < 200_000) stderr += d.toString(); });
    child.on("error", (e) => { clearTimeout(timer); resolve({ code: 127, stdout, stderr: e.message, timedOut, ms: Date.now() - started }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut, ms: Date.now() - started }); });
    child.stdin.on("error", () => undefined);
    child.stdin.end(stdin);
  });
}

const compiled = new Map<string, Promise<{ dir: string; error: string | null }>>();

async function prepare(languageId: number, source: string): Promise<{ dir: string; error: string | null }> {
  const runner = RUNNERS[languageId];
  const key = `${languageId}:${createHash("sha1").update(source).digest("hex")}`;
  let p = compiled.get(key);
  if (!p) {
    p = (async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "algobook-judge-"));
      const src = path.join(dir, runner.file);
      await fs.writeFile(src, source, "utf8");
      if (runner.compile) {
        const r = await runner.compile(dir, src);
        if (!r.ok) return { dir, error: r.output.slice(0, 20_000) || "compilation failed" };
      }
      return { dir, error: null };
    })();
    compiled.set(key, p);
    if (compiled.size > 64) { const first = compiled.keys().next().value; if (first) compiled.delete(first); }
  }
  return p;
}

const CONCURRENCY = 4;

/** Local equivalent of judge0.runBatch: one RawSubmission per item, same status ids. */
export async function runBatchLocal(items: BatchItem[]): Promise<RawSubmission[]> {
  const out: RawSubmission[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      const it = items[i];
      const runner = RUNNERS[it.language_id];
      const token = `local-${i}-${Date.now()}`;
      if (!runner) { out[i] = raw(token, JUDGE0_STATUS.INTERNAL_ERROR, "", "", "", `no local runner for language id ${it.language_id}`, null, null); continue; }
      const prep = await prepare(it.language_id, it.source_code);
      if (prep.error) { out[i] = raw(token, JUDGE0_STATUS.COMPILATION_ERROR, "", "", prep.error, null, null, null); continue; }
      const { cmd, args } = runner.run(prep.dir);
      const limitMs = Math.ceil((it.cpu_time_limit ?? 5) * 1000) + (it.language_id === LANGUAGES.java.id ? 1500 : 500);
      const r = await exec(cmd, args, prep.dir, limitMs, it.stdin);
      const time = (r.ms / 1000).toFixed(3);
      if (r.timedOut) out[i] = raw(token, JUDGE0_STATUS.TLE, r.stdout, r.stderr, "", null, time, null);
      else if (r.code !== 0) out[i] = raw(token, JUDGE0_STATUS.RE_NZEC, r.stdout, r.stderr, "", `Exited with error status ${r.code}`, time, null);
      else out[i] = raw(token, JUDGE0_STATUS.ACCEPTED, r.stdout, r.stderr, "", null, time, null);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return out;
}

function raw(token: string, id: number, stdout: string, stderr: string, compile: string, message: string | null, time: string | null, memory: number | null): RawSubmission {
  return { token, status: { id, description: "" }, stdout, stderr, compile_output: compile, message, time, memory };
}

/** Checks the host toolchain once (fails loudly like verifyLanguages does for Judge0). */
export async function verifyLocalToolchain(): Promise<void> {
  const checks: [string, string[]][] = [["javac", ["-version"]], ["java", ["-version"]], ["python3", ["--version"]], ["g++", ["--version"]], ["node", ["--version"]]];
  const missing: string[] = [];
  for (const [cmd, args] of checks) {
    const r = await exec(cmd, args, os.tmpdir(), 15_000);
    if (r.code !== 0) missing.push(cmd);
  }
  if (missing.length) throw new Error(`JUDGE_BACKEND=local but these tools are missing: ${missing.join(", ")}`);
  console.info(JSON.stringify({ evt: "judge.local_toolchain_verified" }));
}
