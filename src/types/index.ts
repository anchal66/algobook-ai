import { Timestamp } from "firebase/firestore";

export interface Example {
  input: string;
  output: string;
  explanation?: string;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  isSample?: boolean;
}

export interface Question {
  id?: string;
  title: string;
  problemStatement: string;
  examples: Example[];
  constraints: string[];
  starterCode: string;
  testCases: TestCase[];
  tags: string[];
  difficulty: "Easy" | "Medium" | "Hard";
  createdAt?: Timestamp;
}

export interface Submission {
  id?: string;
  userId: string;
  projectId: string;
  questionId: string;
  code: string;
  status: "success" | "fail" | "pending";
  submittedAt: Timestamp;
}

// Add this interface here to centralize it
export interface ProjectQuestion {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  generatedAt: Timestamp;
}