/** Prints the stored reference solution of a problem (admin/dev helper). npx tsx scripts/print-reference.ts --id <problemId> [--lang java] */
import { args } from "./_bootstrap";
import { getAdminDb } from "../src/lib/firebase-admin";
async function main() {
  const a = args();
  const snap = await getAdminDb().collection("problems").doc(String(a.id)).collection("private").doc("tests").get();
  const ref = (snap.data()?.referenceSolution ?? {})[String(a.lang ?? "java")];
  if (!ref) throw new Error("no reference");
  process.stdout.write(ref);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
