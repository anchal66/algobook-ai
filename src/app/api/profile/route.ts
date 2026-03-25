import { NextResponse } from "next/server";
import { getOrCreateProfile, getProfileByUsername } from "@/lib/user-profile";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const username = searchParams.get("username");

    if (!userId && !username) {
      return NextResponse.json({ error: "userId or username is required" }, { status: 400 });
    }

    let profile;
    if (username) {
      profile = await getProfileByUsername(username.toLowerCase());
      if (!profile) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }
    } else {
      profile = await getOrCreateProfile(userId!);
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
