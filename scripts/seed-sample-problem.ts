/**
 * Seeds one hand-written, verified "Two Sum" problem (id/slug `two-sum`) with
 * Java, Python, C++ and JavaScript starter + driver + reference solution,
 * 3 sample + 10 hidden tests. Every reference solution is executed on Judge0
 * against all 13 tests before the problem is marked `verified`.
 *
 *   npm run db:seed:sample            (skips Judge0 verification with --no-verify)
 */
import "./_bootstrap";
import { args } from "./_bootstrap";
import { encodeInput } from "../src/lib/judge/stdin";
import { verifyReference } from "../src/lib/judge/service";
import * as problems from "../src/lib/data/problems";
import { getAdminDb } from "../src/lib/firebase-admin";
import type { Language, TestCase } from "../src/lib/data/schema";

const params = [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }];

// ── Starter code (what the user edits) ───────────────────────────────────────
const starter: Record<Language, string> = {
  java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        
    }
}`,
  python: `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        `,
  cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        
    }
};`,
  javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var twoSum = function(nums, target) {
    
};`,
};

// ── Drivers (private): parse canonical stdin, call the function, print canonical stdout ──
const drivers: Record<Language, string> = {
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(br.readLine().trim());
        String line = br.readLine();
        int[] nums = new int[n];
        if (n > 0) {
            StringTokenizer st = new StringTokenizer(line);
            for (int i = 0; i < n; i++) nums[i] = Integer.parseInt(st.nextToken());
        }
        int target = Integer.parseInt(br.readLine().trim());
        int[] res = new Solution().twoSum(nums, target);
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < res.length; i++) { if (i > 0) sb.append(","); sb.append(res[i]); }
        sb.append("]");
        System.out.println(sb);
    }
}`,
  python: `import sys
from typing import List

def _main():
    lines = sys.stdin.read().split("\\n")
    i = 0
    n = int(lines[i].strip()); i += 1
    nums = [int(x) for x in lines[i].split()] if n > 0 else []; i += 1
    target = int(lines[i].strip()); i += 1
    res = Solution().twoSum(nums, target)
    print("[" + ",".join(str(x) for x in res) + "]")

_main()`,
  cpp: `int main() {
    int n; cin >> n;
    vector<int> nums(n);
    for (auto &x : nums) cin >> x;
    int target; cin >> target;
    Solution s;
    vector<int> r = s.twoSum(nums, target);
    cout << "[";
    for (size_t i = 0; i < r.size(); i++) { if (i) cout << ","; cout << r[i]; }
    cout << "]" << endl;
    return 0;
}`,
  javascript: `const __lines = require("fs").readFileSync(0, "utf8").split("\\n");
let __i = 0;
const __n = parseInt(__lines[__i++], 10);
const __nums = __n > 0 ? __lines[__i++].trim().split(/\\s+/).map(Number) : (__i++, []);
const __target = parseInt(__lines[__i++], 10);
const __r = twoSum(__nums, __target);
console.log("[" + __r.join(",") + "]");`,
};

