/** Verifies the local judge backend on the fixture spec (javac/java, python3, g++, node). JUDGE_BACKEND=local required. */
import "./_bootstrap";
import { verifyReference } from "../src/lib/judge/service";
import { judgeProblemFor } from "../src/lib/ai/generate";
import spec from "../src/lib/ai/__fixtures__/spec.json";
import type { ProblemSpec } from "../src/lib/ai/schemas";

async function main() {
  const s = spec as ProblemSpec;
  const started = Date.now();
  const r = await verifyReference(judgeProblemFor(s), "java", s.reference.java);
  console.log(`java ${r.verdict} ${r.passed}/${r.total} max ${r.runtimeMs} ms (${Date.now() - started} ms)`);
  if (r.verdict !== "AC") console.log(JSON.stringify(r.failedCase, null, 2));
  const bad = await verifyReference(judgeProblemFor(s), "java", s.reference.java.replace("return new int[]{j, i};", "return new int[]{i, j};"));
  console.log(`wrong reference → ${bad.verdict} ${bad.passed}/${bad.total}`);
  const ce = await verifyReference(judgeProblemFor(s), "java", "class Solution { public int[] pairSum(int[] n, int t) { int x = \"s\"; return null; } }");
  console.log(`compile error → ${ce.verdict} ${(ce.compileOutput ?? "").split("\n")[0]}`);
  process.exit(r.verdict === "AC" && bad.verdict === "WA" && ce.verdict === "CE" ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
