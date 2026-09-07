import "server-only";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/api/errors";
import { LANGUAGES, LANGUAGE_KEYS } from "@/lib/judge/languages";
import { JUDGE_BUSY_MESSAGE, reserveBatch } from "@/lib/judge/budget";

/** Judge0 status ids (https://ce.judge0.com/#statuses-and-languages). */
export const JUDGE0_STATUS = {
  IN_QUEUE: 1, PROCESSING: 2, ACCEPTED: 3, WRONG_ANSWER: 4, TLE: 5, COMPILATION_ERROR: 6,
  RE_SIGSEGV: 7, RE_SIGXFSZ: 8, RE_SIGFPE: 9, RE_SIGABRT: 10, RE_NZEC: 11, RE_OTHER: 12, INTERNAL_ERROR: 13, EXEC_FORMAT_ERROR: 14,
} as const;

export interface BatchItem {
  source_code: string;
  language_id: number;
  stdin: string;
  expected_output?: string;
  cpu_time_limit?: number;
  wall_time_limit?: number;
  memory_limit?: number;
}

export interface RawSubmission {
  token: string;
  status: { id: number; description: string };
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string | null; // seconds
  memory: number | null; // KB
}

const POLL_MS = 700;
const POLL_TIMEOUT_MS = 40_000;
const MAX_BATCH = 20; // Judge0 CE default MAX_SUBMISSION_BATCH_SIZE

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (env.JUDGE0_HOST_HEADER) {
    if (!env.RAPIDAPI_KEY) throw new ApiError(503, "UPSTREAM", "Code execution is not configured on this deployment yet (missing judge credentials). Everything else works; please try again later.", { code: "JUDGE_NOT_CONFIGURED" });
    h["X-RapidAPI-Key"] = env.RAPIDAPI_KEY;
    h["X-RapidAPI-Host"] = env.JUDGE0_HOST_HEADER;
  } else if (env.JUDGE0_AUTH_TOKEN) {
    h["X-Auth-Token"] = env.JUDGE0_AUTH_TOKEN;
  }
  return h;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const unb64 = (s: string | null | undefined) => (s ? Buffer.from(s, "base64").toString("utf8") : "");

async function judge0Fetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${env.JUDGE0_BASE_URL.replace(/\/$/, "")}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...headers(), ...(init?.headers as Record<string, string> | undefined) }, cache: "no-store" });
  } catch (e) {
    throw ApiError.upstream("Judge0 unreachable", (e as Error).message);
  }
  if (res.status === 429) throw new ApiError(503, "UPSTREAM", JUDGE_BUSY_MESSAGE, { code: "JUDGE_RATE_LIMIT" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw ApiError.upstream(`Judge0 error ${res.status}`, text.slice(0, 500));
  }
  return res;
}

let verified: Promise<void> | null = null;

/** `JUDGE_BACKEND=local` runs programs with the host toolchain (dev/eval only, see local.ts). */
export function isLocalBackend(): boolean {
  return env.JUDGE_BACKEND === "local";
}

/** Verifies the four Judge0 language ids exist on this instance (cached for the process lifetime). Fails loudly. */
export function verifyLanguages(): Promise<void> {
  if (!verified) {
    verified = (async () => {
      if (isLocalBackend()) { const { verifyLocalToolchain } = await import("@/lib/judge/local"); await verifyLocalToolchain(); return; }
      const res = await judge0Fetch("/languages");
      const list = (await res.json()) as { id: number; name: string }[];
      const ids = new Set(list.map((l) => l.id));
      const missing = LANGUAGE_KEYS.filter((k) => LANGUAGES[k].enabled && !ids.has(LANGUAGES[k].id));
      if (missing.length) {
        throw new Error(`Judge0 at ${env.JUDGE0_BASE_URL} is missing language ids for: ${missing.map((m) => `${m}(${LANGUAGES[m].id})`).join(", ")}`);
      }
      console.info(JSON.stringify({ evt: "judge0.languages_verified", count: list.length }));
    })().catch((e) => { verified = null; throw e; });
  }
  return verified;
}

/** POST /submissions/batch — returns one token per item (base64 payloads). */
export async function submitBatch(items: BatchItem[]): Promise<string[]> {
  const tokens: string[] = [];
  for (let i = 0; i < items.length; i += MAX_BATCH) {
    const chunk = items.slice(i, i + MAX_BATCH).map((it) => ({
      ...it,
      source_code: b64(it.source_code),
      stdin: b64(it.stdin),
      ...(it.expected_output !== undefined ? { expected_output: b64(it.expected_output) } : {}),
    }));
    const res = await judge0Fetch("/submissions/batch?base64_encoded=true", { method: "POST", body: JSON.stringify({ submissions: chunk }) });
    const data = (await res.json()) as Array<{ token?: string } & Record<string, unknown>>;
    for (const d of data) {
      if (!d.token) throw ApiError.upstream("Judge0 rejected a submission", d);
      tokens.push(d.token);
    }
  }
  return tokens;
}

/** GET /submissions/batch — polls until every token has left the queue (or 20 s elapse). */
export async function pollBatch(tokens: string[]): Promise<RawSubmission[]> {
  const started = Date.now();
  const results = new Map<string, RawSubmission>();
  const fields = "token,status,stdout,stderr,compile_output,message,time,memory";
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    const pending = tokens.filter((t) => !results.has(t));
    if (!pending.length) break;
    for (let i = 0; i < pending.length; i += MAX_BATCH) {
      const chunk = pending.slice(i, i + MAX_BATCH);
      const res = await judge0Fetch(`/submissions/batch?tokens=${chunk.join(",")}&base64_encoded=true&fields=${fields}`);
      const data = (await res.json()) as { submissions: Array<Record<string, unknown>> };
      data.submissions.forEach((raw, idx) => {
        const status = raw.status as { id: number; description: string } | undefined;
        const id = status?.id ?? (raw.status_id as number | undefined) ?? 0;
        if (id === JUDGE0_STATUS.IN_QUEUE || id === JUDGE0_STATUS.PROCESSING || id === 0) return;
        results.set((raw.token as string) ?? chunk[idx], {
          token: (raw.token as string) ?? chunk[idx],
          status: { id, description: status?.description ?? "" },
          stdout: unb64(raw.stdout as string | null),
          stderr: unb64(raw.stderr as string | null),
          compile_output: unb64(raw.compile_output as string | null),
          message: unb64(raw.message as string | null),
          time: (raw.time as string | null) ?? null,
          memory: (raw.memory as number | null) ?? null,
        });
      });
    }
    if (results.size < tokens.length) await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return tokens.map((t) => results.get(t) ?? {
    token: t, status: { id: JUDGE0_STATUS.INTERNAL_ERROR, description: "Timed out waiting for Judge0" },
    stdout: "", stderr: "", compile_output: "", message: "poll timeout", time: null, memory: null,
  });
}

/** Submit + poll in one call. */
export async function runBatch(items: BatchItem[]): Promise<RawSubmission[]> {
  if (!items.length) return [];
  if (isLocalBackend()) { const { runBatchLocal } = await import("@/lib/judge/local"); return runBatchLocal(items); }
  await reserveBatch();
  const tokens = await submitBatch(items);
  return pollBatch(tokens);
}
