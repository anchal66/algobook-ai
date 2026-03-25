import { NextResponse } from "next/server";
import { getGlobalLeaderboard, getProjectLeaderboard } from "@/lib/leaderboard";
import { checkSubscription } from "@/lib/check-subscription";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "global";
    const userId = searchParams.get("userId");
    const projectId = searchParams.get("projectId");
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10));
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const sub = await checkSubscription(userId);
    if (!sub.active) {
      return NextResponse.json(
        { error: "Active subscription required", code: "SUBSCRIPTION_REQUIRED" },
        { status: 403 }
      );
    }

    if (scope === "project") {
      if (!projectId) {
        return NextResponse.json({ error: "projectId is required for project scope" }, { status: 400 });
      }
      const result = await getProjectLeaderboard(projectId, limit, userId);
      return NextResponse.json(result);
    }

    // Default: global leaderboard
    const result = await getGlobalLeaderboard(limit, offset, userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Leaderboard API error:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
