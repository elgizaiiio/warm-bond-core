import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play, X, Timer as TimerIcon } from "lucide-react";

interface Props {
  id: string;
  totalSec: number;
  startedAt: number;
  paused: boolean;
  pausedRemaining: number | null;
  onPauseToggle: (id: string) => void;
  onCancel: (id: string) => void;
}

const fmt = (s: number) => {
  const m = Math.max(0, Math.floor(s / 60));
  const ss = Math.max(0, Math.floor(s % 60));
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
};

const InChatTimerCard = ({ id, totalSec, startedAt, paused, pausedRemaining, onPauseToggle, onCancel }: Props) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paused]);

  const remaining = paused
    ? pausedRemaining ?? totalSec
    : Math.max(0, totalSec - Math.floor((now - startedAt) / 1000));
  const done = remaining === 0;
  const pct = totalSec > 0 ? ((totalSec - remaining) / totalSec) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="my-3 mx-auto w-full max-w-sm rounded-3xl liquid-glass-milk p-4 border border-emerald-500/20"
    >
      <div className="flex items-center gap-3">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500/15" />
            <circle
              cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeDasharray={`${pct}, 100`}
              strokeLinecap="round"
              className="text-emerald-500 transition-all"
            />
          </svg>
          <TimerIcon className="absolute inset-0 m-auto w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-emerald-700/80 dark:text-emerald-400/80 font-semibold">
            {done ? "Session complete" : paused ? "Paused" : "Focus session"}
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {done ? "🎉 Done!" : fmt(remaining)}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!done && (
            <button
              onClick={() => onPauseToggle(id)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors"
              aria-label={paused ? "Resume" : "Pause"}
            >
              {paused ? <Play className="w-4 h-4" fill="currentColor" /> : <Pause className="w-4 h-4" fill="currentColor" />}
            </button>
          )}
          <button
            onClick={() => onCancel(id)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-accent/40 text-foreground/70"
            aria-label="Dismiss timer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default InChatTimerCard;
