/**
 * Decides how each heap object is drawn on the memory canvas (Module 07 §3.5): arrays, matrices, dicts,
 * linked-list chains, trees and graphs. Pure; unit-tested. The decision uses the object's own shape plus
 * cheap hints: the problem's declared parameter types and the variable names that point at the object.
 */
import { isRef, type HeapObj, type TraceState, type Value } from "@/lib/trace/types";

export type Shape = "array" | "matrix" | "dict" | "set" | "tuple" | "list-node" | "tree-node" | "graph" | "node" | "func" | "other";

export interface ShapeHints {
  /** Variable names (any frame) that reference the object. */
  names?: string[];
  /** Declared param types, e.g. { nums: "int[]", root: "TreeNode" }. */
  paramTypes?: Record<string, string>;
}

const GRAPH_NAME = /graph|adj|edge|neighbo|children|nbrs?|succ|pred|conn/i;

function isPrimitive(v: Value): boolean {
  return v === null || typeof v !== "object" || "sp" in v;
}

export function detectShape(obj: HeapObj, heap: Record<string, HeapObj>, hints: ShapeHints = {}): Shape {
  const names = hints.names ?? [];
  switch (obj.t) {
    case "func": return "func";
    case "other": return "other";
    case "set": return "set";
    case "tuple": return "tuple";
    case "node": {
      const keys = Object.keys(obj.fields);
      if (keys.includes("left") || keys.includes("right")) return "tree-node";
      if (keys.includes("children") && isRef(obj.fields.children ?? null) && heap[(obj.fields.children as { ref: string }).ref]?.t === "list") return "tree-node";
      if (keys.includes("next") && !keys.includes("prev") && keys.length <= 4) return "list-node";
      if (keys.includes("next") && keys.includes("prev")) return "list-node";
      if (keys.includes("neighbors")) return "graph";
      return "node";
    }
    case "dict": {
      if (obj.n === 0) return "dict";
      const allListValues = obj.entries.every(([, v]) => isRef(v) && (heap[v.ref]?.t === "list" || heap[v.ref]?.t === "set"));
      if (allListValues && (names.some((n) => GRAPH_NAME.test(n)) || obj.entries.every(([k]) => isPrimitive(k)))) {
        // values must reference keys of the same dict (adjacency), otherwise it is just a dict of lists
        const keys = new Set(obj.entries.map(([k]) => JSON.stringify(k)));
        let refsToKeys = 0, total = 0;
        for (const [, v] of obj.entries) {
          const list = heap[(v as { ref: string }).ref];
          if (!list || (list.t !== "list" && list.t !== "set")) continue;
          for (const item of list.items) { total++; if (keys.has(JSON.stringify(item))) refsToKeys++; }
        }
        if (total > 0 && refsToKeys / total >= 0.6) return "graph";
      }
      return "dict";
    }
    case "list": {
      if (obj.n === 0) return "array";
      if (obj.items.every(isPrimitive)) return "array";
      const rows = obj.items.map((v) => (isRef(v) ? heap[v.ref] : undefined));
      if (rows.every((r) => r && r.t === "list" && r.items.every(isPrimitive))) {
        const lens = new Set(rows.map((r) => (r as Extract<HeapObj, { t: "list" }>).n));
        if (names.some((n) => GRAPH_NAME.test(n))) return "graph";
        if (lens.size === 1 && rows.length >= 1) return "matrix";
        if (names.some((n) => /grid|matrix|board|dp|memo|table|cells?/i.test(n))) return "matrix";
        return "array";
      }
      return "array";
    }
  }
}

/** Reachable heap ids from the locals of every frame (BFS through refs). */
export function reachable(state: TraceState): Set<string> {
  const seen = new Set<string>();
  const queue: string[] = [];
  const push = (v: Value) => { if (isRef(v) && !seen.has(v.ref) && state.heap[v.ref]) { seen.add(v.ref); queue.push(v.ref); } };
  for (const locals of Object.values(state.locals)) for (const v of Object.values(locals)) push(v);
  while (queue.length) {
    const o = state.heap[queue.shift()!];
    if (!o) continue;
    switch (o.t) {
      case "list": case "tuple": case "set": o.items.forEach(push); break;
      case "dict": o.entries.forEach(([k, v]) => { push(k); push(v); }); break;
      case "node": Object.values(o.fields).forEach(push); break;
      default: break;
    }
  }
  return seen;
}

