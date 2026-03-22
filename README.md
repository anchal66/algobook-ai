# AlgoBook AI

An AI-powered coding practice platform for technical interview preparation. AlgoBook generates LeetCode-style coding challenges on demand using OpenAI GPT-4, provides a full in-browser Java code editor, executes code against test cases via Judge0, and tracks submission history — all within a project-based workflow backed by Firebase.

---

## Table of Contents

- [What Problem It Solves](#what-problem-it-solves)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Authentication Flow](#authentication-flow)
- [Project Lifecycle](#project-lifecycle)
- [AI Question Generation — The Core Logic](#ai-question-generation--the-core-logic)
  - [The Two-Strategy Approach](#the-two-strategy-approach)
  - [The Full System Prompt](#the-full-system-prompt)
  - [User Prompt Construction](#user-prompt-construction)
  - [AI Response Structure](#ai-response-structure)
- [Code Execution Pipeline](#code-execution-pipeline)
  - [How User Code and Driver Code Are Merged](#how-user-code-and-driver-code-are-merged)
  - [Run vs Submit](#run-vs-submit)
- [Editor Page — The Main Interface](#editor-page--the-main-interface)
- [Firestore Database Schema](#firestore-database-schema)
- [API Routes](#api-routes)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)

---

## What Problem It Solves

Practicing for coding interviews typically means browsing through static question banks on platforms like LeetCode. AlgoBook takes a different approach — it lets users **describe what they want to practice** in natural language (e.g., "give me a medium difficulty graph traversal problem") and uses AI to generate a complete, runnable coding challenge with test cases, starter code, and a driver program. Users can then solve the problem in an embedded code editor, run it against sample inputs, submit against all test cases, and track their progress over time — all organized into personal projects.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS v4, shadcn/ui (New York style) |
| Code Editor | Monaco Editor (`@monaco-editor/react`) |
| AI | OpenAI GPT-4 Turbo (`openai` SDK) |
| Code Execution | Judge0 via RapidAPI |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Firebase Firestore |
| Markdown | `react-markdown` with `remark-gfm` |
| Layout | `react-resizable-panels` for split-pane editor |
| Analytics | Google Analytics 4 |
| Theming | `next-themes` (dark mode default) |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── code/run/route.ts          # Code execution endpoint (Judge0)
│   │   └── question/generate/route.ts  # AI question generation endpoint (OpenAI)
│   ├── dashboard/page.tsx              # Project listing dashboard
│   ├── login/page.tsx                  # Google sign-in page
│   ├── page.tsx                        # Root — redirects to /dashboard or /login
│   ├── project/[projectId]/
│   │   ├── _components/ProjectHeader.tsx  # Header with Editor/History nav
│   │   ├── editor/page.tsx               # Main coding workspace
│   │   ├── history/page.tsx              # Submission history per project
│   │   ├── layout.tsx                    # Project layout wrapper
│   │   └── page.tsx                      # Redirects to /editor
│   ├── projects/new/page.tsx           # Create new project form
│   ├── layout.tsx                      # Root layout (providers, metadata, GA)
│   └── globals.css                     # Tailwind v4 theme tokens
├── components/
│   ├── GoogleAnalytics.tsx             # GA4 pageview tracking
│   ├── theme-provider.tsx              # next-themes wrapper
│   └── ui/                            # shadcn/ui primitives
├── context/
│   └── AuthContext.tsx                 # Firebase auth context + useAuth hook
├── lib/
│   ├── firebase.ts                    # Firebase app, auth, Firestore init
│   └── utils.ts                       # cn() utility for class merging
└── types/
    └── index.ts                       # Shared TypeScript interfaces
```

---

## Architecture Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Browser    │────▶│  Next.js App     │────▶│  Firebase Auth   │
│  (React 19)  │     │  (App Router)    │     │  (Google OAuth)  │
└──────┬───────┘     └────────┬─────────┘     └─────────────────┘
       │                      │
       │  User types prompt   │
       ▼                      ▼
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Monaco Editor│     │ /api/question/   │────▶│  OpenAI GPT-4    │
│ (Java code)  │     │   generate       │     │  (JSON mode)     │
└──────┬───────┘     └────────┬─────────┘     └─────────────────┘
       │                      │
       │  Run / Submit        │  Cache question
       ▼                      ▼
┌──────────────┐     ┌──────────────────┐
│ /api/code/   │────▶│  Judge0 API      │
│   run        │     │  (RapidAPI)      │
└──────────────┘     └──────────────────┘
                              │
                     ┌────────▼─────────┐
                     │  Firestore       │
                     │  (projects,      │
                     │   questions,     │
                     │   submissions)   │
                     └──────────────────┘
```

---

## Authentication Flow

1. **Root page** (`/`) — checks Firebase auth state. Redirects to `/dashboard` if signed in, `/login` if not.
2. **Login page** (`/login`) — renders a "Sign in with Google" button. Calls `signInWithPopup(auth, googleProvider)` from Firebase Auth. On success, redirects to `/`.
3. **AuthContext** — wraps the entire app. Uses `useAuthState(auth)` from `react-firebase-hooks` to expose `user` and `loading` state globally via `useAuth()` hook. Automatically redirects unauthenticated users to `/login`.
4. **All protected pages** consume `useAuth()` and guard against null `user`.

---

## Project Lifecycle

### 1. Creating a Project (`/projects/new`)

Users fill out a form with:
- **Title** — e.g., "Mastering Dynamic Programming"
- **Description** — helps AI tailor questions
- **Purpose** (optional) — e.g., "Prepare for FAANG Interviews"
- **Duration** — slider from 7–90 days

On submit, a document is created in the `projects` Firestore collection with `userId`, `title`, `description`, `duration`, `purpose`, and `createdAt`. The user is then redirected to the project's editor page.

### 2. Dashboard (`/dashboard`)

Queries Firestore for all projects belonging to the current user, ordered by creation date (newest first). Supports search/filter by title. Each project card links to `/project/[id]/editor`.

### 3. Editor (`/project/[projectId]/editor`)

The main workspace. Detailed breakdown below.

### 4. History (`/project/[projectId]/history`)

Fetches all `projectQuestions` for the project, then for each question fetches all submissions from the `submissions` collection. Displays them in an accordion grouped by question, showing pass/fail status and relative timestamps.

---

## AI Question Generation — The Core Logic

This is the heart of AlgoBook. The endpoint lives at `POST /api/question/generate`.

### The Two-Strategy Approach

To minimize API costs, the system uses a **database-first strategy with AI fallback**:

**Strategy 1 — Database Lookup (Cost Saving)**
1. The user's prompt is split into keywords (words longer than 2 characters, lowercased).
2. A Firestore query searches the `questions` collection for any question whose `tags` array contains any of these keywords (`array-contains-any`).
3. If a match is found, that existing question is returned immediately — no AI call is made.

**Strategy 2 — AI Generation (Fallback)**
1. If no matching question exists in the database, the system calls OpenAI.
2. The generated question is saved to Firestore's `questions` collection for future reuse.
3. The question is also linked to the current project via a `projectQuestions` subcollection.

### The Full System Prompt

This is the exact system prompt sent to GPT-4 Turbo (with the user's request injected):

```
You are an expert programming challenge creator. Your task is to generate a high-quality
coding problem for a user practicing for software engineering interviews.
The user's request is: "${prompt}".
Based on the user's request, generate a complete coding challenge.
You MUST respond with a single, minified JSON object and nothing else. Do not include any
explanations or introductory text outside of the JSON.
The JSON object must have the following structure:
{
  "title": "A concise, descriptive title (e.g., 'Two Sum')",
  "problemStatement": "A detailed problem description in Markdown format.",
  "examples": [
    {
      "input": "A string representing the input",
      "output": "A string representing the output",
      "explanation": "An optional, brief explanation."
    }
  ],
  "constraints": ["An array of strings listing the constraints"],
  "starterCode": "A complete Java starter code block with a 'Solution' class and a public method.",
  "testCases": [
    {
      "input": "Machine-readable standard input.",
      "expectedOutput": "The exact expected standard output.",
      "isSample": true
    }
  ],
  "driverCode": "A complete Java 'Main' class that reads from System.in, instantiates Solution,
                  calls its method, and prints the result to System.out.",
  "tags": ["Array of relevant topic tags"],
  "difficulty": "Easy | Medium | Hard"
}
```

The prompt also includes a concrete **Two Sum example** showing exactly how `starterCode`, `testCases`, and `driverCode` should relate to each other, so the AI produces consistent, runnable output.

**Key design decisions in the prompt:**
- **JSON mode** (`response_format: { type: "json_object" }`) ensures the AI returns parseable JSON.
- **Model**: `gpt-4-turbo-preview` for best quality/cost balance.
- **Driver code pattern**: The AI generates a separate `Main` class that wraps the user's `Solution` class. This allows the user to only write the solution method while the system handles I/O parsing.
- **Test case format**: Uses stdin/stdout format (`"input": "2\n2 7\n9"`) so code execution is straightforward through Judge0.

### User Prompt Construction

There are two ways users trigger question generation:

1. **Direct prompt** — User types into the prompt input box (e.g., "give me a hard binary tree problem") and submits. The raw text is sent as the `prompt` field.

2. **"Generate Next" shortcut** (sparkle button) — Automatically constructs a prompt based on the current question:
   - If a question is loaded: `"Give me another question related to {tags} with a similar difficulty."`
   - Fallback: `"Give me a new easy question on arrays"`

### AI Response Structure

The AI returns a JSON object that maps directly to the `Question` TypeScript interface:

```typescript
interface Question {
  id?: string;
  title: string;
  problemStatement: string;      // Markdown content
  examples: Example[];            // Input/output/explanation triples
  constraints: string[];          // e.g., "2 <= nums.length <= 10^4"
  starterCode: string;            // Java Solution class skeleton
  testCases: TestCase[];          // stdin/expectedOutput pairs
  driverCode: string;             // Java Main class for execution
  tags: string[];                 // e.g., ["Array", "Hash Table"]
  difficulty: "Easy" | "Medium" | "Hard";
}
```

After generation, the question is:
1. Saved to the `questions` collection in Firestore
2. Linked to the project via `projects/{projectId}/projectQuestions/{questionId}`
3. Returned to the client and rendered in the editor

---

## Code Execution Pipeline

Code execution is handled by `POST /api/code/run` using the **Judge0** online judge via RapidAPI.

### How User Code and Driver Code Are Merged

Since Java requires a single file with one public class, the API performs an intelligent merge:

1. **Extract imports** from both user code and driver code using regex: `/import\s+[\w\.\*]+;?/g`
2. **Remove imports** from both code blocks
3. **Deduplicate** all imports using a `Set`
4. **Reassemble** into a single valid Java source file:

```java
// Deduplicated imports
import java.util.*;
import java.util.Scanner;

// User's Solution Code
class Solution {
    public int[] twoSum(int[] nums, int target) {
        // user's implementation
    }
}

// Driver Code
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // reads stdin, calls Solution, prints result
    }
}
```

5. The merged source is sent to Judge0 with `language_id: 62` (Java) and the test case's `stdin`.
6. Judge0 compiles and runs the code, returning stdout, stderr, compile output, execution time, and memory usage.

### Run vs Submit

The editor supports two execution modes:

**Run (single test)**
- If the "Custom Input" tab is active, uses the user-typed custom input.
- Otherwise, uses the first sample test case.
- Compares output against expected output and shows "Correct Answer" or "Wrong Answer".
- For custom input, just shows the output without comparison.

**Submit (all tests)**
- Runs the code against **every test case** in the question sequentially.
- If any test case fails (wrong output, runtime error, or non-Accepted status), stops and marks as `fail`.
- If all pass, marks as `success`.
- Saves a `Submission` record to Firestore with `userId`, `projectId`, `questionId`, `code`, `status`, and `submittedAt`.
- Refreshes the submission history in the console.

---

## Editor Page — The Main Interface

The editor page (`/project/[projectId]/editor`) is the core of the application. It uses a **three-panel resizable layout**:

```
┌──────────────────────┬──────────────────────────────┐
│                      │                              │
│  Problem Description │     Monaco Code Editor       │
│  (40% width)         │     (Java, dark theme)       │
│                      │     (65% height)             │
│  - Title + Tags      │                              │
│  - Markdown body     ├──────────────────────────────┤
│  - Examples          │     Console Panel             │
│  - Constraints       │     (35% height)             │
│                      │                              │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─  │  Tabs:                       │
│  Navigation:         │  - Test Result (stdout/diff)  │
│  [← Prev] 2/5 [→]   │  - Custom Input (textarea)   │
│  [Prompt input] [✨] │  - Submissions (history)     │
│                      │  [Format] [Run] [Submit]     │
└──────────────────────┴──────────────────────────────┘
```

**Left panel:**
- Displays the current question's problem statement (rendered from Markdown), examples, constraints, and tags.
- Question navigation (Previous/Next) through project questions.
- Prompt input for generating new questions.
- "Generate Next" sparkle button for quick continuation.
- Sidebar sheet listing all project questions (accessible via hamburger menu).

**Right panel — top (Code Editor):**
- Monaco Editor configured for Java with dark theme, word wrap, and no minimap.
- Code state is initialized with the question's `starterCode` whenever a new question is loaded.

**Right panel — bottom (Console):**
- **Test Result tab** — Shows execution output, expected vs actual comparison, time/memory stats. Handles compilation errors, runtime errors, and wrong answers with distinct UI.
- **Custom Input tab** — Textarea for entering custom stdin input to test against.
- **Submissions tab** — Shows submission history for the current question with pass/fail status and relative timestamps.
- Action buttons: Format (Monaco's built-in formatter), Run (single test), Submit (all tests).

**State management flow:**
1. On page load, fetches all `projectQuestions` for the project from Firestore.
2. Loads the first question's full data from the `questions` collection.
3. Sets the editor content to `starterCode`.
4. When user generates a new question, the question is appended to the list and becomes active.
5. When navigating between questions, full question data is fetched and editor/console state is reset.

---

## Firestore Database Schema

### `projects` (collection)
| Field | Type | Description |
|-------|------|-------------|
| userId | string | Firebase Auth UID |
| title | string | Project name |
| description | string | What the user wants to practice |
| duration | number | Practice period in days (7–90) |
| purpose | string | Optional goal (e.g., "FAANG prep") |
| createdAt | Timestamp | Server timestamp |

### `projects/{projectId}/projectQuestions` (subcollection)
| Field | Type | Description |
|-------|------|-------------|
| questionId | string | Reference to questions collection |
| title | string | Question title (denormalized) |
| difficulty | string | Easy / Medium / Hard |
| tags | string[] | Topic tags |
| generatedAt | Timestamp | When it was added to this project |

### `questions` (collection)
| Field | Type | Description |
|-------|------|-------------|
| title | string | Problem title |
| problemStatement | string | Markdown problem description |
| examples | array | Input/output/explanation objects |
| constraints | string[] | Problem constraints |
| starterCode | string | Java Solution class template |
| testCases | array | stdin/expectedOutput/isSample objects |
| driverCode | string | Java Main class for I/O |
| tags | string[] | Topic tags for search/reuse |
| difficulty | string | Easy / Medium / Hard |
| createdAt | Timestamp | Server timestamp |

### `submissions` (collection)
| Field | Type | Description |
|-------|------|-------------|
| userId | string | Firebase Auth UID |
| projectId | string | Reference to project |
| questionId | string | Reference to question |
| code | string | The user's submitted source code |
| status | string | "success" or "fail" |
| submittedAt | Timestamp | Server timestamp |

---

## API Routes

### `POST /api/question/generate`

Generates or retrieves a coding question.

**Request body:**
```json
{
  "prompt": "give me a medium graph traversal problem",
  "projectId": "abc123",
  "userId": "firebase-uid"
}
```

**Response:**
```json
{
  "question": {
    "id": "firestore-doc-id",
    "title": "...",
    "problemStatement": "...",
    "examples": [...],
    "constraints": [...],
    "starterCode": "...",
    "testCases": [...],
    "driverCode": "...",
    "tags": [...],
    "difficulty": "Medium"
  }
}
```

### `POST /api/code/run`

Executes Java code via Judge0.

**Request body:**
```json
{
  "userCode": "class Solution { ... }",
  "driverCode": "public class Main { ... }",
  "stdin": "2\n2 7\n9"
}
```

**Response (from Judge0):**
```json
{
  "status": { "id": 3, "description": "Accepted" },
  "stdout": "0 1",
  "stderr": null,
  "compile_output": null,
  "time": "0.05",
  "memory": 12345
}
```

---

## Environment Variables

Create a `.env.local` file with the following:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# OpenAI
OPENAI_API_KEY=

# Judge0 (RapidAPI)
RAPIDAPI_KEY=
NEXT_PUBLIC_RAPIDAPI_HOST=
```

---

## Getting Started

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd algobook-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy the template above into `.env.local`
   - Fill in your Firebase project credentials
   - Add your OpenAI API key
   - Add your RapidAPI key and Judge0 host

4. **Set up Firebase**
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Google Authentication
   - Create a Firestore database
   - Create composite indexes for the queries used (Firestore will prompt you with links when queries fail)

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open the app**
   Visit [http://localhost:3000](http://localhost:3000)
