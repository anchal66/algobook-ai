import { NextResponse } from "next/server";
import { updateProfileAfterSubmission } from "@/lib/user-profile";

export async function POST(request: Request) {
  try {
    const { userId, tags, passed } = await request.json();

    if (!userId || !Array.isArray(tags) || typeof passed !== "boolean") {
      return NextResponse.json({ error: "userId, tags[], and passed (boolean) are required" }, { status: 400 });
    }

    await updateProfileAfterSubmission(userId, tags, passed);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
