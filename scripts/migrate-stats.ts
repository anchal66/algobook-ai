/**
 * Module 04 P-10: brings existing v2 `users/{uid}` docs up to the v2 stats shape.
 *  - adds the new counters with defaults (streakFreezes, ratedSolves, dailySolved, noHintSolves, languagesAccepted),
 *  - adds `editorialViews` to every topic skill, normalises legacy `srs` (due today),
 *  - recomputes `stats.level` (1 + floor(sqrt(xp/50))) and `stats.score` with the v2 formula,
 *  - sets `lastAppliedSubmissionId` / `dailyProjectId` to null when absent.
 *
 *   npm run db:migrate:stats            # dry run (prints what would change)
 *   npm run db:migrate:stats -- --apply # write
 */
import "./_bootstrap";
import { args, projectIdFromCredential } from "./_bootstrap";
import { getAdminDb } from "../src/lib/firebase-admin";
import { UserSchema, todayKey } from "../src/lib/data/schema";
import { averageMastery } from "../src/lib/practice/mastery";
import { normalizeSrs } from "../src/lib/practice/srs";
import { levelFor, scoreFor } from "../src/lib/practice/stats";

async function main() {
  const a = args();
  const apply = a.apply === true;
  const db = getAdminDb();
  const today = todayKey();
  console.log(`Project ${projectIdFromCredential()} — ${apply ? "APPLY" : "DRY RUN"}`);
  const snap = await db.collection("users").get();
  let changed = 0;
  for (const doc of snap.docs) {
    const raw = doc.data();
    const user = UserSchema.parse(raw);
    const topicSkills: Record<string, unknown> = {};
    for (const [k, s] of Object.entries(user.topicSkills)) topicSkills[k] = { ...s, editorialViews: s.editorialViews ?? 0, srs: normalizeSrs(s.srs, today) };
    const stats = { ...user.stats, level: levelFor(user.stats.xp) };
    stats.score = scoreFor(stats, averageMastery(user.topicSkills));
    const update = {
      stats, topicSkills,
      lastAppliedSubmissionId: user.lastAppliedSubmissionId ?? null,
      dailyProjectId: user.dailyProjectId ?? null,
    };
    const before = JSON.stringify({ stats: raw.stats, topicSkills: raw.topicSkills, l: raw.lastAppliedSubmissionId, d: raw.dailyProjectId });
    const after = JSON.stringify({ stats: update.stats, topicSkills: update.topicSkills, l: update.lastAppliedSubmissionId, d: update.dailyProjectId });
    if (before === after) continue;
    changed++;
    console.log(`  ${doc.id} (${user.username}): score ${raw.stats?.score ?? "-"} → ${stats.score}, level ${raw.stats?.level ?? "-"} → ${stats.level}, skills ${Object.keys(topicSkills).length}`);
    if (apply) await doc.ref.update(update);
  }
  console.log(`${changed}/${snap.size} user(s) ${apply ? "updated" : "would change"}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
