"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  CalendarCheck, Clock, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  BarChart3, Flame, Target,
} from "lucide-react";
import { format } from "date-fns";

interface AttendanceDay {
  date: string;
  markedAt: string | null;
  questionsGenerated: number;
  questionsSolved: number;
  totalSubmissions: number;
  successfulSubmissions: number;
  failedSubmissions: number;
  timeSpentSeconds: number;
}

interface SubmissionRecord {
  id: string;
  questionId: string;
  status: string;
  attemptNumber: number;
  timeSpentSeconds: number;
  submittedAt: string | null;
}

interface ActivitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
}

export default function ActivitySheet({ open, onOpenChange, projectId, projectTitle }: ActivitySheetProps) {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceDay[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [questionTitles, setQuestionTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    const fetchActivity = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/project/activity?projectId=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(user.uid)}`
        );
        if (res.ok) {
          const data = await res.json();
          setAttendance(data.attendance || []);
          setSubmissions(data.submissions || []);
          setQuestionTitles(data.questionTitles || {});
        }
      } catch (err) {
        console.error("Error fetching activity:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [open, user, projectId]);

  const totalDays = attendance.length;
  const totalSubs = attendance.reduce((sum, d) => sum + d.totalSubmissions, 0);
  const totalSuccess = attendance.reduce((sum, d) => sum + d.successfulSubmissions, 0);
  const totalTime = attendance.reduce((sum, d) => sum + d.timeSpentSeconds, 0);
  const successRate = totalSubs > 0 ? Math.round((totalSuccess / totalSubs) * 100) : 0;

  const getSubmissionsForDay = (date: string) => {
    return submissions.filter((s) => s.submittedAt?.startsWith(date));
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Activity — {projectTitle}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-lg bg-primary animate-pulse" />
          </div>
        ) : attendance.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CalendarCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No activity yet. Open the project to start tracking!</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-xl border border-border/60 bg-card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Days Active</span>
                </div>
                <p className="text-xl font-bold">{totalDays}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs text-muted-foreground">Submissions</span>
                </div>
                <p className="text-xl font-bold">{totalSubs}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="h-4 w-4 text-orange-400" />
                  <span className="text-xs text-muted-foreground">Success Rate</span>
                </div>
                <p className="text-xl font-bold">{successRate}%</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-blue-400" />
                  <span className="text-xs text-muted-foreground">Total Time</span>
                </div>
                <p className="text-xl font-bold">{formatTime(totalTime)}</p>
              </div>
            </div>

            {/* Day-wise list */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Daily Timesheet
              </h3>
              {attendance.map((day) => {
                const daySubmissions = getSubmissionsForDay(day.date);
                const isExpanded = expandedDay === day.date;
                const dayRate = day.totalSubmissions > 0
                  ? Math.round((day.successfulSubmissions / day.totalSubmissions) * 100)
                  : 0;

                return (
                  <div key={day.date} className="rounded-xl border border-border/60 overflow-hidden">
                    <button
                      onClick={() => setExpandedDay(isExpanded ? null : day.date)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {format(new Date(day.date + "T00:00:00"), "EEE, MMM d, yyyy")}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            {day.successfulSubmissions}/{day.totalSubmissions}
                          </span>
                          <span>{dayRate}% pass</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(day.timeSpentSeconds)}
                          </span>
                        </div>
                      </div>
                    </button>

                    {isExpanded && daySubmissions.length > 0 && (
                      <div className="border-t border-border/40 bg-muted/20 p-3 space-y-2">
                        {daySubmissions.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-2 text-xs">
                            {sub.status === "success" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                            )}
                            <span className="flex-1 truncate">
                              {questionTitles[sub.questionId] || sub.questionId}
                            </span>
                            <span className="text-muted-foreground">
                              Attempt #{sub.attemptNumber}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {isExpanded && daySubmissions.length === 0 && (
                      <div className="border-t border-border/40 bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">
                          Attendance marked, no submissions this day.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
