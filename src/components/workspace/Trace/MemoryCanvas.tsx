"use client";
/** "What's in memory": draws every reachable object as a picture (Module 07 V-11…V-13). */
import { useMemo } from "react";
import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatValue } from "@/lib/trace/replay";
import { childrenOf, detectShape, indexVariables, layoutGraph, layoutTree, listChains, pointerLabels, reachable, treeRoots, type Shape } from "@/lib/trace/shapes";
import { isRef, type HeapObj, type Step, type TraceState, type Value } from "@/lib/trace/types";
import { useTrace } from "@/store/trace";

export interface MemoryCanvasProps { state: TraceState; step: Step; prev: TraceState | null; code: string; paramTypes: Record<string, string> }

const cell = "flex h-8 min-w-8 items-center justify-center rounded-[4px] border border-line bg-ws-panel px-1.5 font-mono text-[12px] text-fg-1";

function Labels({ labels, extra }: { labels: { name: string; frameId: number }[]; extra?: string }) {
  if (!labels.length && !extra) return null;
  return (
    <div className="mb-1 flex flex-wrap items-center gap-1">
      {labels.map((l) => <span key={`${l.frameId}:${l.name}`} className="rounded-[4px] bg-brand-from/15 px-1.5 py-0.5 font-mono text-[11px] font-medium text-brand-to">{l.name}</span>)}
      {extra && <span className="text-[11px] text-fg-3">{extra}</span>}
    </div>
  );
}

function Scalar({ v, heap, changed }: { v: Value; heap: TraceState["heap"]; changed?: boolean }) {
  return <span className={cn(changed && "trace-flash")}>{formatValue(v, heap)}</span>;
}

function changedSet(step: Step): Set<string> { return new Set(step.changed); }

function ArrayCard({ id, obj, state, prev, labels, idxVars, changed }: { id: string; obj: Extract<HeapObj, { t: "list" | "tuple" | "set" }>; state: TraceState; prev: TraceState | null; labels: { name: string; frameId: number }[]; idxVars: Set<string>; changed: boolean }) {
  const prevObj = prev?.heap[id] as typeof obj | undefined;
  // index pointers: integer locals (any frame) named like an index of this array
  const pointers: { name: string; index: number }[] = [];
  for (const f of state.stack) for (const [name, v] of Object.entries(state.locals[String(f.id)] ?? {})) if (idxVars.has(name) && typeof v === "number" && Number.isInteger(v)) pointers.push({ name, index: v });
  const items = obj.items;
  return (
    <div className="rounded-[8px] border border-line bg-ws-bar p-2">
      <Labels labels={labels} extra={`${obj.t === "set" ? "set" : obj.t === "tuple" ? "tuple" : "array"} · ${obj.n} ${obj.n === 1 ? "item" : "items"}`} />
      {obj.n === 0 ? <p className="text-[11px] text-fg-3">empty</p> : (
        <div className="ws-scroll overflow-x-auto pb-1">
          <div className="flex items-start gap-1">
            {items.map((v, i) => {
              const was = prevObj?.items[i];
              const isChanged = changed && (was === undefined || JSON.stringify(was) !== JSON.stringify(v));
              const ptrs = pointers.filter((p) => p.index === i);
              return (
                <div key={i} className="flex flex-col items-center">
                  <span className="h-3 text-[10px] leading-3 text-fg-3">{obj.t === "set" ? "" : i}</span>
                  <div className={cn(cell, isChanged && "trace-flash border-medium/70", ptrs.length && "ring-2 ring-brand-from/60")}><Scalar v={v} heap={state.heap} /></div>
                  <span className="mt-0.5 h-3.5 whitespace-nowrap font-mono text-[10px] font-semibold leading-3 text-brand-to">{ptrs.map((p) => p.name).join(",")}{ptrs.length ? " ▲" : ""}</span>
                </div>
              );
            })}
            {obj.n > items.length && <div className={cn(cell, "text-fg-3")}>+{obj.n - items.length}</div>}
            {pointers.filter((p) => p.index >= obj.n || p.index < 0).map((p) => <div key={p.name} className="flex flex-col items-center"><span className="h-3 text-[10px] leading-3 text-fg-3">{p.index}</span><div className={cn(cell, "border-dashed text-fg-3")}>∅</div><span className="mt-0.5 font-mono text-[10px] font-semibold text-brand-to">{p.name} ▲</span></div>)}
          </div>
        </div>
      )}
    </div>
  );
}

