/**
 * Runs the Python tracer under the host `python3` (the same source the worker ships to Pyodide).
 * Skipped when python3 is not installed.
 */
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { PYTHON_TRACER } from "@/lib/trace/python/tracer";
import { PYTHON_PRELUDE } from "@/lib/judge/assemble";
import { replay } from "@/lib/trace/replay";
import type { HeapObj, Trace } from "@/lib/trace/types";

const hasPython = spawnSync("python3", ["--version"]).status === 0;

const TWO_SUM_DRIVER = `
data = sys.stdin.read().split("\\n")
n = int(data[0])
nums = list(map(int, data[1].split())) if n else []
target = int(data[2])
res = Solution().twoSum(nums, target)
print("[" + ",".join(map(str, res)) + "]")
`;

function runPy(user: string, driver = TWO_SUM_DRIVER, stdin = "4\n2 7 11 15\n9\n", limits: Partial<{ maxSteps: number; maxHeap: number; wallMs: number }> = {}): Trace {
  const harness = `${PYTHON_TRACER}\nimport json as _j\n_args = _j.loads(sys.stdin.read())\nprint(run_trace(_args["prelude"], _args["user"], _args["driver"], _args["stdin"], _args["maxSteps"], _args["maxHeap"], _args["wallMs"]))`;
  const input = JSON.stringify({ prelude: PYTHON_PRELUDE, user, driver, stdin, maxSteps: limits.maxSteps ?? 3000, maxHeap: limits.maxHeap ?? 500, wallMs: limits.wallMs ?? 5000 });
  const r = spawnSync("python3", ["-c", harness], { input, encoding: "utf8", timeout: 20_000 });
  if (r.status !== 0) throw new Error(`python3 failed: ${r.stderr}`);
  return JSON.parse(r.stdout) as Trace;
}

describe.skipIf(!hasPython)("Python tracer", () => {
  it("traces Two Sum: entry, lines, locals, dict growth, output", () => {
    const user = `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, x in enumerate(nums):
            need = target - x
            if need in seen:
                return [seen[need], i]
            seen[x] = i
        return []
`;
    const t = runPy(user);
    expect(t.exception).toBeNull();
    expect(t.truncated).toBe(false);
    expect(t.stdout).toBe("[0,1]\n");
    expect(t.entry?.fn).toBe("twoSum");
    expect(t.entry?.args.target).toBe(9);
    expect(t.steps[0].ev).toBe("call");
    expect(t.steps[1].line).toBe(3);
    const last = t.steps[t.steps.length - 1];
    expect(last.ev).toBe("return");
    const st = replay(t, t.steps.length - 1);
    const locals = st.locals[String(st.stack[0].id)];
    expect(locals.i).toBe(1);
    expect(locals.need).toBe(2);
    const seen = st.heap[(locals.seen as { ref: string }).ref] as Extract<HeapObj, { t: "dict" }>;
    expect(seen.entries).toEqual([[2, 0]]);
    expect(Object.keys(locals)).not.toContain("self");
  });

  it("follows recursion with a growing stack and return values", () => {
    const user = `class Solution:
    def twoSum(self, nums, target):
        def fib(n):
            if n < 2:
                return n
            return fib(n - 1) + fib(n - 2)
        return [fib(4), 0]
`;
    const t = runPy(user);
    expect(t.stdout).toBe("[3,0]\n");
    const depth = Math.max(...t.steps.map((_, i) => replay(t, i).stack.length));
    expect(depth).toBe(5);
    expect(t.steps.filter((s) => s.ev === "return").map((s) => s.ret)).toContain(3);
  });

  it("describes ListNode instances as nodes and follows next pointers", () => {
    const driver = `
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next
head = ListNode(1, ListNode(2, ListNode(3)))
r = Solution().reverseList(head)
out = []
while r:
    out.append(r.val); r = r.next
print("[" + ",".join(map(str, out)) + "]")
`;
    const user = `class Solution:
    def reverseList(self, head):
        prev, curr = None, head
        while curr:
            nxt = curr.next
            curr.next = prev
            prev = curr
            curr = nxt
        return prev
`;
    const t = runPy(user, driver, "");
    expect(t.stdout).toBe("[3,2,1]\n");
    const end = replay(t, t.steps.length - 1);
    const prev = end.locals[String(end.stack[0].id)].prev as { ref: string };
    const node = end.heap[prev.ref] as Extract<HeapObj, { t: "node" }>;
    expect(node.cls).toBe("ListNode");
    expect(node.fields.val).toBe(3);
    const next = end.heap[(node.fields.next as { ref: string }).ref] as Extract<HeapObj, { t: "node" }>;
    expect(next.fields.val).toBe(2);
  });

  it("records exceptions with type and line", () => {
    const user = `class Solution:
    def twoSum(self, nums, target):
        x = nums[10]
        return [x]
`;
    const t = runPy(user);
    expect(t.exception?.type).toBe("IndexError");
    const exc = t.steps.find((s) => s.ev === "exception");
    expect(exc?.line).toBe(3);
  });

  it("stops at the step cap even inside try/except", () => {
    const user = `class Solution:
    def twoSum(self, nums, target):
        i = 0
        while True:
            try:
                i += 1
            except Exception:
                pass
        return [i]
`;
    const t = runPy(user, TWO_SUM_DRIVER, "4\n2 7 11 15\n9\n", { maxSteps: 120 });
    expect(t.truncated).toBe("steps");
    expect(t.steps.length).toBeLessThanOrEqual(120);
  });

  it("reports a syntax error in the user's code", () => {
    const t = runPy("class Solution:\n    def twoSum(self, nums, target)\n        return []\n");
    expect(t.exception?.type).toBe("SyntaxError");
    expect(t.steps.length).toBe(0);
  });

  it("keeps sets, tuples, deques and special floats", () => {
    const user = `class Solution:
    def twoSum(self, nums, target):
        s = set(nums)
        t = (1, 2)
        d = deque([1, 2])
        inf = float("inf")
        big = 2 ** 70
        return [len(s), 0]
`;
    const t = runPy(user);
    expect(t.stdout).toBe("[4,0]\n");
    const end = replay(t, t.steps.length - 1);
    const l = end.locals[String(end.stack[0].id)];
    expect(end.heap[(l.s as { ref: string }).ref].t).toBe("set");
    expect(end.heap[(l.t as { ref: string }).ref].t).toBe("tuple");
    expect(end.heap[(l.d as { ref: string }).ref].t).toBe("list");
    expect(l.inf).toEqual({ sp: "inf" });
    expect(l.big).toEqual({ sp: "bigint", v: BigInt(2) ** BigInt(70) + "" });
  });
});
