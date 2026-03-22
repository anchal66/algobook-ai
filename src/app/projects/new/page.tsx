"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { firestore } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Code2, Rocket } from "lucide-react";

export default function NewProjectPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [purpose, setPurpose] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in to create a project.");
      return;
    }
    if (!title.trim() || !description.trim()) {
      setError("Project title and description are required.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const projectsCollection = collection(firestore, "projects");
      const newProjectDoc = await addDoc(projectsCollection, {
        userId: user.uid,
        title,
        description,
        duration,
        purpose,
        createdAt: serverTimestamp(),
      });

      router.push(`/project/${newProjectDoc.id}`);
    } catch (err) {
      console.error("Error creating project: ", err);
      setError("Failed to create project. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">AlgoBook</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="flex items-center justify-center px-4 py-16 sm:py-24">
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="overflow-hidden border-border/60">
            <div className="h-2 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <Rocket className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">
                    Create New Project
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    Define your goals and the AI will tailor questions for you.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Project Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Mastering Dynamic Programming"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what you want to achieve. This helps the AI generate relevant questions."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[100px]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purpose">Purpose (optional)</Label>
                  <Input
                    id="purpose"
                    placeholder="e.g., Prepare for FAANG Interviews"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="duration">Practice Duration</Label>
                    <span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                      {duration} days
                    </span>
                  </div>
                  <Slider
                    id="duration"
                    min={7}
                    max={90}
                    step={1}
                    value={[duration]}
                    onValueChange={(value) => setDuration(value[0])}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 week</span>
                    <span>3 months</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col items-stretch gap-4 pt-2">
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full py-6 text-base gap-2 shadow-lg shadow-primary/20"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4" />
                      Start Coding
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
