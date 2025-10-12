"use client";
import { redirect } from 'next/navigation';

export default function ProjectRootPage({ params }: { params: { projectId: string } }) {
  redirect(`/project/${params.projectId}/editor`);
}