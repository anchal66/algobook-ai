import { describe, expect, it } from "vitest";
import { instrument, InstrumentError } from "@/lib/trace/js/instrument";
import { runInstrumented } from "@/lib/trace/js/runtime";
import { divergeAt, replay } from "@/lib/trace/replay";
import type { HeapObj, Value } from "@/lib/trace/types";

const TWO_SUM_DRIVER = `
const lines = require("fs").readFileSync(0, "utf8").split("\\n");
const n = parseInt(lines[0]);
const nums = n ? lines[1].trim().split(/\\s+/).map(Number) : [];
const target = parseInt(lines[2]);
const res = twoSum(nums, target);
console.log("[" + res.join(",") + "]");
`;

function run(user: string, driver = TWO_SUM_DRIVER, stdin = "4\n2 7 11 15\n9\n", opts: { maxSteps?: number; wallMs?: number } = {}) {
  const ins = instrument(user);
  return { ins, trace: runInstrumented(ins.code, driver, { stdin, ...opts }) };
}

describe("JavaScript tracer", () => {
  it("traces Two Sum with a hash map: lines, locals, heap, output", () => {
    const user = `var twoSum = function(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
};`;
    const { ins, trace } = run(user);
    expect(ins.functions).toBe(1);
    expect(trace.exception).toBeNull();
    expect(trace.truncated).toBe(false);
    expect(trace.stdout).toBe("[0,1]\n");
    expect(trace.entry?.fn).toBe("twoSum");
    expect(trace.entry?.args.target).toBe(9);
    // first step is the call, then line 2 (const seen), then the loop header on line 3
    expect(trace.steps[0].ev).toBe("call");
    expect(trace.steps[1].line).toBe(2);
    expect(trace.steps[2].line).toBe(3);
    const last = trace.steps[trace.steps.length - 1];
    expect(last.ev).toBe("return");
    expect(last.ret).toEqual({ ref: expect.any(String) });
    // replayed state at the return step: seen has one entry, i === 1
    const st = replay(trace, trace.steps.length - 1);
    const frame = st.stack[0];
    const locals = st.locals[String(frame.id)];
    expect(locals.i).toBe(1);
    expect(locals.need).toBe(2);
    const seen = st.heap[(locals.seen as { ref: string }).ref] as Extract<HeapObj, { t: "dict" }>;
    expect(seen.t).toBe("dict");
    expect(seen.entries).toEqual([[2, 0]]);
    const nums = st.heap[(locals.nums as { ref: string }).ref] as Extract<HeapObj, { t: "list" }>;
    expect(nums.items).toEqual([2, 7, 11, 15]);
  });

  it("captures per-iteration let bindings and TDZ names without breaking the program", () => {
    const user = `var twoSum = function(nums, target) {
  const fns = [];
  for (let i = 0; i < 2; i++) { fns.push(() => i); }
  let late = fns[0]() + fns[1]();
  return [late, 1];
};`;
    const { trace } = run(user);
    expect(trace.stdout).toBe("[1,1]\n");
    // at the first probe inside the function `late` is in its TDZ and must simply be absent
    const st1 = replay(trace, 1);
    expect(Object.keys(st1.locals[String(st1.stack[0].id)])).not.toContain("late");
    const end = replay(trace, trace.steps.length - 1);
    expect(end.locals[String(end.stack[0].id)].late).toBe(1);
  });

  it("records recursion: call/return events, a growing stack and return values", () => {
    const user = `function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}
var twoSum = function(nums, target) { return [fib(4), 0]; };`;
    const { trace } = run(user);
    expect(trace.stdout).toBe("[3,0]\n");
    const calls = trace.steps.filter((s) => s.ev === "call" && trace.steps.some((t) => t.stack));
    expect(calls.length).toBeGreaterThanOrEqual(9); // twoSum + fib(4) tree (9 fib calls)
    const maxDepth = Math.max(...trace.steps.map((_, i) => replay(trace, i).stack.length));
    expect(maxDepth).toBe(5); // twoSum → fib(4) → fib(3) → fib(2) → fib(1)
    const rets = trace.steps.filter((s) => s.ev === "return").map((s) => s.ret);
    expect(rets).toContain(3);
  });

  it("describes class instances as nodes (linked list) and follows pointers", () => {
    const driver = `
function ListNode(val, next) { this.val = val; this.next = next === undefined ? null : next; }
const head = new ListNode(1, new ListNode(2, new ListNode(3)));
let r = reverseList(head);
const out = []; while (r) { out.push(r.val); r = r.next; }
console.log("[" + out.join(",") + "]");`;
    const user = `var reverseList = function(head) {
  let prev = null, curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
};`;
    const { trace } = run(user, driver, "");
    expect(trace.stdout).toBe("[3,2,1]\n");
    const end = replay(trace, trace.steps.length - 1);
    const fid = String(end.stack[0].id);
    const prev = end.locals[fid].prev as { ref: string };
    const node = end.heap[prev.ref] as Extract<HeapObj, { t: "node" }>;
    expect(node.t).toBe("node");
    expect(node.cls).toBe("ListNode");
    expect(node.fields.val).toBe(3);
    const next = end.heap[(node.fields.next as { ref: string }).ref] as Extract<HeapObj, { t: "node" }>;
    expect(next.fields.val).toBe(2);
  });

  it("records an exception step with the thrown message", () => {
    const user = `var twoSum = function(nums, target) {
  const x = nums[10].foo;
  return [x];
};`;
    const { trace } = run(user);
    expect(trace.exception).not.toBeNull();
    expect(trace.exception?.type).toBe("TypeError");
    const exc = trace.steps.find((s) => s.ev === "exception");
    expect(exc?.line).toBe(2);
    expect(trace.stdout).toBe("");
  });

  it("stops at the step cap and reports truncation", () => {
    const user = `var twoSum = function(nums, target) {
  let i = 0;
  while (true) { i++; }
  return [i];
};`;
    const { trace } = run(user, TWO_SUM_DRIVER, "4\n2 7 11 15\n9\n", { maxSteps: 200 });
    expect(trace.truncated).toBe("steps");
    expect(trace.steps.length).toBe(200);
    expect(trace.exception).toBeNull();
  });

  it("does not let user code swallow the step limit", () => {
    const user = `var twoSum = function(nums, target) {
  let i = 0;
  while (true) { try { i++; } catch (e) { /* swallow */ } }
  return [i];
};`;
    const { trace } = run(user, TWO_SUM_DRIVER, "4\n2 7 11 15\n9\n", { maxSteps: 150 });
    expect(trace.truncated).toBe("steps");
    expect(trace.steps.length).toBeLessThanOrEqual(150);
  });

  it("handles arrow functions, destructuring, Map/Set and nested functions", () => {
    const user = `const helper = ([a, b]) => a + b;
var twoSum = function(nums, target) {
  const s = new Set(nums);
  const pairs = nums.map((v, i) => [v, i]);
  const total = pairs.reduce((acc, p) => acc + helper(p), 0);
  return [s.size, total];
};`;
    const { trace } = run(user);
    expect(trace.stdout).toBe("[4,41]\n");
    expect(trace.exception).toBeNull();
    const heapTypes = new Set<string>();
    for (const s of trace.steps) for (const o of Object.values(s.heap ?? {})) if (o) heapTypes.add(o.t);
    expect(heapTypes.has("set")).toBe(true);
    expect(heapTypes.has("list")).toBe(true);
  });

  it("throws a syntax error with the line", () => {
    expect(() => instrument("var twoSum = function( { return 1 }")).toThrow(InstrumentError);
    try { instrument("function f() {\n  let x = ;\n}"); } catch (e) { expect((e as InstrumentError).line).toBe(2); }
  });

  it("marks stdout divergence when an expected output is supplied", () => {
    const user = `var twoSum = function(nums, target) { return [1, 0]; };`;
    const { trace } = run(user);
    const withExpected = { ...trace, expected: "[0,1]" };
    expect(divergeAt(withExpected)).toBe(trace.steps.length - 1);
    expect(divergeAt({ ...trace, expected: "[1,0]" })).toBeUndefined();
  });

  it("special values survive serialisation", () => {
    const user = `var twoSum = function(nums, target) { let u; const big = BigInt(2) ** BigInt(70); const inf = 1 / 0; const nan = 0 / 0; return [1, 2]; };`;
    const { trace } = run(user);
    const end = replay(trace, trace.steps.length - 1);
    const l = end.locals[String(end.stack[0].id)] as Record<string, Value>;
    expect(l.u).toEqual({ sp: "undefined" });
    expect(l.big).toEqual({ sp: "bigint", v: BigInt(2) ** BigInt(70) + "" });
    expect(l.inf).toEqual({ sp: "inf" });
    expect(l.nan).toEqual({ sp: "nan" });
  });
});
