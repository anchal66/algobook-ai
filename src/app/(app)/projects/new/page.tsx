"use client";
/** New project wizard (Module 05 U-14): Template → Goal → Details → Review. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Rocket } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, invalidate } from "@/lib/app/query";
import { createProject, listTemplates, type TemplateDTO } from "@/lib/app/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/button";
import { StepDetails, StepGoal, StepReview, StepTemplate, templateDuration, type WizardState } from "@/components/wizard/steps";
import { COMPANY_LABEL } from "@/components/dashboard/ProjectCard";
import { track } from "@/lib/analytics";
import { titleCase } from "@/lib/app/format";
import { cn } from "@/lib/utils";

const STEPS = ["Template", "Goal", "Details", "Review"] as const;

export default function NewProjectPage() {
  const { user } = useAuth();
  const router = useRouter();
  const templates = useQuery(user ? "/api/templates" : null, listTemplates, { staleMs: 5 * 60_000 });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState<WizardState>({ templateId: null, title: "", description: "", purpose: "", goalType: "daily-practice", experienceLevel: "intermediate", selectedTopics: [], durationDays: 30, weeklyHours: 6 });
  const set = (p: Partial<WizardState>) => setS((prev) => ({ ...prev, ...p }));
  const template = templates.data?.templates.find((t) => t.id === s.templateId) ?? null;

  const pickTemplate = (t: TemplateDTO | null) => {
    if (!t) { set({ templateId: null }); return; }
    const label = COMPANY_LABEL[t.company] ?? titleCase(t.company);
    set({ templateId: t.id, durationDays: templateDuration(t.count), goalType: "interview-prep", title: s.title || `${label} interview prep`, description: s.description || t.description || `${t.count} ${label}-style problems, verified and ordered by the template.`, purpose: s.purpose || (t.purpose || `${label} interview`) });
  };

  const detailsValid = s.title.trim().length > 0 && s.description.trim().length > 0;
  const canNext = step === 2 ? detailsValid : true;

  const submit = async () => {
    if (!detailsValid) { setStep(2); toast.error("Project title and description are required."); return; }
    setBusy(true);
    try {
      const { project } = await createProject({ title: s.title.trim(), description: s.description.trim(), purpose: s.purpose.trim(), durationDays: s.durationDays, experienceLevel: s.experienceLevel, goalType: s.goalType, selectedTopics: s.selectedTopics, templateId: s.templateId });
      track("project_create", { template: s.templateId, durationDays: s.durationDays });
      invalidate("/api/projects");
      // The overview's Plan tab requests the AI plan on mount (one call, cached server-side for 10 min).
      toast.success("Project created — building your plan…");
      router.push(`/project/${project.id}?tab=plan`);
    } catch (e) {
      toast.error((e as Error).message || "Could not create the project.");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="New project" title={step === 0 ? "Pick a company template or start custom" : step === 1 ? "Goal & experience" : step === 2 ? "Details & pace" : "Review & create"} description={step === 0 ? "Templates come with a curated, verified problem list. Custom projects generate around your goal." : undefined} />

      <ol className="mb-6 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <button type="button" onClick={() => i < step && setStep(i)} disabled={i > step} className={cn("flex h-8 items-center gap-2 rounded-full pr-3 text-sm transition-colors", i <= step ? "text-text-1" : "text-text-3")}>
              <span className={cn("flex size-7 items-center justify-center rounded-full text-xs font-semibold", i < step ? "bg-ok text-white" : i === step ? "bg-brand text-white" : "bg-surface-3 text-text-2")}>{i < step ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className={cn("h-px flex-1", i < step ? "bg-ok" : "bg-line")} aria-hidden />}
          </li>
        ))}
      </ol>

      <div key={step} className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        {step === 0 && <StepTemplate templates={templates.data?.templates ?? []} loading={templates.loading} value={s.templateId} onPick={pickTemplate} />}
        {step === 1 && <StepGoal s={s} set={set} />}
        {step === 2 && <StepDetails s={s} set={set} templateCount={template?.count ?? null} />}
        {step === 3 && <StepReview s={s} template={template} />}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
        <Button variant="ghost" onClick={() => (step === 0 ? router.push("/dashboard") : setStep(step - 1))} disabled={busy}><ArrowLeft className="size-4" /> {step === 0 ? "Cancel" : "Back"}</Button>
        {step < STEPS.length - 1 ? (
          <Button variant="brand" onClick={() => setStep(step + 1)} disabled={!canNext}>Continue <ArrowRight className="size-4" /></Button>
        ) : (
          <Button variant="brand" size="lg" loading={busy} onClick={() => void submit()}><Rocket className="size-4" /> Create project &amp; start</Button>
        )}
      </div>
    </div>
  );
}
