"use client";

import { useEffect, useState } from 'react';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Submission } from '@/types';

export interface ProjectQuestion {
  id: string; // This is the questionId
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

interface QuestionWithSubmissions extends ProjectQuestion {
  submissions: Submission[];
}

export default function HistoryPage({ params }: { params: { projectId: string } }) {
  const { user } = useAuth();
  const [history, setHistory] = useState<QuestionWithSubmissions[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      try {
        // 1. Get all questions associated with this project
        const pqSnapshot = await getDocs(
          collection(firestore, "projects", params.projectId, "projectQuestions")
        );
        const projectQuestions = pqSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ProjectQuestion[];

        // 2. For each question, get its submissions for this user and project
        const historyWithSubmissions = await Promise.all(
          projectQuestions.map(async (question) => {
            const subQuery = query(
              collection(firestore, "submissions"),
              where("projectId", "==", params.projectId),
              where("userId", "==", user.uid),
              where("questionId", "==", question.id),
              orderBy("submittedAt", "desc")
            );
            const subSnapshot = await getDocs(subQuery);
            const submissions = subSnapshot.docs.map(doc => doc.data()) as Submission[];
            return { ...question, submissions };
          })
        );
        
        setHistory(historyWithSubmissions);
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user, params.projectId]);

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
            You haven't attempted any questions in this project yet. Go to the editor to get started!
        </p>
      )}
    </div>
  );
}