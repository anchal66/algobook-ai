"use client";
/**
 * Typed client for every route the workspace uses (Module 03). All calls go through
 * `apiFetch` (Firebase ID token attached, error envelope → ApiError). SSE routes use `sseFetch`.
 */
import { auth } from "@/lib/firebase";
import { apiFetch, ApiError } from "@/lib/api-client";
import type {
  ChatTurn, CompleteResponse, DraftDTO, EditorialResponse, EnsureLanguageResponse, ExplainResponse, HintResponse, Language, MeResponse,
  NextResult, NoteDTO, ProblemListResponse, ProblemResponse, ProjectResponse, ReportReason, ReviewResponse, RunCaseInput, RunResponse,
  StageEvent, SubmissionDTO, SubmissionsResponse, SubmitMeta, SubmitResponse,
} from "@/lib/workspace/types";
import type { UserSettings } from "@/types";

export { ApiError };

// ── SSE ──────────────────────────────────────────────────────────────────────

export type SseHandler = (event: string, data: unknown) => void;

/** Reads a text/event-stream response and dispatches `{event, data}` pairs. */
export async function readSse(res: Response, onEvent: SseHandler, signal?: AbortSignal): Promise<void> {
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* ignore */ }
    const err = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, (err?.code ?? "INTERNAL") as never, err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    if (signal?.aborted) { await reader.cancel(); return; }
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
      let event = "message", data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (data) { try { onEvent(event, JSON.parse(data)); } catch { onEvent(event, data); } }
    }
  }
}

export async function sseFetch(path: string, body: unknown, onEvent: SseHandler, signal?: AbortSignal): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Sign in required");
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await readSse(res, onEvent, signal);
}

// ── Problems / projects ──────────────────────────────────────────────────────

export const getProblem = (idOrSlug: string, lang?: Language) =>
  apiFetch<ProblemResponse>(`/api/problems/${encodeURIComponent(idOrSlug)}${lang ? `?lang=${lang}` : ""}`);

export const listProblems = (q: { tags?: string; difficulty?: string; q?: string; cursor?: string; limit?: number } = {}) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return apiFetch<ProblemListResponse>(`/api/problems${s ? `?${s}` : ""}`);
};

export const getProject = (id: string) => apiFetch<ProjectResponse>(`/api/projects/${id}`);

export const ensureLanguage = (problemId: string, language: Language) =>
  apiFetch<EnsureLanguageResponse>(`/api/problems/${problemId}/languages`, { method: "POST", body: { language, wait: true } });

export const reportProblem = (problemId: string, reason: ReportReason, details?: string) =>
  apiFetch<{ ok: true; flagCount: number; retired: boolean }>(`/api/problems/${problemId}/report`, { method: "POST", body: { reason, details } });

// ── Run / submit / submissions ───────────────────────────────────────────────

export const runCode = (problemId: string, language: Language, code: string, cases: RunCaseInput[]) =>
  apiFetch<RunResponse>("/api/run", { method: "POST", body: { problemId, language, code, cases } });

export const submitCode = (problemId: string, language: Language, code: string, meta: SubmitMeta, projectId?: string) =>
  apiFetch<SubmitResponse>("/api/submit", { method: "POST", body: { problemId, projectId, language, code, meta } });

export const listSubmissions = (problemId: string, cursor?: string) =>
  apiFetch<SubmissionsResponse>(`/api/submissions?problemId=${encodeURIComponent(problemId)}${cursor ? `&cursor=${cursor}` : ""}&limit=50`);

export const getSubmission = (id: string) => apiFetch<{ submission: SubmissionDTO }>(`/api/submissions/${id}`);

// ── Drafts / notes ───────────────────────────────────────────────────────────

export const putDraft = (problemId: string, language: Language, code: string) =>
  apiFetch<{ draft: DraftDTO }>(`/api/drafts/${problemId}`, { method: "PUT", body: { language, code } });
export const getDraft = (problemId: string) => apiFetch<{ draft: DraftDTO | null }>(`/api/drafts/${problemId}`);
export const getNote = (problemId: string) => apiFetch<{ note: NoteDTO | null }>(`/api/notes/${problemId}`);
export const putNote = (problemId: string, markdown: string) => apiFetch<{ note: NoteDTO }>(`/api/notes/${problemId}`, { method: "PUT", body: { markdown } });

// ── AI features ──────────────────────────────────────────────────────────────

export const getHint = (problemId: string, level: 1 | 2 | 3, ctx?: { code?: string; language?: Language }) =>
  apiFetch<HintResponse>(`/api/problems/${problemId}/hints`, { method: "POST", body: { level, ...ctx } });
export const getEditorial = (problemId: string) => apiFetch<EditorialResponse>(`/api/problems/${problemId}/editorial`);
export const reviewSubmission = (problemId: string, submissionId: string) =>
  apiFetch<ReviewResponse>(`/api/problems/${problemId}/review`, { method: "POST", body: { submissionId } });
export const explainError = (problemId: string, language: Language, code: string, output: string) =>
  apiFetch<ExplainResponse>(`/api/problems/${problemId}/explain-error`, { method: "POST", body: { language, code, output } });
export const completeCode = (body: { language: Language; prefix: string; suffix: string; problemId?: string }, signal?: AbortSignal) =>
  apiFetch<CompleteResponse>("/api/ai/complete", { method: "POST", body, signal });

export const chatStream = (problemId: string, messages: ChatTurn[], ctx: { code?: string; language?: Language }, onDelta: (t: string) => void, signal?: AbortSignal) =>
  new Promise<string>((resolve, reject) => {
    let full = "";
    sseFetch(`/api/problems/${problemId}/chat`, { messages, ...ctx }, (event, data) => {
      if (event === "delta") { const t = (data as { text: string }).text; full += t; onDelta(t); }
      else if (event === "done") { const t = (data as { text?: string }).text; if (t) full = t; }
      else if (event === "error") reject(new ApiError(502, "UPSTREAM", (data as { message?: string }).message ?? "Chat failed"));
    }, signal).then(() => resolve(full), reject);
  });

/** `POST /api/projects/:id/next` with the SSE stream: stage events then `done` with the result. */
export const nextProblemStream = (projectId: string, opts: { userPrompt?: string; language?: Language }, onStage: (s: StageEvent) => void, signal?: AbortSignal) =>
  new Promise<NextResult>((resolve, reject) => {
    let result: NextResult | null = null;
    sseFetch(`/api/projects/${projectId}/next`, { ...opts, stream: true }, (event, data) => {
      if (event === "stage") onStage(data as StageEvent);
      else if (event === "done") result = data as NextResult;
      else if (event === "error") { const e = data as { code?: string; status?: number; message?: string; details?: unknown }; reject(new ApiError(e.status ?? 503, (e.code ?? "UPSTREAM") as never, e.message ?? "Generation failed", e.details)); }
    }, signal).then(() => { if (result) resolve(result); else reject(new ApiError(502, "UPSTREAM", "The generation stream ended without a result")); }, reject);
  });

// ── Me / settings ────────────────────────────────────────────────────────────

export const getMe = () => apiFetch<MeResponse>("/api/me");
export const patchSettings = (patch: Partial<{ editor: Partial<UserSettings["editor"]>; layout: Record<string, unknown>; timer: Partial<UserSettings["timer"]>; shortcuts: Record<string, string> }>) =>
  apiFetch<{ settings: UserSettings }>("/api/me/settings", { method: "PATCH", body: patch });
