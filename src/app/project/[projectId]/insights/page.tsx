"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/context/AuthContext";
import { firestore } from "@/lib/firebase";
import {
  doc, getDoc, collection, getDocs, query, where, orderBy,
} from "firebase/firestore";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, Target,
  Flame, TrendingUp, Brain, BookOpen, Lightbulb, Code2, Trophy,
  BarChart3, Zap,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { ProjectInsights, Submission } from "@/types";

interface ProjectData {
  title: string;
  description: string;
  purpose?: string;
  duration?: number;
  activeDays?: number;
  templateId?: string;
  experienceLevel?: string;
  goalType?: string;
  insights?: ProjectInsights;
  createdAt: { seconds: number; nanoseconds: number };
}

interface QuestionData {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
}

interface QuestionWithSubmissions extends QuestionData {
  submissions: Submission[];
  solved: boolean;
  bestTime: number | null;
  hintsUsed: number;
}

export default function ProjectInsightsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [questions, setQuestions] = useState<QuestionWithSubmissions[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const projectDoc = await getDoc(doc(firestore, "projects", projectId));
        if (!projectDoc.exists()) return;
        setProject(projectDoc.data() as ProjectData);

        // Fetch project questions
        const pqSnap = await getDocs(collection(firestore, "projects", projectId, "projectQuestions"));
        const pqs = pqSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as QuestionData[];

        // Fetch all submissions for this project
        const subSnap = await getDocs(
          query(
            collection(firestore, "submissions"),
            where("projectId", "==", projectId),
            where("userId", "==", user.uid),
            orderBy("submittedAt", "desc")
          )
        );
        const allSubs = subSnap.docs.map((d) => d.data()) as Submission[];

        // Group submissions by question
        const subsByQ: Record<string, Submission[]> = {};
        allSubs.forEach((s) => {
          if (!subsByQ[s.questionId]) subsByQ[s.questionId] = [];
          subsByQ[s.questionId].push(s);
        });

        const qWithSubs: QuestionWithSubmissions[] = pqs.map((q) => {
          const subs = subsByQ[q.id] || [];
          const solved = subs.some((s) => s.status === "success");
          const successSubs = subs.filter((s) => s.status === "success");
          const bestTime = successSubs.length > 0 ? Math.min(...successSubs.map((s) => s.timeSpentSeconds)) : null;
          const hintsUsed = subs.reduce((max, s) => Math.max(max, s.hintsUsed), 0);
          return { ...q, submissions: subs, solved, bestTime, hintsUsed };
        });

        setQuestions(qWithSubs);
      } catch (err) {
        console.error("Error fetching insights data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, projectId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">Project not found</p>
        <Link href="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
      </div>
    );
  }

  const insights = project.insights;
  const totalSolved = questions.filter((q) => q.solved).length;
  const totalAttempting = questions.filter((q) => !q.solved && q.submissions.length > 0).length;
  const totalTarget = insights?.totalRecommended || questions.length || 1;
  const solvePercent = Math.min(100, Math.round((totalSolved / totalTarget) * 100));

  const easySolved = questions.filter((q) => q.solved && q.difficulty === "Easy").length;
  const medSolved = questions.filter((q) => q.solved && q.difficulty === "Medium").length;
  const hardSolved = questions.filter((q) => q.solved && q.difficulty === "Hard").length;

  const totalSubmissions = questions.reduce((s, q) => s + q.submissions.length, 0);
  const totalSuccessSubs = questions.reduce((s, q) => s + q.submissions.filter((sub) => sub.status === "success").length, 0);
  const successRate = totalSubmissions > 0 ? Math.round((totalSuccessSubs / totalSubmissions) * 100) : 0;

  const totalTimeSeconds = questions.reduce((s, q) => s + q.submissions.reduce((t, sub) => t + (sub.timeSpentSeconds || 0), 0), 0);
  const totalHints = questions.reduce((s, q) => s + q.hintsUsed, 0);

  // Topic frequency
  const topicCounts: Record<string, { solved: number; total: number }> = {};
  questions.forEach((q) => {
    (q.tags || []).forEach((tag) => {
      if (!topicCounts[tag]) topicCounts[tag] = { solved: 0, total: 0 };
      topicCounts[tag].total++;
      if (q.solved) topicCounts[tag].solved++;
    });
  });
  const topicEntries = Object.entries(topicCounts).sort((a, b) => b[1].total - a[1].total);

  // Milestone progress
  const milestones = insights?.milestones || [];
  const currentMilestoneIdx = milestones.findIndex((m) => totalSolved < m.questionsTarget);

  // SVG circular progress
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (solvePercent / 100) * circumference;

  // Recent activity (last 10 submissions)
  const recentSubs = questions
    .flatMap((q) => q.submissions.map((s) => ({ ...s, questionTitle: q.title, difficulty: q.difficulty })))
    .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0))
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="h-5 w-px bg-border" />
            <Link href="/dashboard" className="flex items-center gap-1.5">
              <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
                <Code2 className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold hidden sm:inline">AlgoBook</span>
            </Link>
            <div className="h-5 w-px bg-border hidden sm:block" />
            <h1 className="text-sm font-medium text-muted-foreground truncate max-w-[300px]">{project.title} — Insights</h1>
          </div>
          <Link href={`/project/${projectId}/editor`}>
            <Button size="sm" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Continue Practicing
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {/* Top Overview Row */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Circular Progress Card */}
          <Card className="lg:col-span-1">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <div className="relative mb-4">
                <svg width="160" height="160" viewBox="0 0 160 160" className="transform -rotate-90">
                  <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
                  <circle
                    cx="80" cy="80" r={radius} fill="none"
                    stroke="url(#insightsGradient)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="insightsGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="hsl(var(--primary))" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold">{totalSolved}<span className="text-sm text-muted-foreground font-normal">/{totalTarget}</span></span>
                  <span className="text-xs text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Solved
                  </span>
                </div>
              </div>
              {totalAttempting > 0 && (
                <p className="text-sm text-muted-foreground">{totalAttempting} Attempting</p>
              )}
              {insights?.tip && (
                <div className="mt-4 rounded-lg bg-primary/5 border border-primary/10 px-4 py-2.5 text-center">
                  <p className="text-xs text-primary flex items-center gap-1.5 justify-center">
                    <Lightbulb className="h-3.5 w-3.5 shrink-0" /> {insights.tip}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Difficulty Breakdown Card */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Difficulty Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DifficultyRow label="Easy" solved={easySolved} total={insights?.easyCount || easySolved} color="emerald" />
              <DifficultyRow label="Medium" solved={medSolved} total={insights?.mediumCount || medSolved} color="amber" />
              <DifficultyRow label="Hard" solved={hardSolved} total={insights?.hardCount || hardSolved} color="red" />
            </CardContent>
          </Card>

          {/* Quick Stats Card */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <StatRow icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Success Rate" value={`${successRate}%`} />
              <StatRow icon={<Clock className="h-4 w-4 text-blue-400" />} label="Total Time" value={formatTime(totalTimeSeconds)} />
              <StatRow icon={<Brain className="h-4 w-4 text-purple-400" />} label="Hints Used" value={String(totalHints)} />
              <StatRow icon={<Flame className="h-4 w-4 text-orange-400" />} label="Active Days" value={String(project.activeDays || 0)} />
              <StatRow icon={<BookOpen className="h-4 w-4 text-cyan-400" />} label="Total Submissions" value={String(totalSubmissions)} />
              {insights?.estimatedHoursPerWeek && (
                <StatRow icon={<TrendingUp className="h-4 w-4 text-primary" />} label="Recommended" value={`${insights.estimatedHoursPerWeek}h/week`} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Milestones */}
        {milestones.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" /> Milestones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-0">
                  {milestones.map((m, i) => {
                    const reached = totalSolved >= m.questionsTarget;
                    const isCurrent = i === currentMilestoneIdx;
                    const pct = Math.min(100, Math.round((totalSolved / m.questionsTarget) * 100));
                    return (
                      <div key={i} className="flex-1 relative">
                        <div className="flex flex-col items-center text-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                            reached
                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-500"
                              : isCurrent
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-muted border-border text-muted-foreground"
                          }`}>
                            {reached ? <CheckCircle2 className="h-5 w-5" /> : m.questionsTarget}
                          </div>
                          <p className={`text-xs font-semibold mt-2 ${reached ? "text-emerald-500" : isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                            {m.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[140px]">{m.description}</p>
                          {!reached && (
                            <p className="text-[10px] text-muted-foreground mt-1">{pct}% · {m.questionsTarget - totalSolved} to go</p>
                          )}
                        </div>
                        {/* Connector line */}
                        {i < milestones.length - 1 && (
                          <div className="absolute top-5 left-[55%] right-0 h-0.5">
                            <div className={`h-full ${reached ? "bg-emerald-500" : "bg-border"}`} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Key Topics + Recent Activity */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Topic Coverage */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-400" /> Topic Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topicEntries.length > 0 ? (
                <div className="space-y-2.5">
                  {topicEntries.slice(0, 12).map(([topic, counts]) => {
                    const pct = counts.total > 0 ? Math.round((counts.solved / counts.total) * 100) : 0;
                    return (
                      <div key={topic}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium capitalize">{topic}</span>
                          <span className="text-[10px] text-muted-foreground">{counts.solved}/{counts.total}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-primary" : pct > 0 ? "bg-amber-500" : "bg-muted"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {insights?.keyTopics && insights.keyTopics.length > 0 && (
                    <div className="pt-3 border-t border-border/50">
                      <p className="text-[10px] text-muted-foreground mb-2">AI Recommended Topics:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {insights.keyTopics.map((t) => (
                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No questions attempted yet</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-400" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentSubs.length > 0 ? (
                <div className="space-y-2">
                  {recentSubs.map((sub, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      {sub.status === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{sub.questionTitle}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {sub.submittedAt?.seconds
                            ? formatDistanceToNow(new Date(sub.submittedAt.seconds * 1000), { addSuffix: true })
                            : "Unknown"}
                          {sub.timeSpentSeconds > 0 && ` · ${Math.round(sub.timeSpentSeconds / 60)}min`}
                          {sub.hintsUsed > 0 && ` · ${sub.hintsUsed} hint${sub.hintsUsed > 1 ? "s" : ""}`}
                        </p>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        sub.difficulty === "Easy" ? "bg-emerald-500/10 text-emerald-500" :
                        sub.difficulty === "Medium" ? "bg-amber-500/10 text-amber-500" :
                        "bg-red-500/10 text-red-400"
                      }`}>
                        {sub.difficulty}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No submissions yet</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Question History Table */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-cyan-400" /> Question History ({questions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {questions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Question</th>
                        <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Difficulty</th>
                        <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Attempts</th>
                        <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Best Time</th>
                        <th className="text-left py-2 text-xs text-muted-foreground font-medium">Hints</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q) => (
                        <tr key={q.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 pr-4">
                            {q.solved ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : q.submissions.length > 0 ? (
                              <XCircle className="h-4 w-4 text-amber-500" />
                            ) : (
                              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                            )}
                          </td>
                          <td className="py-2.5 pr-4 font-medium text-xs max-w-[250px] truncate">{q.title}</td>
                          <td className="py-2.5 pr-4">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              q.difficulty === "Easy" ? "bg-emerald-500/10 text-emerald-500" :
                              q.difficulty === "Medium" ? "bg-amber-500/10 text-amber-500" :
                              "bg-red-500/10 text-red-400"
                            }`}>{q.difficulty}</span>
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-muted-foreground">{q.submissions.length}</td>
                          <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                            {q.bestTime ? `${Math.round(q.bestTime / 60)}m` : "—"}
                          </td>
                          <td className="py-2.5 text-xs text-muted-foreground">{q.hintsUsed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No questions generated yet. Start practicing to see your progress!
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

function DifficultyRow({ label, solved, total, color }: { label: string; solved: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((solved / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-sm font-semibold text-${color}-500`}>{label}</span>
        <span className="text-sm font-bold">{solved}<span className="text-muted-foreground font-normal text-xs">/{total}</span></span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full bg-${color}-500 transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
