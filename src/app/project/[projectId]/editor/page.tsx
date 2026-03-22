"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Panel as ResizablePanel, Group as ResizablePanelGroup, Separator as ResizableHandle } from "react-resizable-panels";
import { Editor } from "@monaco-editor/react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { Question, Submission, ProjectQuestion, TestCase } from "@/types";
import { Wand2, Loader2, Code, Play, Send, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronLeft, ChevronRight, Menu, Sparkles, BrainCircuit } from "lucide-react";
import { firestore } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp, query, getDocs, orderBy, doc, getDoc, Timestamp, where } from "firebase/firestore";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";


interface ExecutionResult {
  status: { id: number, description: string };
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  time: string;
  memory: number;
}

export default function ProjectPage() {
  const { user } = useAuth();
  const params = useParams();
  const projectId = params.projectId as string;

  const [prompt, setPrompt] = useState("");
  const [question, setQuestion] = useState<Question | null>(null);
  const [code, setCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [projectQuestions, setProjectQuestions] = useState<ProjectQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [activeConsoleTab, setActiveConsoleTab] = useState("test-result");
  const [customInput, setCustomInput] = useState("");
  const [submissionHistory, setSubmissionHistory] = useState<Submission[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [lastRunInput, setLastRunInput] = useState<string | null>(null);

  const editorRef = useRef<any>(null);

  const fetchSubmissionHistory = useCallback(async (questionId: string) => {
    if (!user || !projectId) return;
    setIsHistoryLoading(true);
    try {
      const q = query(
        collection(firestore, "submissions"),
        where("userId", "==", user.uid),
        where("projectId", "==", projectId),
        where("questionId", "==", questionId),
        orderBy("submittedAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const history = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Submission[];
      setSubmissionHistory(history);
    } catch (err) {
      console.error("Error fetching submission history:", err);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [user, projectId]);

  const loadQuestion = useCallback(async (questionId: string, questionsList: ProjectQuestion[]) => {
    setIsLoading(true);
    setQuestion(null);
    setExecutionResult(null);
    setExecutionError(null);
    setCustomInput("");
    setSubmissionHistory([]);
    try {
      const questionRef = doc(firestore, "questions", questionId);
      const questionSnap = await getDoc(questionRef);
      if (questionSnap.exists()) {
        const fullQuestionData = { id: questionSnap.id, ...questionSnap.data() } as Question;
        if (!fullQuestionData.testCases) fullQuestionData.testCases = [];
        if (!fullQuestionData.driverCode) fullQuestionData.driverCode = "";
        setQuestion(fullQuestionData);
        setCode(fullQuestionData.starterCode);
        const qIndex = questionsList.findIndex(q => q.id === questionId);
        setCurrentQuestionIndex(qIndex);
        fetchSubmissionHistory(fullQuestionData.id!);
      } else {
        throw new Error(`Question with ID ${questionId} not found.`);
      }
    } catch (error) {
      console.error("Error loading question:", error);
      setExecutionError("Failed to load the question. It might have been deleted or is missing data.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchSubmissionHistory]);

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

  const handleNextQuestion = () => {
    if (isLoading) return;
    if (projectQuestions.length === 0) return;
    if (currentQuestionIndex < 0) {
      const first = projectQuestions[0];
      if (first) loadQuestion(first.id, projectQuestions);
      return;
    }
    const nextIndex = Math.min(currentQuestionIndex + 1, projectQuestions.length - 1);
    if (nextIndex === currentQuestionIndex) return;
    const nextQ = projectQuestions[nextIndex];
    if (nextQ) loadQuestion(nextQ.id, projectQuestions);
  };

  const handlePreviousQuestion = () => {
    if (isLoading) return;
    if (projectQuestions.length === 0) return;
    if (currentQuestionIndex < 0) {
      const first = projectQuestions[0];
      if (first) loadQuestion(first.id, projectQuestions);
      return;
    }
    const prevIndex = Math.max(currentQuestionIndex - 1, 0);
    if (prevIndex === currentQuestionIndex) return;
    const prevQ = projectQuestions[prevIndex];
    if (prevQ) loadQuestion(prevQ.id, projectQuestions);
  };

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

  const handleGenerateNext = () => {
    let nextPrompt = "Give me a new easy question on arrays";
    if (question && question.tags.length > 0) {
      nextPrompt = `Give me another question related to ${question.tags.join(', ')} with a similar difficulty.`;
    }
    submitPrompt(nextPrompt);
  };

  const handleRunCode = async (isSubmission: boolean = false) => {
    if (!code || !question?.id || !question.driverCode) {
      setExecutionError("Cannot run code. The question is missing driver code.");
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);
    setExecutionError(null);
    setLastRunInput(null);
    setActiveConsoleTab("test-result");

    let testCasesToRun: TestCase[] = [];

    if (isSubmission) {
      if (question.testCases.length === 0) {
        setExecutionError("Cannot submit. The question has no test cases.");
        setIsExecuting(false);
        return;
      }
      testCasesToRun = question.testCases;
    } else {
      let inputToUse: string;
      if (activeConsoleTab === "custom-input") {
        inputToUse = customInput;
        testCasesToRun = [{ input: inputToUse, expectedOutput: "N/A (Custom Input)", isSample: true }];
      } else {
        const sampleCase = question.testCases.find(tc => tc.isSample) || question.testCases[0];
        if (!sampleCase) {
          setExecutionError("Cannot run. The question has no sample test cases.");
          setIsExecuting(false);
          return;
        }
        testCasesToRun = [sampleCase];
        inputToUse = sampleCase.input;
      }
      setLastRunInput(inputToUse);
    }

    let allTestsPassed = true;
    let finalResult: ExecutionResult | null = null;

    for (const testCase of testCasesToRun) {
      try {
        const response = await fetch('/api/code/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userCode: code,
            driverCode: question.driverCode,
            stdin: testCase.input
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "API request failed");
        }
        const result: ExecutionResult = await response.json();
        finalResult = result;
        setLastRunInput(testCase.input);
        if (result.status.id !== 3 || (testCase.expectedOutput !== "N/A (Custom Input)" && result.stdout?.trim() !== testCase.expectedOutput.trim())) {
          allTestsPassed = false;
          if (isSubmission) break;
        }
      } catch (error: any) {
        console.error("Failed to execute code:", error);
        setExecutionError(`An unexpected error occurred: ${error.message}`);
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
      fetchSubmissionHistory(question.id);
    }

    setIsExecuting(false);
  };

  const difficultyClass = (d: string) =>
    d === 'Easy' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' :
    d === 'Medium' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' :
    'bg-red-500/15 text-red-400 border-red-500/20';

  return (
    <main className="h-full w-full overflow-hidden bg-background text-foreground">
      <ResizablePanelGroup orientation="horizontal">
        {/* Left Panel — Problem */}
        <ResizablePanel defaultSize={40} minSize={25}>
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2 border-b border-border/50">
              <QuestionListSidebar questions={projectQuestions} onQuestionSelect={(id) => loadQuestion(id, projectQuestions)} difficultyClass={difficultyClass} />
              <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Problem</h2>
            </div>
            <div className="flex-grow p-5 overflow-y-auto">
              {isLoading && (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="rounded-2xl bg-primary/10 p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Generating question...</p>
                </div>
              )}
              {!isLoading && question && <QuestionDisplay question={question} difficultyClass={difficultyClass} />}
              {!isLoading && !question && <WelcomeMessage />}
            </div>
            <div className="flex-shrink-0 border-t border-border/50 p-3 space-y-3 bg-card/50">
              <div className="flex justify-between items-center">
                <Button variant="ghost" size="sm" onClick={handlePreviousQuestion} disabled={currentQuestionIndex <= 0} className="gap-1 text-xs">
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <span className="text-xs text-muted-foreground font-medium tabular-nums">
                  {projectQuestions.length > 0 ? `${currentQuestionIndex + 1} / ${projectQuestions.length}` : 'No questions yet'}
                </span>
                <Button variant="ghost" size="sm" onClick={handleNextQuestion} disabled={currentQuestionIndex >= projectQuestions.length - 1} className="gap-1 text-xs">
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <form onSubmit={handlePromptSubmit} className="flex gap-1.5">
                <Input
                  placeholder="Ask AI for a new question..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isLoading}
                  className="h-9 text-sm bg-background"
                />
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" type="button" onClick={handleGenerateNext} disabled={isLoading} className="h-9 w-9 shrink-0">
                        <Sparkles className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Generate Similar Question</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button type="submit" size="icon" disabled={isLoading} className="h-9 w-9 shrink-0 shadow-sm shadow-primary/20">
                  <Wand2 className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle className="w-[3px] bg-border/40 hover:bg-primary/40 transition-colors data-[resize-handle-active]:bg-primary" />

        {/* Right Panel — Editor + Console */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize={65} minSize={30}>
              <Editor
                height="100%"
                language="java"
                theme="vs-dark"
                value={code}
                onMount={handleEditorDidMount}
                onChange={(value) => setCode(value || "")}
                options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on', padding: { top: 12 }, scrollBeyondLastLine: false }}
              />
            </ResizablePanel>

            <ResizableHandle className="h-[3px] bg-border/40 hover:bg-primary/40 transition-colors data-[resize-handle-active]:bg-primary" />

            {/* Console */}
            <ResizablePanel defaultSize={35} minSize={20}>
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 flex-shrink-0 bg-card/30">
                  <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Console</span>
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="sm" onClick={formatCode} className="gap-1.5 text-xs h-7">
                      <Code className="h-3 w-3" /> Format
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunCode(false)}
                      disabled={isExecuting || !question}
                      className="gap-1.5 text-xs h-7"
                    >
                      {isExecuting ? <Loader2 className="h-3 w-3 animate-spin"/> : <Play className="h-3 w-3"/>} Run
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleRunCode(true)}
                      disabled={isExecuting || !question}
                      className="gap-1.5 text-xs h-7 shadow-sm shadow-primary/20"
                    >
                      {isExecuting ? <Loader2 className="h-3 w-3 animate-spin"/> : <Send className="h-3 w-3"/>} Submit
                    </Button>
                  </div>
                </div>

                <Tabs value={activeConsoleTab} onValueChange={setActiveConsoleTab} className="flex-grow flex flex-col">
                  <TabsList className="flex-shrink-0 rounded-none bg-transparent border-b border-border/50 justify-start h-8 px-1">
                    <TabsTrigger value="test-result" className="text-xs h-7 data-[state=active]:shadow-none">Test Result</TabsTrigger>
                    <TabsTrigger value="custom-input" className="text-xs h-7 data-[state=active]:shadow-none">Custom Input</TabsTrigger>
                    <TabsTrigger value="submissions" className="text-xs h-7 data-[state=active]:shadow-none">Submissions</TabsTrigger>
                  </TabsList>

                  <TabsContent value="test-result" className="flex-grow overflow-y-auto p-4">
                    {isExecuting && (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" /> Running your code...
                      </div>
                    )}
                    {executionError && (
                      <div className="text-red-400">
                        <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4" /> Error</h3>
                        <pre className="bg-red-500/5 border border-red-500/10 p-3 rounded-lg text-xs whitespace-pre-wrap">{executionError}</pre>
                      </div>
                    )}
                    {executionResult && !executionError &&
                      <OutputDisplay
                        result={executionResult}
                        inputUsed={lastRunInput}
                        expectedOutput={question?.testCases.find(tc => tc.input === lastRunInput)?.expectedOutput}
                      />}
                    {!isExecuting && !executionResult && !executionError &&
                      <p className="text-sm text-muted-foreground">Click &quot;Run&quot; to test your code against the sample test case, or &quot;Submit&quot; to check all test cases.</p>
                    }
                  </TabsContent>

                  <TabsContent value="custom-input" className="flex-grow overflow-y-auto p-4 flex flex-col">
                    <label htmlFor="custom-input" className="text-xs font-medium mb-2 text-muted-foreground">Custom stdin input:</label>
                    <Textarea
                      id="custom-input"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder={"e.g.\n2\n2 7\n9"}
                      className="flex-grow font-mono text-sm bg-background"
                    />
                  </TabsContent>

                  <TabsContent value="submissions" className="flex-grow overflow-y-auto p-4">
                    {isHistoryLoading && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading...</div>}
                    {!isHistoryLoading && submissionHistory.length === 0 && <p className="text-sm text-muted-foreground">No submissions yet for this question.</p>}
                    {!isHistoryLoading && submissionHistory.length > 0 && (
                      <div className="space-y-2">
                        {submissionHistory.map((sub) => (
                          <Card key={sub.id} className={`border ${sub.status === 'success' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                            <CardHeader className="p-3 flex flex-row items-center justify-between">
                              <CardTitle className="text-sm flex items-center gap-2 font-medium">
                                {sub.status === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                {sub.status === 'success' ? 'Accepted' : 'Wrong Answer'}
                              </CardTitle>
                              <span className="text-[11px] text-muted-foreground">
                                {formatDistanceToNow(sub.submittedAt.toDate(), { addSuffix: true })}
                              </span>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}

// --- HELPER COMPONENTS ---

const QuestionListSidebar = ({ questions, onQuestionSelect, difficultyClass }: {
  questions: ProjectQuestion[],
  onQuestionSelect: (id: string) => void,
  difficultyClass: (d: string) => string,
}) => (
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="outline" size="icon" className="h-8 w-8">
        <Menu className="h-3.5 w-3.5" />
      </Button>
    </SheetTrigger>
    <SheetContent side="left" className="w-full sm:w-[380px]">
      <SheetHeader>
        <SheetTitle className="text-lg">Questions</SheetTitle>
      </SheetHeader>
      <div className="py-3 space-y-1">
        <Accordion type="single" collapsible className="w-full">
          {questions.map((q, i) => (
            <AccordionItem value={q.id} key={q.id} className="border-none">
              <Button
                variant="ghost"
                className="w-full justify-start text-left h-auto py-2.5 px-3 rounded-lg"
                onClick={() => onQuestionSelect(q.id)}
              >
                <div className="flex items-center gap-3 w-full">
                  <span className="text-xs text-muted-foreground font-mono w-5">{i + 1}.</span>
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="text-sm font-normal truncate">{q.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border w-fit font-medium ${difficultyClass(q.difficulty)}`}>
                      {q.difficulty}
                    </span>
                  </div>
                </div>
              </Button>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </SheetContent>
  </Sheet>
);

const QuestionDisplay = ({ question, difficultyClass }: { question: Question, difficultyClass: (d: string) => string }) => (
  <article className="prose prose-invert max-w-none prose-headings:tracking-tight prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50">
    <h1 className="text-2xl">{question.title}</h1>
    <div className="flex flex-wrap gap-2 my-4 not-prose">
      <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${difficultyClass(question.difficulty)}`}>
        {question.difficulty}
      </span>
      {question.tags.map(tag => (
        <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/15 font-medium">{tag}</span>
      ))}
    </div>
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{question.problemStatement}</ReactMarkdown>

    <h2 className="text-lg mt-6">Examples</h2>
    {question.examples.map((ex, i) => (
      <div key={i} className="bg-muted/30 border border-border/30 p-4 rounded-xl mb-4 not-prose">
        <p className="text-sm mb-1"><span className="font-semibold text-muted-foreground">Input:</span> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{ex.input}</code></p>
        <p className="text-sm mb-1"><span className="font-semibold text-muted-foreground">Output:</span> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{ex.output}</code></p>
        {ex.explanation && <p className="text-sm text-muted-foreground"><span className="font-semibold">Explanation:</span> {ex.explanation}</p>}
      </div>
    ))}

    <h2 className="text-lg mt-6">Constraints</h2>
    <ul className="!my-2 text-sm">
      {question.constraints.map((c, i) => <li key={i}>{c}</li>)}
    </ul>
  </article>
);

const WelcomeMessage = () => (
  <div className="flex flex-col items-center justify-center h-full text-center px-6">
    <div className="mb-5 rounded-2xl bg-primary/10 p-5">
      <BrainCircuit className="h-10 w-10 text-primary" />
    </div>
    <h2 className="text-xl font-bold mb-2">Welcome to your AlgoBook</h2>
    <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
      Type a topic in the prompt below to generate an AI-powered coding challenge, or click the sparkle button for a quick suggestion.
    </p>
  </div>
);

const OutputDisplay = ({ result, inputUsed, expectedOutput }: { result: ExecutionResult, inputUsed: string | null, expectedOutput?: string }) => {
  const isAccepted = result.status.id === 3;
  const output = result.stdout?.trim();
  const isCorrect = isAccepted && output === expectedOutput?.trim();

  if (result.compile_output) {
    return (
      <div className="text-red-400">
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm"><XCircle className="h-4 w-4" /> Compilation Error</h3>
        <pre className="bg-red-500/5 border border-red-500/10 p-3 rounded-lg text-xs whitespace-pre-wrap">{result.compile_output}</pre>
      </div>
    );
  }
  if (result.stderr) {
    return (
      <div className="text-red-400">
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4" /> Runtime Error</h3>
        <pre className="bg-red-500/5 border border-red-500/10 p-3 rounded-lg text-xs whitespace-pre-wrap">{result.stderr}</pre>
      </div>
    );
  }
  if (isAccepted) {
    return (
      <div className="space-y-3">
        {expectedOutput && expectedOutput !== "N/A (Custom Input)" && (
          <div className={`flex items-center gap-2 text-base font-semibold ${isCorrect ? 'text-emerald-500' : 'text-red-500'}`}>
            {isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            {isCorrect ? 'Correct Answer' : 'Wrong Answer'}
          </div>
        )}
        {expectedOutput === "N/A (Custom Input)" && (
          <div className="flex items-center gap-2 text-base font-semibold text-primary">
            <CheckCircle2 className="h-5 w-5" /> Custom Input Executed
          </div>
        )}
        <div className="space-y-2 text-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Input</p>
            <pre className="bg-muted/50 border border-border/30 p-2.5 rounded-lg whitespace-pre-wrap text-xs">{inputUsed || 'N/A'}</pre>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Your Output</p>
            <pre className="bg-muted/50 border border-border/30 p-2.5 rounded-lg whitespace-pre-wrap text-xs">{result.stdout || '(no output)'}</pre>
          </div>
          {expectedOutput && expectedOutput !== "N/A (Custom Input)" && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Expected Output</p>
              <pre className="bg-muted/50 border border-border/30 p-2.5 rounded-lg whitespace-pre-wrap text-xs">{expectedOutput}</pre>
            </div>
          )}
          <div className="flex gap-4 text-[11px] text-muted-foreground pt-1">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {result.time}s</span>
            <span className="flex items-center gap-1"><Code className="h-3 w-3" /> {result.memory} KB</span>
          </div>
        </div>
      </div>
    );
  }
  return <div className="text-amber-400"><h3 className="font-semibold text-sm">{result.status.description}</h3><p className="text-xs text-muted-foreground mt-1">Execution did not complete successfully.</p></div>;
};
