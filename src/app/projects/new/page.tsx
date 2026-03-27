"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { firestore } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp, doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  ArrowLeft,
  Code2,
  Rocket,
  GraduationCap,
  Zap,
  Briefcase,
  RotateCcw,
  Baby,
  User,
  Crown,
  Lock,
  Sparkles,
  Check,
  ArrowRight,
  X,
  Building2,
  FileText,
} from "lucide-react";
import type { ExperienceLevel, GoalType, TemplateInfo } from "@/types";

const EXPERIENCE_OPTIONS: {
  value: ExperienceLevel;
  label: string;
  description: string;
  icon: typeof Baby;
}[] = [
  { value: "beginner", label: "Just Starting Out", description: "New to coding or data structures", icon: Baby },
  { value: "intermediate", label: "I Code Regularly", description: "Comfortable with basics, building skills", icon: User },
  { value: "advanced", label: "Experienced Developer", description: "Strong fundamentals, want harder challenges", icon: Crown },
];

const GOAL_OPTIONS: {
  value: GoalType;
  label: string;
  description: string;
  icon: typeof GraduationCap;
}[] = [
  { value: "learn-basics", label: "Learn the Basics", description: "Build a strong foundation", icon: GraduationCap },
  { value: "daily-practice", label: "Daily Practice", description: "Stay sharp with regular coding", icon: Zap },
  { value: "interview-prep", label: "Interview Prep", description: "Prepare for technical interviews", icon: Briefcase },
  { value: "returning-after-break", label: "Getting Back Into It", description: "Rebuild skills after a break", icon: RotateCcw },
];

