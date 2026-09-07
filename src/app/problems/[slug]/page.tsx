import type { Metadata } from "next";
import { WorkspaceClient } from "@/components/workspace/WorkspaceClient";

/** Explore workspace (D-06): a verified problem by slug or id, no project context. */
export const metadata: Metadata = { title: "Problem" };

export default async function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <WorkspaceClient problemId={slug} projectId={null} />;
}
