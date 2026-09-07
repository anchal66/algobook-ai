/**
 * D-02: back up every top-level collection (recursively) to backups/<timestamp>/
 * then delete EVERYTHING, including `subscriptions`. Requires --yes.
 * Refuses to run against any project other than algobook-c9caa unless --project is passed.
 *
 *   npm run db:wipe -- --yes
 *   npm run db:wipe -- --yes --project other-project-id
 *   npm run db:wipe -- --dry-run           (backup + counts only)
 */
import fs from "node:fs";
import path from "node:path";
import { args, projectIdFromCredential, EXPECTED_PROJECT } from "./_bootstrap";
import { getAdminDb } from "../src/lib/firebase-admin";

type Doc = { id: string; data: Record<string, unknown>; collections: Record<string, Doc[]> };

function jsonSafe(v: unknown): unknown {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown> & { toDate?: () => Date; toArray?: () => number[]; path?: string };
    if (typeof o.toDate === "function") return { __timestamp: o.toDate().toISOString() };
    if (typeof o.toArray === "function") return { __vector: o.toArray() };
    if (typeof o.path === "string" && "firestore" in o) return { __ref: o.path };
    if (Array.isArray(v)) return v.map(jsonSafe);
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) out[k] = jsonSafe(x);
    return out;
  }
  return v;
}

async function dumpCollection(col: FirebaseFirestore.CollectionReference, counter: { docs: number }): Promise<Doc[]> {
  const snap = await col.get();
  const out: Doc[] = [];
  for (const d of snap.docs) {
    counter.docs++;
    const sub: Record<string, Doc[]> = {};
    for (const c of await d.ref.listCollections()) sub[c.id] = await dumpCollection(c, counter);
    out.push({ id: d.id, data: jsonSafe(d.data()) as Record<string, unknown>, collections: sub });
  }
  return out;
}

async function main() {
  const a = args();
  const db = getAdminDb();
  const projectId = projectIdFromCredential();
  const allowed = a.project ? String(a.project) : EXPECTED_PROJECT;
  if (projectId !== allowed) throw new Error(`Refusing: credential is for "${projectId}" but expected "${allowed}" (pass --project ${projectId} to override)`);
  const dryRun = Boolean(a["dry-run"]);
  if (!a.yes && !dryRun) throw new Error("Refusing to wipe without --yes (use --dry-run to only back up)");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "backups", stamp);
  fs.mkdirSync(dir, { recursive: true });

  const cols = await db.listCollections();
  console.log(`Project ${projectId}: ${cols.length} top-level collections → ${dir}`);
  const before: Record<string, number> = {};
  for (const col of cols) {
    const counter = { docs: 0 };
    const docs = await dumpCollection(col, counter);
    fs.writeFileSync(path.join(dir, `${col.id}.json`), JSON.stringify(docs, null, 2));
    before[col.id] = counter.docs;
    console.log(`  backed up ${col.id}: ${counter.docs} docs (incl. subcollections)`);
  }
  fs.writeFileSync(path.join(dir, "_manifest.json"), JSON.stringify({ projectId, at: stamp, counts: before }, null, 2));
  if (dryRun) { console.log("Dry run — nothing deleted."); return; }

  for (const col of cols) {
    await db.recursiveDelete(col);
    console.log(`  deleted ${col.id}`);
  }
  const after = await db.listCollections();
  const remaining: Record<string, number> = {};
  for (const col of after) remaining[col.id] = (await col.count().get()).data().count;
  console.log("Before:", JSON.stringify(before));
  console.log("After :", JSON.stringify(remaining), after.length === 0 ? "(empty)" : "");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
