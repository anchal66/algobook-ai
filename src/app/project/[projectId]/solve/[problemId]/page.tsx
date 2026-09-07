import type { Metadata } from "next";
import { WorkspaceClient } from "@/components/workspace/WorkspaceClient";

/** Project workspace. `/solve/next` renders the generation flow for the next queued problem. */
export const metadata: Metadata = { title: "Solve" };

export default async function SolvePage({ params }: { params: Promise<{ projectId: string; problemId: string }> }) {
  const { projectId, problemId } = await params;
  return <WorkspaceClient problemId={problemId === "next" ? null : problemId} projectId={projectId} />;
}
