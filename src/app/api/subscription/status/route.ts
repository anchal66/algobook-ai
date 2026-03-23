import { NextResponse } from "next/server";
import { checkSubscriptionStatus } from "@/lib/subscription";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const status = await checkSubscriptionStatus(userId);
  return NextResponse.json(status);
}
