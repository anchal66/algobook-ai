"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { firestore, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PlusCircle,
  Loader2,
  Search,
  FolderOpen,
  LogOut,
  Code2,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";

interface Project {
  id: string;
  title: string;
  description: string;
  purpose?: string;
  duration?: number;
  createdAt: { seconds: number; nanoseconds: number };
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchProjects = async () => {
      try {
        const q = query(
          collection(firestore, "projects"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const userProjects = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Project[];
        setProjects(userProjects);
        setFilteredProjects(userProjects);
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user, authLoading, router]);

  useEffect(() => {
    const results = projects.filter((project) =>
      project.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProjects(results);
  }, [searchTerm, projects]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = user?.displayName?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">AlgoBook</span>
          </Link>
          <div className="flex items-center gap-3">
            {user?.photoURL && (
              <img
                src={user.photoURL}
                alt=""
                className="h-8 w-8 rounded-full ring-2 ring-border"
                referrerPolicy="no-referrer"
              />
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5 text-muted-foreground hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Greeting */}
        <motion.div
          className="mb-10"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Welcome back, {firstName}
              </h1>
              <p className="text-muted-foreground mt-1">
                {projects.length > 0
                  ? `You have ${projects.length} project${projects.length !== 1 ? "s" : ""}. Keep up the great work.`
                  : "Ready to start your coding practice journey?"}
              </p>
            </div>
            <Link href="/projects/new">
              <Button className="gap-2 shadow-lg shadow-primary/20">
                <PlusCircle className="h-4 w-4" /> New Project
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Search */}
        <motion.div
          className="relative mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="pl-10 h-11 bg-card border-border/60"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </motion.div>

        {/* Project Grid */}
        {filteredProjects.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            {filteredProjects.map((project) => (
              <motion.div key={project.id} variants={fadeUp}>
                <Link href={`/project/${project.id}/editor`}>
                  <Card className="group h-full flex flex-col overflow-hidden hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 cursor-pointer">
                    <div className="h-1.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {project.title}
                        </CardTitle>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-200" />
                      </div>
                      <CardDescription>
                        {format(
                          new Date(project.createdAt.seconds * 1000),
                          "PPP"
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow pt-0">
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {project.description}
                      </p>
                      {(project.purpose || project.duration) && (
                        <div className="flex flex-wrap gap-2">
                          {project.purpose && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                              {project.purpose}
                            </span>
                          )}
                          {project.duration && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                              {project.duration} days
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            className="text-center py-20 rounded-2xl border-2 border-dashed border-border/60"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="mx-auto mb-6 inline-flex items-center justify-center rounded-2xl bg-muted p-5">
              <FolderOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {searchTerm ? "No matching projects" : "No projects yet"}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              {searchTerm
                ? `Nothing matches "${searchTerm}". Try a different search.`
                : "Create your first project to start practicing with AI-generated coding challenges."}
            </p>
            {!searchTerm && (
              <Link href="/projects/new">
                <Button className="gap-2">
                  <PlusCircle className="h-4 w-4" /> Create Your First Project
                </Button>
              </Link>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
