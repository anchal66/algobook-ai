import { NextResponse } from "next/server";
import { checkSubscriptionStatus } from "@/lib/subscription";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const status = await checkSubscriptionStatus(userId);
    return NextResponse.json(status);
  } catch (error: unknown) {
    console.error("[api/subscription/status]", error);
    const message = error instanceof Error ? error.message : String(error);
    const missingCreds =
      message.includes("FIREBASE_SERVICE_ACCOUNT") || message.includes("not valid JSON");
    return NextResponse.json(
      {
        active: false,
        reason: missingCreds ? "firebase_admin_misconfigured" : "server_error",
        ...(process.env.NODE_ENV === "development" && { debug: message }),
      },
      { status: 500 }
    );
  }
}
