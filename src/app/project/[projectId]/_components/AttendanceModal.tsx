"use client";

/**
 * D-07 (default): the "mark your attendance" modal is removed. Daily check-in is
 * automatic on the first Run/Submit of the day (server-side `activity` doc) and
 * `projects.progress.activeDays` is maintained by POST /api/submit.
 * Module 05 replaces this with a streak indicator in the top bar.
 */
export default function AttendanceModal({ projectId }: { projectId: string }) {
  void projectId;
  return null;
}
