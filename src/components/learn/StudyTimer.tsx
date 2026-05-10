import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, X, Coffee } from "lucide-react";

interface Props {
  durationMin: number;
  pomodoro?: boolean;
  onEnd?: () => void;
  onStop?: () => void;
}

const StudyTimer = ({ durationMin, pomodoro = true, onEnd, onStop }: Props) => {
  const [phase, setPhase] = useState<"study" | "break">("study");
  const [remaining, setRemaining] = useState(durationMin * 60);
  const [paused, setPaused] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1;
        // chime
        try {
          if (!audioRef.current) audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          const ctx = audioRef.current!;
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = phase === "study" ? 880 : 660;
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
          o.start(); o.stop(ctx.currentTime + 0.65);
        } catch {}

        if (pomodoro && phase === "study") {
          setPhase("break");
          return 5 * 60;
        }
        if (pomodoro && phase === "break") {
          setPhase("study");
          return durationMin * 60;
        }
        clearInterval(t);
        onEnd?.();
        return 0;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [paused, phase, durationMin, pomodoro, onEnd]);

  const min = String(Math.floor(remaining / 60)).padStart(2, "0");
  const sec = String(remaining % 60).padStart(2, "0");
  const pct = phase === "study"
    ? 1 - remaining / (durationMin * 60)
    : 1 - remaining / (5 * 60);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={`mx-auto max-w-3xl flex items-center gap-3 px-4 py-2.5 rounded-2xl backdrop-blur-md border ${
        phase === "study"
          ? "bg-emerald-500/10 border-emerald-400/30"
          : "bg-amber-500/10 border-amber-400/30"
      }`}
    >
      <div className="relative w-9 h-9 shrink-0">
        <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2.5" className={phase === "study" ? "text-emerald-400/20" : "text-amber-400/20"} />
          <circle
            cx="18" cy="18" r="15" fill="none" strokeWidth="2.5" strokeLinecap="round"
            className={phase === "study" ? "text-emerald-300" : "text-amber-300"}
            stroke="currentColor"
            strokeDasharray={`${2 * Math.PI * 15}`}
            strokeDashoffset={`${2 * Math.PI * 15 * (1 - pct)}`}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {phase === "break" ? <Coffee className="w-4 h-4 text-amber-300" /> : <span className="text-[9px] font-bold text-emerald-300">📚</span>}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {phase === "study" ? "وقت المذاكرة" : "وقت الراحة"}
        </div>
        <div className={`font-mono text-lg font-bold leading-none ${phase === "study" ? "text-emerald-100" : "text-amber-100"}`}>
          {min}:{sec}
        </div>
      </div>
      <button
        onClick={() => setPaused((p) => !p)}
        className="p-2 rounded-lg hover:bg-foreground/10 text-foreground/70"
        aria-label={paused ? "استئناف" : "إيقاف مؤقت"}
      >
        {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
      </button>
      <button
        onClick={onStop}
        className="p-2 rounded-lg hover:bg-foreground/10 text-foreground/70"
        aria-label="إنهاء"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

export default StudyTimer;
