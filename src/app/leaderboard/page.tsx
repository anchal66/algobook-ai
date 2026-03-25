"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { firestore } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Trophy,
  Crown,
  Medal,
  Flame,
  Code2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
  FolderOpen,
  Target,
  TrendingUp,
} from "lucide-react";
import type { LeaderboardEntry } from "@/types";
import UserMenu from "@/components/UserMenu";

interface Project {
  id: string;
  title: string;
}

type TabScope = "global" | "project";

const PAGE_SIZE = 25;

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { active: hasSubscription, loading: subLoading, plan, redirectToCheckout } = useSubscription();
  const router = useRouter();

  const [tab, setTab] = useState<TabScope>("global");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userPercentile, setUserPercentile] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Project tab state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Fetch user projects for the project tab
  useEffect(() => {
    if (!user || tab !== "project") return;

    const fetchProjects = async () => {
      setProjectsLoading(true);
      try {
        const q = query(
          collection(firestore, "projects"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, title: d.data().title as string }));
        setProjects(list);
        if (list.length > 0 && !selectedProjectId) {
          setSelectedProjectId(list[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch projects:", err);
      } finally {
        setProjectsLoading(false);
      }
    };

    fetchProjects();
  }, [user, tab, selectedProjectId]);

  const fetchLeaderboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        scope: tab,
        userId: user.uid,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (tab === "project" && selectedProjectId) {
        params.set("projectId", selectedProjectId);
      }

      const res = await fetch(`/api/leaderboard?${params}`);
      if (!res.ok) {
        const data = await res.json();
        if (data.code === "SUBSCRIPTION_REQUIRED") {
          setEntries([]);
          setLoading(false);
          return;
        }
        throw new Error(data.error);
      }

      const data = await res.json();
      setEntries(data.entries || []);
      setUserRank(data.userRank);
      setUserPercentile(data.userPercentile);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, tab, page, selectedProjectId]);

  useEffect(() => {
    if (authLoading || subLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (!hasSubscription) {
      setLoading(false);
      return;
    }
    fetchLeaderboard();
  }, [authLoading, subLoading, user, hasSubscription, fetchLeaderboard, router]);

  // Reset page when tab/project changes
  useEffect(() => {
    setPage(0);
  }, [tab, selectedProjectId]);

  if (authLoading || subLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">AlgoBook</span>
          </Link>
          <div className="flex items-center gap-3">
            {!subLoading && hasSubscription && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                <Crown className="h-3 w-3" /> {plan?.name || "Pro"}
              </span>
            )}
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Title */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-amber-500/10 p-2.5">
              <Trophy className="h-6 w-6 text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
          </div>
          <p className="text-muted-foreground ml-14">
            See how you rank against other AlgoBook users.
          </p>
        </motion.div>

        {/* Subscription gate */}
        {!hasSubscription ? (
          <motion.div
            className="text-center py-20 rounded-2xl border-2 border-dashed border-border/60"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="mx-auto mb-6 inline-flex items-center justify-center rounded-2xl bg-muted p-5">
              <Trophy className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Pro Feature</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Upgrade to Pro to access the leaderboard and see your rank.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => redirectToCheckout("pro-monthly")}>
                ₹499/mo
              </Button>
              <Button onClick={() => redirectToCheckout("pro-yearly")} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> ₹4,999/yr
              </Button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* User rank summary */}
            {userRank !== null && tab === "global" && (
              <motion.div
                className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="border-amber-500/20 bg-amber-500/5">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="rounded-lg bg-amber-500/10 p-2">
                      <Trophy className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Your Rank</p>
                      <p className="text-lg font-bold">#{userRank}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Percentile</p>
                      <p className="text-lg font-bold">Top {100 - (userPercentile ?? 0) + 1}%</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-emerald-500/20 bg-emerald-500/5">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="rounded-lg bg-emerald-500/10 p-2">
                      <Users className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Players</p>
                      <p className="text-lg font-bold">{total}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Tabs */}
            <motion.div
              className="flex items-center gap-2 mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <button
                onClick={() => setTab("global")}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === "global"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <Users className="h-4 w-4" /> Global
              </button>
              <button
                onClick={() => setTab("project")}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === "project"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <FolderOpen className="h-4 w-4" /> My Projects
              </button>
            </motion.div>

            {/* Project selector */}
            {tab === "project" && (
              <motion.div
                className="mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {projectsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading projects...
                  </div>
                ) : projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No projects found.</p>
                ) : (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                )}
              </motion.div>
            )}

            {/* Leaderboard table */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-20 rounded-2xl border-2 border-dashed border-border/60">
                <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-2xl bg-muted p-5">
                  <Target className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No rankings yet</h3>
                <p className="text-sm text-muted-foreground">
                  {tab === "project"
                    ? "No submissions in this project yet."
                    : "Start solving problems to appear on the leaderboard!"}
                </p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {/* Table header */}
                <div className="grid grid-cols-[3.5rem_1fr_5rem_5rem_5rem_5rem] sm:grid-cols-[3.5rem_1fr_6rem_6rem_6rem_6rem] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border/60">
                  <span>Rank</span>
                  <span>User</span>
                  <span className="text-right">Score</span>
                  <span className="text-right">Solved</span>
                  <span className="text-right hidden sm:block">Streak</span>
                  <span className="text-right hidden sm:block">Mastery</span>
                </div>

                {/* Rows */}
                <div className="divide-y divide-border/40">
                  {entries.map((entry) => {
                    const isMe = entry.userId === user?.uid;
                    return (
                      <div
                        key={entry.userId}
                        className={`grid grid-cols-[3.5rem_1fr_5rem_5rem_5rem_5rem] sm:grid-cols-[3.5rem_1fr_6rem_6rem_6rem_6rem] gap-2 px-4 py-3 items-center transition-colors ${
                          isMe
                            ? "bg-primary/5 border-l-2 border-l-primary"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        {/* Rank */}
                        <div className="flex items-center justify-center">
                          {entry.rank === 1 ? (
                            <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center">
                              <Crown className="h-4 w-4 text-amber-400" />
                            </div>
                          ) : entry.rank === 2 ? (
                            <div className="h-8 w-8 rounded-full bg-zinc-400/15 flex items-center justify-center">
                              <Medal className="h-4 w-4 text-zinc-400" />
                            </div>
                          ) : entry.rank === 3 ? (
                            <div className="h-8 w-8 rounded-full bg-orange-700/15 flex items-center justify-center">
                              <Medal className="h-4 w-4 text-orange-700" />
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-muted-foreground">
                              {entry.rank}
                            </span>
                          )}
                        </div>

                        {/* User */}
                        <div className="flex items-center gap-3 min-w-0">
                          {entry.photoURL ? (
                            <img
                              src={entry.photoURL}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-muted-foreground">
                                {(entry.displayName || entry.username || "?")[0].toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${isMe ? "text-primary" : ""}`}>
                              {entry.displayName || entry.username}
                              {isMe && (
                                <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              @{entry.username}
                            </p>
                          </div>
                        </div>

                        {/* Score */}
                        <p className="text-sm font-bold text-right">{entry.score}</p>

                        {/* Solved */}
                        <p className="text-sm text-right text-muted-foreground">{entry.totalSolved}</p>

                        {/* Streak */}
                        <div className="hidden sm:flex items-center justify-end gap-1">
                          {entry.currentStreak > 0 && (
                            <Flame className="h-3.5 w-3.5 text-orange-400" />
                          )}
                          <span className="text-sm text-muted-foreground">{entry.currentStreak}d</span>
                        </div>

                        {/* Mastery */}
                        <p className="text-sm text-right hidden sm:block text-muted-foreground">
                          {entry.avgMastery}%
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/40">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                      className="gap-1"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