/** Variable labels per heap id: "name" (single frame) or "name·fn" when several frames are live. */
export function pointerLabels(state: TraceState): Record<string, { name: string; frameId: number }[]> {
  const out: Record<string, { name: string; frameId: number }[]> = {};
  for (const f of state.stack) {
    const locals = state.locals[String(f.id)] ?? {};
    for (const [name, v] of Object.entries(locals)) if (isRef(v)) (out[v.ref] ??= []).push({ name, frameId: f.id });
  }
  return out;
}

export interface Chain { head: string; nodes: string[]; cyclic: boolean }

/** Linked-list chains: follow `next` from nodes that no other node points to. */
export function listChains(ids: Iterable<string>, heap: Record<string, HeapObj>): Chain[] {
  const nodes = [...ids].filter((id) => heap[id]?.t === "node" && "next" in (heap[id] as Extract<HeapObj, { t: "node" }>).fields);
  const pointed = new Set<string>();
  for (const id of nodes) { const nx = (heap[id] as Extract<HeapObj, { t: "node" }>).fields.next; if (isRef(nx)) pointed.add(nx.ref); }
  const heads = nodes.filter((id) => !pointed.has(id));
  const visited = new Set<string>();
  const chains: Chain[] = [];
  const walk = (head: string) => {
    const list: string[] = [];
    let cur: string | null = head;
    let cyclic = false;
    while (cur && heap[cur]?.t === "node") {
      if (visited.has(cur)) { cyclic = list.includes(cur); break; }
      visited.add(cur); list.push(cur);
      const nx: Value = (heap[cur] as Extract<HeapObj, { t: "node" }>).fields.next ?? null;
      cur = isRef(nx) ? nx.ref : null;
      if (list.length > 200) break;
    }
    chains.push({ head, nodes: list, cyclic });
  };
  heads.forEach(walk);
  for (const id of nodes) if (!visited.has(id)) walk(id); // pure cycles
  return chains;
}

export interface TreeLayoutNode { id: string; x: number; y: number; depth: number; parent: string | null; label: string }

/** Tree roots: tree-nodes that are not a child of another tree-node. */
export function treeRoots(ids: Iterable<string>, heap: Record<string, HeapObj>): string[] {
  const nodes = [...ids].filter((id) => heap[id]?.t === "node" && detectShape(heap[id], heap) === "tree-node");
  const children = new Set<string>();
  for (const id of nodes) for (const c of childrenOf(id, heap)) if (c) children.add(c);
  return nodes.filter((id) => !children.has(id));
}

export function childrenOf(id: string, heap: Record<string, HeapObj>): (string | null)[] {
  const o = heap[id];
  if (!o || o.t !== "node") return [];
  const f = o.fields;
  if ("left" in f || "right" in f) return [isRef(f.left ?? null) ? (f.left as { ref: string }).ref : null, isRef(f.right ?? null) ? (f.right as { ref: string }).ref : null];
  if (isRef(f.children ?? null)) { const l = heap[(f.children as { ref: string }).ref]; if (l && l.t === "list") return l.items.map((v) => (isRef(v) ? v.ref : null)); }
  return [];
}

/**
 * Tidy-ish layout for binary / n-ary trees: leaves get consecutive x slots, parents sit above the middle
 * of their children; `null` binary children keep an empty slot so left/right stay visually distinct.
 */