// ── Reference solutions ──────────────────────────────────────────────────────
const reference: Record<Language, string> = {
  java: `import java.util.*;
class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int need = target - nums[i];
            if (seen.containsKey(need)) return new int[]{seen.get(need), i};
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}`,
  python: `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, x in enumerate(nums):
            if target - x in seen:
                return [seen[target - x], i]
            seen[x] = i
        return []`,
  cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            auto it = seen.find(target - nums[i]);
            if (it != seen.end()) return {it->second, i};
            seen[nums[i]] = i;
        }
        return {};
    }
};`,
  javascript: `var twoSum = function(nums, target) {
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
        if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
        seen.set(nums[i], i);
    }
    return [];
};`,
};

// ── Tests ────────────────────────────────────────────────────────────────────
function solve(nums: number[], target: number): [number, number] {
  const seen = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const j = seen.get(target - nums[i]);
    if (j !== undefined) return [j, i];
    seen.set(nums[i], i);
  }
  throw new Error("no solution");
}
function tc(nums: number[], target: number): TestCase {
  const [a, b] = solve(nums, target);
  return { input: encodeInput(params, [nums, target]), expectedOutput: `[${a},${b}]` };
}
// Deterministic pseudo-random generator so re-seeding yields identical tests.
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
function randomCase(r: () => number, n: number, range: number): TestCase {
  const set = new Set<number>();
  while (set.size < n) set.add(Math.floor(r() * 2 * range) - range);
  const nums = [...set];
  const i = Math.floor(r() * n); let j = Math.floor(r() * n); while (j === i) j = Math.floor(r() * n);
  return tc(nums, nums[i] + nums[j]);
}

const sampleTests: TestCase[] = [tc([2, 7, 11, 15], 9), tc([3, 2, 4], 6), tc([3, 3], 6)];
const r = rng(20260907);
const hiddenTests: TestCase[] = [
  tc([-1, -2, -3, -4, -5], -8),
  tc([0, 4, 3, 0], 0),
  tc([1000000000, -1000000000, 5, 7], 12),
  tc([5, 75, 25], 100),
  tc([1, 2], 3),
  randomCase(r, 50, 1000),
  randomCase(r, 500, 100000),
  randomCase(r, 2000, 1000000000),
  randomCase(r, 5000, 1000000000),
  randomCase(r, 10000, 1000000000),
];

const statementMd = `Given an array of integers \`nums\` and an integer \`target\`, return *indices of the two numbers such that they add up to \`target\`*.

You may assume that each input would have **exactly one solution**, and you may not use the *same* element twice.

Return the answer with the smaller index first.`;

async function main() {
  const a = args();
  const verify = !a["no-verify"];
  const languages: Language[] = ["java", "python", "cpp", "javascript"];
  const judgeProblem = { id: "two-sum", checker: { type: "exact" as const }, limits: { cpuTimeSec: 2, memoryKb: 256000 }, sampleTests, hiddenTests, drivers };

  if (verify) {
    for (const lang of languages) {
      const started = Date.now();
      const res = await verifyReference(judgeProblem, lang, reference[lang]);
      console.log(`${lang.padEnd(10)} ${res.verdict} ${res.passed}/${res.total}  max ${res.runtimeMs} ms / ${res.memoryKb} KB  (${Date.now() - started} ms)`);
      if (res.verdict !== "AC") {
        console.error(JSON.stringify(res.failedCase, null, 2));
        throw new Error(`Reference solution for ${lang} failed verification`);
      }
    }
  }

  const db = getAdminDb();
  await db.recursiveDelete(db.collection("problems").doc("two-sum")).catch(() => undefined);
  const id = await problems.create({
    id: "two-sum",
    problem: {
      slug: "two-sum", number: 1, title: "Two Sum", difficulty: "Easy", tags: ["array", "hash map"],
      companies: ["amazon", "apple", "google", "meta", "microsoft", "uber"],
      statementMd,
      examples: [
        { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]." },
        { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
        { input: "nums = [3,3], target = 6", output: "[0,1]" },
      ],
      constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "-10^9 <= target <= 10^9", "Only one valid answer exists."],
      followUp: "Can you come up with an algorithm that is less than O(n²) time complexity?",
      params, returnType: "int[]", functionName: "twoSum",
      sampleTests, checker: { type: "exact" }, limits: { cpuTimeSec: 2, memoryKb: 256000 },
      languages: verify ? languages : [], starter, hintsPreview: 3, rating: 1200, source: "curated",
      templateRef: { company: "amazon", number: 1, title: "Two Sum" }, embedding: null,
      status: verify ? "verified" : "draft", createdBy: "seed", model: null,
    },
    tests: { hiddenTests, referenceSolution: reference },
    drivers: { drivers },
  });
  await db.collection("problems").doc(id).collection("content").doc("hints").set({
    hints: [
      { label: "Pattern Recognition", text: "This is a classic pair-finding problem on an unsorted array. Think about what information about earlier elements you need when you look at the current one." },
      { label: "Algorithm Choice", text: "A hash map from value → index lets you check in O(1) whether the complement (target − current) has already been seen, giving an O(n) single pass." },
      { label: "Implementation Trap", text: "Insert the current element into the map only after checking for its complement, otherwise you can match an element with itself (e.g. [3,3], target 6 must return [0,1], not [0,0])." },
    ],
  });
  console.log(`Seeded problems/${id} (${sampleTests.length} sample + ${hiddenTests.length} hidden tests, languages: ${verify ? languages.join(",") : "none (unverified)"})`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
