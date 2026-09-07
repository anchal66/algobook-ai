import { Metadata } from "next";
import PublicProfileClient from "./_client";
import { getByUsername, publicProfile } from "@/lib/data/users";
import { serialize } from "@/lib/data/schema";
import { toLegacyProfile } from "@/lib/legacy/adapters";

async function loadProfile(username: string) {
  const u = await getByUsername(username);
  if (!u) return null;
  const pub = serialize(publicProfile(u));
  return toLegacyProfile({ ...pub, uid: u.id, email: "", usernameChangesLeft: 0, experienceLevel: u.experienceLevel, goalType: u.goalType,
    practiceState: u.practiceState, calibration: u.calibration, topicSkills: {}, settings: serialize(u.settings), plan: serialize(u.plan), quotas: u.quotas, updatedAt: pub.createdAt,
    lastAppliedSubmissionId: null, dailyProjectId: null });
}

type Props = { params: Promise<{ username: string }> };

const RESERVED = new Set([
  "dashboard", "login", "project", "projects", "profile", "privacy",
  "terms", "contact", "about", "settings", "api", "admin",
]);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  if (RESERVED.has(username)) return {};

  try {
    const profile = await loadProfile(username.toLowerCase());
    if (!profile) return { title: "Profile Not Found | AlgoBook" };
    return {
      title: `${profile.displayName || username} | AlgoBook`,
      description: profile.bio || `${profile.displayName || username}'s coding profile on AlgoBook`,
      openGraph: {
        title: `${profile.displayName || username} | AlgoBook`,
        description: profile.bio || `Check out ${profile.displayName || username}'s coding profile`,
        type: "profile",
      },
    };
  } catch {
    return { title: "AlgoBook Profile" };
  }
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  if (RESERVED.has(username)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Page not found.</p>
      </div>
    );
  }
  const profile = await loadProfile(username.toLowerCase()).catch(() => null);
  return <PublicProfileClient username={username} profile={profile} />;
}
