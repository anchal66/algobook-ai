import { handler } from "@/lib/api/handler";
import { adminDb } from "@/lib/firebase-admin";
import { AchievementsSchema } from "@/lib/data/schema";
import { catalogForClient, getAchievement } from "@/lib/practice/achievements";

/** Unlocked achievements with catalog metadata, plus the full catalog for the profile page (Module 04 §3.14). */
export const GET = handler({ evt: "me.achievements" }, async ({ user }) => {
  const snap = await adminDb.collection("achievements").doc(user.uid).get();
  const unlocked = snap.exists ? AchievementsSchema.parse(snap.data()).unlocked : [];
  const catalog = catalogForClient();
  const items = unlocked
    .map((u) => ({ id: u.id, at: u.at.toDate().toISOString(), ...(getAchievement(u.id) ? { name: getAchievement(u.id)!.name, description: getAchievement(u.id)!.description, icon: getAchievement(u.id)!.icon } : {}) }))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  const have = new Set(unlocked.map((u) => u.id));
  return { unlocked: items, catalog: catalog.map((c) => ({ ...c, unlocked: have.has(c.id) })), counts: { unlocked: have.size, total: catalog.length } };
});
