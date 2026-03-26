import { NextResponse } from "next/server";
import OpenAI from "openai";
import { adminDb } from "@/lib/firebase-admin";
import { checkSubscription } from "@/lib/check-subscription";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { projectId, userId, title, description, purpose, duration, experienceLevel, goalType, templateId } = await request.json();

    if (!projectId || !userId || !title) {
      return NextResponse.json({ error: "projectId, userId, and title are required" }, { status: 400 });
    }

    const sub = await checkSubscription(userId);
    if (!sub.active) {
      return NextResponse.json({ error: "Active subscription required", code: "SUBSCRIPTION_REQUIRED" }, { status: 403 });
    }

    // Build context for AI
    const templateContext = templateId
      ? `This is a company interview template project (${templateId}). The user is preparing for ${templateId} interviews.`
      : "This is a custom project.";

    const prompt = `You are an expert coding practice planner. Based on the following project details, recommend a study plan.

PROJECT DETAILS:
- Title: "${title}"
- Description: "${description || "N/A"}"
- Purpose: "${purpose || "General practice"}"
- Duration: ${duration || 30} days
- Experience Level: ${experienceLevel || "intermediate"}
- Goal: ${goalType || "daily-practice"}
- ${templateContext}

Respond with a single JSON object:
{
  "totalRecommended": <number — total questions to solve in ${duration || 30} days, reasonable pace>,
  "easyCount": <number>,
  "mediumCount": <number>,
  "hardCount": <number>,
  "estimatedHoursPerWeek": <number — suggested weekly hours>,
  "keyTopics": [<top 5-8 focus topics as strings>],
  "milestones": [
    { "label": "Foundation", "questionsTarget": <number>, "description": "<what reaching this means>" },
    { "label": "Intermediate", "questionsTarget": <number>, "description": "<what reaching this means>" },
    { "label": "Advanced", "questionsTarget": <number>, "description": "<what reaching this means>" }
  ],
  "tip": "<one motivational/strategic sentence for this specific project>"
}

RULES:
- totalRecommended = easyCount + mediumCount + hardCount
- For beginners: ~60% Easy, ~30% Medium, ~10% Hard
- For intermediate: ~30% Easy, ~50% Medium, ~20% Hard
- For advanced: ~15% Easy, ~40% Medium, ~45% Hard
- Pace: 2-4 questions/day for interview-prep, 1-2 for daily-practice, 1-3 for learn-basics
- milestones should be progressive: ~30%, ~65%, ~100% of totalRecommended
- keyTopics should be realistic for the goal and experience level
- Respond with ONLY valid JSON, no markdown`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.4,
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("AI failed to generate insights.");

    const insights = JSON.parse(content);

    // Validate and normalize
    const normalized = {
      totalRecommended: insights.totalRecommended || 60,
      easyCount: insights.easyCount || 20,
      mediumCount: insights.mediumCount || 30,
      hardCount: insights.hardCount || 10,
      estimatedHoursPerWeek: insights.estimatedHoursPerWeek || 5,
      keyTopics: Array.isArray(insights.keyTopics) ? insights.keyTopics.slice(0, 8) : [],
      milestones: Array.isArray(insights.milestones) ? insights.milestones.slice(0, 3) : [],
      tip: insights.tip || "Stay consistent — small daily progress adds up.",
    };

    // Save insights to the project document
    await adminDb.collection("projects").doc(projectId).update({
      insights: normalized,
    });

    return NextResponse.json({ insights: normalized });
  } catch (error) {
    console.error("Project insights API error:", error);
    return NextResponse.json({ error: "Failed to generate project insights" }, { status: 500 });
  }
}

// GET: Fetch existing insights for a project
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    const doc = await adminDb.collection("projects").doc(projectId).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const data = doc.data();
    return NextResponse.json({ insights: data?.insights || null });
  } catch (error) {
    console.error("Get insights error:", error);
    return NextResponse.json({ error: "Failed to fetch insights" }, { status: 500 });
  }
}
