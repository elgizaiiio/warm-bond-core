import { motion, AnimatePresence } from "framer-motion";

type Mood = "idle" | "happy" | "encourage" | "celebrate" | "thinking";

const StudyBuddy = ({ mood = "idle" }: { mood?: Mood }) => {
  const face: Record<Mood, string> = {
    idle: "🦊",
    happy: "🥳",
    encourage: "🤗",
    celebrate: "🎉",
    thinking: "🤔",
  };
  return (
    <AnimatePresence>
      <motion.div
        key={mood}
        initial={{ scale: 0.6, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: [0, -4, 0] }}
        exit={{ scale: 0.6, opacity: 0 }}
        transition={{ y: { repeat: Infinity, duration: 2.4 }, scale: { duration: 0.3 } }}
        className="fixed bottom-32 right-3 z-30 w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-400/40 backdrop-blur-md flex items-center justify-center text-2xl shadow-lg pointer-events-none select-none"
      >
        {face[mood]}
      </motion.div>
    </AnimatePresence>
  );
};

export default StudyBuddy;