export function layoutTree(root: string, heap: Record<string, HeapObj>, o: { dx?: number; dy?: number; maxNodes?: number } = {}): { nodes: TreeLayoutNode[]; width: number; height: number } {
  const dx = o.dx ?? 44, dy = o.dy ?? 52, maxNodes = o.maxNodes ?? 200;
  const nodes: TreeLayoutNode[] = [];
  let slot = 0, maxDepth = 0, count = 0;
  const seen = new Set<string>();
  const place = (id: string | null, depth: number, parent: string | null): number => {
    maxDepth = Math.max(maxDepth, depth);
    if (id === null || !heap[id] || seen.has(id) || count >= maxNodes) { return slot++; }
    seen.add(id); count++;
    const kids = childrenOf(id, heap);
    const isBinary = "left" in (heap[id] as Extract<HeapObj, { t: "node" }>).fields || "right" in (heap[id] as Extract<HeapObj, { t: "node" }>).fields;
    let x: number;
    if (!kids.length || kids.every((k) => k === null)) x = slot++;
    else {
      const xs = kids.map((k, i) => (isBinary && k === null && kids.filter(Boolean).length ? (i === 0 ? slot++ : slot++) : place(k, depth + 1, id)));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    const val = (heap[id] as Extract<HeapObj, { t: "node" }>).fields.val ?? (heap[id] as Extract<HeapObj, { t: "node" }>).fields.value;
    nodes.push({ id, x: x * dx + dx / 2, y: depth * dy + dy / 2, depth, parent, label: val === undefined ? "•" : String(typeof val === "object" && val ? ("ref" in val ? val.ref : "…") : val) });
    return x;
  };
  place(root, 0, null);
  return { nodes, width: Math.max(1, slot) * dx, height: (maxDepth + 1) * dy };
}

export interface GraphLayout { nodes: { id: string; label: string; x: number; y: number }[]; edges: { from: string; to: string }[]; width: number; height: number }

/** Circular layout for an adjacency dict (`key → [neighbors]`) or adjacency list (`index → [neighbors]`). */
export function layoutGraph(id: string, heap: Record<string, HeapObj>, o: { radius?: number } = {}): GraphLayout | null {
  const obj = heap[id];
  if (!obj) return null;
  const keys: string[] = [];
  const adj = new Map<string, string[]>();
  const keyOf = (v: Value) => (isRef(v) ? v.ref : JSON.stringify(v));
  if (obj.t === "dict") {
    for (const [k, v] of obj.entries) {
      const key = keyOf(k); keys.push(key);
      const list = isRef(v) ? heap[v.ref] : undefined;
      adj.set(key, list && (list.t === "list" || list.t === "set") ? list.items.map(keyOf) : []);
    }
  } else if (obj.t === "list") {
    obj.items.forEach((v, i) => {
      const key = String(i); keys.push(key);
      const list = isRef(v) ? heap[v.ref] : undefined;
      adj.set(key, list && (list.t === "list" || list.t === "set") ? list.items.map(keyOf) : []);
    });
  } else return null;
  for (const targets of adj.values()) for (const t of targets) if (!adj.has(t)) { adj.set(t, []); keys.push(t); }
  const n = keys.length;
  const r = o.radius ?? Math.max(60, 16 * n);
  const cx = r + 24, cy = r + 24;
  const nodes = keys.map((k, i) => { const a = (2 * Math.PI * i) / Math.max(1, n) - Math.PI / 2; return { id: k, label: k.replace(/^"|"$/g, ""), x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; });
  const edges: { from: string; to: string }[] = [];
  const seen = new Set<string>();
  for (const [from, targets] of adj) for (const to of targets) { const key = from < to ? `${from}|${to}` : `${to}|${from}`; if (seen.has(key)) continue; seen.add(key); edges.push({ from, to }); }
  return { nodes, edges, width: 2 * (r + 24), height: 2 * (r + 24) };
}

/** `arr[i]` patterns in the source → { arr: Set(i) } so index variables can be drawn under their cells. */
export function indexVariables(source: string): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  const re = /([A-Za-z_$][\w$]*)\s*\[\s*([A-Za-z_$][\w$]*)(?:\s*[+-]\s*\d+)?\s*\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) (out[m[1]] ??= new Set()).add(m[2]);
  return out;
}
