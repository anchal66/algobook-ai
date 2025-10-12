"use client";

import { useEffect, useState } from 'react';
import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Code, History, ArrowLeft, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectData {
  title: string;
}

export default function ProjectHeader({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const fetchProject = async () => {
      const docRef = doc(firestore, 'projects', projectId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProject(docSnap.data() as ProjectData);
      }
    };
    fetchProject();
  }, [projectId]);

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b shrink-0">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="icon" aria-label="Back to Dashboard">
            <Home className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold truncate">{project?.title || 'Loading Project...'}</h1>
      </div>
      <nav className="flex items-center gap-2">
        <Link href={`/project/${projectId}/editor`}>
            <Button variant="ghost" className={cn(
                "flex items-center gap-2",
                pathname.includes('/editor') && "bg-accent"
            )}>
                <Code className="h-4 w-4" />
                <span>Editor</span>
            </Button>
        </Link>
        <Link href={`/project/${projectId}/history`}>
            <Button variant="ghost" className={cn(
                "flex items-center gap-2",
                pathname.includes('/history') && "bg-accent"
            )}>
                <History className="h-4 w-4" />
                <span>History</span>
            </Button>
        </Link>
      </nav>
    </header>
  );
}