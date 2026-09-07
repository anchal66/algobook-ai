/** Bundled sample problem for the landing live demo (Module 05 U-10 §2.1). Runs in-browser in a Web Worker (JavaScript). */
export const DEMO_PROBLEM = {
  number: 1,
  title: "Two Sum",
  difficulty: "Easy" as const,
  tags: ["Array", "Hash Map"],
  statement: [
    "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers such that they add up to `target`.",
    "You may assume that each input has exactly one solution, and you may not use the same element twice. Return the answer in any order.",
  ],
  examples: [
    { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "nums[0] + nums[1] == 9." },
    { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
    { input: "nums = [3,3], target = 6", output: "[0,1]" },
  ],
  constraints: ["2 ≤ nums.length ≤ 10⁴", "−10⁹ ≤ nums[i] ≤ 10⁹", "Only one valid answer exists."],
  followUp: "Can you do it in O(n) time?",
  cases: [
    { nums: [2, 7, 11, 15], target: 9, expected: [0, 1] },
    { nums: [3, 2, 4], target: 6, expected: [1, 2] },
    { nums: [3, 3], target: 6, expected: [0, 1] },
  ],
  starter: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  // Try a hash map: value -> index
  
}
`,
  solution: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}
`,
};

export interface DemoCaseResult { index: number; status: "AC" | "WA" | "RE" | "TLE"; output: string; expected: string; error?: string; ms: number }

/** Worker source: evaluates the user's `twoSum` against the sample cases with a per-case time cap. */
export const WORKER_SRC = `
self.onmessage = (e) => {
  const { code, cases } = e.data;
  const results = [];
  let fn;
  try {
    fn = new Function(code + "\\n;return typeof twoSum === 'function' ? twoSum : null;")();
    if (!fn) throw new Error("Define a function named twoSum(nums, target).");
  } catch (err) {
    self.postMessage({ compileError: String(err && err.message || err) });
    return;
  }
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const t0 = performance.now();
    try {
      const out = fn(c.nums.slice(), c.target);
      const ms = performance.now() - t0;
      const norm = (a) => Array.isArray(a) ? a.slice().sort((x, y) => x - y).join(",") : String(a);
      const ok = norm(out) === norm(c.expected);
      results.push({ index: i, status: ok ? "AC" : "WA", output: JSON.stringify(out), expected: JSON.stringify(c.expected), ms });
    } catch (err) {
      results.push({ index: i, status: "RE", output: "", expected: JSON.stringify(c.expected), error: String(err && err.message || err), ms: performance.now() - t0 });
    }
  }
  self.postMessage({ results });
};
`;
