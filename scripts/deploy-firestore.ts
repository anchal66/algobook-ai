/**
 * Deploys `firebase/firestore.rules` and `firebase/firestore.indexes.json` using
 * the project's service account and the official Google APIs (Firebase Rules API
 * + Firestore Admin API). Equivalent to:
 *
 *     firebase deploy --only firestore:rules,firestore:indexes
 *
 * but runnable without the Firebase CLI / interactive login, so CI (and this
 * repo's automation) can ship rules and indexes.
 *
 *   npm run db:deploy                 # rules + indexes, waits for indexes to build
 *   npm run db:deploy -- --print-gcloud   # print the equivalent gcloud commands
 *   npm run db:deploy -- --rules-only
 *   npm run db:deploy -- --indexes-only
 *   npm run db:deploy -- --no-wait
 */
import fs from "node:fs";
import path from "node:path";
import { JWT } from "google-auth-library";
import { args, projectIdFromCredential } from "./_bootstrap";

const RULES_FILE = path.join(process.cwd(), "firebase", "firestore.rules");
const INDEXES_FILE = path.join(process.cwd(), "firebase", "firestore.indexes.json");
const DATABASE = "(default)";

interface IndexField {
  fieldPath: string;
  order?: "ASCENDING" | "DESCENDING";
  arrayConfig?: "CONTAINS";
  vectorConfig?: { dimension: number; flat: Record<string, never> };
}
interface IndexDef {
  collectionGroup: string;
  queryScope: "COLLECTION" | "COLLECTION_GROUP";
  fields: IndexField[];
}

function credentials(): { client_email: string; private_key: string } {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) return JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"));
  throw new Error("Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_KEY");
}

async function client() {
  const c = credentials();
  const jwt = new JWT({
    email: c.client_email,
    key: c.private_key,
    scopes: ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/firebase"],
  });
  await jwt.authorize();
  return jwt;
}

async function api(jwt: JWT, method: string, url: string, body?: unknown) {
  const res = await jwt.request({ url, method: method as "GET", body: body ? JSON.stringify(body) : undefined, headers: { "Content-Type": "application/json" }, validateStatus: () => true });
  return { status: res.status, data: res.data as Record<string, unknown> };
}

