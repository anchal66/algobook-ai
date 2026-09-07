import "server-only";
/**
 * Mock interview backend (Module 04 §3.12, D-11 stretch). `start` picks two verified problems by rating
 * (1 Medium + 1 Medium/Hard), links them into the user's system "Interview" project and opens an
 * `interviews/{id}` doc with a deadline; the workspace runs in interview mode (countdown, no hints /
 * editorial / tutor). `finish` collects the submissions made during the window and asks the Module 02
 * model (purpose `review`, interviewer instruction set) for strengths / weaknesses / a score.
 */
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError } from "@/lib/api/errors";
import * as problems from "@/lib/data/problems";
import * as projects from "@/lib/data/projects";
import * as submissions from "@/lib/data/submissions";
import { InterviewSchema, type Difficulty, type Interview, type InterviewFeedback, type User, type WithId } from "@/lib/data/schema";
import { aiCall } from "@/lib/ai/client";
import { getSeenProblemIds } from "@/lib/practice";
import { RATING_SEED } from "@/lib/practice/rating";

const COL = "interviews";
export const INTERVIEW_DURATIONS = [30, 45, 60] as const;

function parse(snap: FirebaseFirestore.DocumentSnapshot): WithId<Interview> | null {
  return snap.exists ? { id: snap.id, ...InterviewSchema.parse(snap.data()) } : null;
}

export async function getInterview(id: string, uid: string): Promise<WithId<Interview>> {
  const it = parse(await adminDb.collection(COL).doc(id).get());
  if (!it || it.uid !== uid) throw ApiError.notFound("Interview not found");
  return it;
}

export async function activeInterview(uid: string): Promise<WithId<Interview> | null> {
  const snap = await adminDb.collection(COL).where("uid", "==", uid).where("status", "==", "active").limit(1).get();
  if (snap.empty) return null;
  const it = parse(snap.docs[0])!;
  if (it.endsAt.toMillis() < Date.now()) return it; // caller decides (finish or expire)
  return it;
}

async function pickProblem(difficulty: Difficulty, targetRating: number, exclude: string[]) {
  const res = await problems.search({ difficulty, status: "verified", excludeIds: exclude, limit: 40 });
  const pool = res.items.filter((p) => p.languages.length >= 1);
  if (!pool.length) return null;
  pool.sort((a, b) => Math.abs(a.rating - targetRating) - Math.abs(b.rating - targetRating));
  return pool[0];
}

export interface StartOptions { durationMin: number; difficulty: "mixed" | "medium" | "hard" }

export async function startInterview(uid: string, user: User, opts: StartOptions): Promise<{ interview: WithId<Interview>; projectId: string }> {
  const existing = await activeInterview(uid);
  if (existing && existing.endsAt.toMillis() > Date.now()) throw ApiError.conflict("An interview is already in progress", { interviewId: existing.id });
  if (existing) await adminDb.collection(COL).doc(existing.id).update({ status: "expired" });

  const seen = await getSeenProblemIds(uid);
  const rating = user.stats.rating;
  const firstDiff: Difficulty = opts.difficulty === "hard" ? "Hard" : "Medium";
  const secondDiff: Difficulty = opts.difficulty === "medium" ? "Medium" : opts.difficulty === "hard" || rating >= 1500 ? "Hard" : "Medium";
  // Prefer unseen problems; when the bank is too small (dev / early launch) fall back to seen ones rather than failing.
  const pick = async (diffs: Difficulty[], target: number, exclude: string[]) => {
    for (const d of diffs) { const p = await pickProblem(d, target, exclude); if (p) return p; }
    for (const d of diffs) { const p = await pickProblem(d, target, exclude.filter((id) => !seen.includes(id))); if (p) return p; }
    return null;
  };
  const p1 = await pick([firstDiff, "Medium", "Easy"], rating + 100, seen);
  if (!p1) throw ApiError.conflict("Not enough verified problems to start an interview");
  const p2 = await pick([secondDiff, "Medium", "Easy", "Hard"], rating + 300, [...seen, p1.id]);
  if (!p2) throw ApiError.conflict("Not enough verified problems to start an interview");

  const project = await projects.ensureSystemProject(uid, "interview", "Mock Interviews", "Timed interview sessions: two problems, no hints, AI interviewer feedback at the end.");
  for (const [i, p] of [p1, p2].entries()) {
    if (!(await projects.getItem(project.id, p.id))) {
      await projects.addItem(project.id, {
        problemId: p.id, title: p.title, difficulty: p.difficulty, tags: p.tags, source: "curated",
        reason: { short: `Interview problem ${i + 1}`, detail: `Problem ${i + 1} of your timed mock interview.`, facts: [] },
      });
    }
  }
  const now = Timestamp.now();
  const doc = InterviewSchema.parse({
    uid, projectId: project.id, status: "active", durationMin: opts.durationMin, difficulty: opts.difficulty,
    problems: [p1, p2].map((p) => ({ problemId: p.id, title: p.title, difficulty: p.difficulty, rating: p.rating })),
    startedAt: now, endsAt: Timestamp.fromMillis(now.toMillis() + opts.durationMin * 60_000), finishedAt: null, feedback: null,
  });
  const ref = adminDb.collection(COL).doc();
  await ref.set(doc);
  console.info(JSON.stringify({ evt: "interview.start", uid, id: ref.id, problems: doc.problems.map((p) => p.problemId), durationMin: opts.durationMin }));
  return { interview: { id: ref.id, ...doc }, projectId: project.id };
}

