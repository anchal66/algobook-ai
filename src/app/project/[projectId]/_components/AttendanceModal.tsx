"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Flame, Sparkles } from "lucide-react";

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

  const today = new Date().toISOString().slice(0, 10);
  const localKey = `attendance_${projectId}_${today}`;

  useEffect(() => {
    if (authLoading || !user) return;

    // Fast local check
    if (localStorage.getItem(localKey)) return;

    // Check Firestore
    const checkAttendance = async () => {
      try {
        const ref = doc(firestore, "projects", projectId, "attendance", today);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          localStorage.setItem(localKey, "1");
        } else {
          setShow(true);
        }
      } catch (err) {
        console.error("Error checking attendance:", err);
      }
    };
    checkAttendance();
  }, [authLoading, user, projectId, today, localKey]);

  const handleMarkAttendance = async () => {
    if (!user) return;
    setMarking(true);
    try {
      const ref = doc(firestore, "projects", projectId, "attendance", today);
      await setDoc(ref, {
        userId: user.uid,
        markedAt: serverTimestamp(),
        questionsGenerated: 0,
        questionsSolved: 0,
        totalSubmissions: 0,
        successfulSubmissions: 0,
        failedSubmissions: 0,
        timeSpentSeconds: 0,
      });
      localStorage.setItem(localKey, "1");
      setShow(false);
    } catch (err) {
      console.error("Error marking attendance:", err);
    } finally {
      setMarking(false);
    }
  };

  const message = MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];

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
                <CalendarCheck className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Mark Your Attendance</h2>
              <p className="text-muted-foreground text-sm mb-4">
                {message}
              </p>
              <div className="flex items-center justify-center gap-2 mb-6 text-xs text-muted-foreground">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                <span>Track your daily progress and build streaks</span>
              </div>
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
