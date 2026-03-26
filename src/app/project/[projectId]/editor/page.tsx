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
import { useSubscription } from "@/context/SubscriptionContext";
import { Question, Submission, ProjectQuestion, TestCase, RecommendationReason, SolutionExplanation, SessionHealth, PracticeState } from "@/types";
import {
  Wand2, Loader2, Code, Play, Send, CheckCircle2, XCircle, Clock,
  AlertTriangle, ChevronLeft, ChevronRight, Menu, Sparkles, BrainCircuit,
  Lightbulb, Info, Lock, Crown, RotateCcw, Minus, Plus, Timer, Keyboard,
  Maximize2, Minimize2, TriangleAlert, Brain, Flame, BookOpen, Dumbbell,
  RefreshCw, Target, Shield, FileText, Trophy,
  Building2,
} from "lucide-react";
import { createSession, recordAttempt, computeSessionHealth } from "@/lib/session-tracker";
import type { SessionState } from "@/lib/session-tracker";
import { firestore } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp, query, getDocs, orderBy, doc, getDoc, setDoc, Timestamp, where, increment } from "firebase/firestore";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  const { active: hasSubscription, loading: subLoading, redirectToCheckout } = useSubscription();
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
  const [submissionHistory, setSubmissionHistory] = useState<Submission[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [lastRunInput, setLastRunInput] = useState<string | null>(null);

  // Hints state
  const [hints, setHints] = useState<string[]>([]);
  const [hintLabels, setHintLabels] = useState<string[]>([]);
  const [revealedHintLevel, setRevealedHintLevel] = useState(0);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const hintsUsedRef = useRef(0);
  const runCountRef = useRef(0);

  // "Why this question?" reason
  const [recommendationReason, setRecommendationReason] = useState<RecommendationReason | null>(null);

  // Timing: track when user started working on a question
  const questionStartTimeRef = useRef<number>(Date.now());

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const runCodeRef = useRef<((isSubmission: boolean) => Promise<void>) | undefined>(undefined);
  const completionDisposableRef = useRef<any>(null);
  const [fontSize, setFontSize] = useState(14);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'testcase' | 'test-result' | 'submissions' | 'solution'>('testcase');
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);
  const [editableInputs, setEditableInputs] = useState<Record<number, string>>({});

  // Session tracking (client-side fatigue detection)
  const sessionRef = useRef<SessionState>(createSession());
  const [sessionHealth, setSessionHealth] = useState<SessionHealth>({ score: 100, problemsAttempted: 0, problemsSolved: 0, sessionMinutes: 0, trend: 'stable', suggestion: null });

  // Solution explanation (post-solve AI analysis)
  const [solutionExplanation, setSolutionExplanation] = useState<SolutionExplanation | null>(null);
  const [isSolutionLoading, setIsSolutionLoading] = useState(false);
  const [hasSolvedCurrent, setHasSolvedCurrent] = useState(false);

  // Practice state (fetched from profile)
  const [practiceState, setPracticeState] = useState<PracticeState>('learning');
  const [stateProgress, setStateProgress] = useState<string>('');

  // Template progress (for template-based projects)
  const [templateProgress, setTemplateProgress] = useState<{ total: number; used: number; company: string } | null>(null);

  // Elapsed timer for current question
  useEffect(() => {
    if (!question) { setElapsedTime(0); return; }
    questionStartTimeRef.current = Date.now();
    setElapsedTime(0);
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - questionStartTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [question]);

  // Cleanup completion provider on unmount
  useEffect(() => {
    return () => { completionDisposableRef.current?.dispose(); };
  }, []);

  // Fetch practice state from profile
  useEffect(() => {
    if (!user) return;
    const fetchPracticeState = async () => {
      try {
        const res = await fetch(`/api/profile?userId=${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          if (data.profile?.practiceState) setPracticeState(data.profile.practiceState);
        }
      } catch { /* silent */ }
    };
    fetchPracticeState();
  }, [user]);

  // Reset solution state when question changes
  useEffect(() => {
    setSolutionExplanation(null);
    setIsSolutionLoading(false);
    setHasSolvedCurrent(false);
  }, [question?.id]);

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

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
    setEditableInputs({});
    setSelectedCaseIndex(0);
    setSubmissionHistory([]);
    setHints([]);
    setHintLabels([]);
    setRevealedHintLevel(0);
    setRecommendationReason(null);
    hintsUsedRef.current = 0;
    runCountRef.current = 0;
    questionStartTimeRef.current = Date.now();
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

  // Fetch template progress for template-based projects
  useEffect(() => {
    if (!projectId) return;
    const fetchTemplateProgress = async () => {
      try {
        const projSnap = await getDoc(doc(firestore, "projects", projectId));
        const templateId = projSnap.data()?.templateId as string | undefined;
        if (!templateId) return;

        const poolSnap = await getDocs(collection(firestore, "projects", projectId, "templatePool"));
        if (poolSnap.empty) return;

        const total = poolSnap.size;
        const used = poolSnap.docs.filter((d) => d.data().status === "used").length;
        const company = templateId.charAt(0).toUpperCase() + templateId.slice(1);
        setTemplateProgress({ total, used, company });
      } catch {}
    };
    fetchTemplateProgress();
  }, [projectId]);

  const handleEditorBeforeMount = (monaco: any) => {
    monacoRef.current = monaco;
    monaco.editor.defineTheme('algobook-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'cba6f7', fontStyle: 'bold' },
        { token: 'keyword.control', foreground: 'cba6f7', fontStyle: 'bold' },
        { token: 'string', foreground: 'a6e3a1' },
        { token: 'string.escape', foreground: '94e2d5' },
        { token: 'number', foreground: 'fab387' },
        { token: 'number.float', foreground: 'fab387' },
        { token: 'comment', foreground: '6c7086', fontStyle: 'italic' },
        { token: 'comment.doc', foreground: '6c7086', fontStyle: 'italic' },
        { token: 'type', foreground: 'f9e2af' },
        { token: 'type.identifier', foreground: 'f9e2af' },
        { token: 'delimiter', foreground: '9399b2' },
        { token: 'delimiter.bracket', foreground: '9399b2' },
        { token: 'annotation', foreground: 'f9e2af' },
        { token: 'variable', foreground: 'cdd6f4' },
        { token: 'variable.predefined', foreground: 'f38ba8' },
        { token: 'constant', foreground: 'fab387' },
        { token: 'operator', foreground: '89dceb' },
        { token: 'tag', foreground: '89b4fa' },
        { token: 'attribute.name', foreground: 'f9e2af' },
        { token: 'attribute.value', foreground: 'a6e3a1' },
      ],
      colors: {
        'editor.background': '#1e1e2e',
        'editor.foreground': '#cdd6f4',
        'editor.lineHighlightBackground': '#28283d',
        'editor.lineHighlightBorder': '#00000000',
        'editor.selectionBackground': '#45475a80',
        'editor.selectionHighlightBackground': '#45475a40',
        'editorCursor.foreground': '#f5e0dc',
        'editor.inactiveSelectionBackground': '#31324460',
        'editorLineNumber.foreground': '#45475a',
        'editorLineNumber.activeForeground': '#a6adc8',
        'editorIndentGuide.background1': '#31324440',
        'editorIndentGuide.activeBackground1': '#45475a60',
        'editorBracketMatch.background': '#89b4fa15',
        'editorBracketMatch.border': '#89b4fa40',
        'editorBracketHighlight.foreground1': '#f38ba8',
        'editorBracketHighlight.foreground2': '#fab387',
        'editorBracketHighlight.foreground3': '#89b4fa',
        'editorBracketHighlight.foreground4': '#a6e3a1',
        'editorBracketHighlight.foreground5': '#f9e2af',
        'editorBracketHighlight.foreground6': '#cba6f7',
        'editorSuggestWidget.background': '#1e1e2e',
        'editorSuggestWidget.border': '#313244',
        'editorSuggestWidget.foreground': '#cdd6f4',
        'editorSuggestWidget.highlightForeground': '#89b4fa',
        'editorSuggestWidget.selectedBackground': '#45475a',
        'editorSuggestWidget.selectedForeground': '#cdd6f4',
        'editorWidget.background': '#1e1e2e',
        'editorWidget.border': '#313244',
        'editorHoverWidget.background': '#1e1e2e',
        'editorHoverWidget.border': '#313244',
        'scrollbarSlider.background': '#31324440',
        'scrollbarSlider.hoverBackground': '#45475a60',
        'scrollbarSlider.activeBackground': '#585b7080',
        'editorGutter.background': '#1e1e2e',
        'editorOverviewRuler.border': '#00000000',
        'focusBorder': '#89b4fa40',
        'list.hoverBackground': '#313244',
        'list.activeSelectionBackground': '#45475a',
        'input.background': '#313244',
        'input.border': '#45475a',
        'input.foreground': '#cdd6f4',
      },
    });
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track cursor position
    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPosition({ lineNumber: e.position.lineNumber, column: e.position.column });
    });

    // Keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runCodeRef.current?.(false);
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      runCodeRef.current?.(true);
    });
    editor.addCommand(monaco.KeyCode.Escape, () => {
      setIsFullscreen(false);
    });

    // Java completion provider
    completionDisposableRef.current?.dispose();
    completionDisposableRef.current = monaco.languages.registerCompletionItemProvider('java', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const keywords = [
          'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
          'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
          'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
          'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
          'package', 'private', 'protected', 'public', 'return', 'short', 'static',
          'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
          'transient', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null',
        ];

        const types = [
          'String', 'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Character',
          'Object', 'List', 'ArrayList', 'LinkedList', 'Map', 'HashMap', 'TreeMap',
          'LinkedHashMap', 'Set', 'HashSet', 'TreeSet', 'Queue', 'PriorityQueue',
          'Stack', 'Deque', 'ArrayDeque', 'Arrays', 'Collections', 'Math',
          'StringBuilder', 'StringBuffer', 'System', 'Scanner', 'Optional',
          'Stream', 'Comparator', 'Iterator', 'Iterable', 'Random', 'Pair',
          'int[]', 'int[][]', 'String[]', 'char[]', 'boolean[]', 'long[]',
        ];

        const snippets = [
          { label: 'for', insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}', detail: 'For loop' },
          { label: 'foreach', insertText: 'for (${1:int} ${2:item} : ${3:collection}) {\n\t$0\n}', detail: 'Enhanced for loop' },
          { label: 'while', insertText: 'while (${1:condition}) {\n\t$0\n}', detail: 'While loop' },
          { label: 'ifelse', insertText: 'if (${1:condition}) {\n\t$0\n} else {\n\t\n}', detail: 'If-else block' },
          { label: 'trycatch', insertText: 'try {\n\t$0\n} catch (${1:Exception} ${2:e}) {\n\t${3:e.printStackTrace();}\n}', detail: 'Try-catch block' },
          { label: 'sout', insertText: 'System.out.println(${1});', detail: 'Print to stdout' },
          { label: 'soutf', insertText: 'System.out.printf("${1:%s}\\n", ${2});', detail: 'Formatted print' },
          { label: 'main', insertText: 'public static void main(String[] args) {\n\t$0\n}', detail: 'Main method' },
          { label: 'bsearch', insertText: 'int left = 0, right = ${1:arr}.length - 1;\nwhile (left <= right) {\n\tint mid = left + (right - left) / 2;\n\tif (${1:arr}[mid] == ${2:target}) return mid;\n\telse if (${1:arr}[mid] < ${2:target}) left = mid + 1;\n\telse right = mid - 1;\n}\nreturn -1;', detail: 'Binary Search' },
          { label: 'bfs', insertText: 'Queue<${1:Integer}> queue = new LinkedList<>();\nqueue.offer(${2:start});\nSet<${1:Integer}> visited = new HashSet<>();\nvisited.add(${2:start});\nwhile (!queue.isEmpty()) {\n\t${1:Integer} curr = queue.poll();\n\t$0\n}', detail: 'BFS Template' },
          { label: 'dfs', insertText: 'private void dfs(${1:int node}, ${2:boolean[] visited}) {\n\tvisited[${1:node}] = true;\n\t$0\n}', detail: 'DFS Template' },
          { label: 'swap', insertText: 'int temp = ${1:arr}[${2:i}];\n${1:arr}[${2:i}] = ${1:arr}[${3:j}];\n${1:arr}[${3:j}] = temp;', detail: 'Swap elements' },
          { label: 'hashmap', insertText: 'Map<${1:String}, ${2:Integer}> ${3:map} = new HashMap<>();', detail: 'New HashMap' },
          { label: 'arraylist', insertText: 'List<${1:Integer}> ${2:list} = new ArrayList<>();', detail: 'New ArrayList' },
          { label: 'sort', insertText: 'Arrays.sort(${1:arr});', detail: 'Sort array' },
          { label: 'sortcmp', insertText: 'Arrays.sort(${1:arr}, (a, b) -> ${2:a - b});', detail: 'Sort with comparator' },
          { label: 'maxmin', insertText: 'Math.max(${1:a}, ${2:b})', detail: 'Math.max' },
          { label: 'matrix', insertText: 'int[][] ${1:matrix} = new int[${2:rows}][${3:cols}];', detail: '2D array' },
        ];

        const suggestions = [
          ...keywords.map(k => ({
            label: k,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: k,
            range,
            sortText: '1' + k,
          })),
          ...types.map(t => ({
            label: t,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: t,
            detail: 'Type',
            range,
            sortText: '0' + t,
          })),
          ...snippets.map(s => ({
            label: s.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: s.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: s.detail,
            range,
            sortText: '00' + s.label,
          })),
        ];

        return { suggestions };
      },
    });
  };

  const formatCode = () => {
    const editor = editorRef.current;
    if (!editor) return;
    // Format using the built-in action
    const action = editor.getAction('editor.action.formatDocument');
    if (action) {
      action.run();
    } else {
      // Fallback: trigger format via command
      editor.trigger('keyboard', 'editor.action.formatDocument', null);
    }
  };

  const resetCode = () => {
    if (question?.starterCode) {
      setCode(question.starterCode);
      setEditableInputs({});
    }
  };

  const toggleFullscreen = () => setIsFullscreen(prev => !prev);

  // Parse test case inputs into labeled variables
  const parseTestCaseInputs = (input: string): { name: string; value: string }[] => {
    const lines = input.trim().split('\n');
    return lines.map((line, i) => ({
      name: `param${i + 1}`,
      value: line,
    }));
  };

  // Get the input for running — either edited or original
  const getRunInput = (): string => {
    if (activeBottomTab === 'testcase') {
      if (editableInputs[selectedCaseIndex] !== undefined) {
        return editableInputs[selectedCaseIndex];
      }
      const cases = question?.testCases.filter(tc => tc.isSample) || [];
      const tc = cases[selectedCaseIndex] || question?.testCases[selectedCaseIndex];
      return tc?.input || '';
    }
    return '';
  };

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
    setRecommendationReason(null);
    setHints([]);
    setHintLabels([]);
    setRevealedHintLevel(0);
    hintsUsedRef.current = 0;
    runCountRef.current = 0;
    try {
      const response = await fetch('/api/question/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptToSubmit, projectId, userId: user.uid }),
      });
      if (response.status === 403) {
        setExecutionError("You need an active subscription to generate questions. Upgrade to Pro to continue.");
        setIsLoading(false);
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch question from AI');
      const data = await response.json();
      const newQuestion = data.question as Question;
      setQuestion(newQuestion);
      setCode(newQuestion.starterCode);
      setPrompt("");
      questionStartTimeRef.current = Date.now();

      if (data.reason) {
        setRecommendationReason(data.reason as RecommendationReason);
      }

      const newProjectQuestion: ProjectQuestion = {
        id: newQuestion.id!,
        title: newQuestion.title,
        difficulty: newQuestion.difficulty,
        tags: newQuestion.tags,
        generatedAt: Timestamp.now(),
      };
      const updatedQuestions = [...projectQuestions, newProjectQuestion];
      setProjectQuestions(updatedQuestions);
      setCurrentQuestionIndex(updatedQuestions.length - 1);

      // Increment template progress counter if this is a template project
      if (templateProgress) {
        setTemplateProgress((prev) => prev ? { ...prev, used: prev.used + 1 } : prev);
      }
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
    submitPrompt("__auto_next__");
  };

  const fetchHint = async (level: number) => {
    if (!question?.id || level < 1 || level > 3) return;
    if (level > revealedHintLevel + 1) return;

    if (hints[level - 1]) {
      setRevealedHintLevel(level);
      return;
    }

    setIsHintLoading(true);
    try {
      const response = await fetch("/api/hints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          hintLevel: level,
          userCode: level === 3 ? code : undefined,
          userId: user?.uid,
        }),
      });
      if (response.status === 403) {
        setExecutionError("You need an active subscription to use hints. Upgrade to Pro to continue.");
        setIsHintLoading(false);
        return;
      }
      if (!response.ok) throw new Error("Failed to get hint");
      const data = await response.json();
      setHints((prev) => {
        const updated = [...prev];
        updated[level - 1] = data.hint;
        return updated;
      });
      setHintLabels((prev) => {
        const updated = [...prev];
        updated[level - 1] = data.label || HINT_LABELS_DEFAULT[level - 1];
        return updated;
      });
      setRevealedHintLevel(level);
      hintsUsedRef.current = level;
    } catch (err) {
      console.error("Error fetching hint:", err);
    } finally {
      setIsHintLoading(false);
    }
  };

  const fetchSolutionExplanation = async () => {
    if (!user || !question?.id || !code || isSolutionLoading) return;
    setIsSolutionLoading(true);
    try {
      const res = await fetch('/api/solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, userCode: code, userId: user.uid }),
      });
      if (res.ok) {
        const data = await res.json();
        setSolutionExplanation(data);
      }
    } catch (err) {
      console.error('Solution fetch failed:', err);
    } finally {
      setIsSolutionLoading(false);
    }
  };

  const updateUserProfile = async (tags: string[], passed: boolean) => {
    if (!user || !question) return;
    const timeSpent = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
    try {
      await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          tags,
          passed,
          difficulty: question.difficulty,
          hintsUsed: hintsUsedRef.current,
          timeSpentSeconds: timeSpent,
          isFirstTry: submissionHistory.length === 0,
          runCount: runCountRef.current,
        }),
      });
    } catch (err) {
      console.error("Profile update failed:", err);
    }
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

    let testCasesToRun: TestCase[] = [];

    if (isSubmission) {
      if (question.testCases.length === 0) {
        setExecutionError("Cannot submit. The question has no test cases.");
        setIsExecuting(false);
        return;
      }
      testCasesToRun = question.testCases;
    } else {
      // Count Run clicks (non-submission) for struggle tracking
      runCountRef.current += 1;
      const inputToUse = getRunInput();
      testCasesToRun = [{ input: inputToUse, expectedOutput: "N/A (Custom Input)", isSample: true }];
      // Try matching to expected output if it's a known test case
      const matchedCase = question.testCases.find(tc => tc.input === inputToUse);
      if (matchedCase) {
        testCasesToRun = [matchedCase];
      }
      setLastRunInput(inputToUse);
    }

    // Switch to test-result on run
    setActiveBottomTab('test-result');

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
            stdin: testCase.input,
            userId: user?.uid,
          }),
        });
        if (response.status === 403) {
          setExecutionError("You need an active subscription to run code. Upgrade to Pro to continue.");
          setIsExecuting(false);
          return;
        }
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
      const timeSpent = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
      const attemptNumber = submissionHistory.length + 1;
      await addDoc(collection(firestore, "submissions"), {
        userId: user.uid,
        projectId,
        questionId: question.id,
        code,
        status: allTestsPassed ? 'success' : 'fail',
        attemptNumber,
        hintsUsed: hintsUsedRef.current,
        timeSpentSeconds: timeSpent,
        isFirstTry: attemptNumber === 1,
        runCount: runCountRef.current,
        submittedAt: serverTimestamp(),
      });

      // Update today's attendance counters
      const today = new Date().toISOString().slice(0, 10);
      const attendanceRef = doc(firestore, "projects", projectId, "attendance", today);
      const attendanceSnap = await getDoc(attendanceRef);
      if (attendanceSnap.exists()) {
        await setDoc(attendanceRef, {
          totalSubmissions: increment(1),
          ...(allTestsPassed
            ? { successfulSubmissions: increment(1), questionsSolved: increment(1) }
            : { failedSubmissions: increment(1) }),
          timeSpentSeconds: increment(timeSpent),
        }, { merge: true });
      }

      fetchSubmissionHistory(question.id);
      updateUserProfile(question.tags || [], allTestsPassed);

      // Session tracking: record this attempt for fatigue detection
      sessionRef.current = recordAttempt(
        sessionRef.current,
        allTestsPassed,
        hintsUsedRef.current,
        timeSpent,
      );
      setSessionHealth(computeSessionHealth(sessionRef.current));

      // On successful solve: mark solved, auto-switch to solution tab
      if (allTestsPassed) {
        setHasSolvedCurrent(true);
        setActiveBottomTab('solution');
        fetchSolutionExplanation();
      }
    }

    setIsExecuting(false);
  };

  // Keep ref in sync for keyboard shortcuts
  runCodeRef.current = handleRunCode;

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
              {!isLoading && question && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <PracticeStateBadge state={practiceState} progress={stateProgress} />
                    {templateProgress && (
                      <TemplateProgressBadge progress={templateProgress} />
                    )}
                    {recommendationReason && (
                      <ReasonBadge reason={recommendationReason} />
                    )}
                  </div>
                  <QuestionDisplay question={question} difficultyClass={difficultyClass} />
                  <HintsPanel
                    hints={hints}
                    labels={hintLabels}
                    revealedLevel={revealedHintLevel}
                    isLoading={isHintLoading}
                    onRequestHint={fetchHint}
                    disabled={!hasSubscription}
                  />
                </>
              )}
              {!isLoading && !question && <WelcomeMessage />}
            </div>
            <div className="flex-shrink-0 border-t border-border/50 p-3 space-y-3 bg-card/50">
              {!subLoading && !hasSubscription && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs text-amber-300 flex-1">Upgrade to Pro to generate questions, run code, and submit.</span>
                  <button
                    onClick={() => redirectToCheckout("pro-monthly")}
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 whitespace-nowrap"
                  >
                    ₹499/mo
                  </button>
                  <span className="text-amber-500/40">|</span>
                  <button
                    onClick={() => redirectToCheckout("pro-yearly")}
                    className="text-xs font-semibold text-primary hover:text-primary/80 whitespace-nowrap"
                  >
                    ₹4,999/yr
                  </button>
                </div>
              )}
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
                  placeholder={hasSubscription ? "Ask AI for a new question..." : "Upgrade to Pro to generate questions"}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isLoading || !hasSubscription}
                  className="h-9 text-sm bg-background"
                />
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" type="button" onClick={handleGenerateNext} disabled={isLoading || !hasSubscription} className="h-9 w-9 shrink-0">
                        <Sparkles className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{hasSubscription ? "Smart Next Question" : "Upgrade to Pro"}</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button type="submit" size="icon" disabled={isLoading || !hasSubscription} className="h-9 w-9 shrink-0 shadow-sm shadow-primary/20">
                  <Wand2 className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle className="w-[3px] bg-border/40 hover:bg-primary/40 transition-colors data-[resize-handle-active]:bg-primary" />

        {/* Right Panel — Editor + Console */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
            <ResizablePanelGroup orientation="vertical" className="flex-grow">
              <ResizablePanel defaultSize={65} minSize={25}>
                <div className="flex flex-col h-full">
                  {/* Editor Toolbar */}
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#313244] bg-[#1e1e2e] flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#313244] border border-[#45475a]">
                        <Code className="h-3 w-3 text-orange-400" />
                        <span className="text-[11px] font-semibold text-[#cdd6f4]">Java</span>
                      </div>
                      {question && (
                        <div className="flex items-center gap-1 text-[11px] text-[#a6adc8]">
                          <Timer className="h-3 w-3" />
                          <span className="font-mono tabular-nums">{formatElapsed(elapsedTime)}</span>
                        </div>
                      )}
                      {/* Session Health Indicator */}
                      {sessionHealth.problemsAttempted > 0 && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] ${
                                sessionHealth.score >= 80 ? 'text-emerald-400' :
                                sessionHealth.score >= 60 ? 'text-amber-400' :
                                sessionHealth.score >= 30 ? 'text-orange-400 animate-pulse' :
                                'text-red-400 animate-pulse'
                              }`}>
                                <Brain className="h-3 w-3" />
                                <span className="font-mono tabular-nums">{sessionHealth.score}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs text-xs">
                              <div className="space-y-1">
                                <p className="font-medium">Session Health: {sessionHealth.score}/100</p>
                                <p>{sessionHealth.sessionMinutes}min | {sessionHealth.problemsAttempted} attempted | {sessionHealth.problemsSolved} solved</p>
                                <p className="capitalize">Trend: {sessionHealth.trend}</p>
                                {sessionHealth.suggestion && <p className="text-amber-400 mt-1">{sessionHealth.suggestion}</p>}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <div className="flex items-center gap-0.5 mr-1 px-1 py-0.5 rounded bg-[#313244]/50">
                        <button onClick={() => setFontSize(s => Math.max(10, s - 1))} className="p-0.5 rounded hover:bg-[#45475a] text-[#a6adc8] transition-colors" title="Decrease font size">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-[10px] text-[#a6adc8] font-mono w-4 text-center tabular-nums">{fontSize}</span>
                        <button onClick={() => setFontSize(s => Math.min(24, s + 1))} className="p-0.5 rounded hover:bg-[#45475a] text-[#a6adc8] transition-colors" title="Increase font size">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={formatCode} className="p-1.5 rounded hover:bg-[#45475a] text-[#a6adc8] transition-colors">
                              <Code className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p>Format Code <kbd className="ml-1 px-1 py-0.5 rounded bg-muted text-[10px] font-mono">⇧⌥F</kbd></p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={resetCode} className="p-1.5 rounded hover:bg-[#45475a] text-[#a6adc8] transition-colors">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p>Reset to starter code</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={toggleFullscreen} className="p-1.5 rounded hover:bg-[#45475a] text-[#a6adc8] transition-colors">
                              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="p-1.5 rounded hover:bg-[#45475a] text-[#a6adc8] transition-colors">
                              <Keyboard className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            <div className="space-y-1">
                              <p><kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">⌘ Enter</kbd> Run Code</p>
                              <p><kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">⌘ ⇧ Enter</kbd> Submit</p>
                              <p><kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">⇧ ⌥ F</kbd> Format Code</p>
                              <p><kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Esc</kbd> Exit Fullscreen</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* Monaco Editor */}
                  <div className="flex-grow relative">
                    <Editor
                      height="100%"
                      language="java"
                      theme="algobook-dark"
                      value={code}
                      beforeMount={handleEditorBeforeMount}
                      onMount={handleEditorDidMount}
                      onChange={(value) => setCode(value || "")}
                      options={{
                        fontSize,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
                        fontLigatures: true,
                        minimap: { enabled: false },
                        wordWrap: 'on',
                        padding: { top: 16, bottom: 16 },
                        scrollBeyondLastLine: false,
                        smoothScrolling: true,
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: 'on',
                        cursorWidth: 2,
                        renderLineHighlight: 'all',
                        renderLineHighlightOnlyWhenFocus: false,
                        bracketPairColorization: { enabled: true },
                        autoClosingBrackets: 'always',
                        autoClosingQuotes: 'always',
                        autoIndent: 'full',
                        formatOnPaste: true,
                        formatOnType: true,
                        suggestOnTriggerCharacters: true,
                        acceptSuggestionOnCommitCharacter: true,
                        tabCompletion: 'on',
                        wordBasedSuggestions: 'currentDocument',
                        quickSuggestions: { other: true, comments: false, strings: true },
                        parameterHints: { enabled: true },
                        suggest: {
                          showKeywords: true,
                          showSnippets: true,
                          showClasses: true,
                          showFunctions: true,
                          showVariables: true,
                          showWords: true,
                          preview: true,
                          shareSuggestSelections: true,
                        },
                        lineNumbers: 'on',
                        glyphMargin: false,
                        folding: true,
                        foldingHighlight: true,
                        showFoldingControls: 'mouseover',
                        matchBrackets: 'always',
                        selectionHighlight: true,
                        occurrencesHighlight: 'singleFile',
                        renderWhitespace: 'selection',
                        guides: {
                          indentation: true,
                          bracketPairs: true,
                          highlightActiveBracketPair: true,
                        },
                        scrollbar: {
                          verticalScrollbarSize: 8,
                          horizontalScrollbarSize: 8,
                          useShadows: false,
                        },
                        overviewRulerLanes: 0,
                        hideCursorInOverviewRuler: true,
                        overviewRulerBorder: false,
                      }}
                    />
                  </div>

                  {/* Status Bar */}
                  <div className="flex items-center justify-between px-3 py-1 border-t border-[#313244] bg-[#1e1e2e] flex-shrink-0">
                    <div className="flex items-center gap-3 text-[10px] text-[#6c7086] font-mono">
                      <span>Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}</span>
                      <span>UTF-8</span>
                      <span>Java</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#6c7086]">
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Ready
                      </span>
                    </div>
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle className="h-[3px] bg-border/40 hover:bg-primary/40 transition-colors data-[resize-handle-active]:bg-primary" />

              {/* Bottom Panel — LeetCode-style Testcase / Test Result */}
              <ResizablePanel defaultSize={35} minSize={15}>
                <div className="flex flex-col h-full">
                  {/* Tab Header */}
                  <div className="flex items-center border-b border-border/50 flex-shrink-0 bg-card/30 px-1">
                    <button
                      onClick={() => setActiveBottomTab('testcase')}
                      className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                        activeBottomTab === 'testcase'
                          ? 'border-primary text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        Testcase
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveBottomTab('test-result')}
                      className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                        activeBottomTab === 'test-result'
                          ? 'border-primary text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {executionResult ? (
                          executionResult.status.id === 3 ? <Play className="h-3 w-3 text-emerald-500" /> : <TriangleAlert className="h-3 w-3 text-red-400" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        Test Result
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveBottomTab('submissions')}
                      className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                        activeBottomTab === 'submissions'
                          ? 'border-primary text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Submissions
                    </button>
                    {hasSolvedCurrent && (
                      <button
                        onClick={() => { setActiveBottomTab('solution'); if (!solutionExplanation && !isSolutionLoading) fetchSolutionExplanation(); }}
                        className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                          activeBottomTab === 'solution'
                            ? 'border-primary text-foreground'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <FileText className="h-3 w-3 text-blue-400" />
                          Solution
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Tab Content */}
                  <div className="flex-grow overflow-y-auto">
                    {/* Testcase Tab — LeetCode style */}
                    {activeBottomTab === 'testcase' && (
                      <div className="p-4">
                        {question && question.testCases.length > 0 ? (
                          <>
                            {/* Case tabs */}
                            <div className="flex items-center gap-1.5 mb-4">
                              {question.testCases.filter(tc => tc.isSample).length > 0
                                ? question.testCases.filter(tc => tc.isSample).map((_, i) => (
                                    <button
                                      key={i}
                                      onClick={() => setSelectedCaseIndex(i)}
                                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                        selectedCaseIndex === i
                                          ? 'bg-[#313244] text-foreground'
                                          : 'text-muted-foreground hover:bg-[#313244]/50'
                                      }`}
                                    >
                                      Case {i + 1}
                                    </button>
                                  ))
                                : question.testCases.slice(0, 3).map((_, i) => (
                                    <button
                                      key={i}
                                      onClick={() => setSelectedCaseIndex(i)}
                                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                        selectedCaseIndex === i
                                          ? 'bg-[#313244] text-foreground'
                                          : 'text-muted-foreground hover:bg-[#313244]/50'
                                      }`}
                                    >
                                      Case {i + 1}
                                    </button>
                                  ))
                              }
                            </div>

                            {/* Input fields for selected case */}
                            {(() => {
                              const sampleCases = question.testCases.filter(tc => tc.isSample);
                              const cases = sampleCases.length > 0 ? sampleCases : question.testCases.slice(0, 3);
                              const tc = cases[selectedCaseIndex];
                              if (!tc) return null;
                              const parsed = parseTestCaseInputs(tc.input);
                              return (
                                <div className="space-y-3">
                                  {parsed.map((p, i) => (
                                    <div key={i}>
                                      <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                                        {p.name} =
                                      </label>
                                      <div
                                        className="bg-[#313244] rounded-lg px-3 py-2.5 font-mono text-sm text-[#cdd6f4] cursor-text border border-transparent focus-within:border-[#45475a] transition-colors"
                                        contentEditable
                                        suppressContentEditableWarning
                                        onInput={(e) => {
                                          const newVal = (e.target as HTMLDivElement).innerText;
                                          const lines = (editableInputs[selectedCaseIndex] || tc.input).split('\\n');
                                          lines[i] = newVal;
                                          setEditableInputs(prev => ({ ...prev, [selectedCaseIndex]: lines.join('\\n') }));
                                        }}
                                        dangerouslySetInnerHTML={{ __html: p.value }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">No test cases available. Generate a question first.</p>
                        )}
                      </div>
                    )}

                    {/* Test Result Tab */}
                    {activeBottomTab === 'test-result' && (
                      <div className="p-4">
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
                          <p className="text-sm text-muted-foreground">Click <strong>Run</strong> to test your code, or <strong>Submit</strong> to check all test cases.</p>
                        }
                      </div>
                    )}

                    {/* Submissions Tab */}
                    {activeBottomTab === 'submissions' && (
                      <div className="p-4">
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
                                    <span className="text-[10px] text-muted-foreground font-normal">
                                      #{sub.attemptNumber || '?'}
                                      {sub.hintsUsed > 0 && ` · ${sub.hintsUsed} hint${sub.hintsUsed > 1 ? 's' : ''}`}
                                    </span>
                                  </CardTitle>
                                  <span className="text-[11px] text-muted-foreground">
                                    {sub.submittedAt?.toDate ? formatDistanceToNow(sub.submittedAt.toDate(), { addSuffix: true }) : ''}
                                  </span>
                                </CardHeader>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Solution Tab */}
                    {activeBottomTab === 'solution' && (
                      <div className="p-4">
                        {isSolutionLoading && (
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Analyzing your solution...
                          </div>
                        )}
                        {!isSolutionLoading && !solutionExplanation && (
                          <div className="text-center py-6">
                            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground mb-3">Get an AI analysis of your solution</p>
                            <Button size="sm" variant="outline" onClick={fetchSolutionExplanation} disabled={!hasSubscription}>
                              {!hasSubscription ? <><Lock className="h-3 w-3 mr-1" /> Pro Only</> : 'Analyze My Code'}
                            </Button>
                          </div>
                        )}
                        {!isSolutionLoading && solutionExplanation && (
                          <div className="space-y-4 text-sm">
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Your Approach</h4>
                              <p className="text-foreground">{solutionExplanation.analysis}</p>
                            </div>
                            <div className="flex gap-4">
                              <div className="flex-1 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/15">
                                <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Time Complexity</p>
                                <p className="text-sm font-mono mt-0.5">{solutionExplanation.timeComplexity}</p>
                              </div>
                              <div className="flex-1 p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/15">
                                <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">Space Complexity</p>
                                <p className="text-sm font-mono mt-0.5">{solutionExplanation.spaceComplexity}</p>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Optimal Approach</h4>
                              <p className="text-foreground">{solutionExplanation.optimalApproach}</p>
                            </div>
                            {solutionExplanation.improvements.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Improvements</h4>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                  {solutionExplanation.improvements.map((imp, i) => <li key={i}>{imp}</li>)}
                                </ul>
                              </div>
                            )}
                            {solutionExplanation.alternativeApproaches.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Alternative Approaches</h4>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                  {solutionExplanation.alternativeApproaches.map((alt, i) => <li key={i}>{alt}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>

            {/* Bottom Action Bar — LeetCode style */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 bg-card/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={formatCode} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors" aria-label="Format code">
                        <Code className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent><p>Format <kbd className="ml-1 px-1 py-0.5 rounded bg-muted text-[10px] font-mono">⇧⌥F</kbd></p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={toggleFullscreen} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors" aria-label="Fullscreen">
                        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent><p>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRunCode(false)}
                  disabled={isExecuting || !question || !hasSubscription}
                  className="gap-1.5 text-xs h-8 px-4"
                >
                  {!hasSubscription ? <Lock className="h-3.5 w-3.5"/> : isExecuting ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Play className="h-3.5 w-3.5"/>}
                  Run
                  <kbd className="hidden sm:inline-block ml-1 px-1 py-0.5 rounded bg-muted/80 text-[9px] font-mono text-muted-foreground">⌘↵</kbd>
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleRunCode(true)}
                  disabled={isExecuting || !question || !hasSubscription}
                  className="gap-1.5 text-xs h-8 px-4 shadow-sm shadow-primary/20 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {!hasSubscription ? <Lock className="h-3.5 w-3.5"/> : isExecuting ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Send className="h-3.5 w-3.5"/>}
                  Submit
                  <kbd className="hidden sm:inline-block ml-1 px-1 py-0.5 rounded bg-emerald-800/50 text-[9px] font-mono text-emerald-200/80">⌘⇧↵</kbd>
                </Button>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}

// ─── HELPER COMPONENTS ───

const PRACTICE_STATE_CONFIG: Record<string, { icon: typeof Flame; color: string; label: string }> = {
  'warm-up': { icon: Flame, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', label: 'Warm-up' },
  'learning': { icon: BookOpen, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: 'Learning' },
  'strengthening': { icon: Dumbbell, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Strengthening' },
  'revision': { icon: RefreshCw, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20', label: 'Revision' },
  'interview-prep': { icon: Target, color: 'text-red-400 bg-red-500/10 border-red-500/20', label: 'Interview Prep' },
  'maintenance': { icon: Shield, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Maintenance' },
};

const PracticeStateBadge = ({ state, progress }: { state: PracticeState; progress: string }) => {
  const cfg = PRACTICE_STATE_CONFIG[state] || PRACTICE_STATE_CONFIG.learning;
  const Icon = cfg.icon;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1.5 mb-4 px-2.5 py-1.5 rounded-lg border cursor-help ${cfg.color}`}>
            <Icon className="h-3 w-3 shrink-0" />
            <span className="text-[11px] font-medium">{cfg.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs font-medium mb-1">{cfg.label} Phase</p>
          {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const TemplateProgressBadge = ({ progress }: { progress: { total: number; used: number; company: string } }) => {
  const pct = Math.round((progress.used / progress.total) * 100);
  const isComplete = progress.used >= progress.total;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-2 mb-4 px-2.5 py-1.5 rounded-lg border cursor-help ${
            isComplete
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              : "text-blue-400 bg-blue-500/10 border-blue-500/20"
          }`}>
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="text-[11px] font-medium">
              {isComplete ? `${progress.company} ✓` : `${progress.company}: ${progress.used}/${progress.total}`}
            </span>
            {!isComplete && (
              <div className="w-12 h-1.5 rounded-full bg-blue-500/20 overflow-hidden">
                <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs font-medium mb-1">{progress.company} Template</p>
          <p className="text-xs text-muted-foreground">
            {isComplete
              ? "All template questions covered! AI is now generating similar questions."
              : `${progress.used} of ${progress.total} template questions covered (${pct}%)`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ReasonBadge = ({ reason }: { reason: RecommendationReason }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15 cursor-help">
          <Info className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs text-primary font-medium">{reason.short}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="text-xs">{reason.detail}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

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

const HINT_LABELS_DEFAULT = ["Pattern Recognition", "Algorithm Choice", "Implementation Trap"];
const HINT_DESCRIPTIONS = [
  "What pattern or category does this problem belong to?",
  "Which algorithm or data structure is the right fit?",
  "What edge case or subtle trap will trip you up?",
];

const HintsPanel = ({
  hints,
  labels,
  revealedLevel,
  isLoading,
  onRequestHint,
  disabled,
}: {
  hints: string[];
  labels: string[];
  revealedLevel: number;
  isLoading: boolean;
  onRequestHint: (level: number) => void;
  disabled?: boolean;
}) => (
  <div className="mt-6 border-t border-border/30 pt-5">
    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
      <Lightbulb className="h-4 w-4 text-amber-400" /> Hints
    </h3>
    <div className="space-y-2">
      {[1, 2, 3].map((level) => {
        const isRevealed = level <= revealedLevel && hints[level - 1];
        const isNext = level === revealedLevel + 1;
        const isLocked = level > revealedLevel + 1;
        const label = labels[level - 1] || HINT_LABELS_DEFAULT[level - 1];

        return (
          <div key={level} className="rounded-lg border border-border/40 overflow-hidden">
            {isRevealed ? (
              <div className="p-3 bg-amber-500/5">
                <p className="text-xs font-medium text-amber-400 mb-1">
                  Hint {level}: {label}
                </p>
                <p className="text-sm text-foreground">{hints[level - 1]}</p>
              </div>
            ) : (
              <button
                onClick={() => !isLocked && !disabled && onRequestHint(level)}
                disabled={isLocked || isLoading || disabled}
                className={`w-full text-left p-3 text-sm transition-colors ${
                  isLocked || disabled
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : "text-muted-foreground hover:bg-muted/30 cursor-pointer"
                }`}
              >
                {isLoading && isNext ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating hint...
                  </span>
                ) : (
                  <span>
                    {isNext ? `Reveal Hint ${level}` : `Hint ${level}`}: {HINT_DESCRIPTIONS[level - 1]}
                    {isLocked && " (reveal previous first)"}
                  </span>
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

const WelcomeMessage = () => (
  <div className="flex flex-col items-center justify-center h-full text-center px-6">
    <div className="mb-5 rounded-2xl bg-primary/10 p-5">
      <BrainCircuit className="h-10 w-10 text-primary" />
    </div>
    <h2 className="text-xl font-bold mb-2">Welcome to your AlgoBook</h2>
    <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
      Type a topic in the prompt below to generate an AI-powered coding challenge, or click the sparkle button for a smart recommendation.
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
