"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
// Make sure to import Panel from "react-resizable-panels"
import { Panel as ResizablePanel, PanelGroup as ResizablePanelGroup, PanelResizeHandle as ResizableHandle } from "react-resizable-panels";
import { Editor } from "@monaco-editor/react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; 
import { useAuth } from "@/context/AuthContext";
import { Question, Submission } from "@/types";
import { Wand2, Loader2, Code, Play, Send, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { firestore } from "@/lib/firebase"; 
import { addDoc, collection, serverTimestamp, query, getDocs, orderBy, QueryDocumentSnapshot } from "firebase/firestore";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion } from "@radix-ui/react-accordion";
import { AccordionItem } from "@/components/ui/accordion";
import { ProjectQuestion } from "../history/page";
import { useRouter } from "next/navigation";

interface ExecutionResult {
    status: { id: number, description: string };
    stdout: string | null;
    stderr: string | null;
    compile_output: string | null;
    time: string;
    memory: number;
}


// MAIN COMPONENT
export default function ProjectPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter(); // This is now correctly imported from next/navigation
  const projectId = params.projectId as string;
  
  // State Management
  const [prompt, setPrompt] = useState("");
  const [question, setQuestion] = useState<Question | null>(null);
  const [code, setCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [projectQuestions, setProjectQuestions] = useState<ProjectQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);

  const editorRef = useRef<any>(null);

  // Fetch all questions for this project on component mount
  useEffect(() => {
    const fetchProjectQuestions = async () => {
      if (!projectId) return;
      const q = query(collection(firestore, "projects", projectId, "projectQuestions"), orderBy("generatedAt", "asc"));
      const querySnapshot = await getDocs(q);
      const questions = querySnapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() })) as ProjectQuestion[];
      setProjectQuestions(questions);
    };
    fetchProjectQuestions();
  }, [projectId]);

  // Editor and Code Formatting
  const handleEditorDidMount = (editor: any) => { editorRef.current = editor; };
  const formatCode = () => { if (editorRef.current) editorRef.current.getAction('editor.action.formatDocument').run(); };

  // Function to load a specific question's full details
  const loadQuestion = async (questionId: string) => {
    setIsLoading(true);
    setQuestion(null);
    try {
      // This is a simplified fetch. In a real app, you'd fetch from Firestore `doc(firestore, "questions", questionId)`
      // For now, we regenerate to ensure we have the full object.
      // A better approach would be to create a new API endpoint like `/api/question/[questionId]`
      const response = await fetch('/api/question/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: `regenerate question: ${questionId}`, projectId, userId: user?.uid }),
      });
      if (!response.ok) throw new Error('Failed to fetch question');
      const data = await response.json();
      setQuestion(data.question);
      setCode(data.question.starterCode);
      const qIndex = projectQuestions.findIndex(q => q.id === questionId);
      setCurrentQuestionIndex(qIndex);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate between questions
  const handleNextQuestion = () => {
    if (currentQuestionIndex < projectQuestions.length - 1) {
      const nextQuestionId = projectQuestions[currentQuestionIndex + 1].id;
      loadQuestion(nextQuestionId);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      const prevQuestionId = projectQuestions[currentQuestionIndex - 1].id;
      loadQuestion(prevQuestionId);
    }
  };

  // API Interaction
  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !user) return;
    setIsLoading(true);
    setQuestion(null);
    setExecutionResult(null);
    try {
      const response = await fetch('/api/question/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, projectId, userId: user.uid }),
      });
      if (!response.ok) throw new Error('Failed to fetch question');
      const data = await response.json();
      const newQuestion = data.question;

      setQuestion(newQuestion);
      setCode(newQuestion.starterCode);

      // Refresh the project question list
      const updatedQuestions = [...projectQuestions, { id: newQuestion.id, title: newQuestion.title, difficulty: newQuestion.difficulty }];
      setProjectQuestions(updatedQuestions);
      setCurrentQuestionIndex(updatedQuestions.length - 1);

    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };


  const handleRunCode = async () => {
    if (!code || !question?.testCases) return;
    setIsExecuting(true);
    setExecutionResult(null);

    // Run against the first sample test case
    const sampleTestCase = question.testCases.find(tc => tc.isSample) || question.testCases[0];

    try {
        const response = await fetch('/api/code/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sourceCode: code,
                languageId: 62, // Java
                stdin: sampleTestCase.input,
            }),
        });
        const result: ExecutionResult = await response.json();
        setExecutionResult(result);

    } catch (error) {
        console.error("Failed to run code:", error);
    } finally {
        setIsExecuting(false);
    }
  };

  const handleSubmitCode = async () => {
     if (!code || !question?.testCases || !user || !question.id) return;
    setIsExecuting(true);
    setExecutionResult(null);

    let finalStatus: Submission['status'] = 'success';
    // Here we would normally run all test cases, for this example we'll just run one
    // In a real scenario, you'd loop through question.testCases and call the API for each
    const sampleTestCase = question.testCases.find(tc => tc.isSample) || question.testCases[0];
     try {
        const response = await fetch('/api/code/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sourceCode: code,
                languageId: 62, // Java
                stdin: sampleTestCase.input,
            }),
        });
        const result: ExecutionResult = await response.json();
        
        // Check if the output matches the expected output
        const output = result.stdout?.trim();
        if (result.status.id !== 3 || output !== sampleTestCase.expectedOutput.trim()) {
            finalStatus = 'fail';
        }
        setExecutionResult(result);

        // Save submission to Firestore
        await addDoc(collection(firestore, "submissions"), {
            userId: user.uid,
            projectId,
            questionId: question.id,
            code,
            status: finalStatus,
            submittedAt: serverTimestamp(),
        });

    } catch (error) {
        console.error("Failed to submit code:", error);
        finalStatus = 'fail';
    } finally {
        setIsExecuting(false);
    }
  };

   return (
    <main className="h-full w-full overflow-hidden bg-background text-foreground">
      <ResizablePanelGroup direction="horizontal">
        {/* Left Panel */}
        <ResizablePanel defaultSize={40} minSize={25}>
          <div className="flex flex-col h-full">
            {/* *** FIX: ADDED A HEADER FOR QUESTION LIST SIDEBAR *** */}
            <div className="flex-shrink-0 flex items-center gap-2 p-2 border-b">
              <QuestionListSidebar questions={projectQuestions} onQuestionSelect={loadQuestion} />
              <h2 className="text-lg font-semibold truncate">Problem Description</h2>
            </div>
            <div className="flex-grow p-4 overflow-y-auto">
              {isLoading && <div className="flex flex-col items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="mt-4 text-muted-foreground">Loading...</p></div>}
              {!isLoading && question && <QuestionDisplay question={question} />}
              {!isLoading && !question && <WelcomeMessage />}
            </div>
            {/* *** NEW: NAVIGATION AND PROMPT AREA *** */}
            <div className="flex-shrink-0 border-t p-4 space-y-4">
                <div className="flex justify-between items-center">
                    <Button variant="outline" onClick={handlePreviousQuestion} disabled={currentQuestionIndex <= 0}>
                        <ChevronLeft className="h-4 w-4 mr-2" /> Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        {projectQuestions.length > 0 ? `${currentQuestionIndex + 1} / ${projectQuestions.length}` : 'No questions yet'}
                    </span>
                    <Button variant="outline" onClick={handleNextQuestion} disabled={currentQuestionIndex >= projectQuestions.length - 1}>
                        Next <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                </div>
                <form onSubmit={handlePromptSubmit} className="flex gap-2">
                    <Input placeholder="Generate a new question..." value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isLoading} />
                    <Button type="submit" disabled={isLoading}><Wand2 className="h-4 w-4" /></Button>
                </form>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle className="relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1">
          <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border"><div className="h-2.5 w-1 rounded-full bg-muted-foreground" /></div>
        </ResizableHandle>
        {/* Right Panel */}
        <ResizablePanel defaultSize={60} minSize={30}>
          {/* --- Vertical Layout for Editor and Output --- */}
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={70} minSize={30}>
                <Editor
                  height="100%"
                  language="java"
                  theme="vs-dark"
                  value={code}
                  onMount={handleEditorDidMount}
                  onChange={(value) => setCode(value || "")}
                  options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on' }}
                />
            </ResizablePanel>
            <ResizableHandle className="relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1">
              <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border"><div className="h-2.5 w-1 rounded-full bg-muted-foreground" /></div>
            </ResizableHandle>
            <ResizablePanel defaultSize={30} minSize={15}>
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-2 border-b flex-shrink-0">
                        <span className="font-semibold text-lg">Output</span>
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" onClick={formatCode} className="flex items-center gap-2"><Code className="h-4 w-4"/> Format</Button>
                            <Button variant="outline" onClick={handleRunCode} disabled={isExecuting || !question} className="flex items-center gap-2">
                                {isExecuting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Play className="h-4 w-4"/>} Run
                            </Button>
                            <Button onClick={handleSubmitCode} disabled={isExecuting || !question} className="bg-green-600 hover:bg-green-700 flex items-center gap-2">
                                {isExecuting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>} Submit
                            </Button>
                        </div>
                    </div>
                    <div className="p-4 flex-grow overflow-y-auto bg-muted/20">
                        {isExecuting && <div className="flex items-center text-muted-foreground"><Loader2 className="h-4 w-4 mr-2 animate-spin"/> Executing...</div>}
                        {executionResult && <OutputDisplay result={executionResult} expectedOutput={question?.testCases[0].expectedOutput} />}
                    </div>
                </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}

