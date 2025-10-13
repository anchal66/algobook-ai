import { ReactNode } from 'react';
import ProjectHeader from './_components/ProjectHeader';

// FIX: Add the 'async' keyword to the function definition
export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { projectId: string };
}) {
  return (
    <div className="flex flex-col h-screen w-screen">
      {/* Now it's safe to access params.projectId here */}
      <ProjectHeader projectId={params.projectId} />
      <main className="flex-grow overflow-hidden">
        {children}
      </main>
    </div>
  );
}