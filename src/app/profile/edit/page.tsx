"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Code2, ArrowLeft, Loader2, Save, Check, X, AlertCircle,
} from "lucide-react";
import type { UserProfile } from "@/types";
import { SKILLS_LIST } from "@/lib/skills";

export default function EditProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form fields
  const [bio, setBio] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [college, setCollege] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState("");
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);

  // Username fields
  const [username, setUsername] = useState("");
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState("");
  const [usernameChanging, setUsernameChanging] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }

    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/profile?userId=${encodeURIComponent(user.uid)}`);
        if (res.ok) {
          const data = await res.json();
          const p = data.profile as UserProfile;
          setProfile(p);
          setBio(p.bio || "");
          setCompany(p.company || "");
          setAddress(p.address || "");
          setCollege(p.college || "");
          setGithubUrl(p.githubUrl || "");
          setLinkedinUrl(p.linkedinUrl || "");
          setSkills(p.skills || []);
          setUsername(p.username || "");
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user, authLoading, router]);

  // Debounced username availability check
  const checkUsername = useCallback(async (value: string) => {
    if (!value || value === profile?.username) {
      setUsernameAvailable(null);
      setUsernameError("");
      return;
    }
    if (!/^[a-z][a-z0-9_]{2,19}$/.test(value)) {
      setUsernameAvailable(false);
      setUsernameError("3-20 chars, lowercase letters, numbers, underscores. Must start with a letter.");
      return;
    }
    setUsernameChecking(true);
    try {
      const res = await fetch(`/api/profile/username/check?username=${encodeURIComponent(value)}`);
      if (res.ok) {
        const data = await res.json();
        setUsernameAvailable(data.available);
        setUsernameError(data.available ? "" : "Username is taken");
      }
    } catch {
      setUsernameError("Error checking availability");
    } finally {
      setUsernameChecking(false);
    }
  }, [profile?.username]);

  useEffect(() => {
    const timer = setTimeout(() => checkUsername(username), 500);
    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          fields: { bio, company, address, college, githubUrl, linkedinUrl, skills },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Error saving profile:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleChangeUsername = async () => {
    if (!user || !usernameAvailable || username === profile?.username) return;
    setUsernameChanging(true);
    try {
      const res = await fetch("/api/profile/username/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, newUsername: username }),
      });
      if (res.ok) {
        setProfile((prev) => prev ? { ...prev, username, usernameChangesLeft: prev.usernameChangesLeft - 1 } : prev);
        setUsernameAvailable(null);
      } else {
        const data = await res.json();
        setUsernameError(data.error || "Failed to update username");
      }
    } catch {
      setUsernameError("Error updating username");
    } finally {
      setUsernameChanging(false);
    }
  };

  const filteredSkills = SKILLS_LIST.filter(
    (s) => s.toLowerCase().includes(skillSearch.toLowerCase()) && !skills.includes(s)
  );

  const addSkill = (skill: string) => {
    setSkills((prev) => [...prev, skill]);
    setSkillSearch("");
  };

  const removeSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill));
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-6 py-3">
          <Link href="/profile" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">AlgoBook</span>
          </Link>
          <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Profile
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight mb-8">Edit Profile</h1>

        <div className="space-y-8">
          {/* Username */}
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <Label className="text-sm font-semibold mb-1 block">Username</Label>
            <p className="text-xs text-muted-foreground mb-3">
              {profile.usernameChangesLeft > 0
                ? `You can change your username ${profile.usernameChangesLeft} more time${profile.usernameChangesLeft > 1 ? "s" : ""}.`
                : "You've used all your username changes."}
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  className="pl-7"
                  disabled={profile.usernameChangesLeft <= 0}
                  maxLength={20}
                />
                {usernameChecking && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {!usernameChecking && usernameAvailable === true && username !== profile.username && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                )}
                {!usernameChecking && usernameAvailable === false && (
                  <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />
                )}
              </div>
              <Button
                size="sm"
                disabled={!usernameAvailable || username === profile.username || usernameChanging || profile.usernameChangesLeft <= 0}
                onClick={handleChangeUsername}
              >
                {usernameChanging ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
              </Button>
            </div>
            {usernameError && (
              <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {usernameError}
              </p>
            )}
          </div>

          {/* Bio */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground mt-1">{bio.length}/300</p>
          </div>

          {/* Company & College */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold mb-1.5 block">Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Where do you work?" />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1.5 block">College</Label>
              <Input value={college} onChange={(e) => setCollege(e.target.value)} placeholder="Where did you study?" />
            </div>
          </div>

          {/* Address */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">Location</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="City, Country" />
          </div>

          {/* URLs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold mb-1.5 block">GitHub URL</Label>
              <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/username" />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1.5 block">LinkedIn URL</Label>
              <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/username" />
            </div>
          </div>

          {/* Skills */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">Skills</Label>
            <div className="flex flex-wrap gap-2 mb-3">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium border border-primary/20"
                >
                  {skill}
                  <button onClick={() => removeSkill(skill)} className="hover:text-red-400 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <Input
                value={skillSearch}
                onChange={(e) => { setSkillSearch(e.target.value); setShowSkillDropdown(true); }}
                onFocus={() => setShowSkillDropdown(true)}
                placeholder="Search and add skills..."
              />
              {showSkillDropdown && skillSearch && filteredSkills.length > 0 && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                  {filteredSkills.slice(0, 15).map((skill) => (
                    <button
                      key={skill}
                      onClick={() => { addSkill(skill); setShowSkillDropdown(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3 pt-4 border-t border-border/40">
            <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saved ? "Saved!" : saving ? "Saving..." : "Save Profile"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/profile")}>
              Cancel
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
