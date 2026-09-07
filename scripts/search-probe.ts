import "./_bootstrap";
import * as problems from "../src/lib/data/problems";
import { getAdminDb } from "../src/lib/firebase-admin";
async function main() {
  const db = getAdminDb();
  const d = (await db.collection("problems").doc("two-sum").get()).data()!;
  console.log("two-sum", d.status, d.difficulty, d.tags, d.createdAt?.toDate?.());
  for (const opts of [{ difficulty: "Easy" as const }, { tags: ["array"] }, { tags: ["array"], difficulty: "Easy" as const }, { tags: ["hash-table"], difficulty: "Easy" as const }]) {
    try { const r = await problems.search({ ...opts, status: "verified", limit: 20 }); console.log(JSON.stringify(opts), "→", r.items.map((i) => i.title)); }
    catch (e) { console.log(JSON.stringify(opts), "ERR", (e as Error).message.slice(0, 200)); }
  }
  try {
    const snap = await db.collection("problems").where("status", "==", "verified").where("difficulty", "==", "Easy").where("tags", "array-contains", "array").limit(10).get();
    console.log("raw equality+array-contains →", snap.docs.map((x) => x.id));
  } catch (e) { console.log("raw ERR", (e as Error).message.slice(0, 300)); }
}
main();
