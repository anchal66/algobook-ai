"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, serverTimestamp, increment } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Flame, Sparkles, Trophy } from "lucide-react";

const MOTIVATIONAL_MESSAGES = [
  "Consistency beats intensity. Let's code today! 🔥",
  "Another day, another algorithm conquered! 💪",
  "The best time to practice was yesterday. The next best time is now.",
  "Small steps daily lead to giant leaps in skill.",
  "Your future self will thank you for practicing today.",
  "Great developers are built one day at a time.",
];

export default function AttendanceModal({ projectId }: { projectId: string }) {
  const { user, loading: authLoading } = useAuth();
  const [show, setShow] = useState(false);
  const [marking, setMarking] = useState(false);
  const [activeDays, setActiveDays] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  const today = new Date().toISOString().slice(0, 10);
  const localKey = `attendance_${projectId}_${today}`;

  useEffect(() => {
    if (authLoading || !user) return;

    // Fast local check
    if (localStorage.getItem(localKey)) return;

    // Check Firestore (with retry for newly created projects)
    const checkAttendance = async () => {
      try {
        // Load project info for duration — retry if doc not yet available
        const projectRef = doc(firestore, "projects", projectId);
        let projectData: Record<string, unknown> | undefined;
        for (let attempt = 0; attempt < 5; attempt++) {
          const projectSnap = await getDoc(projectRef);
          if (projectSnap.exists()) {
            projectData = projectSnap.data();
            break;
          }
          // Doc not ready yet (new project race condition) — wait and retry
          await new Promise((r) => setTimeout(r, 400));
        }

        if (projectData) {
          setTotalDuration((projectData.duration as number) || 0);
          setActiveDays((projectData.activeDays as number) || 0);
        }

        // Check if already marked today
        const ref = doc(firestore, "projects", projectId, "attendance", today);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          localStorage.setItem(localKey, "1");
        } else {
          setShow(true);
        }
      } catch (err) {
        console.error("Error checking attendance:", err);
        // Still show modal even on error — better to show than to silently fail
        setShow(true);
      }
    };
    checkAttendance();
  }, [authLoading, user, projectId, today, localKey]);

  const handleMarkAttendance = async () => {
    if (!user) return;
    setMarking(true);
    try {
      const newDayNumber = activeDays + 1;

      // Create today's attendance doc
      const ref = doc(firestore, "projects", projectId, "attendance", today);
      await setDoc(ref, {
        userId: user.uid,
        dayNumber: newDayNumber,
        markedAt: serverTimestamp(),
        totalSubmissions: 0,
        successfulSubmissions: 0,
        failedSubmissions: 0,
        questionsSolved: 0,
        timeSpentSeconds: 0,
      });

      // Increment the project's activeDays counter
      const projectRef = doc(firestore, "projects", projectId);
      await updateDoc(projectRef, {
        activeDays: increment(1),
      });

      setActiveDays(newDayNumber);
      localStorage.setItem(localKey, "1");
      setShow(false);
    } catch (err) {
      console.error("Error marking attendance:", err);
    } finally {
      setMarking(false);
    }
  };

  const message = MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
  const isCompleted = totalDuration > 0 && activeDays >= totalDuration;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-md mx-4 rounded-2xl border border-border/60 bg-card p-8 shadow-2xl"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="text-center">
              <div className="mx-auto mb-5 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4">
                {isCompleted ? (
                  <Trophy className="h-10 w-10 text-amber-400" />
                ) : (
                  <CalendarCheck className="h-10 w-10 text-primary" />
                )}
              </div>

              {isCompleted ? (
                <>
                  <h2 className="text-2xl font-bold mb-2">🎉 Project Complete!</h2>
                  <p className="text-muted-foreground text-sm mb-4">
                    You&apos;ve completed all {totalDuration} days! Amazing dedication.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-2">Mark Your Attendance</h2>
                  <p className="text-muted-foreground text-sm mb-4">{message}</p>
                </>
              )}

              {/* Progress indicator */}
              {totalDuration > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2 text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-400" />
                      Day {Math.min(activeDays + 1, totalDuration)} of {totalDuration}
                    </span>
                    <span className="font-medium text-primary">
                      {Math.round((activeDays / totalDuration) * 100)}% done
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${isCompleted ? 'bg-amber-400' : 'bg-primary'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.round((activeDays / totalDuration) * 100))}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {activeDays} active day{activeDays !== 1 ? 's' : ''} completed — only days you code count!
                  </p>
                </div>
              )}

              {!isCompleted && (
                <Button
                  onClick={handleMarkAttendance}
                  disabled={marking}
                  className="w-full gap-2 py-5 text-base shadow-lg shadow-primary/20"
                >
                  {marking ? (
                    <>Marking...</>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      I&apos;m Here — Let&apos;s Code!
                    </>
                  )}
                </Button>
              )}

              {isCompleted && (
                <Button
                  onClick={() => { setShow(false); localStorage.setItem(localKey, "1"); }}
                  className="w-full gap-2 py-5 text-base"
                  variant="outline"
                >
                  Continue Practicing
                </Button>
              )}

              <button
                onClick={() => setShow(false)}
                className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Remind me later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
