import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { adminDb } from "@/lib/firebase-admin";
import { DateKeySchema, todayKey } from "@/lib/data/schema";

const QuerySchema = z.object({ from: DateKeySchema.optional(), to: DateKeySchema.optional() });
const MAX_DOCS = 5000;

interface Bucket { calls: number; failed: number; costUsd: number; inputTokens: number; cachedTokens: number; outputTokens: number; reasoningTokens: number; latencyMs: number }
const empty = (): Bucket => ({ calls: 0, failed: 0, costUsd: 0, inputTokens: 0, cachedTokens: 0, outputTokens: 0, reasoningTokens: 0, latencyMs: 0 });

/** Totals of `aiUsage` by purpose / model / day for [from, to] (UTC dates, inclusive; default last 7 days). */
export const GET = handler({ evt: "admin.ai_usage", admin: true, query: QuerySchema }, async ({ query }) => {
  const to = query.to ?? todayKey();
  const from = query.from ?? todayKey(new Date(Date.now() - 6 * 86_400_000));
  if (from > to) throw ApiError.validation("from must be <= to");
  const start = Timestamp.fromDate(new Date(`${from}T00:00:00.000Z`));
  const end = Timestamp.fromDate(new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000));
  const snap = await adminDb.collection("aiUsage").where("createdAt", ">=", start).where("createdAt", "<", end).orderBy("createdAt", "desc").limit(MAX_DOCS).get();

  const byPurpose: Record<string, Bucket> = {}, byModel: Record<string, Bucket> = {}, byDay: Record<string, Bucket> = {};
  const total = empty();
  const add = (b: Bucket, d: FirebaseFirestore.DocumentData) => {
    b.calls++; if (d.ok === false) b.failed++;
    b.costUsd += d.costUsd ?? 0; b.inputTokens += d.inputTokens ?? 0; b.cachedTokens += d.cachedTokens ?? 0; b.outputTokens += d.outputTokens ?? 0; b.reasoningTokens += d.reasoningTokens ?? 0; b.latencyMs += d.latencyMs ?? 0;
  };
  for (const doc of snap.docs) {
    const d = doc.data();
    const day = (d.createdAt as Timestamp).toDate().toISOString().slice(0, 10);
    add(total, d);
    add((byPurpose[d.purpose] ??= empty()), d);
    add((byModel[d.model] ??= empty()), d);
    add((byDay[day] ??= empty()), d);
  }
  const round = (b: Bucket) => ({ ...b, costUsd: Math.round(b.costUsd * 1e4) / 1e4, avgLatencyMs: b.calls ? Math.round(b.latencyMs / b.calls) : 0 });
  const mapRound = (m: Record<string, Bucket>) => Object.fromEntries(Object.entries(m).sort().map(([k, v]) => [k, round(v)]));
  return { from, to, truncated: snap.size >= MAX_DOCS, total: round(total), byPurpose: mapRound(byPurpose), byModel: mapRound(byModel), byDay: mapRound(byDay) };
});
