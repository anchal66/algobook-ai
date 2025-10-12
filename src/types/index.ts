import { Timestamp } from "firebase/firestore";

export interface Example {
  input: string;
  output: string;
  explanation?: string;
}

export interface TestCase {
  input: string;      // Machine-readable input, e.g., "5\n1 2 3 4 5"
  expectedOutput: string; // The exact expected output
  isSample?: boolean; // To distinguish examples from hidden tests
}

export interface Question {
  id?: string; // Document ID from Firestore
  title: string;
  problemStatement: string; // Markdown formatted
  examples: Example[];
  constraints: string[];
  starterCode: string;
  testCases: TestCase[];
  tags: string[]; // e.g., ["Array", "Hash Table", "Two Pointers"]
  difficulty: "Easy" | "Medium" | "Hard";
  createdAt?: Timestamp;
}

export interface Submission {
  id?: string; // Document ID
  userId: string;
  projectId: string;
  questionId: string;
  code: string;
  status: "success" | "fail" | "pending";
  submittedAt: Timestamp;
}