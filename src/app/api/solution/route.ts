import { NextResponse } from "next/server";
import OpenAI from "openai";
import { adminDb } from "@/lib/firebase-admin";
import { checkSubscription } from "@/lib/check-subscription";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { questionId, userCode, userId } = await request.json();

    if (!questionId || !userCode || !userId) {
      return NextResponse.json(
        { error: "questionId, userCode, and userId are required" },
        { status: 400 }
      );
    }

    const sub = await checkSubscription(userId);
    if (!sub.active) {
      return NextResponse.json(
        { error: "Active subscription required", code: "SUBSCRIPTION_REQUIRED" },
        { status: 403 }
      );
    }

    // Fetch question data
    const questionSnap = await adminDb.collection("questions").doc(questionId).get();
    if (!questionSnap.exists) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const questionData = questionSnap.data()!;

    const prompt = `You are an expert coding tutor analyzing a student's solution.

PROBLEM: ${questionData.title}
${questionData.problemStatement}

DIFFICULTY: ${questionData.difficulty}
TAGS: ${(questionData.tags || []).join(", ")}

STUDENT'S CODE:
\`\`\`java
${userCode}
\`\`\`

Analyze the student's solution and respond with a JSON object:
{
  "analysis": "2-3 sentence description of what the student's code does and their approach",
  "timeComplexity": "O(?) with brief explanation",
  "spaceComplexity": "O(?) with brief explanation",
  "optimalApproach": "2-3 sentences describing the optimal algorithm (without full code). If student's approach IS optimal, say so and explain why.",
  "improvements": ["specific improvement 1", "specific improvement 2"],
  "alternativeApproaches": ["brief description of alternative approach 1"]
}

RULES:
- Be specific about the student's actual code, not generic advice
- If the solution is already optimal, say so clearly and keep improvements to style/readability only
- Time/space complexity should analyze the student's specific implementation
- Alternative approaches should be genuinely different algorithms, not minor variations
- Keep each field concise but informative`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 800,
      temperature: 0.3,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("AI failed to generate solution analysis.");
    }

    const explanation = JSON.parse(content);

    // Ensure all required fields exist
    return NextResponse.json({
      analysis: explanation.analysis || "Unable to analyze.",
      timeComplexity: explanation.timeComplexity || "Unknown",
      spaceComplexity: explanation.spaceComplexity || "Unknown",
      optimalApproach: explanation.optimalApproach || "No analysis available.",
      improvements: Array.isArray(explanation.improvements) ? explanation.improvements : [],
      alternativeApproaches: Array.isArray(explanation.alternativeApproaches) ? explanation.alternativeApproaches : [],
    });
  } catch (error) {
    console.error("Solution API error:", error);
    return NextResponse.json({ error: "Failed to generate solution analysis" }, { status: 500 });
  }
}
