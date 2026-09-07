/**
 * Prints every top-level Firestore collection with a document count, plus the
 * seeded fixtures Module 01 depends on. Read-only.
 *
 *   npm run db:status
 */
import "./_bootstrap";
import { projectIdFromCredential } from "./_bootstrap";
import { getAdminDb } from "../src/lib/firebase-admin";

async function main() {
  const db = getAdminDb();
  console.log(`Project ${projectIdFromCredential()}`);

  const cols = await db.listCollections();
  if (!cols.length) {
    console.log("  (no collections)");
  }
  for (const col of cols.sort((a, b) => a.id.localeCompare(b.id))) {
    const n = (await col.count().get()).data().count;
    console.log(`  ${col.id.padEnd(16)} ${String(n).padStart(6)}`);
  }

  const problem = await db.collection("problems").doc("two-sum").get();
  if (problem.exists) {
    const d = problem.data()!;
    const tests = await db.collection("problems").doc("two-sum").collection("private").doc("tests").get();
    const hidden = (tests.data()?.hiddenTests as unknown[] | undefined)?.length ?? 0;
    console.log(`\n  problems/two-sum: status=${d.status} languages=[${(d.languages as string[]).join(",")}] sample=${(d.sampleTests as unknown[]).length} hidden=${hidden}`);
  } else {
    console.log("\n  problems/two-sum: MISSING — run `npm run db:seed:sample`");
  }

  const templates = await db.collection("templates").get();
  if (templates.empty) console.log("  templates: MISSING — run `npm run db:seed:templates`");
  else console.log(`  templates: ${templates.docs.map((t) => `${t.id}=${t.data().count}`).join(" ")}`);

  const subs = await db.collection("subscriptions").where("status", "==", "active").get();
  console.log(`  active subscriptions: ${subs.size}${subs.size ? ` (${subs.docs.map((s) => `${s.data().uid}:${s.data().planSlug}`).join(", ")})` : ""}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
