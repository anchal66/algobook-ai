"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Code2, Loader2, Building2, GraduationCap, MapPin, ExternalLink,
} from "lucide-react";
import type { UserProfile } from "@/types";
import SubmissionHeatmap from "@/components/SubmissionHeatmap";

export default function PublicProfileClient({ username }: { username: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/profile?username=${encodeURIComponent(username)}`);
        if (res.status === 404) { setNotFound(true); return; }
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-2xl font-bold">User not found</p>
        <p className="text-muted-foreground">@{username} doesn&apos;t exist on AlgoBook.</p>
        <Link href="/" className="text-primary hover:underline">Go home</Link>
      </div>
    );
  }

  const infoItems = [
    profile.company && { icon: Building2, text: profile.company },
    profile.college && { icon: GraduationCap, text: profile.college },
    profile.address && { icon: MapPin, text: profile.address },
  ].filter(Boolean) as { icon: typeof Building2; text: string }[];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">AlgoBook</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Profile Header */}
        <div className="flex items-start gap-5 mb-8">
          {profile.photoURL ? (
            <img src={profile.photoURL} alt="" className="h-20 w-20 rounded-full ring-2 ring-primary/20" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {(profile.displayName || username)[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{profile.displayName || username}</h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio && <p className="text-sm mt-2 max-w-lg">{profile.bio}</p>}
            <div className="flex flex-wrap gap-3 mt-3">
              {profile.githubUrl && (
                <a href={profile.githubUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  GitHub <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {profile.linkedinUrl && (
                <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  LinkedIn <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        {infoItems.length > 0 && (
          <div className="flex flex-wrap gap-4 mb-8">
            {infoItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <item.icon className="h-4 w-4" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span key={skill} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Solved", value: profile.totalSolved },
            { label: "Success Rate", value: `${profile.totalSolved && (profile.totalSolved + profile.totalFailed) ? Math.round((profile.totalSolved / (profile.totalSolved + profile.totalFailed)) * 100) : 0}%` },
            { label: "Current Streak", value: `${profile.currentStreak || 0}d` },
            { label: "Longest Streak", value: `${profile.longestStreak || 0}d` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border/60 bg-card p-4 text-center">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Heatmap */}
        {profile.userId && <SubmissionHeatmap userId={profile.userId} />}
      </main>
    </div>
  );
}
