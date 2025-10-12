import { Timestamp } from "firebase/firestore";

export interface Example {
  input: string;
  output: string;
  explanation?: string;
}

export interface Question {
  id?: string; // Document ID from Firestore
  title: string;
  problemStatement: string; // Markdown formatted
  examples: Example[];
  constraints: string[];
  starterCode: string;
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