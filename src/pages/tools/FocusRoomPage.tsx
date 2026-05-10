import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Pause, RotateCcw, Check, Coffee, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";

const spring = { type: "spring" as const, damping: 22, stiffness: 350 };

type FocusState = "setup" | "focus" | "break" | "done";

const MOTIVATIONAL_MESSAGES = [
  "Stay focused, you're doing great",
  "One step at a time",
  "Deep work leads to deep results",
  "Keep going, almost there",
  "Your future self will thank you",
  "Focus is your superpower",
];

const FocusRoomPage = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<FocusState>("setup");
  const [taskName, setTaskName] = useState("");
  const [duration, setDuration] = useState(25);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [totalFocusTime, setTotalFocusTime] = useState(0);
  const [motivMsg, setMotivMsg] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state !== "focus" && state !== "break") return;
    if (isPaused) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (state === "focus") {
            setSessionsCompleted(p => p + 1);
            setTotalFocusTime(p => p + duration);
            setState("done");
          } else {
            setState("setup");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state, isPaused, duration]);

  // Motivational messages every 10 min
  useEffect(() => {
    if (state !== "focus") return;
    const elapsed = duration * 60 - timeLeft;
    if (elapsed > 0 && elapsed % 600 === 0) {
      setMotivMsg(MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)]);
      setTimeout(() => setMotivMsg(""), 5000);
    }
  }, [timeLeft, state, duration]);

  const startFocus = () => {
    setTimeLeft(duration * 60);
    setIsPaused(false);
    setState("focus");
  };

  const startBreak = () => {
    setTimeLeft(5 * 60);
    setIsPaused(false);
    setState("break");
  };

  const togglePause = () => setIsPaused(p => !p);

  const endSession = () => {
    if (state === "focus") {
      const elapsed = duration * 60 - timeLeft;
      if (elapsed > 60) {
        setTotalFocusTime(p => p + Math.floor(elapsed / 60));
        setSessionsCompleted(p => p + 1);
      }
    }
    setState("setup");
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = state === "focus" ? 1 - timeLeft / (duration * 60) : state === "break" ? 1 - timeLeft / 300 : 0;
  const circumference = 2 * Math.PI * 120;

  return (
    <AppLayout>
      <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3">
          <motion.button whileTap={{ scale: 0.9 }} transition={spring} onClick={() => { if (state === "focus") { if (confirm("End focus session?")) endSession(); } else navigate("/chat"); }} className="w-9 h-9 rounded-full liquid-glass-button flex items-center justify-center text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
          <h1 className="text-base font-semibold text-foreground">Focus Room</h1>
          {(sessionsCompleted > 0 || totalFocusTime > 0) && (
            <span className="ml-auto text-xs text-muted-foreground">{sessionsCompleted} sessions - {totalFocusTime}min</span>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center px-6">
          <AnimatePresence mode="wait">
            {state === "setup" && (
              <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-sm w-full space-y-8 text-center">
                <div>
                  <h2 className="font-display text-3xl font-black tracking-tight mb-2">
                    <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">Deep Focus</span>
                  </h2>
                  <p className="text-muted-foreground/60 text-sm">Eliminate distractions. One task at a time.</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block text-left">Task</label>
                  <input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="What are you working on?" className="w-full h-12 rounded-2xl liquid-glass px-4 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block text-left">Duration</label>
                  <div className="flex gap-2">
                    {[15, 25, 30, 45, 60].map(d => (
                      <motion.button key={d} whileTap={{ scale: 0.95 }} onClick={() => setDuration(d)} className={`flex-1 py-3 rounded-xl text-xs font-medium transition-all ${duration === d ? "bg-primary text-primary-foreground" : "liquid-glass-button text-foreground/70"}`}>{d}m</motion.button>
                    ))}
                  </div>
                </div>

                <motion.button whileTap={{ scale: 0.95 }} transition={spring} onClick={startFocus} className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/20">
                  <Play className="w-4 h-4 inline mr-2" /> Start Focus
                </motion.button>
              </motion.div>
            )}

            {(state === "focus" || state === "break") && (
              <motion.div key="timer" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center space-y-8">
                {taskName && (
                  <p className="text-sm text-muted-foreground/70 font-medium">{taskName}</p>
                )}

                {/* Circular timer */}
                <div className="relative w-64 h-64 mx-auto">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
                    <circle cx="130" cy="130" r="120" fill="none" stroke="currentColor" strokeWidth="3" className="text-border/20" />
                    <motion.circle cx="130" cy="130" r="120" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className={state === "focus" ? "text-primary" : "text-emerald-400"} strokeDasharray={circumference} animate={{ strokeDashoffset: circumference * (1 - progress) }} transition={{ duration: 0.5 }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-mono font-bold text-foreground tracking-tight">{formatTime(timeLeft)}</span>
                    <span className="text-xs text-muted-foreground mt-1">{state === "focus" ? "Focus" : "Break"}</span>
                  </div>
                </div>

                <AnimatePresence>
                  {motivMsg && (
                    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-primary/80 font-medium">{motivMsg}</motion.p>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-center gap-4">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={endSession} className="w-12 h-12 rounded-full liquid-glass-button flex items-center justify-center text-muted-foreground hover:text-foreground">
                    <RotateCcw className="w-5 h-5" />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={togglePause} className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30">
                    {isPaused ? <Play className="w-6 h-6 ml-0.5" /> : <Pause className="w-6 h-6" />}
                  </motion.button>
                  <div className="w-12" />
                </div>
              </motion.div>
            )}

            {state === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6 max-w-sm w-full">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.2 }} className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-10 h-10 text-emerald-400" />
                </motion.div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-1">Session Complete</h3>
                  <p className="text-sm text-muted-foreground">{duration} minutes of focused work</p>
                  {taskName && <p className="text-xs text-muted-foreground/60 mt-1">{taskName}</p>}
                </div>

                <div className="flex gap-3">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={startBreak} className="flex-1 py-3.5 rounded-2xl liquid-glass-button text-sm font-medium text-foreground/70">
                    <Coffee className="w-4 h-4 inline mr-1.5" /> 5min Break
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={startFocus} className="flex-1 py-3.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold">
                    <Zap className="w-4 h-4 inline mr-1.5" /> Next Session
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
};

export default FocusRoomPage;
