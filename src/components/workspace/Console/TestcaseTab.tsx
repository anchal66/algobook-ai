"use client";
/** Testcase tab (Module 03 W-10): sample cases + up to 6 custom cases, per-param human inputs with validation. */
import { useMemo } from "react";
import { parseHuman } from "@/lib/judge/human";
import { useWorkspace, type CaseDraft } from "@/store/workspace";
import { CaseChips, type Chip } from "@/components/workspace/Console/CaseChips";
import { ParamInput } from "@/components/workspace/Console/ParamInput";

export const MAX_CUSTOM_CASES = 6;
let customSeq = 0;

export function TestcaseTab() {
  const problem = useWorkspace((s) => s.problem);
  const cases = useWorkspace((s) => s.cases);
  const active = useWorkspace((s) => s.activeCase);
  const setCases = useWorkspace((s) => s.setCases);
  const setActive = useWorkspace((s) => s.setActiveCase);

  const errors = useMemo(() => {
    if (!problem) return {};
    const c = cases[active];
    if (!c) return {};
    const out: Record<number, string> = {};
    problem.params.forEach((p, i) => { const r = parseHuman(p.type, c.values[i] ?? ""); if (r instanceof Error) out[i] = r.message; });
    return out;
  }, [problem, cases, active]);

  if (!problem) return <p className="p-4 text-sm text-fg-3">Load a problem to edit test cases.</p>;
  const current = cases[active];
  const customCount = cases.filter((c) => c.custom).length;

  const chips: Chip[] = cases.map((c, i) => ({ id: c.id, label: `Case ${i + 1}`, removable: c.custom }));
  const update = (i: number, v: string) => {
    const next = cases.map((c, k) => (k === active ? { ...c, values: c.values.map((x, j) => (j === i ? v : x)) } : c));
    setCases(next);
  };
  const add = () => {
    if (customCount >= MAX_CUSTOM_CASES) return;
    const base = current ?? cases[0];
    const draft: CaseDraft = { id: `c${++customSeq}-${Date.now()}`, values: base ? [...base.values] : problem.params.map(() => ""), custom: true };
    setCases([...cases, draft]);
    setActive(cases.length);
  };
  const remove = (i: number) => {
    const next = cases.filter((_, k) => k !== i);
    setCases(next);
    setActive(Math.max(0, Math.min(active >= i ? active - 1 : active, next.length - 1)));
  };

  return (
    <div className="ws-scroll h-full overflow-y-auto p-4">
      <CaseChips chips={chips} active={active} onSelect={setActive} onRemove={remove} onAdd={add} canAdd={customCount < MAX_CUSTOM_CASES} />
      {current && (
        <div className="mt-4 space-y-3">
          {problem.params.map((p, i) => (
            <ParamInput key={p.name} name={p.name} type={p.type} value={current.values[i] ?? ""} error={errors[i]} onChange={(v) => update(i, v)} />
          ))}
          {current.custom && <p className="text-[11px] text-fg-3">Custom cases run without an expected output — you will only see what your code prints.</p>}
        </div>
      )}
    </div>
  );
}
