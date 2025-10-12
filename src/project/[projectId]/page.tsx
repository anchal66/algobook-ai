"use client";

// This is a placeholder for the main code editor page.
// We will build this out in the next part.

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">Code Editor</h1>
      <p className="mt-4 text-muted-foreground">
        Project ID: <span className="font-mono text-primary">{projectId}</span>
      </p>
      <p className="mt-8 text-lg">Coming soon in Part 2!</p>
    </div>
  );
}