function MatrixCard({ id, obj, state, prev, labels, changed }: { id: string; obj: Extract<HeapObj, { t: "list" }>; state: TraceState; prev: TraceState | null; labels: { name: string; frameId: number }[]; changed: Set<string> }) {
  const rows = obj.items.map((v) => (isRef(v) ? (state.heap[v.ref] as Extract<HeapObj, { t: "list" }>) : null));
  void id;
  return (
    <div className="rounded-[8px] border border-line bg-ws-bar p-2">
      <Labels labels={labels} extra={`matrix · ${obj.n} × ${rows[0]?.n ?? 0}`} />
      <div className="ws-scroll overflow-auto pb-1">
        <table className="border-separate border-spacing-0.5">
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                <td className="pr-1 text-right font-mono text-[10px] text-fg-3">{ri}</td>
                {r?.items.map((v, ci) => {
                  const rowRef = obj.items[ri];
                  const rowId = isRef(rowRef) ? rowRef.ref : "";
                  const prevRow = prev?.heap[rowId] as Extract<HeapObj, { t: "list" }> | undefined;
                  const isChanged = changed.has(rowId) && JSON.stringify(prevRow?.items[ci]) !== JSON.stringify(v);
                  return <td key={ci}><div className={cn(cell, "h-7 min-w-7 text-[11px]", isChanged && "trace-flash border-medium/70")}><Scalar v={v} heap={state.heap} /></div></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DictCard({ id, obj, state, prev, labels, changed }: { id: string; obj: Extract<HeapObj, { t: "dict" }>; state: TraceState; prev: TraceState | null; labels: { name: string; frameId: number }[]; changed: boolean }) {
  const prevObj = prev?.heap[id] as typeof obj | undefined;
  const prevMap = new Map(prevObj?.entries.map(([k, v]) => [JSON.stringify(k), JSON.stringify(v)]) ?? []);
  const setSelected = useTrace((s) => s.setSelected);
  return (
    <div className="rounded-[8px] border border-line bg-ws-bar p-2">
      <Labels labels={labels} extra={`map · ${obj.n} ${obj.n === 1 ? "entry" : "entries"}`} />
      {obj.n === 0 ? <p className="text-[11px] text-fg-3">empty</p> : (
        <div className="ws-scroll max-h-56 overflow-auto">
          <table className="w-full border-separate border-spacing-y-0.5">
            <tbody>
              {obj.entries.map(([k, v], i) => {
                const kk = JSON.stringify(k);
                const isNew = changed && !prevMap.has(kk);
                const isChanged = changed && prevMap.has(kk) && prevMap.get(kk) !== JSON.stringify(v);
                return (
                  <tr key={i} className={cn((isNew || isChanged) && "trace-flash")}>
                    <td className="w-[40%] rounded-l-[4px] bg-ws-panel px-2 py-1 font-mono text-[12px] text-fg-2"><Scalar v={k} heap={state.heap} /></td>
                    <td className="rounded-r-[4px] bg-ws-panel px-2 py-1 font-mono text-[12px] text-fg-1">
                      {isRef(v) ? <button type="button" onClick={() => setSelected(v.ref)} className="text-brand-to hover:underline">{formatValue(v, state.heap)}</button> : <Scalar v={v} heap={state.heap} />}
                    </td>
                  </tr>
                );
              })}
              {obj.n > obj.entries.length && <tr><td colSpan={2} className="px-2 text-[11px] text-fg-3">+{obj.n - obj.entries.length} more</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ListChainCard({ nodes, cyclic, state, labelsById, changed }: { nodes: string[]; cyclic: boolean; state: TraceState; labelsById: Record<string, { name: string; frameId: number }[]>; changed: Set<string> }) {
  return (
    <div className="rounded-[8px] border border-line bg-ws-bar p-2">
      <Labels labels={[]} extra={`linked list · ${nodes.length} ${nodes.length === 1 ? "node" : "nodes"}${cyclic ? " · cycle!" : ""}`} />
      <div className="ws-scroll overflow-x-auto pb-1">
        <div className="flex items-end gap-0">
          {nodes.map((id, i) => {
            const o = state.heap[id] as Extract<HeapObj, { t: "node" }>;
            const labels = labelsById[id] ?? [];
            const extraFields = Object.entries(o.fields).filter(([k]) => k !== "next" && k !== "val" && k !== "value" && k !== "prev");
            return (
              <div key={id} className="flex items-end">
                <div className="flex flex-col items-center">
                  <div className="mb-1 flex h-4 flex-wrap justify-center gap-0.5">{labels.map((l) => <span key={`${l.frameId}:${l.name}`} className="rounded-[3px] bg-brand-from/15 px-1 font-mono text-[10px] font-semibold text-brand-to">{l.name}</span>)}</div>
                  <div className={cn("flex overflow-hidden rounded-[6px] border border-line bg-ws-panel", changed.has(id) && "trace-flash border-medium/70", labels.length && "ring-2 ring-brand-from/50")}>
                    <div className="px-2 py-1 font-mono text-[12px] text-fg-1"><Scalar v={o.fields.val ?? o.fields.value ?? null} heap={state.heap} /></div>
                    <div className="flex w-5 items-center justify-center border-l border-line text-[10px] text-fg-3">{isRef(o.fields.next ?? null) ? "•" : "∅"}</div>
                  </div>
                  {extraFields.length > 0 && <div className="mt-0.5 font-mono text-[10px] text-fg-3">{extraFields.map(([k, v]) => `${k}=${formatValue(v, state.heap)}`).join(" ")}</div>}
                </div>
                {i < nodes.length - 1 && <span className="mb-3 w-6 text-center text-fg-3">→</span>}
                {i === nodes.length - 1 && cyclic && <span className="mb-3 w-6 text-center text-fg-3">↺</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TreeCard({ root, state, labelsById, changed }: { root: string; state: TraceState; labelsById: Record<string, { name: string; frameId: number }[]>; changed: Set<string> }) {
  const layout = useMemo(() => layoutTree(root, state.heap), [root, state.heap]);
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const r = 14;
  return (
    <div className="rounded-[8px] border border-line bg-ws-bar p-2">
      <Labels labels={[]} extra={`tree · ${layout.nodes.length} ${layout.nodes.length === 1 ? "node" : "nodes"}`} />
      <div className="ws-scroll overflow-auto">
        <svg width={layout.width} height={layout.height + 14} className="block">
          {layout.nodes.map((n) => n.parent && byId.get(n.parent) ? <line key={`e${n.id}`} x1={byId.get(n.parent)!.x} y1={byId.get(n.parent)!.y} x2={n.x} y2={n.y} className="stroke-line" strokeWidth={1.5} /> : null)}
          {layout.nodes.map((n) => {
            const labels = labelsById[n.id] ?? [];
            const hot = changed.has(n.id);
            return (
              <g key={n.id} className="transition-transform duration-300" style={{ transform: `translate(${n.x}px, ${n.y}px)` }}>
                <circle r={r} className={cn("fill-ws-panel stroke-line", labels.length && "stroke-brand-from", hot && "trace-flash-svg")} strokeWidth={labels.length ? 2 : 1.5} />
                <text textAnchor="middle" dominantBaseline="central" className="fill-fg-1 font-mono text-[11px]">{n.label}</text>
                {labels.length > 0 && <text y={r + 11} textAnchor="middle" className="fill-brand-to font-mono text-[10px] font-semibold">{labels.map((l) => l.name).join(",")}</text>}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function GraphCard({ id, state, labels, changed }: { id: string; state: TraceState; labels: { name: string; frameId: number }[]; changed: boolean }) {
  const layout = useMemo(() => layoutGraph(id, state.heap), [id, state.heap]);
  if (!layout) return null;
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  // highlight nodes named by scalar locals (e.g. `node`, `cur`, `u`) whose value equals a key
  const marks = new Map<string, string[]>();
  for (const f of state.stack) for (const [name, v] of Object.entries(state.locals[String(f.id)] ?? {})) if (typeof v !== "object") { const key = JSON.stringify(v); if (byId.has(key)) (marks.get(key) ?? marks.set(key, []).get(key)!).push(name); }
  return (
    <div className="rounded-[8px] border border-line bg-ws-bar p-2">
      <Labels labels={labels} extra={`graph · ${layout.nodes.length} nodes · ${layout.edges.length} edges`} />
      <div className="ws-scroll overflow-auto">
        <svg width={layout.width} height={layout.height} className={cn("block", changed && "trace-flash-svg")}>
          {layout.edges.map((e, i) => { const a = byId.get(e.from)!, b = byId.get(e.to)!; return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-line" strokeWidth={1.5} />; })}
          {layout.nodes.map((n) => {
            const m = marks.get(n.id);
            return (
              <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                <circle r={14} className={cn("fill-ws-panel stroke-line", m && "stroke-brand-from")} strokeWidth={m ? 2 : 1.5} />
                <text textAnchor="middle" dominantBaseline="central" className="fill-fg-1 font-mono text-[11px]">{n.label}</text>
                {m && <text y={25} textAnchor="middle" className="fill-brand-to font-mono text-[10px] font-semibold">{m.join(",")}</text>}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function NodeCard({ id, obj, state, labels, changed }: { id: string; obj: Extract<HeapObj, { t: "node" }>; state: TraceState; labels: { name: string; frameId: number }[]; changed: boolean }) {
  const setSelected = useTrace((s) => s.setSelected);
  void id;
  return (
    <div className={cn("rounded-[8px] border border-line bg-ws-bar p-2", changed && "trace-flash")}>
      <Labels labels={labels} extra={obj.cls} />
      <table className="border-separate border-spacing-y-0.5"><tbody>
        {Object.entries(obj.fields).map(([k, v]) => (
          <tr key={k}><td className="pr-2 font-mono text-[12px] text-fg-2">{k}</td><td className="font-mono text-[12px] text-fg-1">{isRef(v) ? <button type="button" onClick={() => setSelected(v.ref)} className="text-brand-to hover:underline">{formatValue(v, state.heap)}</button> : formatValue(v, state.heap)}</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}

export function MemoryCanvas({ state, step, prev, code, paramTypes }: MemoryCanvasProps) {
  const selected = useTrace((s) => s.selected);
  const changed = useMemo(() => changedSet(step), [step]);
  const idxVars = useMemo(() => indexVariables(code), [code]);
  const model = useMemo(() => {
    const ids = reachable(state);
    const labels = pointerLabels(state);
    const shapes = new Map<string, Shape>();
    for (const id of ids) shapes.set(id, detectShape(state.heap[id], state.heap, { names: (labels[id] ?? []).map((l) => l.name), paramTypes }));
    const listIds = [...ids].filter((id) => shapes.get(id) === "list-node");
    const chains = listChains(listIds, state.heap);
    const treeIds = [...ids].filter((id) => shapes.get(id) === "tree-node");
    const roots = treeRoots(treeIds, state.heap);
    const inTree = new Set<string>();
    for (const r of roots) { const q = [r]; while (q.length) { const n = q.pop()!; if (inTree.has(n)) continue; inTree.add(n); for (const c of childrenOf(n, state.heap)) if (c) q.push(c); } }
    const inChain = new Set(chains.flatMap((c) => c.nodes));
    // rows of matrices and adjacency lists are drawn inside their parent
    const nested = new Set<string>();
    for (const id of ids) {
      const sh = shapes.get(id);
      const o = state.heap[id];
      if ((sh === "matrix" || sh === "graph") && o.t === "list") for (const v of o.items) if (isRef(v) && !(labels[v.ref]?.length)) nested.add(v.ref);
      if (sh === "graph" && o.t === "dict") for (const [, v] of o.entries) if (isRef(v) && !(labels[v.ref]?.length)) nested.add(v.ref);
      if (sh === "tree-node" && o.t === "node" && isRef(o.fields.children ?? null)) nested.add((o.fields.children as { ref: string }).ref);
    }
    // order: labelled objects first (by first label's frame depth), then the rest
    const order = [...ids].filter((id) => !inChain.has(id) && !inTree.has(id) && !nested.has(id)).sort((a, b) => (labels[b]?.length ? 1 : 0) - (labels[a]?.length ? 1 : 0) || a.localeCompare(b, undefined, { numeric: true }));
    return { ids, labels, shapes, chains, roots, order };
  }, [state, paramTypes]);

  const empty = model.order.length === 0 && model.chains.length === 0 && model.roots.length === 0;
  return (
    <div className="ws-scroll h-full overflow-y-auto p-2">
      <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-fg-3"><Boxes className="size-3.5" /> What&apos;s in memory</p>
      {empty && <p className="px-1 text-xs text-fg-3">Only simple values so far — arrays, maps, nodes and trees appear here as soon as your code creates them.</p>}
      <div className="flex flex-col gap-2">
        {model.chains.map((c) => <div key={c.head} className={cn(selected && c.nodes.includes(selected) && "ring-2 ring-brand-from/60 rounded-[8px]")}><ListChainCard nodes={c.nodes} cyclic={c.cyclic} state={state} labelsById={model.labels} changed={changed} /></div>)}
        {model.roots.map((r) => <div key={r} className={cn(selected === r && "ring-2 ring-brand-from/60 rounded-[8px]")}><TreeCard root={r} state={state} labelsById={model.labels} changed={changed} /></div>)}
        {model.order.map((id) => {
          const o = state.heap[id];
          const sh = model.shapes.get(id)!;
          const labels = model.labels[id] ?? [];
          const isChanged = changed.has(id);
          const wrap = (el: React.ReactNode) => <div key={id} data-heap-id={id} className={cn(selected === id && "rounded-[8px] ring-2 ring-brand-from/60")}>{el}</div>;
          switch (sh) {
            case "array": case "tuple": case "set": return wrap(<ArrayCard id={id} obj={o as Extract<HeapObj, { t: "list" | "tuple" | "set" }>} state={state} prev={prev} labels={labels} idxVars={new Set(labels.flatMap((l) => [...(idxVars[l.name] ?? [])]))} changed={isChanged} />);
            case "matrix": return wrap(<MatrixCard id={id} obj={o as Extract<HeapObj, { t: "list" }>} state={state} prev={prev} labels={labels} changed={changed} />);
            case "dict": return wrap(<DictCard id={id} obj={o as Extract<HeapObj, { t: "dict" }>} state={state} prev={prev} labels={labels} changed={isChanged} />);
            case "graph": return wrap(<GraphCard id={id} state={state} labels={labels} changed={isChanged} />);
            case "node": case "list-node": case "tree-node": return wrap(<NodeCard id={id} obj={o as Extract<HeapObj, { t: "node" }>} state={state} labels={labels} changed={isChanged} />);
            case "func": return null;
            case "other": return labels.length ? wrap(<div className="rounded-[8px] border border-line bg-ws-bar p-2"><Labels labels={labels} extra={(o as Extract<HeapObj, { t: "other" }>).cls} /><p className="font-mono text-[12px] text-fg-2">{(o as Extract<HeapObj, { t: "other" }>).repr}</p></div>) : null;
          }
        })}
      </div>
    </div>
  );
}
