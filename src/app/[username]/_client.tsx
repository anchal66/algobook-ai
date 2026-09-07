"use client";
import { useAuth } from "@/context/AuthContext";
import { ProfileView, type ProfileData } from "@/components/profile/ProfileView";
import type { publicProfile } from "@/lib/data/users";
import type { Serialized } from "@/types";

type PublicDTO = Serialized<ReturnType<typeof publicProfile>>;

export function PublicProfile({ profile }: { profile: PublicDTO }) {
  const { user } = useAuth();
  const isOwner = user?.uid === profile.id;
  const p: ProfileData = { ...profile, ratingHistory: profile.ratingHistory ?? [], mastery: profile.mastery ?? {} };
  return <ProfileView p={p} isOwner={isOwner} />;
}