// ── finish → AI interviewer feedback ────────────────────────────────────────

const InterviewAiSchema = z.object({
  score: z.number().min(0).max(10),
  verdict: z.enum(["strong-hire", "hire", "lean-hire", "no-hire"]),
  strengths: z.array(z.string()).min(1).max(5),
  weaknesses: z.array(z.string()).min(1).max(5),
  summary: z.string(),
  perProblem: z.array(z.object({ problemId: z.string(), note: z.string() })),
});

export const INTERVIEWER_INSTRUCTIONS = `You are a senior software engineer debriefing after a timed mock coding interview (two problems, no hints).
Assess the candidate the way a fair, encouraging interviewer would: problem solving, correctness, code quality, time management and communication as evidenced by the code.
Return JSON matching the schema: score 0-10 (10 = strong hire), verdict, 1-5 concrete strengths, 1-5 concrete weaknesses with actionable advice, a 3-5 sentence summary, and one short note per problem (reference problemId exactly as given).
Be specific: cite the actual approach used, complexity, and what a better approach would be when the solution was suboptimal or unsolved. Do not invent facts that are not in the transcript.`;

interface Attempt { verdict: string; passed: number; total: number; runtimeMs: number; timeSpentSec: number; hintsUsed: number; language: string; createdAt: string; code: string }

async function attemptsFor(uid: string, problemId: string, sinceMs: number): Promise<Attempt[]> {
  const page = await submissions.list(uid, { problemId, limit: 50 });
  const out: Attempt[] = [];
  for (const row of page.items) {
    if (row.createdAt.toMillis() < sinceMs) continue;
    const full = await submissions.get(row.id, uid);
    out.push({ verdict: row.verdict, passed: row.passed, total: row.total, runtimeMs: row.runtimeMs, timeSpentSec: row.timeSpentSec, hintsUsed: row.hintsUsed, language: row.language, createdAt: row.createdAt.toDate().toISOString(), code: full?.code ?? "" });
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

function transcript(it: WithId<Interview>, attempts: Record<string, Attempt[]>): string {
  const lines: string[] = [`Interview: ${it.durationMin} minutes, ${it.problems.length} problems, difficulty ${it.difficulty}.`];
  for (const p of it.problems) {
    const list = attempts[p.problemId] ?? [];
    const solved = list.some((a) => a.verdict === "AC");
    lines.push(`\n## Problem ${p.problemId}: ${p.title} (${p.difficulty}, rating ${Math.round(p.rating)}) — ${solved ? "SOLVED" : "NOT SOLVED"}, ${list.length} submission(s)`);
    list.forEach((a, i) => lines.push(`- attempt ${i + 1} at ${a.createdAt}: ${a.verdict} ${a.passed}/${a.total}, ${a.runtimeMs} ms, ${a.timeSpentSec}s on the clock, ${a.language}`));
    const best = [...list].reverse().find((a) => a.verdict === "AC") ?? list[list.length - 1];
    if (best) lines.push(`\nFinal code (${best.language}, ${best.verdict}):\n\`\`\`\n${best.code.slice(0, 6000)}\n\`\`\``);
    else lines.push("No code submitted.");
  }
  return lines.join("\n");
}

export async function finishInterview(id: string, uid: string): Promise<{ interview: WithId<Interview>; cached: boolean; costUsd: number }> {
  const it = await getInterview(id, uid);
  if (it.feedback) return { interview: it, cached: true, costUsd: 0 };
  const since = it.startedAt.toMillis();
  const attempts: Record<string, Attempt[]> = {};
  for (const p of it.problems) attempts[p.problemId] = await attemptsFor(uid, p.problemId, since);

  const res = await aiCall({ purpose: "review", schema: InterviewAiSchema, schemaName: "interview_feedback", instructions: INTERVIEWER_INSTRUCTIONS, input: transcript(it, attempts), uid, promptCacheKey: "interview" });
  const feedback: InterviewFeedback = {
    score: res.data.score, verdict: res.data.verdict, strengths: res.data.strengths, weaknesses: res.data.weaknesses, summary: res.data.summary,
    perProblem: it.problems.map((p) => {
      const list = attempts[p.problemId] ?? [];
      return {
        problemId: p.problemId, title: p.title, solved: list.some((a) => a.verdict === "AC"), attempts: list.length,
        timeSpentSec: list.reduce((m, a) => Math.max(m, a.timeSpentSec), 0),
        note: res.data.perProblem.find((n) => n.problemId === p.problemId)?.note ?? "",
      };
    }),
    model: res.model, createdAt: Timestamp.now(),
  };
  await adminDb.collection(COL).doc(id).update({ status: "finished", finishedAt: Timestamp.now(), feedback });
  console.info(JSON.stringify({ evt: "interview.finish", uid, id, score: feedback.score, verdict: feedback.verdict, costUsd: res.costUsd }));
  return { interview: { ...it, status: "finished", finishedAt: feedback.createdAt, feedback }, cached: false, costUsd: res.costUsd };
}

export { RATING_SEED };
