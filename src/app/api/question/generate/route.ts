import { NextResponse } from "next/server";
import OpenAI from "openai";
import { firestore } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, doc, setDoc } from "firebase/firestore";
import { Question } from "@/types";

// Initialize OpenAI client with the API key from your .env.local
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
    try {
        const { prompt, projectId, userId } = await request.json();

        if (!prompt || !projectId || !userId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        let questionToReturn: Question | null = null;

        // --- STRATEGY 1: Database First (Cost Saving) ---
        const promptKeywords = prompt.toLowerCase().split(' ').filter((word: string) => word.length > 2);
        if (promptKeywords.length > 0) {
            const questionsRef = collection(firestore, "questions");
            const q = query(
                questionsRef,
                where("tags", "array-contains-any", promptKeywords),
                limit(1)
            );

            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                questionToReturn = { id: doc.id, ...doc.data() } as Question;
                console.log("Found existing question in DB:", questionToReturn.title);
            }
        }


        // --- STRATEGY 2: AI Fallback ---
        if (!questionToReturn) {
            console.log("No suitable question in DB, generating with AI...");

            const systemPrompt = `You are an expert programming challenge creator. Your task is to generate a high-quality coding problem for a user practicing for software engineering interviews.
      The user's request is: "${prompt}".
      Based on the user's request, generate a complete coding challenge.
      You MUST respond with a single, minified JSON object and nothing else. Do not include any explanations or introductory text outside of the JSON.
      The JSON object must have the following structure:
      {
        "title": "A concise, descriptive title (e.g., 'Two Sum')",
        "problemStatement": "A detailed problem description in Markdown format. Use code blocks for variable names or examples.",
        "examples": [
          {
            "input": "A string representing the input, e.g., 'nums = [2, 7, 11, 15], target = 9'",
            "output": "A string representing the output, e.g., '[0, 1]'",
            "explanation": "An optional, brief explanation."
          }
        ],
        "constraints": ["An array of strings listing the constraints, e.g., '2 <= nums.length <= 10^4'"],
        "starterCode": "A complete Java starter code block. It MUST include a 'Solution' class with a public method that can be called for testing. Import necessary libraries.",
        "testCases": [
            {
            "input": "Machine-readable standard input. For an array [1, 2, 3], this could be '3\\n1 2 3'. For two numbers, it could be '10 5'.",
            "expectedOutput": "The exact expected standard output. It must match precisely.",
            "isSample": true
            }
        ],
        "tags": ["An array of relevant topic tags, e.g., 'Array', 'Hash Table'"],
        "difficulty": "A string, either 'Easy', 'Medium', or 'Hard'."
      }
      Example starter code format for Java:
      class Solution {
          public int[] twoSum(int[] nums, int target) {
              // Your code here
          }
      }`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt },
                ],
                response_format: { type: "json_object" },
            });

            const content = completion.choices[0].message.content;
            if (!content) {
                throw new Error("AI failed to generate a question.");
            }

            const newQuestionData: Omit<Question, 'id'> = JSON.parse(content);

            const questionsCollection = collection(firestore, "questions");
            const docRef = await addDoc(questionsCollection, {
                ...newQuestionData,
                createdAt: serverTimestamp(),
            });

            console.log("New question generated and saved with ID:", docRef.id);
            questionToReturn = { id: docRef.id, ...newQuestionData };
        }

        // --- NEW LOGIC: Associate question with the project ---
        if (questionToReturn.id) {
            const projectQuestionRef = doc(firestore, "projects", projectId, "projectQuestions", questionToReturn.id);
            await setDoc(projectQuestionRef, {
                questionId: questionToReturn.id,
                title: questionToReturn.title, // Store title for easy access
                difficulty: questionToReturn.difficulty,
                tags: questionToReturn.tags,
                generatedAt: serverTimestamp(),
            });
            console.log(`Associated question ${questionToReturn.id} with project ${projectId}`);
        }

        return NextResponse.json({ question: questionToReturn });

    } catch (error) {
        console.error("Error in generate question API:", error);
        return NextResponse.json({ error: "Failed to generate question" }, { status: 500 });
    }
}