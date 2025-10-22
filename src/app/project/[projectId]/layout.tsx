import { ReactNode } from 'react';
import ProjectHeader from './_components/ProjectHeader';

// 1. FIX: The 'params' prop type is now a Promise
export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>; // <-- This is the type fix
}) {
  
  // 2. FIX: You must await the promise to get the resolved value
  const resolvedParams = await params;

  return (
    <div className="flex flex-col h-screen w-screen">
      {/* 3. FIX: Use the resolved value here */}
      <ProjectHeader projectId={resolvedParams.projectId} />
      <main className="flex-grow overflow-hidden">
        {children}
      </main>
    </div>
  );
}