/** Uploads the rules source as a new ruleset and points the live release at it. */
async function deployRules(jwt: JWT, projectId: string) {
  const source = fs.readFileSync(RULES_FILE, "utf8");
  const created = await api(jwt, "POST", `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, {
    source: { files: [{ name: "firestore.rules", content: source }] },
  });
  if (created.status >= 300) throw new Error(`ruleset create failed: ${created.status} ${JSON.stringify(created.data)}`);
  const rulesetName = created.data.name as string;
  console.log(`  ruleset created: ${rulesetName}`);

  const releaseName = `projects/${projectId}/releases/cloud.firestore`;
  let rel = await api(jwt, "PATCH", `https://firebaserules.googleapis.com/v1/${releaseName}`, { release: { name: releaseName, rulesetName } });
  if (rel.status === 404) {
    rel = await api(jwt, "POST", `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`, { name: releaseName, rulesetName });
  }
  if (rel.status >= 300) throw new Error(`release failed: ${rel.status} ${JSON.stringify(rel.data)}`);
  console.log(`  release updated: ${releaseName} → ${rulesetName.split("/").pop()}`);
}

const indexKey = (cg: string, fields: IndexField[]) =>
  `${cg}|${fields.filter((f) => f.fieldPath !== "__name__").map((f) => `${f.fieldPath}:${f.order ?? f.arrayConfig ?? (f.vectorConfig ? `vector${f.vectorConfig.dimension}` : "")}`).join(",")}`;

async function listIndexes(jwt: JWT, projectId: string) {
  const out: (IndexDef & { name: string; state: string })[] = [];
  let pageToken = "";
  do {
    // The wildcard collection-group listing rejects an explicit pageSize ("Only 0 is supported").
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(DATABASE)}/collectionGroups/-/indexes${pageToken ? `?pageToken=${pageToken}` : ""}`;
    const res = await api(jwt, "GET", url);
    if (res.status >= 300) throw new Error(`list indexes failed: ${res.status} ${JSON.stringify(res.data)}`);
    for (const idx of ((res.data.indexes as Record<string, unknown>[]) ?? [])) {
      const name = idx.name as string;
      out.push({
        name,
        state: idx.state as string,
        collectionGroup: name.split("/collectionGroups/")[1].split("/")[0],
        queryScope: idx.queryScope as IndexDef["queryScope"],
        fields: (idx.fields as IndexField[]) ?? [],
      });
    }
    pageToken = (res.data.nextPageToken as string) ?? "";
  } while (pageToken);
  return out;
}

/**
 * The equivalent `gcloud` invocation. Printed when the service account lacks
 * `datastore.indexes.create` (the Firebase Admin SDK service agent does by
 * default), so the indexes can be created with owner credentials instead.
 * Note the vector syntax differs from every other field config.
 */
export function gcloudCommand(projectId: string, idx: IndexDef): string {
  const fields = idx.fields
    .filter((f) => f.fieldPath !== "__name__")
    .map((f) =>
      f.vectorConfig
        ? `--field-config=vector-config='{"dimension":"${f.vectorConfig.dimension}","flat":"{}"}',field-path=${f.fieldPath}`
        : f.arrayConfig
          ? `--field-config=field-path=${f.fieldPath},array-config=contains`
          : `--field-config=field-path=${f.fieldPath},order=${(f.order ?? "ASCENDING").toLowerCase()}`,
    );
  return `gcloud firestore indexes composite create --project=${projectId} --collection-group=${idx.collectionGroup} --query-scope=${idx.queryScope} ${fields.join(" ")} --async`;
}

async function deployIndexes(jwt: JWT, projectId: string, wait: boolean) {
  const wanted: IndexDef[] = JSON.parse(fs.readFileSync(INDEXES_FILE, "utf8")).indexes;
  const existing = await listIndexes(jwt, projectId);
  const have = new Set(existing.map((i) => indexKey(i.collectionGroup, i.fields)));

  let created = 0;
  const denied: IndexDef[] = [];
  for (const idx of wanted) {
    const key = indexKey(idx.collectionGroup, idx.fields);
    if (have.has(key)) { console.log(`  exists  ${key}`); continue; }
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(DATABASE)}/collectionGroups/${idx.collectionGroup}/indexes`;
    const res = await api(jwt, "POST", url, { queryScope: idx.queryScope, fields: idx.fields.filter((f) => f.fieldPath !== "__name__") });
    const status = (res.data?.error as { status?: string })?.status;
    if (res.status === 409 || status === "ALREADY_EXISTS") { console.log(`  exists  ${key}`); continue; }
    if (res.status === 403 || status === "PERMISSION_DENIED") { console.log(`  denied  ${key}`); denied.push(idx); continue; }
    if (res.status >= 300) throw new Error(`create index ${key} failed: ${res.status} ${JSON.stringify(res.data)}`);
    created++;
    console.log(`  created ${key}`);
  }
  console.log(`  ${created} new index(es), ${wanted.length - created - denied.length} already present`);

  if (denied.length) {
    console.log(`\n  The service account cannot create indexes (needs roles/datastore.indexAdmin).`);
    console.log(`  Run these with owner credentials (gcloud auth login), or grant the role once:\n`);
    for (const idx of denied) console.log(`  ${gcloudCommand(projectId, idx)}`);
    console.log("");
    return;
  }

  if (!wait || !created) return;
  const started = Date.now();
  for (;;) {
    const now = await listIndexes(jwt, projectId);
    const building = now.filter((i) => i.state !== "READY");
    if (!building.length) { console.log("  all indexes READY"); return; }
    if (Date.now() - started > 10 * 60_000) {
      console.log(`  still building after 10 min: ${building.map((b) => indexKey(b.collectionGroup, b.fields)).join(", ")}`);
      return;
    }
    console.log(`  building ${building.length}… (${Math.round((Date.now() - started) / 1000)}s)`);
    await new Promise((r) => setTimeout(r, 10_000));
  }
}

async function main() {
  const a = args();
  const projectId = projectIdFromCredential();
  if (a["print-gcloud"]) {
    const wanted: IndexDef[] = JSON.parse(fs.readFileSync(INDEXES_FILE, "utf8")).indexes;
    for (const idx of wanted) console.log(gcloudCommand(projectId, idx));
    return;
  }
  const jwt = await client();
  console.log(`Deploying Firestore config to ${projectId}`);
  if (!a["indexes-only"]) { console.log("Rules:"); await deployRules(jwt, projectId); }
  if (!a["rules-only"]) { console.log("Indexes:"); await deployIndexes(jwt, projectId, !a["no-wait"]); }
  console.log("Done.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
