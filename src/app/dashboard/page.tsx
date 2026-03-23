"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { firestore, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
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
} from "lucide-react";
import { format } from "date-fns";
import type { UserProfile } from "@/types";

interface Project {
  id: string;
  title: string;
  description: string;
  purpose?: string;
  duration?: number;
  createdAt: { seconds: number; nanoseconds: number };
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

    fetchProjects();
    fetchProfile();
  }, [user, authLoading, router]);

  useEffect(() => {
    const results = projects.filter((project) =>
      project.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProjects(results);
  }, [searchTerm, projects]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

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
            {user?.photoURL && (
              <img
                src={user.photoURL}
                alt=""
                className="h-8 w-8 rounded-full ring-2 ring-border"
                referrerPolicy="no-referrer"
              />
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5 text-muted-foreground hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
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
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
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
            {filteredProjects.map((project) => (
              <motion.div key={project.id} variants={fadeUp}>
                <Link href={`/project/${project.id}/editor`}>
                  <Card className="group h-full flex flex-col overflow-hidden hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 cursor-pointer">
                    <div className="h-1.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {project.title}
                        </CardTitle>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-200" />
                      </div>
                      <CardDescription>
                        {format(
                          new Date(project.createdAt.seconds * 1000),
                          "PPP"
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow pt-0">
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {project.description}
                      </p>
                      {(project.purpose || project.duration) && (
                        <div className="flex flex-wrap gap-2">
                          {project.purpose && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                              {project.purpose}
                            </span>
                          )}
                          {project.duration && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                              {project.duration} days
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
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
    </div>
  );
}

function StatsCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className={`border-${accent}-500/20 bg-${accent}-500/5`}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg bg-${accent}-500/10 p-2`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
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
