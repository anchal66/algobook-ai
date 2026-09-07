"use client";

import { useEffect, useState } from 'react';
import { use } from 'react';
import { apiFetch } from '@/lib/api-client';
import { toLegacySubmission, type SubmissionDTO } from '@/lib/legacy/adapters';
import { useAuth } from '@/context/AuthContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Submission } from '@/types/legacy';

export interface ProjectQuestion {
  id: string; // This is the questionId
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

interface QuestionWithSubmissions extends ProjectQuestion {
  submissions: Submission[];
}

export default function HistoryPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { user } = useAuth();
  const [history, setHistory] = useState<QuestionWithSubmissions[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      try {
        const [{ items }, subs] = await Promise.all([
          apiFetch<{ items: { problemId: string; title: string; difficulty: 'Easy' | 'Medium' | 'Hard' }[] }>(`/api/projects/${projectId}`),
          apiFetch<{ items: SubmissionDTO[] }>(`/api/submissions?projectId=${encodeURIComponent(projectId)}&limit=50`),
        ]);
        const byProblem: Record<string, Submission[]> = {};
        for (const s of subs.items) (byProblem[s.problemId] ??= []).push(toLegacySubmission(s));
        const historyWithSubmissions: QuestionWithSubmissions[] = items.map((q) => ({
          id: q.problemId, title: q.title, difficulty: q.difficulty, submissions: byProblem[q.problemId] ?? [],
        }));
        setHistory(historyWithSubmissions);
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user, projectId]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Question History</h1>
      {history.length > 0 ? (
        <Accordion type="single" collapsible className="w-full">
          {history.map(item => (
            <AccordionItem value={item.id} key={item.id}>
              <AccordionTrigger className="text-lg hover:no-underline">
                <div className="flex items-center gap-4">
                   <span className={`px-2 py-1 text-xs rounded-full ${
                      item.difficulty === 'Easy' ? 'bg-green-800 text-green-200' :
                      item.difficulty === 'Medium' ? 'bg-yellow-800 text-yellow-200' :
                      'bg-red-800 text-red-200'
                    }`}>{item.difficulty}</span>
                  <span>{item.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {item.submissions.length > 0 ? (
                  <ul className="space-y-2 pl-4">
                    {item.submissions.map((sub, index) => (
                      <li key={index} className="flex items-center gap-3 text-sm p-2 rounded-md bg-muted/50">
                        {sub.status === 'success' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className="font-mono text-xs uppercase">{sub.status}</span>
                        <span className="text-muted-foreground">
                          - {formatDistanceToNow(new Date(sub.submittedAt.seconds * 1000), { addSuffix: true })}
                        </span>
                        {/* We can add a "View Code" button here later */}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pl-4 text-muted-foreground">No submissions found for this question.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <p className="text-center text-muted-foreground mt-8">
            You haven&apos;t attempted any questions in this project yet. Go to the editor to get started!
        </p>
      )}
    </div>
  );
}