const QuestionListSidebar = ({ questions, onQuestionSelect }: { questions: ProjectQuestion[], onQuestionSelect: (id: string) => void }) => {
    // You need to install `shadcn-vue@latest add sheet`
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon"><Menu className="h-4 w-4" /></Button>
            </SheetTrigger>
            <SheetContent side="left">
                <SheetHeader>
                    <SheetTitle>Project Questions</SheetTitle>
                </SheetHeader>
                <div className="py-4">
                    <Accordion type="single" collapsible className="w-full">
                        {questions.map((q) => (
                            <AccordionItem value={q.id} key={q.id} className="border-none">
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start text-left h-auto py-2"
                                    onClick={() => onQuestionSelect(q.id)}
                                >
                                    <div className="flex flex-col items-start">
                                        <span>{q.title}</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full mt-1 ${
                                            q.difficulty === 'Easy' ? 'bg-green-800 text-green-200' :
                                            q.difficulty === 'Medium' ? 'bg-yellow-800 text-yellow-200' :
                                            'bg-red-800 text-red-200'
                                        }`}>{q.difficulty}</span>
                                    </div>
                                </Button>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            </SheetContent>
        </Sheet>
    );
};


// ... (QuestionDisplay and WelcomeMessage components are unchanged) ...
const QuestionDisplay = ({ question }: { question: Question }) => (
    <article className="prose prose-invert max-w-none">
        {/*... same as before ... */}
    </article>
);
const WelcomeMessage = () => (
    <div className="flex flex-col items-center justify-center h-full text-center">
        {/*... same as before ... */}
    </div>
);


// --- NEW HELPER COMPONENT FOR DISPLAYING OUTPUT ---
const OutputDisplay = ({ result, expectedOutput }: { result: ExecutionResult, expectedOutput?: string }) => {
    const status = result.status.description;
    const isAccepted = result.status.id === 3; // 3 = Accepted
    const output = result.stdout?.trim();
    const isCorrect = isAccepted && output === expectedOutput?.trim();

    if (result.compile_output) {
        return <div className="text-red-400"><h3 className="font-bold mb-2 flex items-center gap-2"><XCircle/> Compilation Error</h3><pre className="bg-background p-2 rounded-md text-xs whitespace-pre-wrap">{result.compile_output}</pre></div>;
    }
    if (result.stderr) {
        return <div className="text-red-400"><h3 className="font-bold mb-2 flex items-center gap-2"><AlertTriangle/> Runtime Error</h3><pre className="bg-background p-2 rounded-md text-xs whitespace-pre-wrap">{result.stderr}</pre></div>;
    }
    if (isAccepted) {
        return (
            <div>
                <h3 className={`font-bold mb-2 flex items-center gap-2 ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                    {isCorrect ? <CheckCircle2/> : <XCircle/>} {isCorrect ? 'Correct Answer' : 'Wrong Answer'}
                </h3>
                <div className="space-y-2 text-sm">
                    <div><p className="font-semibold">Your Output:</p><pre className="bg-background p-2 rounded-md whitespace-pre-wrap">{result.stdout || '(no output)'}</pre></div>
                    <div><p className="font-semibold">Expected Output:</p><pre className="bg-background p-2 rounded-md whitespace-pre-wrap">{expectedOutput}</pre></div>
                    <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                        <span><Clock className="inline h-3 w-3 mr-1"/> Time: {result.time}s</span>
                        <span><Code className="inline h-3 w-3 mr-1"/> Memory: {result.memory} KB</span>
                    </div>
                </div>
            </div>
        );
    }
    return <div className="text-yellow-400"><h3 className="font-bold">{status}</h3><p>Something went wrong during execution.</p></div>;
};