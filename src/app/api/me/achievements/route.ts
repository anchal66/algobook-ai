import { handler } from "@/lib/api/handler";
import { adminDb } from "@/lib/firebase-admin";
import { AchievementsSchema } from "@/lib/data/schema";
import { catalogForClient, getAchievement } from "@/lib/practice/achievements";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { getByUsername } from "@/lib/data/users";
import type { AuthedUser } from "@/lib/auth/types";

/** Unlocked achievements with catalog metadata, plus the full catalog for the profile page (Module 04 §3.14). */
export const GET = handler<unknown, { username?: string }, AuthedUser | null>({ evt: "me.achievements", auth: "optional", query: z.object({ username: z.string().max(20).optional() }) }, async ({ user: caller, query }) => {
  let uid: string;
  if (query.username) {
    const u = await getByUsername(query.username);
    if (!u || (!u.publicProfile && u.id !== caller?.uid)) throw ApiError.notFound("User not found");
    uid = u.id;
  } else {
    if (!caller) throw ApiError.unauthenticated();
    uid = caller.uid;
  }
  const snap = await adminDb.collection("achievements").doc(uid).get();
  const unlocked = snap.exists ? AchievementsSchema.parse(snap.data()).unlocked : [];
  const catalog = catalogForClient();
  const items = unlocked
    .map((u) => ({ id: u.id, at: u.at.toDate().toISOString(), ...(getAchievement(u.id) ? { name: getAchievement(u.id)!.name, description: getAchievement(u.id)!.description, icon: getAchievement(u.id)!.icon } : {}) }))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  const have = new Set(unlocked.map((u) => u.id));
  return { unlocked: items, catalog: catalog.map((c) => ({ ...c, unlocked: have.has(c.id) })), counts: { unlocked: have.size, total: catalog.length } };
});
