import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getByUsername, publicProfile, RESERVED_USERNAMES } from "@/lib/data/users";
import { serialize } from "@/lib/data/schema";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { PublicProfile } from "@/app/[username]/_client";

/** Public profile `/[username]` (Module 05 U-16): server-fetched, hides private data, per-user OG image. */
export const dynamic = "force-dynamic";

async function load(username: string) {
  const u = username.toLowerCase();
  if (RESERVED_USERNAMES.has(u) || !/^[a-z][a-z0-9_]{2,19}$/.test(u)) return null;
  const user = await getByUsername(u);
  if (!user || !user.publicProfile) return null;
  return serialize(publicProfile(user));
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const p = await load(username);
  if (!p) return { title: "User not found" };
  const name = p.displayName || p.username;
  const description = `${name} on AlgoBook — ${p.stats.totalSolved} solved · rating ${Math.round(p.stats.rating)} · ${p.stats.longestStreak}-day best streak.`;
  return { title: `${name} (@${p.username})`, description, openGraph: { title: `${name} · AlgoBook`, description, type: "profile", username: p.username }, twitter: { card: "summary_large_image", title: `${name} · AlgoBook`, description } };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const p = await load(username);
  if (!p) notFound();
  return (
    <MarketingShell>
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8">
        <PublicProfile profile={p} />
      </div>
    </MarketingShell>
  );
}
