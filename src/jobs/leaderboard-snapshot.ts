import "server-only";
/**
 * Leaderboard snapshots (Module 04 §3.10): `leaderboard/global` (top 100), `leaderboard/template_{company}`
 * (users sharing a company template, ranked by template progress) and `leaderboard/week_{yyyy-Www}`
 * (accepted submissions this ISO week from `activity` docs). Hourly via `/api/cron/leaderboard`.
 */
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import * as projects from "@/lib/data/projects";
import * as activity from "@/lib/data/activity";
import { CohortSnapshotSchema, LeaderboardSnapshotSchema, WeeklySnapshotSchema, todayKey, type CohortEntry, type WeeklyEntry } from "@/lib/data/schema";
import { TEMPLATE_COMPANIES } from "@/lib/practice/achievements";
import { assignRanks, isoWeekOf, topRanked, totalRanked } from "@/lib/practice/leaderboard";

const TOP_N = 100;

async function userCards(uids: string[]): Promise<Map<string, { username: string; displayName: string; photoURL: string }>> {
  const out = new Map<string, { username: string; displayName: string; photoURL: string }>();
  for (let i = 0; i < uids.length; i += 100) {
    const refs = uids.slice(i, i + 100).map((u) => adminDb.collection("users").doc(u));
    const snaps = await adminDb.getAll(...refs, { fieldMask: ["username", "displayName", "photoURL"] });
    for (const s of snaps) if (s.exists) out.set(s.id, { username: s.data()?.username ?? "", displayName: s.data()?.displayName ?? "", photoURL: s.data()?.photoURL ?? "" });
  }
  return out;
}

export async function snapshotGlobal(): Promise<{ entries: number; total: number }> {
  const entries = await topRanked(TOP_N);
  const doc = LeaderboardSnapshotSchema.parse({ updatedAt: Timestamp.now(), entries: entries.map(({ rating: _r, level: _l, longestStreak: _s, ...e }) => e) });
  await adminDb.collection("leaderboard").doc("global").set(doc);
  const total = await totalRanked(true);
  return { entries: entries.length, total };
}

/** One cohort per company: the best (most solved) project per user, ranked by progress %. */
export async function snapshotTemplates(companies: string[] = Object.keys(TEMPLATE_COMPANIES)): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const company of companies) {
    const [list, count] = await Promise.all([projects.listByTemplate(company), projects.templateItemCount(company)]);
    const best = new Map<string, { solved: number; items: number }>();
    for (const p of list) {
      const prev = best.get(p.uid);
      if (!prev || p.progress.solved > prev.solved) best.set(p.uid, { solved: p.progress.solved, items: count || p.progress.items });
    }
    const ranked = [...best.entries()]
      .map(([uid, v]) => ({ uid, solved: v.solved, items: v.items, score: v.items ? Math.round((1000 * v.solved) / v.items) / 10 : 0 }))
      .sort((a, b) => b.score - a.score || b.solved - a.solved)
      .slice(0, TOP_N);
    const cards = await userCards(ranked.map((r) => r.uid));
    const entries: CohortEntry[] = assignRanks(ranked, 1).map((r) => ({
      uid: r.uid, ...(cards.get(r.uid) ?? { username: "", displayName: "", photoURL: "" }), solved: r.solved, items: r.items, progressPct: r.score, rank: r.rank,
    }));
    await adminDb.collection("leaderboard").doc(`template_${company}`).set(CohortSnapshotSchema.parse({ company, updatedAt: Timestamp.now(), entries }));
    out[company] = entries.length;
  }
  return out;
}

export async function snapshotWeek(dayKey = todayKey()): Promise<{ week: string; entries: number; activityDocs: number }> {
  const { week, from, to } = isoWeekOf(dayKey);
  const docs = await activity.listRange(from, to);
  const agg = new Map<string, { accepted: number; submissions: number; xpEarned: number; activeDays: number }>();
  for (const d of docs) {
    const a = agg.get(d.uid) ?? { accepted: 0, submissions: 0, xpEarned: 0, activeDays: 0 };
    a.accepted += d.accepted; a.submissions += d.submissions; a.xpEarned += d.xpEarned; a.activeDays += 1;
    agg.set(d.uid, a);
  }
  const ranked = [...agg.entries()].map(([uid, a]) => ({ uid, ...a, score: a.accepted * 10 + a.activeDays * 5 + Math.round(a.xpEarned / 10) }))
    .filter((r) => r.submissions > 0)
    .sort((a, b) => b.score - a.score || b.accepted - a.accepted)
    .slice(0, TOP_N);
  const cards = await userCards(ranked.map((r) => r.uid));
  const entries: WeeklyEntry[] = assignRanks(ranked, 1).map((r) => ({
    uid: r.uid, ...(cards.get(r.uid) ?? { username: "", displayName: "", photoURL: "" }),
    accepted: r.accepted, submissions: r.submissions, xpEarned: r.xpEarned, activeDays: r.activeDays, rank: r.rank,
  }));
  await adminDb.collection("leaderboard").doc(`week_${week}`).set(WeeklySnapshotSchema.parse({ week, from, to, updatedAt: Timestamp.now(), entries }));
  return { week, entries: entries.length, activityDocs: docs.length };
}

export async function runLeaderboardSnapshot(opts: { companies?: string[]; dayKey?: string } = {}) {
  const started = Date.now();
  const [global, templates, week] = await Promise.all([snapshotGlobal(), snapshotTemplates(opts.companies), snapshotWeek(opts.dayKey)]);
  const out = { global, templates, week, ms: Date.now() - started };
  console.info(JSON.stringify({ evt: "leaderboard.snapshot", ...out }));
  return out;
}