export default function NewProjectPage() {
  const { user } = useAuth();
  const { active: hasSubscription, loading: subLoading, redirectToCheckout } = useSubscription();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [purpose, setPurpose] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("intermediate");
  const [goalType, setGoalType] = useState<GoalType>("daily-practice");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Template state
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null);

  // Fetch available templates
  useEffect(() => {
    fetch("/api/templates")
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, []);

  const selectTemplate = (tmpl: TemplateInfo) => {
    setSelectedTemplate(tmpl);
    setTitle(tmpl.title);
    setDescription(tmpl.description);
    setPurpose(tmpl.purpose);
    setGoalType("interview-prep");
    // ~2 questions/day pace, capped at 90
    setDuration(Math.min(90, Math.max(7, Math.ceil(tmpl.questionCount / 2))));
  };

  const clearTemplate = () => {
    setSelectedTemplate(null);
    setTitle("");
    setDescription("");
    setPurpose("");
    setGoalType("daily-practice");
    setDuration(30);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in to create a project.");
      return;
    }
    if (!title.trim() || !description.trim()) {
      setError("Project title and description are required.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const projectData: Record<string, unknown> = {
        userId: user.uid,
        title,
        description,
        duration,
        purpose,
        experienceLevel,
        goalType,
        createdAt: serverTimestamp(),
      };
      if (selectedTemplate) {
        projectData.templateId = selectedTemplate.id;
      }

      const projectsCollection = collection(firestore, "projects");
      const newProjectDoc = await addDoc(projectsCollection, projectData);

      // Wait for the document to be confirmed readable before navigating.
      // This prevents race conditions where the editor/attendance loads
      // before the project doc is available in Firestore's cache.
      const projectRef = doc(firestore, "projects", newProjectDoc.id);
      for (let i = 0; i < 10; i++) {
        const snap = await getDoc(projectRef);
        if (snap.exists()) break;
        await new Promise((r) => setTimeout(r, 200));
      }

      // Seed template pool if a template was selected
      if (selectedTemplate) {
        try {
          await fetch("/api/templates/seed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: newProjectDoc.id,
              templateId: selectedTemplate.id,
              userId: user.uid,
            }),
          });
        } catch (seedErr) {
          console.error("Template seed failed (non-blocking):", seedErr);
        }
      }

      // Generate AI-powered project insights (non-blocking)
      fetch("/api/project/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: newProjectDoc.id,
          userId: user.uid,
          title,
          description,
          purpose,
          duration,
          experienceLevel,
          goalType,
          templateId: selectedTemplate?.id || null,
        }),
      }).catch((err) => console.error("Insights generation failed (non-blocking):", err));

      router.push(`/project/${newProjectDoc.id}`);
    } catch (err) {
      console.error("Error creating project: ", err);
      setError("Failed to create project. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">AlgoBook</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="flex items-center justify-center px-4 py-16 sm:py-24">
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {!subLoading && !hasSubscription ? (
            <Card className="overflow-hidden border-border/60">
              <div className="h-2 bg-gradient-to-r from-amber-500/60 via-amber-500 to-amber-500/60" />
              <CardContent className="py-16 text-center">
                <div className="mx-auto mb-6 inline-flex items-center justify-center rounded-2xl bg-amber-500/10 p-5">
                  <Lock className="h-10 w-10 text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Pro Plan Required</h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-8">
                  Creating projects requires an active Pro plan. Choose a plan below to unlock AI-powered question generation, code execution, and more.
                </p>
                <ul className="text-sm text-left max-w-xs mx-auto space-y-2.5 mb-8">
                  {[
                    "Unlimited AI question generation",
                    "Full code editor & execution",
                    "Unlimited projects",
                    "Smart hints & recommendations",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mb-6">No auto-renewal — renew only when you want to.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button
                    onClick={() => redirectToCheckout("pro-monthly")}
                    variant="outline"
                    className="gap-2"
                    size="lg"
                  >
                    <Sparkles className="h-4 w-4" /> ₹499 / month
                  </Button>
                  <Button
                    onClick={() => redirectToCheckout("pro-yearly")}
                    className="gap-2 shadow-lg shadow-primary/20"
                    size="lg"
                  >
                    <Sparkles className="h-4 w-4" /> ₹4,999 / year &middot; Save 17%
                  </Button>
                </div>
                <div className="mt-4">
                  <Link href="/dashboard">
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                      <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
          <Card className="overflow-hidden border-border/60">
            <div className="h-2 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <Rocket className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">
                    Create New Project
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    Pick a company template or start a custom project.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            {/* Template Picker */}
            <CardContent className="pb-2">
              <Label className="mb-3 block">Choose a Template</Label>
              {templatesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading templates...
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Custom Project card */}
                  <button
                    type="button"
                    onClick={clearTemplate}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
                      !selectedTemplate
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <FileText className={`h-6 w-6 ${!selectedTemplate ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-xs font-medium ${!selectedTemplate ? "text-primary" : ""}`}>Custom</span>
                  </button>

                  {/* Company template cards */}
                  {templates.map((tmpl) => {
                    const isSelected = selectedTemplate?.id === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => selectTemplate(tmpl)}
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <Building2 className={`h-6 w-6 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-xs font-medium ${isSelected ? "text-primary" : ""}`}>{tmpl.company}</span>
                        <span className="text-[10px] text-muted-foreground">{tmpl.questionCount} questions</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Selected template badge */}
              {selectedTemplate && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary text-xs font-medium px-3 py-1.5">
                  <Building2 className="h-3 w-3" />
                  {selectedTemplate.company} Template · {selectedTemplate.questionCount} questions
                  <span className="text-[10px] text-primary/60">
                    ({selectedTemplate.difficulties.easy}E · {selectedTemplate.difficulties.medium}M · {selectedTemplate.difficulties.hard}H)
                  </span>
                  <button type="button" onClick={clearTemplate} className="ml-1 hover:text-primary/70">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </CardContent>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Project Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Mastering Dynamic Programming"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what you want to achieve. This helps the AI generate relevant questions."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[100px]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purpose">Purpose (optional)</Label>
                  <Input
                    id="purpose"
                    placeholder="e.g., Prepare for FAANG Interviews"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="duration">Practice Duration</Label>
                    <span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                      {duration} days
                    </span>
                  </div>
                  <Slider
                    id="duration"
                    min={7}
                    max={90}
                    step={1}
                    value={[duration]}
                    onValueChange={(value) => setDuration(value[0])}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 week</span>
                    <span>3 months</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Your Experience Level</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {EXPERIENCE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const selected = experienceLevel === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setExperienceLevel(opt.value)}
                          className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
                            selected
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-sm font-medium ${selected ? "text-primary" : ""}`}>{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>What&apos;s Your Goal?</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {GOAL_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const selected = goalType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setGoalType(opt.value)}
                          className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                            selected
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <Icon className={`h-5 w-5 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                          <div>
                            <span className={`text-sm font-medium block ${selected ? "text-primary" : ""}`}>{opt.label}</span>
                            <span className="text-xs text-muted-foreground">{opt.description}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col items-stretch gap-4 pt-2">
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full py-6 text-base gap-2 shadow-lg shadow-primary/20"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4" />
                      Start Coding
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
          )}
        </motion.div>
      </main>
    </div>
  );
}
