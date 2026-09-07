/**
 * Read-only: reports whether the live Firestore rules match firebase/firestore.rules,
 * which composite indexes from firebase/firestore.indexes.json exist, and the
 * top-level collections with document counts. Never writes anything.
 *
 *   npx tsx scripts/check-firestore-status.ts
 */
import fs from "node:fs";
import path from "node:path";
import { JWT } from "google-auth-library";
import { projectIdFromCredential } from "./_bootstrap";
import { getAdminDb } from "../src/lib/firebase-admin";

function credentials(): { client_email: string; private_key: string } {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) return JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"));
  throw new Error("Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_KEY");
}

async function main() {
  const projectId = projectIdFromCredential();
  const c = credentials();
  const jwt = new JWT({ email: c.client_email, key: c.private_key, scopes: ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/firebase"] });
  await jwt.authorize();
  const get = async (url: string) => {
    const r = await jwt.request({ url, validateStatus: () => true });
    return { status: r.status, data: r.data as Record<string, unknown> };
  };

  console.log(`Project: ${projectId}`);

  // Rules
  const rel = await get(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`);
  if (rel.status >= 300) console.log(`Rules: release lookup failed ${rel.status} ${JSON.stringify(rel.data)}`);
  else {
    const rulesetName = rel.data.rulesetName as string;
    const rs = await get(`https://firebaserules.googleapis.com/v1/${rulesetName}`);
    const files = ((rs.data.source as { files?: { content: string }[] })?.files) ?? [];
    const live = (files[0]?.content ?? "").trim();
    const local = fs.readFileSync(path.join(process.cwd(), "firebase", "firestore.rules"), "utf8").trim();
    console.log(`Rules: live ruleset ${rulesetName.split("/").pop()} (created ${rs.data.createTime}), updated ${rel.data.updateTime}`);
    console.log(`Rules: ${live === local ? "MATCH local firebase/firestore.rules (v2 deployed)" : "DIFFER from local file (v2 NOT deployed)"}`);
    if (live !== local) console.log(`Rules: live head → ${live.split("\n").slice(0, 4).join(" | ")}`);
  }

  // Indexes
  const idx = await get(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/-/indexes`);
  const existing = ((idx.data.indexes as Record<string, unknown>[]) ?? []).map((i) => ({
    cg: (i.name as string).split("/collectionGroups/")[1].split("/")[0],
    state: i.state as string,
    fields: ((i.fields as { fieldPath: string; order?: string; arrayConfig?: string; vectorConfig?: { dimension: number } }[]) ?? []).filter((f) => f.fieldPath !== "__name__"),
  }));
  const key = (cg: string, fields: typeof existing[number]["fields"]) => `${cg}|${fields.map((f) => `${f.fieldPath}:${f.order ?? f.arrayConfig ?? (f.vectorConfig ? `vector${f.vectorConfig.dimension}` : "")}`).join(",")}`;
  const have = new Map(existing.map((i) => [key(i.cg, i.fields), i.state]));
  const wanted = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase", "firestore.indexes.json"), "utf8")).indexes as { collectionGroup: string; fields: typeof existing[number]["fields"] }[];
  console.log(`Indexes: ${existing.length} live, ${wanted.length} wanted`);
  for (const w of wanted) {
    const k = key(w.collectionGroup, w.fields.filter((f) => f.fieldPath !== "__name__"));
    console.log(`  ${have.has(k) ? have.get(k) : "MISSING"}  ${k}`);
  }

  // Collections
  const db = getAdminDb();
  const cols = await db.listCollections();
  console.log(`Collections: ${cols.length}`);
  for (const col of cols) console.log(`  ${col.id}: ${(await col.count().get()).data().count}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
