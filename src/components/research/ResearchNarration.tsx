import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { detectLang, langDir } from "@/lib/detectLang";
import MegsyStar from "@/components/files/MegsyStar";

interface Props {
  items: string[];
  active: boolean;
}

const ResearchNarration = ({ items, active }: Props) => {
  const visible = (items || []).filter((t) => (t || "").trim().length > 0 || active);
  if (visible.length === 0 && !active) return null;

  if (visible.length === 0 && active) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <MegsyStar size={14} />
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
      </div>
    );
  }

  const dir = langDir(detectLang(items.join(" ")));
  return (
    <div dir={dir} className="space-y-2.5 mb-3">
      <AnimatePresence initial={false}>
        {items.map((text, i) => {
          const isLast = i === items.length - 1;
          const isEmpty = !text || text.trim().length === 0;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-start gap-2.5"
            >
              <span className="mt-1 inline-flex items-center justify-center shrink-0">
                <MegsyStar size={14} static={!(isLast && active)} />
              </span>
              <p className="text-[14px] leading-relaxed text-foreground/90 flex-1 break-words">
                {text}
                {isLast && active && (
                  isEmpty ? (
                    <Loader2 className="inline-block w-3.5 h-3.5 animate-spin text-primary align-middle" />
                  ) : (
                    <span className="inline-block w-[2px] h-[14px] bg-primary/70 align-middle ms-0.5 animate-pulse" />
                  )
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
