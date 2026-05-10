import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { detectLang, langDir } from "@/lib/detectLang";

interface Props {
  items: string[];
  active: boolean;
}

const ResearchNarration = ({ items, active }: Props) => {
  if (!items || items.length === 0) {
    if (!active) return null;
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
        <span>…</span>
      </div>
    );
  }
  const dir = langDir(detectLang(items.join(" ")));
  return (
    <div dir={dir} className="space-y-2 mb-3">
      <AnimatePresence initial={false}>
        {items.map((text, i) => {
          const isLast = i === items.length - 1;
          return (
            <motion.div
              key={`${i}-${text.slice(0, 24)}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-start gap-2.5"
            >
              <span className="mt-1 inline-flex w-5 h-5 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 shrink-0">
                <Sparkles className="w-3 h-3" />
              </span>
              <p className="text-[14px] leading-relaxed text-foreground/90 flex-1">
                {text}
                {isLast && active && (
                  <Loader2 className="inline-block w-3.5 h-3.5 ms-2 animate-spin text-violet-500 align-middle" />
                )}
              </p>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ResearchNarration;
