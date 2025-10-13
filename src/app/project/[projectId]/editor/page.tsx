"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Panel as ResizablePanel, PanelGroup as ResizablePanelGroup, PanelResizeHandle as ResizableHandle } from "react-resizable-panels";
import { Editor } from "@monaco-editor/react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; 
import { useAuth } from "@/context/AuthContext";
import { Question, Submission, ProjectQuestion, TestCase } from "@/types";
import { Wand2, Loader2, Code, Play, Send, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronLeft, ChevronRight, Menu, Sparkles } from "lucide-react";
import { firestore } from "@/lib/firebase"; 
import { addDoc, collection, serverTimestamp, query, getDocs, orderBy, doc, getDoc, Timestamp } from "firebase/firestore";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


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
  const projectId = params.projectId as string;
  
  // State Management
  const [prompt, setPrompt] = useState("");
  const [question, setQuestion] = useState<Question | null>(null);
  const [code, setCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  // NEW: State for handling execution errors
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [projectQuestions, setProjectQuestions] = useState<ProjectQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);

  const editorRef = useRef<any>(null);

  const loadQuestion = useCallback(async (questionId: string, questionsList: ProjectQuestion[]) => {
    setIsLoading(true);
    setQuestion(null);
    setExecutionResult(null);
    setExecutionError(null);
    try {
      const questionRef = doc(firestore, "questions", questionId);
      const questionSnap = await getDoc(questionRef);

      if (questionSnap.exists()) {
        const fullQuestionData = { id: questionSnap.id, ...questionSnap.data() } as Question;
        // FIX: Ensure testCases is always an array to prevent crashes
        if (!fullQuestionData.testCases) {
            fullQuestionData.testCases = [];
        }
        setQuestion(fullQuestionData);
        setCode(fullQuestionData.starterCode);
        const qIndex = questionsList.findIndex(q => q.id === questionId);
        setCurrentQuestionIndex(qIndex);
      } else {
        throw new Error(`Question with ID ${questionId} not found.`);
      }
    } catch (error) {
      console.error("Error loading question:", error);
      setExecutionError("Failed to load the question. It might have been deleted.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    const fetchProjectQuestions = async () => {
      const q = query(collection(firestore, "projects", projectId, "projectQuestions"), orderBy("generatedAt", "asc"));
      const querySnapshot = await getDocs(q);
      const questions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ProjectQuestion[];
      setProjectQuestions(questions);

      if (questions.length > 0) {
        loadQuestion(questions[0].id, questions);
      } else {
        setIsLoading(false);
      }
    };
    fetchProjectQuestions();
  }, [projectId, loadQuestion]);

  const handleEditorDidMount = (editor: any) => { editorRef.current = editor; };
  const formatCode = () => { if (editorRef.current) editorRef.current.getAction('editor.action.formatDocument').run(); };

  const handleNextQuestion = () => { /* ... unchanged ... */ };
  const handlePreviousQuestion = () => { /* ... unchanged ... */ };
  
  const submitPrompt = async (promptToSubmit: string) => {
    if (!promptToSubmit.trim() || !user) return;
    setIsLoading(true);
    setQuestion(null);
    setExecutionResult(null);
    setExecutionError(null);
    try {
      const response = await fetch('/api/question/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptToSubmit, projectId, userId: user.uid }),
      });
      if (!response.ok) throw new Error('Failed to fetch question from AI');
      const data = await response.json();
      const newQuestion = data.question as Question;
      setQuestion(newQuestion);
      setCode(newQuestion.starterCode);
      setPrompt("");

      const newProjectQuestion: ProjectQuestion = { id: newQuestion.id!, title: newQuestion.title, difficulty: newQuestion.difficulty, tags: newQuestion.tags, generatedAt: Timestamp.now() };
      const updatedQuestions = [...projectQuestions, newProjectQuestion];
      setProjectQuestions(updatedQuestions);
      setCurrentQuestionIndex(updatedQuestions.length - 1);
    } catch (error) {
      console.error(error);
      setExecutionError("Sorry, I couldn't generate a question. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitPrompt(prompt);
  };
  
  // NEW: "Generate Next" shortcut handler
  const handleGenerateNext = () => {
    let nextPrompt = "Give me a new easy question on arrays"; // Default fallback
    if (question && question.tags.length > 0) {
        nextPrompt = `Give me another question related to ${question.tags.join(', ')} with a similar difficulty.`;
    }
    submitPrompt(nextPrompt);
  };

  // FIX: Robust Run and Submit handlers with proper error feedback
  const handleRunCode = async (isSubmission: boolean = false) => {
    if (!code || !question?.id || !question.testCases || question.testCases.length === 0) {
        setExecutionError("Cannot run code. The question is missing test cases.");
        return;
    }
    setIsExecuting(true);
    setExecutionResult(null);
    setExecutionError(null);

    const testCasesToRun = isSubmission ? question.testCases : [question.testCases.find(tc => tc.isSample) || question.testCases[0]];
    let allTestsPassed = true;
    let finalResult: ExecutionResult | null = null;

    for (const testCase of testCasesToRun) {
        try {
            const response = await fetch('/api/code/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceCode: code, languageId: 62, stdin: testCase.input }),
            });
            const result: ExecutionResult = await response.json();
            finalResult = result; // Show the result of the last run test case

            if (result.status.id !== 3 || result.stdout?.trim() !== testCase.expectedOutput.trim()) {
                allTestsPassed = false;
                if (isSubmission) break; // Stop on first failure for submissions
            }
        } catch (error) {
            console.error("Failed to execute code:", error);
            setExecutionError("An unexpected error occurred while running your code.");
            allTestsPassed = false;
            break;
        }
    }
    
    setExecutionResult(finalResult);

    if (isSubmission && user) {
        await addDoc(collection(firestore, "submissions"), {
            userId: user.uid,
            projectId,
            questionId: question.id,
            code,
            status: allTestsPassed ? 'success' : 'fail',
            submittedAt: serverTimestamp(),
        });
    }
    
    setIsExecuting(false);
  };


   return (
    <main className="h-full w-full overflow-hidden bg-background text-foreground">
      <ResizablePanelGroup direction="horizontal">
        {/* Left Panel */}
        <ResizablePanel defaultSize={40} minSize={30}>
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 flex items-center gap-2 p-2 border-b">
              <QuestionListSidebar questions={projectQuestions} onQuestionSelect={(id) => loadQuestion(id, projectQuestions)} />
              <h2 className="text-lg font-semibold truncate">Problem Description</h2>
            </div>
            <div className="flex-grow p-4 overflow-y-auto">
              {isLoading && <div className="flex flex-col items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="mt-4 text-muted-foreground">Loading...</p></div>}
              {!isLoading && question && <QuestionDisplay question={question} />}
              {!isLoading && !question && <WelcomeMessage />}
            </div>
            <div className="flex-shrink-0 border-t p-4 space-y-4 bg-background">
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
                    {/* NEW: Tooltip provider for shortcut button */}
                    <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" type="button" onClick={handleGenerateNext} disabled={isLoading}><Sparkles className="h-4 w-4" /></Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Generate Next Question</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <Button type="submit" disabled={isLoading}><Wand2 className="h-4 w-4" /></Button>
                </form>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />
        
        {/* Right Panel */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={70} minSize={30}>
                <Editor
                  height="100%" language="java" theme="vs-dark" value={code}
                  onMount={handleEditorDidMount} onChange={(value) => setCode(value || "")}
                  options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on' }} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={30} minSize={15}>
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-2 border-b flex-shrink-0">
                        <span className="font-semibold text-lg">Console</span>
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" onClick={formatCode} className="flex items-center gap-2"><Code className="h-4 w-4"/> Format</Button>
                            <Button variant="outline" onClick={() => handleRunCode(false)} disabled={isExecuting || !question} className="flex items-center gap-2">
                                {isExecuting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Play className="h-4 w-4"/>} Run
                            </Button>
                            <Button onClick={() => handleRunCode(true)} disabled={isExecuting || !question} className="bg-green-600 hover:bg-green-700 flex items-center gap-2">
                                {isExecuting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>} Submit
                            </Button>
                        </div>
                    </div>
                    <div className="p-4 flex-grow overflow-y-auto bg-muted/20">
                        {isExecuting && <div className="flex items-center text-muted-foreground"><Loader2 className="h-4 w-4 mr-2 animate-spin"/> Executing...</div>}
                        {/* NEW: Display errors in the output panel */}
                        {executionError && <div className="text-red-400"><h3 className="font-bold mb-2 flex items-center gap-2"><AlertTriangle/> Error</h3><p className="text-xs whitespace-pre-wrap">{executionError}</p></div>}
                        {executionResult && !executionError && <OutputDisplay result={executionResult} expectedOutput={question?.testCases[0].expectedOutput} />}
                    </div>
                </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}

// --- HELPER COMPONENTS ---

const QuestionListSidebar = ({ questions, onQuestionSelect }: { questions: ProjectQuestion[], onQuestionSelect: (id: string) => void }) => {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon"><Menu className="h-4 w-4" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full sm:w-[400px]">
                <SheetHeader>
                    <SheetTitle>Project Questions</SheetTitle>
                </SheetHeader>
                <div className="py-4">
                    {/* FIX: Use Accordion from shadcn which can be empty */}
                    <Accordion type="single" collapsible className="w-full">
                        {questions.map((q) => (
                            <AccordionItem value={q.id} key={q.id} className="border-none">
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start text-left h-auto py-2 px-2"
                                    onClick={() => onQuestionSelect(q.id)}
                                >
                                    <div className="flex flex-col items-start gap-1">
                                        <span className="font-normal">{q.title}</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
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

const QuestionDisplay = ({ question }: { question: Question }) => (
    <article className="prose prose-invert max-w-none">
      <h1>{question.title}</h1>
      <div className="flex flex-wrap gap-2 my-4">
          <span className={`px-2 py-1 text-xs rounded-full ${
            question.difficulty === 'Easy' ? 'bg-green-800 text-green-200' :
            question.difficulty === 'Medium' ? 'bg-yellow-800 text-yellow-200' :
            'bg-red-800 text-red-200'
          }`}>{question.difficulty}</span>
          {question.tags.map(tag => (
              <span key={tag} className="px-2 py-1 text-xs bg-muted rounded-full">{tag}</span>
          ))}
      </div>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{question.problemStatement}</ReactMarkdown>
      
      <h2 className="mt-6">Examples</h2>
      {question.examples.map((ex, i) => (
          <div key={i} className="bg-muted/50 p-4 rounded-md mb-4">
              <p className="!my-1"><strong>Input:</strong> <code>{ex.input}</code></p>
              <p className="!my-1"><strong>Output:</strong> <code>{ex.output}</code></p>
              {ex.explanation && <p className="!my-1"><strong>Explanation:</strong> {ex.explanation}</p>}
          </div>
      ))}
      
      <h2 className="mt-6">Constraints</h2>
      <ul className="!my-2">
        {question.constraints.map((c, i) => <li key={i}>{c}</li>)}
      </ul>
    </article>
);

const WelcomeMessage = () => (
    <div className="flex flex-col items-center justify-center h-full text-center">
        <Wand2 size={48} className="text-primary mb-4" />
        <h2 className="text-2xl font-bold">Welcome to your AlgoBook</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
            Generate a new question using the prompt box below, or select an existing one from the menu.
        </p>
    </div>
);

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