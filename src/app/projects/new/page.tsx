"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { firestore } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

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
import { Loader2 } from "lucide-react";

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
        duration, // in days
        purpose,
        createdAt: serverTimestamp(),
      });
      
      // Redirect to the newly created project's editor page
      router.push(`/project/${newProjectDoc.id}`);

    } catch (err) {
      console.error("Error creating project: ", err);
      setError("Failed to create project. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Create New Project</CardTitle>
          <CardDescription>
            Define your goals and start your personalized coding journey.
          </CardDescription>
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
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="A brief description of what you want to achieve. This will help the AI tailor questions for you."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="purpose">Optional Purpose</Label>
              <Input
                id="purpose"
                placeholder="e.g., Prepare for FAANG Interviews"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label htmlFor="duration">Practice Duration (Days)</Label>
                <span className="text-lg font-semibold text-primary">{duration}</span>
              </div>
              <Slider
                id="duration"
                min={7}
                max={90}
                step={1}
                value={[duration]}
                onValueChange={(value) => setDuration(value[0])}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-4">
             {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Start Coding"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}