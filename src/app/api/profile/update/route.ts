import { NextResponse } from "next/server";
import { updateProfileAfterSubmission, updateProfileFields } from "@/lib/user-profile";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, tags, passed, difficulty, hintsUsed, timeSpentSeconds, isFirstTry, runCount, fields } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // If "fields" is provided, update profile fields (bio, company, etc.)
    if (fields && typeof fields === "object") {
      await updateProfileFields(userId, fields);
      return NextResponse.json({ success: true });
    }

    // Otherwise, treat as a submission update
    if (!Array.isArray(tags) || typeof passed !== "boolean") {
      return NextResponse.json(
        { error: "userId, tags[], and passed (boolean) are required" },
        { status: 400 }
      );
    }

    await updateProfileAfterSubmission(userId, {
      tags,
      passed,
      difficulty: difficulty || "Medium",
      hintsUsed: hintsUsed ?? 0,
      timeSpentSeconds: timeSpentSeconds ?? 0,
      isFirstTry: isFirstTry ?? true,
      runCount: runCount ?? 0,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
