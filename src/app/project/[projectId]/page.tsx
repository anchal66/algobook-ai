"use client";

import { useState, useRef } from "react";
import {
  PanelResizeHandle as ResizableHandle,
  Panel as ResizablePanel,
  PanelGroup as ResizablePanelGroup,
} from "react-resizable-panels";
import { Editor } from "@monaco-editor/react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; 
import { useAuth } from "@/context/AuthContext";
import { Question } from "@/types";
import { Wand2, Loader2, Code, Play, Send } from "lucide-react";

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  const { user } = useAuth();
  const { projectId } = params;
  
  const [prompt, setPrompt] = useState("");
  const [question, setQuestion] = useState<Question | null>(null);
  const [code, setCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
  };

  const formatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument').run();
    }
  };

  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !user) return;

    setIsLoading(true);
    setQuestion(null);

    try {
      const response = await fetch('/api/question/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, projectId, userId: user.uid }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch question');
      }

      const data = await response.json();
      setQuestion(data.question);
      setCode(data.question.starterCode);

    } catch (error) {
      console.error(error);
      // Here you would show an error toast to the user
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <main className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        {/* Left Panel: Question and Prompt */}
        <ResizablePanel defaultSize={40} minSize={25} className="p-4 flex flex-col h-full">
          <div className="flex-grow overflow-y-auto pr-2">
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Generating your challenge...</p>
              </div>
            )}
            {question && <QuestionDisplay question={question} />}
            {!question && !isLoading && <WelcomeMessage />}
          </div>
          <form onSubmit={handlePromptSubmit} className="mt-4 flex gap-2 border-t pt-4">
            <Input 
              placeholder="Give me a hard question on arrays..." 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading}>
              <Wand2 className="h-4 w-4" />
            </Button>
          </form>
        </ResizablePanel>

        <ResizableHandle className="relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1">
          <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
            <div className="h-2.5 w-1 rounded-full bg-muted-foreground" />
          </div>
        </ResizableHandle>

        {/* Right Panel: Code Editor */}
        <ResizablePanel defaultSize={60} minSize={30} className="flex flex-col h-full">
           <div className="bg-[#1e1e1e] flex-grow">
              <Editor
                height="100%"
                language="java"
                theme="vs-dark"
                value={code}
                onMount={handleEditorDidMount}
                onChange={(value) => setCode(value || "")}
                options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                }}
                />
            </div>
            <div className="flex items-center justify-between p-2 border-t">
                <Button variant="secondary" onClick={formatCode} className="flex items-center gap-2">
                    <Code className="h-4 w-4"/> Format Code
                </Button>
                <div className="flex gap-2">
                     <Button variant="outline" className="flex items-center gap-2">
                        <Play className="h-4 w-4"/> Run
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700 flex items-center gap-2">
                        <Send className="h-4 w-4"/> Submit
                    </Button>
                </div>
            </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}

// Helper component for displaying the question
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
      
      <h2>Examples</h2>
      {question.examples.map((ex, i) => (
          <div key={i} className="bg-muted/50 p-4 rounded-md mb-4">
              <p><strong>Input:</strong> <code>{ex.input}</code></p>
              <p><strong>Output:</strong> <code>{ex.output}</code></p>
              {ex.explanation && <p><strong>Explanation:</strong> {ex.explanation}</p>}
          </div>
      ))}
      
      <h2>Constraints</h2>
      <ul>
        {question.constraints.map((c, i) => <li key={i}>{c}</li>)}
      </ul>
    </article>
);


// Helper component for the initial state
const WelcomeMessage = () => (
    <div className="flex flex-col items-center justify-center h-full text-center">
        <Wand2 size={48} className="text-primary mb-4" />
        <h2 className="text-2xl font-bold">Welcome to your AlgoBook</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
            Use the prompt box below to start your practice session.
            Try something like "Give me an easy question" or "Next question on Trees".
        </p>
    </div>
);