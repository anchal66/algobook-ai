"use client";

import { useEffect, useState } from "react";
import { firestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Code, Code2, History, Home, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectData {
  title: string;
}

export default function ProjectHeader({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    const fetchProject = async () => {
      const docRef = doc(firestore, "projects", projectId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProject(docSnap.data() as ProjectData);
      }
    };
    fetchProject();
  }, [projectId]);

  const isEditor = pathname.includes("/editor");
  const isHistory = pathname.includes("/history");
  const isInsights = pathname.includes("/insights");

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-background/80 backdrop-blur-xl shrink-0">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" aria-label="Back to Dashboard" className="hover:bg-primary/10">
            <Home className="h-4 w-4" />
          </Button>
        </Link>
        <div className="h-5 w-px bg-border" />
        <Link href="/dashboard" className="flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
            <Code2 className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold hidden sm:inline">AlgoBook</span>
        </Link>
        <div className="h-5 w-px bg-border hidden sm:block" />
        <h1 className="text-sm font-medium text-muted-foreground truncate max-w-[200px] hidden sm:block">
          {project?.title || "Loading..."}
        </h1>
      </div>

      <nav className="flex items-center gap-1">
        <Link href={`/project/${projectId}/editor`}>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 text-sm relative",
              isEditor
                ? "text-primary hover:text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Code className="h-3.5 w-3.5" />
            Editor
            {isEditor && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </Button>
        </Link>
        <Link href={`/project/${projectId}/history`}>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 text-sm relative",
              isHistory
                ? "text-primary hover:text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="h-3.5 w-3.5" />
            History
            {isHistory && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </Button>
        </Link>
        <Link href={`/project/${projectId}/insights`}>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 text-sm relative",
              isInsights
                ? "text-primary hover:text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Insights
            {isInsights && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </Button>
        </Link>

        {user?.photoURL && (
          <>
            <div className="h-5 w-px bg-border ml-2" />
            <img
              src={user.photoURL}
              alt=""
              className="h-7 w-7 rounded-full ring-1 ring-border ml-2"
              referrerPolicy="no-referrer"
            />
          </>
        )}
      </nav>
    </header>
  );
}
