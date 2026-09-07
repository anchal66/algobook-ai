import { handler } from "@/lib/api/handler";
import * as problems from "@/lib/data/problems";
import { adminDb } from "@/lib/firebase-admin";

/** `GET /api/admin/problems/flagged` (Module 05 U-20): flagged problems with their reports, most-flagged first. */
export const GET = handler({ evt: "admin.problems.flagged", admin: true }, async () => {
  const flagged = await problems.listFlagged(100);
  const items = await Promise.all(flagged.map(async (p) => {
    const snap = await adminDb.collection("reports").where("problemId", "==", p.id).limit(20).get();
    const reports = snap.docs.map((d) => {
      const r = d.data();
      return { id: d.id, uid: String(r.uid ?? ""), reason: String(r.reason ?? ""), details: String(r.details ?? ""), createdAt: r.createdAt?.toDate?.().toISOString?.() ?? null };
    }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return { id: p.id, slug: p.slug, title: p.title, difficulty: p.difficulty, status: p.status, tags: p.tags, flagCount: p.flagCount, flagReasons: p.flagReasons, reports };
  }));
  return { items };
});
