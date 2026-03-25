import { Metadata } from "next";
import PublicProfileClient from "./_client";

type Props = { params: Promise<{ username: string }> };

const RESERVED = new Set([
  "dashboard", "login", "project", "projects", "profile", "privacy",
  "terms", "contact", "about", "settings", "api", "admin",
]);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  if (RESERVED.has(username)) return {};

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://algobook.ai";
    const res = await fetch(`${baseUrl}/api/profile?username=${encodeURIComponent(username)}`, { cache: "no-store" });
    if (!res.ok) return { title: "Profile Not Found | AlgoBook" };
    const { profile } = await res.json();
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
  return <PublicProfileClient username={username} />;
}
