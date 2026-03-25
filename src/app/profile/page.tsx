"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/UserMenu";
import SubmissionHeatmap from "@/components/SubmissionHeatmap";
import {
  Code2, ArrowLeft, Loader2, Edit2, Share2, Copy, Check,
  Building2, GraduationCap, MapPin, ExternalLink,
  Flame, Trophy, CheckCircle2, XCircle, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { UserProfile } from "@/types";
import { format } from "date-fns";

interface HistorySubmission {
  id: string;
  questionId: string;
  projectId: string;
  questionTitle: string;
  projectTitle: string;
  status: string;
  difficulty: string | null;
  attemptNumber: number;
  hintsUsed: number;
  timeSpentSeconds: number;
  submittedAt: string | null;
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // History state
  const [history, setHistory] = useState<HistorySubmission[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }

    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/profile?userId=${encodeURIComponent(user.uid)}`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const res = await fetch(
          `/api/profile/history?userId=${encodeURIComponent(user.uid)}&page=${historyPage}&limit=20`
        );
        if (res.ok) {
          const data = await res.json();
          setHistory(data.submissions);
          setHistoryHasMore(data.hasMore);
        }
      } catch (err) {
        console.error("Error fetching history:", err);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [user, historyPage]);

  const handleShare = async () => {
    if (!profile?.username) return;
    const url = `${window.location.origin}/${profile.username}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !profile) return null;

  const hasDetails = profile.bio || profile.company || profile.college || profile.githubUrl || profile.linkedinUrl;
  const totalAttempts = profile.totalSolved + profile.totalFailed;
  const successRate = totalAttempts > 0 ? Math.round((profile.totalSolved / totalAttempts) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">AlgoBook</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-start gap-6 mb-10">
          <div className="shrink-0">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="h-24 w-24 rounded-2xl ring-4 ring-border" referrerPolicy="no-referrer" />
            ) : (
              <div className="h-24 w-24 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary ring-4 ring-border">
                {user.displayName?.[0]?.toUpperCase() || "U"}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{profile.displayName || user.displayName || "Unnamed User"}</h1>
            {profile.username && (
              <p className="text-sm text-primary font-medium">@{profile.username}</p>
            )}
            {profile.bio && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{profile.bio}</p>
            )}
            <div className="flex items-center gap-2 mt-4">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => router.push("/profile/edit")}>
                <Edit2 className="h-3.5 w-3.5" /> Edit Profile
              </Button>
              {profile.username && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleShare}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Share"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Prompt to fill profile if empty */}
        {!hasDetails && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 mb-8 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">Complete your profile</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add your bio, skills, and links to make your profile stand out to recruiters.</p>
            </div>
            <Button size="sm" onClick={() => router.push("/profile/edit")} className="gap-1.5 shrink-0">
              <Edit2 className="h-3.5 w-3.5" /> Fill Details
            </Button>
          </div>
        )}

        {/* Info Cards */}
        {hasDetails && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {profile.company && (
              <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Company</p>
                  <p className="text-sm font-medium truncate">{profile.company}</p>
                </div>
              </div>
            )}
            {profile.college && (
              <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4">
                <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">College</p>
                  <p className="text-sm font-medium truncate">{profile.college}</p>
                </div>
              </div>
            )}
            {profile.address && (
              <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="text-sm font-medium truncate">{profile.address}</p>
                </div>
              </div>
            )}
            {(profile.githubUrl || profile.linkedinUrl) && (
              <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4">
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-3">
                  {profile.githubUrl && (
                    <a href={profile.githubUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">GitHub</a>
                  )}
                  {profile.linkedinUrl && (
                    <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">LinkedIn</a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span key={skill} className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
            <p className="text-2xl font-bold">{profile.totalSolved}</p>
            <p className="text-xs text-muted-foreground">Problems Solved</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
            <p className="text-2xl font-bold">{successRate}%</p>
            <p className="text-xs text-muted-foreground">Success Rate</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Flame className="h-5 w-5 text-orange-400" />
              <p className="text-2xl font-bold">{profile.currentStreak}</p>
            </div>
            <p className="text-xs text-muted-foreground">Current Streak</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Trophy className="h-5 w-5 text-amber-400" />
              <p className="text-2xl font-bold">{profile.longestStreak}</p>
            </div>
            <p className="text-xs text-muted-foreground">Longest Streak</p>
          </div>
        </div>

        {/* Submission Heatmap */}
        <div className="mb-10">
          <SubmissionHeatmap userId={user.uid} />
        </div>

        {/* Submission History */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Submission History</h2>
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground rounded-xl border border-border/60">
              <p className="text-sm">No submissions yet. Start solving problems to see your history!</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Question</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Project</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Attempt</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((sub) => (
                        <tr key={sub.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-medium">{sub.questionTitle}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{sub.projectTitle}</td>
                          <td className="px-4 py-3">
                            {sub.status === "success" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Passed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-400">
                                <XCircle className="h-3.5 w-3.5" /> Failed
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">#{sub.attemptNumber}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {sub.submittedAt ? format(new Date(sub.submittedAt), "MMM d, yyyy") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => p - 1)}
                  className="gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {historyPage}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!historyHasMore}
                  onClick={() => setHistoryPage((p) => p + 1)}
                  className="gap-1"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
