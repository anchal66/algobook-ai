"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { firestore } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PlusCircle,
  Loader2,
  Search,
  FolderOpen,
  LogOut,
  Code2,
  ArrowRight,
  Flame,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Crown,
  Sparkles,
  MoreVertical,
  BarChart3,
  ExternalLink,
  BookOpen,
  Clock,
  Target,
  Building2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { UserProfile } from "@/types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import ActivitySheet from "@/components/ActivitySheet";
import UserMenu from "@/components/UserMenu";
import type { ProjectInsights } from "@/types";

interface Project {
  id: string;
  title: string;
  description: string;
  purpose?: string;
  duration?: number;
  activeDays?: number;
  templateId?: string;
  insights?: ProjectInsights;
  createdAt: { seconds: number; nanoseconds: number };
}

interface ProjectProgress {
  totalQuestions: number;
  totalSubmissions: number;
  successfulSubmissions: number;
  lastActivity: Date | null;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  attempting: number;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { active: hasSubscription, loading: subLoading, plan, redirectToCheckout } = useSubscription();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activityProject, setActivityProject] = useState<{ id: string; title: string } | null>(null);
  const [projectProgress, setProjectProgress] = useState<Record<string, ProjectProgress>>({});
  const [rankData, setRankData] = useState<{ rank: number; percentile: number } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchProjects = async () => {
      try {
        const q = query(
          collection(firestore, "projects"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const userProjects = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Project[];
        setProjects(userProjects);
        setFilteredProjects(userProjects);
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/profile?userId=${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    };

    fetchProjects().then(() => fetchProjectProgress());
    fetchProfile();

    async function fetchRank() {
      if (!user) return;
      try {
        const res = await fetch(`/api/leaderboard?scope=global&userId=${user.uid}&limit=1`);
        if (res.ok) {
          const data = await res.json();
          if (data.userRank !== null) {
            setRankData({ rank: data.userRank, percentile: data.userPercentile ?? 0 });
          }
        }
      } catch {}
    }
    fetchRank();

    async function fetchProjectProgress() {
      if (!user) return;
      try {
        const projQuery = query(
          collection(firestore, "projects"),
          where("userId", "==", user.uid)
        );
        const projSnap = await getDocs(projQuery);
        const projectIds = projSnap.docs.map((d) => d.id);
        if (projectIds.length === 0) return;

        const progressMap: Record<string, ProjectProgress> = {};

        // Fetch question counts and submissions per project in parallel
        await Promise.all(
          projectIds.map(async (pid) => {
            const [qSnap, subSnap] = await Promise.all([
              getDocs(collection(firestore, "projects", pid, "projectQuestions")),
              getDocs(
                query(
                  collection(firestore, "submissions"),
                  where("userId", "==", user.uid),
                  where("projectId", "==", pid),
                  orderBy("submittedAt", "desc")
                )
              ),
            ]);
            const subs = subSnap.docs.map((d) => d.data());
            const successCount = subs.filter((s) => s.status === "success").length;
            const lastSub = subs[0]?.submittedAt;

            // Per-difficulty solved counts
            const solvedQuestionIds = new Set(
              subs.filter((s) => s.status === "success").map((s) => s.questionId)
            );
            const attemptedNotSolvedIds = new Set(
              subs.filter((s) => s.status !== "success").map((s) => s.questionId)
            );
            // Remove solved from attempting
            solvedQuestionIds.forEach((id) => attemptedNotSolvedIds.delete(id));

            // Map question IDs to difficulty
            const qDiffById: Record<string, string> = {};
            qSnap.docs.forEach((d) => { qDiffById[d.id] = d.data().difficulty || "Medium"; });

            let easySolved = 0, mediumSolved = 0, hardSolved = 0;
            solvedQuestionIds.forEach((qId) => {
              const diff = qDiffById[qId];
              if (diff === "Easy") easySolved++;
              else if (diff === "Medium") mediumSolved++;
              else if (diff === "Hard") hardSolved++;
            });

            progressMap[pid] = {
              totalQuestions: qSnap.size,
              totalSubmissions: subs.length,
              successfulSubmissions: successCount,
              lastActivity: lastSub?.toDate ? lastSub.toDate() : null,
              easySolved,
              mediumSolved,
              hardSolved,
              attempting: attemptedNotSolvedIds.size,
            };
          })
        );
        setProjectProgress(progressMap);
      } catch (err) {
        console.error("Error fetching project progress:", err);
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const results = projects.filter((project) =>
      project.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProjects(results);
  }, [searchTerm, projects]);

  if (loading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = user?.displayName?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">AlgoBook</span>
          </Link>
          <div className="flex items-center gap-3">
            {!subLoading && (
              hasSubscription ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  <Crown className="h-3 w-3" /> {plan?.name || "Pro"}
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => redirectToCheckout("pro-monthly")}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                  >
                    <Sparkles className="h-3 w-3" /> ₹499/mo
                  </button>
                  <button
                    onClick={() => redirectToCheckout("pro-yearly")}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                  >
                    ₹4,999/yr
                  </button>
                </div>
              )
            )}
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Greeting */}
        <motion.div
          className="mb-10"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Welcome back, {firstName}
              </h1>
              <p className="text-muted-foreground mt-1">
                {projects.length > 0
                  ? `You have ${projects.length} project${projects.length !== 1 ? "s" : ""}. Keep up the great work.`
                  : "Ready to start your coding practice journey?"}
              </p>
            </div>
            {hasSubscription ? (
              <Link href="/projects/new">
                <Button className="gap-2 shadow-lg shadow-primary/20">
                  <PlusCircle className="h-4 w-4" /> New Project
                </Button>
              </Link>
            ) : (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => redirectToCheckout("pro-monthly")}
              >
                <PlusCircle className="h-4 w-4" /> New Project
                <Crown className="h-3.5 w-3.5 text-amber-400" />
              </Button>
            )}
          </motion.div>
        </motion.div>

        {/* Upgrade Banner */}
        {!subLoading && !hasSubscription && (
          <motion.div
            className="mb-8 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Unlock the full AlgoBook experience</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    AI questions, code execution, smart hints & unlimited projects. No auto-renewal — renew only when you want.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={() => redirectToCheckout("pro-monthly")}
                  variant="outline"
                  className="gap-1.5"
                  size="sm"
                >
                  ₹499/mo
                </Button>
                <Button
                  onClick={() => redirectToCheckout("pro-yearly")}
                  className="gap-1.5 shadow-lg shadow-primary/20"
                  size="sm"
                >
                  <Sparkles className="h-3.5 w-3.5" /> ₹4,999/yr &middot; Save 17%
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Row */}
        {profile && (profile.totalSolved > 0 || profile.currentStreak > 0) && (
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <StatsCard
              icon={<Flame className="h-5 w-5 text-orange-400" />}
              label="Current Streak"
              value={`${profile.currentStreak} day${profile.currentStreak !== 1 ? "s" : ""}`}
              accent="orange"
            />
            <StatsCard
              icon={<Trophy className="h-5 w-5 text-amber-400" />}
              label="Longest Streak"
              value={`${profile.longestStreak} day${profile.longestStreak !== 1 ? "s" : ""}`}
              accent="amber"
            />
            <StatsCard
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
              label="Total Solved"
              value={String(profile.totalSolved)}
              accent="emerald"
            />
            <StatsCard
              icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
              label="Weak Topic"
              value={getWeakestTopic(profile)}
              accent="red"
            />
            {rankData ? (
              <Link href="/leaderboard">
                <StatsCard
                  icon={<Target className="h-5 w-5 text-primary" />}
                  label="Global Rank"
                  value={`#${rankData.rank}`}
                  accent="primary"
                  subtitle={`Top ${Math.max(1, 100 - rankData.percentile + 1)}%`}
                />
              </Link>
            ) : (
              <StatsCard
                icon={<Target className="h-5 w-5 text-primary" />}
                label="Global Rank"
                value="—"
                accent="primary"
              />
            )}
          </motion.div>
        )}

        {/* Search */}
        <motion.div
          className="relative mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="pl-10 h-11 bg-card border-border/60"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </motion.div>

        {/* Project Grid */}
        {filteredProjects.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            {filteredProjects.map((project) => {
              const progress = projectProgress[project.id];
              const insights = project.insights;
              const totalQ = progress?.totalQuestions || 0;
              const totalSolved = (progress?.easySolved || 0) + (progress?.mediumSolved || 0) + (progress?.hardSolved || 0);
              const totalTarget = insights?.totalRecommended || totalQ || 1;
              const solvePercent = Math.min(100, Math.round((totalSolved / totalTarget) * 100));
              const attempting = progress?.attempting || 0;
              const createdDate = new Date(project.createdAt.seconds * 1000);
              const activeDays = project.activeDays || 0;
              const durationProgress = project.duration ? Math.min(100, Math.round((activeDays / project.duration) * 100)) : null;

              // SVG circular progress
              const radius = 52;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (solvePercent / 100) * circumference;

              return (
                <motion.div key={project.id} variants={fadeUp}>
                  <Card className="group h-full flex flex-col overflow-hidden hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                    <div className="h-1.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <Link href={`/project/${project.id}/editor`} className="flex-1 min-w-0">
                          <CardTitle className="text-lg group-hover:text-primary transition-colors cursor-pointer">
                            {project.title}
                          </CardTitle>
                          {project.templateId && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <Building2 className="h-2.5 w-2.5" /> {project.templateId.charAt(0).toUpperCase() + project.templateId.slice(1)} Template
                            </span>
                          )}
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded-md hover:bg-accent transition-colors -mr-1" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/project/${project.id}/editor`} className="gap-2">
                                <ExternalLink className="h-4 w-4" /> Open Project
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/project/${project.id}/insights`} className="gap-2">
                                <BarChart3 className="h-4 w-4" /> Project Insights
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => setActivityProject({ id: project.id, title: project.title })}
                            >
                              <BookOpen className="h-4 w-4" /> View Activity
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created {format(createdDate, "MMM d, yyyy")}
                        {progress?.lastActivity && (
                          <> · Active {formatDistanceToNow(progress.lastActivity, { addSuffix: true })}</>
                        )}
                      </p>
                    </CardHeader>
                    <Link href={`/project/${project.id}/editor`} className="cursor-pointer flex-grow">
                      <CardContent className="pt-0 pb-4 flex flex-col h-full">
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {project.description}
                        </p>

                        {/* Progress Section: Circular Ring + Difficulty Breakdown */}
                        {insights ? (
                          <div className="flex items-center gap-4 mb-4">
                            {/* Circular Progress Ring */}
                            <div className="relative shrink-0">
                              <svg width="120" height="120" viewBox="0 0 120 120" className="transform -rotate-90">
                                <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                                <circle
                                  cx="60" cy="60" r={radius} fill="none"
                                  stroke="url(#progressGradient)"
                                  strokeWidth="8"
                                  strokeLinecap="round"
                                  strokeDasharray={circumference}
                                  strokeDashoffset={strokeDashoffset}
                                  className="transition-all duration-700"
                                />
                                <defs>
                                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                                    <stop offset="100%" stopColor="#22c55e" />
                                  </linearGradient>
                                </defs>
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-xl font-bold">{totalSolved}<span className="text-xs text-muted-foreground font-normal">/{totalTarget}</span></span>
                                <span className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> Solved
                                </span>
                                {attempting > 0 && (
                                  <span className="text-[9px] text-muted-foreground">{attempting} Attempting</span>
                                )}
                              </div>
                            </div>

                            {/* Difficulty Breakdown */}
                            <div className="flex flex-col gap-2 flex-1 min-w-0">
                              <DifficultyBar label="Easy" solved={progress?.easySolved || 0} total={insights.easyCount} color="text-emerald-500" bg="bg-emerald-500" />
                              <DifficultyBar label="Med." solved={progress?.mediumSolved || 0} total={insights.mediumCount} color="text-amber-500" bg="bg-amber-500" />
                              <DifficultyBar label="Hard" solved={progress?.hardSolved || 0} total={insights.hardCount} color="text-red-400" bg="bg-red-500" />
                            </div>
                          </div>
                        ) : (
                          /* Fallback: original stats row when no insights */
                          <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="rounded-lg bg-muted/50 p-2 text-center">
                              <p className="text-base font-bold">{totalQ}</p>
                              <p className="text-[10px] text-muted-foreground">Questions</p>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-2 text-center">
                              <p className="text-base font-bold">{progress?.totalSubmissions || 0}</p>
                              <p className="text-[10px] text-muted-foreground">Submissions</p>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-2 text-center">
                              <p className={`text-base font-bold ${(progress?.totalSubmissions || 0) > 0 ? (Math.round(((progress?.successfulSubmissions || 0) / (progress?.totalSubmissions || 1)) * 100) >= 70 ? 'text-emerald-500' : 'text-amber-500') : ''}`}>
                                {(progress?.totalSubmissions || 0) > 0 ? `${Math.round(((progress?.successfulSubmissions || 0) / (progress?.totalSubmissions || 1)) * 100)}%` : '—'}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Success</p>
                            </div>
                          </div>
                        )}

                        {/* Duration progress bar */}
                        {project.duration && (
                          <div className="mt-auto">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Day {activeDays} of {project.duration}
                              </span>
                              <span className="text-[10px] font-medium text-muted-foreground">{durationProgress}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  durationProgress! >= 100 ? 'bg-emerald-500' : durationProgress! >= 75 ? 'bg-amber-500' : 'bg-primary'
                                }`}
                                style={{ width: `${durationProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Tags */}
                        {(project.purpose || (project.duration && !project.duration)) && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {project.purpose && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                {project.purpose}
                              </span>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Link>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            className="text-center py-20 rounded-2xl border-2 border-dashed border-border/60"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="mx-auto mb-6 inline-flex items-center justify-center rounded-2xl bg-muted p-5">
              <FolderOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {searchTerm ? "No matching projects" : "No projects yet"}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              {searchTerm
                ? `Nothing matches "${searchTerm}". Try a different search.`
                : "Create your first project to start practicing with AI-generated coding challenges."}
            </p>
            {!searchTerm && (
              <Link href="/projects/new">
                <Button className="gap-2">
                  <PlusCircle className="h-4 w-4" /> Create Your First Project
                </Button>
              </Link>
            )}
          </motion.div>
        )}
      </main>

      {/* Activity Sheet */}
      <ActivitySheet
        open={!!activityProject}
        onOpenChange={(open) => !open && setActivityProject(null)}
        projectId={activityProject?.id || ""}
        projectTitle={activityProject?.title || ""}
      />
    </div>
  );
}

function StatsCard({
  icon,
  label,
  value,
  accent,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  subtitle?: string;
}) {
  return (
    <Card className={`border-${accent}-500/20 bg-${accent}-500/5`}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg bg-${accent}-500/10 p-2`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function getWeakestTopic(profile: UserProfile): string {
  const entries = Object.entries(profile.topicSkills || {});
  if (entries.length === 0) return "None yet";

  let weakest = { topic: "", score: Infinity };
  for (const [topic, skill] of entries) {
    const total = skill.solved + skill.failed;
    if (total === 0) continue;
    const mastery = skill.masteryScore ?? Math.round((skill.solved / total) * 100);
    if (mastery < weakest.score) {
      weakest = { topic, score: mastery };
    }
  }

  if (weakest.topic === "") return "None yet";
  return weakest.topic.charAt(0).toUpperCase() + weakest.topic.slice(1);
}

function DifficultyBar({ label, solved, total, color, bg }: { label: string; solved: number; total: number; color: string; bg: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((solved / total) * 100)) : 0;
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[11px] font-semibold ${color}`}>{label}</span>
        <span className="text-[11px] font-bold">{solved}<span className="text-muted-foreground font-normal">/{total}</span></span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${bg} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
