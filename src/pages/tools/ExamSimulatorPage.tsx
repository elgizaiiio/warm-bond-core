import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, ChevronRight, ChevronLeft, Flag, Check, X, RotateCcw, Target, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AppLayout from "@/layouts/AppLayout";

const spring = { type: "spring" as const, damping: 22, stiffness: 350 };

interface ExamQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

type Difficulty = "easy" | "medium" | "hard" | "mixed";
type ExamState = "setup" | "exam" | "results";

const ExamSimulatorPage = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<ExamState>("setup");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("mixed");
  const [questionCount, setQuestionCount] = useState(10);
  const [duration, setDuration] = useState(15);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const generateExam = useCallback(async () => {
    if (!subject.trim()) { toast.error("Please enter a subject"); return; }
    setIsGenerating(true);

    const systemPrompt = `You are an exam generator AI. Generate exactly ${questionCount} multiple-choice questions about "${subject}"${topic ? ` specifically on "${topic}"` : ""}.
Difficulty: ${difficulty}. Mix question types to test understanding, not memorization.

IMPORTANT: Respond ONLY with a valid JSON array. No text before or after.
Each item: {"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}
correct is 0-indexed. Make explanations educational and clear.
Respond in the same language as the subject.`;

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Generate ${questionCount} exam questions about ${subject}` }],
          model: "google/gemini-2.5-flash-lite-preview-09-2025",
          mode: "chat",
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let result = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) result += delta;
          } catch {}
        }
      }

      // Parse JSON from response
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No valid JSON");
      const parsed = JSON.parse(jsonMatch[0]) as ExamQuestion[];
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Empty");

      setQuestions(parsed);
      setAnswers(new Array(parsed.length).fill(null));
      setMarked(new Set());
      setCurrentQ(0);
      setTimeLeft(duration * 60);
      setState("exam");
    } catch {
      toast.error("Failed to generate exam. Try again.");
    }

    setIsGenerating(false);
  }, [subject, topic, difficulty, questionCount, duration]);

  // Timer (proper useEffect — useState was a typo causing the timer to never run)
  useEffect(() => {
    if (state !== "exam") return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); setState("results"); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

  const selectAnswer = (idx: number) => {
    setAnswers(prev => { const n = [...prev]; n[currentQ] = idx; return n; });
  };

  const toggleMark = () => {
    setMarked(prev => { const n = new Set(prev); if (n.has(currentQ)) n.delete(currentQ); else n.add(currentQ); return n; });
  };

  const finishExam = () => setState("results");

  const correctCount = answers.filter((a, i) => a === questions[i]?.correct).length;
  const percentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const grade = percentage >= 90 ? "Excellent" : percentage >= 70 ? "Good" : percentage >= 50 ? "Average" : "Needs Improvement";
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <AppLayout>
      <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3">
          <motion.button whileTap={{ scale: 0.9 }} transition={spring} onClick={() => state === "exam" ? setState("setup") : navigate("/chat")} className="w-9 h-9 rounded-full liquid-glass-button flex items-center justify-center text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
          <h1 className="text-base font-semibold text-foreground">Exam Simulator</h1>
          {state === "exam" && (
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass-pill text-xs font-mono text-foreground">
              <Clock className="w-3 h-3" /> {formatTime(timeLeft)}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-4">
          <AnimatePresence mode="wait">
            {state === "setup" && (
              <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-md mx-auto py-8 space-y-6">
                <div className="text-center mb-8">
                  <h2 className="font-display text-3xl font-black tracking-tight mb-2">
                    <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Test Your Knowledge</span>
                  </h2>
                  <p className="text-muted-foreground/60 text-sm">AI-powered exams that adapt to your level</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subject *</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Mathematics, Biology, History..." className="w-full h-12 rounded-2xl liquid-glass px-4 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Topic (optional)</label>
                    <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Algebra, Cell Division..." className="w-full h-12 rounded-2xl liquid-glass px-4 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none" />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Difficulty</label>
                    <div className="flex gap-2">
                      {(["easy", "medium", "hard", "mixed"] as Difficulty[]).map(d => (
                        <motion.button key={d} whileTap={{ scale: 0.95 }} onClick={() => setDifficulty(d)} className={`flex-1 py-2.5 rounded-xl text-xs font-medium capitalize transition-all ${difficulty === d ? "bg-primary text-primary-foreground" : "liquid-glass-button text-foreground/70"}`}>{d}</motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Questions</label>
                      <div className="flex gap-2">
                        {[10, 20, 30].map(n => (
                          <motion.button key={n} whileTap={{ scale: 0.95 }} onClick={() => setQuestionCount(n)} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${questionCount === n ? "bg-primary text-primary-foreground" : "liquid-glass-button text-foreground/70"}`}>{n}</motion.button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Minutes</label>
                      <div className="flex gap-2">
                        {[10, 15, 30].map(n => (
                          <motion.button key={n} whileTap={{ scale: 0.95 }} onClick={() => setDuration(n)} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${duration === n ? "bg-primary text-primary-foreground" : "liquid-glass-button text-foreground/70"}`}>{n}</motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <motion.button whileTap={{ scale: 0.95 }} transition={spring} onClick={generateExam} disabled={isGenerating || !subject.trim()} className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-30 shadow-lg shadow-primary/20">
                  {isGenerating ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Generating...</span> : "Start Exam"}
                </motion.button>
              </motion.div>
            )}

            {state === "exam" && questions.length > 0 && (
              <motion.div key="exam" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-lg mx-auto py-6 space-y-6">
                {/* Progress */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <motion.div animate={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} className="h-full bg-primary rounded-full" transition={spring} />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{currentQ + 1}/{questions.length}</span>
                </div>

                {/* Question */}
                <div className="liquid-glass rounded-3xl p-6 space-y-5">
                  <p className="text-base font-semibold text-foreground leading-relaxed">{questions[currentQ].question}</p>
                  <div className="space-y-2.5">
                    {questions[currentQ].options.map((opt, idx) => (
                      <motion.button key={idx} whileTap={{ scale: 0.97 }} transition={spring} onClick={() => selectAnswer(idx)} className={`w-full text-left px-4 py-3.5 rounded-2xl text-sm transition-all ${answers[currentQ] === idx ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "liquid-glass-button text-foreground/80 hover:text-foreground"}`}>
                        <span className="font-medium mr-2 opacity-50">{String.fromCharCode(65 + idx)}.</span> {opt}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-3">
                  <motion.button whileTap={{ scale: 0.9 }} disabled={currentQ === 0} onClick={() => setCurrentQ(prev => prev - 1)} className="w-10 h-10 rounded-full liquid-glass-button flex items-center justify-center disabled:opacity-20">
                    <ChevronLeft className="w-4 h-4" />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={toggleMark} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium ${marked.has(currentQ) ? "bg-amber-500/20 text-amber-400" : "liquid-glass-button text-muted-foreground"}`}>
                    <Flag className="w-3 h-3" /> {marked.has(currentQ) ? "Marked" : "Mark"}
                  </motion.button>
                  <div className="flex-1" />
                  {currentQ < questions.length - 1 ? (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setCurrentQ(prev => prev + 1)} className="w-10 h-10 rounded-full liquid-glass-button flex items-center justify-center">
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  ) : (
                    <motion.button whileTap={{ scale: 0.95 }} onClick={finishExam} className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      Finish
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}

            {state === "results" && (
              <motion.div key="results" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-lg mx-auto py-8 space-y-6">
                {/* Score */}
                <div className="text-center liquid-glass rounded-3xl p-8">
                  <div className="text-6xl font-black text-foreground mb-1">{percentage}%</div>
                  <p className={`text-sm font-semibold ${percentage >= 70 ? "text-emerald-400" : percentage >= 50 ? "text-amber-400" : "text-red-400"}`}>{grade}</p>
                  <p className="text-xs text-muted-foreground mt-2">{correctCount} of {questions.length} correct</p>
                </div>

                {/* Review */}
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground/50 font-medium">Review</p>
                  {questions.map((q, i) => {
                    const isCorrect = answers[i] === q.correct;
                    return (
                      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.03 }} className={`rounded-2xl p-4 ${isCorrect ? "liquid-glass-subtle" : "border border-red-500/20 bg-red-500/5"}`}>
                        <div className="flex items-start gap-2 mb-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isCorrect ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                            {isCorrect ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          </div>
                          <p className="text-sm text-foreground font-medium">{q.question}</p>
                        </div>
                        {!isCorrect && (
                          <div className="ml-7 space-y-1">
                            <p className="text-xs text-red-400">Your answer: {q.options[answers[i] ?? 0]}</p>
                            <p className="text-xs text-emerald-400">Correct: {q.options[q.correct]}</p>
                            <p className="text-xs text-muted-foreground mt-1">{q.explanation}</p>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setState("setup"); setQuestions([]); }} className="flex-1 py-3 rounded-2xl liquid-glass-button text-sm font-medium text-foreground/70">
                    <RotateCcw className="w-4 h-4 inline mr-1.5" /> New Exam
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setAnswers(new Array(questions.length).fill(null)); setCurrentQ(0); setTimeLeft(duration * 60); setState("exam"); }} className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold">
                    Retake
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

export default ExamSimulatorPage;
