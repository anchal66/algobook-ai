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
            
            // --- MODIFICATION START ---
            // I've added the "driverCode" field to your existing prompt.
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
        
        "driverCode": "A complete Java 'Main' class that acts as a driver. This code MUST read from System.in (stdin), parse the input, instantiate the 'Solution' class, call its method, and print the result to System.out (stdout). It must be a complete, runnable file.",

        "tags": ["An array of relevant topic tags, e.g., 'Array', 'Hash Table'"],
        "difficulty": "A string, either 'Easy', 'Medium', or 'Hard'."
      }
      
      --- EXAMPLE for 'Two Sum' ---
      "starterCode": "import java.util.*;\\n\\nclass Solution {\\n    public int[] twoSum(int[] nums, int target) {\\n        // Your code here\\n    }\\n}"
      "testCases": [
        {
          "input": "2\\n2 7\\n9",
          "expectedOutput": "0 1",
          "isSample": true
        }
      ],
      "driverCode": "import java.util.Scanner;\\nimport java.util.Arrays;\\n\\npublic class Main {\\n    public static void main(String[] args) {\\n        Scanner sc = new Scanner(System.in);\\n        int n = sc.nextInt();\\n        int[] nums = new int[n];\\n        for(int i = 0; i < n; i++) {\\n            nums[i] = sc.nextInt();\\n        }\\n        int target = sc.nextInt();\\n        sc.close();\\n\\n        Solution solution = new Solution();\\n        int[] result = solution.twoSum(nums, target);\\n        System.out.println(result[0] + \" \" + result[1]);\\n    }\\n}"
      ---
      Ensure the 'driverCode' correctly parses the 'input' from the 'testCases' and prints in the format of the 'expectedOutput'.
      `;
      // --- MODIFICATION END ---

            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview", // Consider gpt-4o for speed and cost
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

        // --- This logic is correct and unchanged ---
        if (questionToReturn.id) {
            const projectQuestionRef = doc(firestore, "projects", projectId, "projectQuestions", questionToReturn.id);
            await setDoc(projectQuestionRef, {
                questionId: questionToReturn.id,
                title: questionToReturn.title,
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