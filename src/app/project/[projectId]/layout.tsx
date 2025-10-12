import { ReactNode } from 'react';
import ProjectHeader from './_components/ProjectHeader';

export default function ProjectLayout({
  children,
  params: { projectId },
}: {
  children: ReactNode;
  params: { projectId: string };
}) {
  return (
    <div className="flex flex-col h-screen w-screen">
      <ProjectHeader projectId={projectId} />
      <main className="flex-grow overflow-hidden">
        {children}
      </main>
    </div>
  );
}