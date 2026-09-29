import type { Metadata } from "next";
import { WorkspaceClient } from "@/components/workspace/WorkspaceClient";

/** Contest arena (Module 06): the workspace in room mode, outside the app shell like /problems/[slug]. */
export const metadata: Metadata = { title: "Contest · AlgoBook" };

export default async function RoomPlayPage({ params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  const i = Math.max(0, Number(index) || 0);
  return <WorkspaceClient problemId={`room:${id}:${i}`} projectId={null} room={{ id, index: i }} />;
}
