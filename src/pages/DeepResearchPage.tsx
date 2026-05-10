import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Menu, Plus, X, ArrowUp, Square, Image as ImageIcon, FileUp, Camera,
  ChevronDown, Share2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";
import AppLayout from "@/layouts/AppLayout";
import { streamChat } from "@/lib/streamChat";
import { saveConversation } from "@/lib/conversationPersistence";
import { saveResearch } from "@/lib/researchPersistence";
import { getModeDescription } from "@/lib/modeDescriptions";
import LiveResearchActivity from "@/components/research/LiveResearchActivity";
import { extractUrls } from "@/components/research/templateUtils";

const ChatThinkingStar = ({ active }: { active: boolean }) => (
  <motion.svg
    width="14" height="14" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
    animate={active ? { rotate: [0, 180, 360], scale: [1, 1.1, 1] } : { rotate: 0, scale: 1 }}
    transition={active ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
  >
    <path d="M50 5 L60 40 L95 50 L60 60 L50 95 L40 60 L5 50 L40 40 Z" fill="currentColor" />
  </motion.svg>
);

interface TimelineStep {
  id: string;
  label: string;
  detail: string;
  status: "active" | "done";
  ts: number;
  topics?: string[];
  kind?: "plan" | "search" | "analyze" | "images" | "compare" | "write" | "generic";
}

interface ResearchSession {
  id: string;
  query: string;
  steps: TimelineStep[];
  images: string[];
  report: string;
  summary: string;
  expandedStep: string | null;
  // Live activity fields
  plan: string[];
  searches: string[];
  sources: { url: string; title?: string }[];
  startedAt: number;
  isLive: boolean;
}

const RESEARCH_PROMPT = [
  "You are a Deep Research agent. Reply in the user's EXACT language and dialect.",
  "Output ONLY a large, premium, well-structured FINAL REPORT in valid Markdown. No preface. No greetings. No AI self-references. No internal thinking. No tool names. No raw search results.",
  "STRICT RULES:",
  "- NEVER insert inline images (no ![]() and no <img>). Images are shown separately by the UI.",
  "- NEVER ask the user a follow-up question at the end.",
  "- NEVER expose 'Sources', 'Citations', URLs lists or tool names at the end.",
  "- Use proper Markdown: # for the title, ## for sections, ### for subsections.",
  "- Use - bullets for lists, and standard | --- | tables for comparisons.",
  "- Make the report feel like a programmed research document: use `inline code` for important terms, **bold highlights** for key claims, blockquotes for insights, and tables for structured comparisons.",
  "- Use at least 8 substantial sections for broad topics. Each main section must contain 2-4 useful paragraphs plus bullets or a table where helpful.",
  "- Target a rich report, not a short answer: normally 1,800-3,000 words unless the user's topic is tiny.",
  "- Do not keep content generic. Include numbers, tradeoffs, timelines, examples, risks, opportunities, and practical takeaways when relevant.",
  "- Always leave a blank line BEFORE and AFTER every heading, list, and table.",
  "REQUIRED STRUCTURE (translate the section titles to the user's language — Arabic if the user wrote Arabic, English if English):",
  "# {Concise Title}",
  "",
  "## Executive Summary / الملخص التنفيذي",
  "4-6 sentence overview with **bold** key points.",
  "",
  "## Key Findings / أهم النتائج",
  "- 6-10 deep bullets, each with a bold lead phrase.",
  "",
  "## Research Map / خريطة البحث",
  "A table or bullet map of the main dimensions investigated.",
  "",
  "## Details / التفاصيل المتعمقة",
  "### subsection",
  "multiple paragraphs, bullets, and insight blockquotes.",
  "",
  "## Comparison / مقارنة (only if relevant)",
  "| Column | Column |",
  "| --- | --- |",
  "| ... | ... |",
  "",
  "## Risks & Open Questions / المخاطر والأسئلة المفتوحة",
  "Specific risks, uncertainties, and what needs verification.",
  "",
  "## Practical Takeaways / خطوات عملية",
  "Clear actionable takeaways.",
  "",
  "## Conclusion / الخلاصة",
  "Final takeaway in 4-6 strong sentences.",
].join("\n");

// Realistic, varied search status messages — show the agent is actually working
const buildStatusFromQuery = (query: string, phase: number): { label: string; detail: string } => {
  const q = query.length > 30 ? query.slice(0, 30) + "…" : query;
  const phases = [
    { label: "Searching the web", detail: `Looking up "${q}" and opening the strongest sources.` },
    { label: "Analyzing sources", detail: "Reading detailed sources and extracting the most useful facts." },
    { label: "Collecting images", detail: `Gathering the best relevant visuals for "${q}".` },
    { label: "Comparing information", detail: "Cross-checking details across multiple sources for accuracy." },
    { label: "Writing the report", detail: "Organizing the findings into a polished final report." },
  ];
  return phases[Math.min(phase, phases.length - 1)];
};

const labelFromStatus = (s: string): string => {
  const l = s.toLowerCase();
  if (/search|gathering|browsing|opening|navigat|بحث/i.test(l)) return "Searching the web";
  if (/analyz|reviewing|reading|تحليل/i.test(l)) return "Analyzing sources";
  if (/image|صور/i.test(l)) return "Collecting images";
  if (/compar|مقارنة/i.test(l)) return "Comparing information";
  if (/writing|summar|report|composing|كتابة/i.test(l)) return "Writing the report";
  return "Working";
};

const DeepResearchPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; type: string; data: string }[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Auto-scroll only when the user just sent a message — let the user scroll freely otherwise.
  const userJustSentRef = useRef(false);
  useEffect(() => {
    if (userJustSentRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      userJustSentRef.current = false;
    }
  }, [sessions.length]);

  useEffect(() => {
    if (!plusOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (plusMenuRef.current?.contains(target) || plusButtonRef.current?.contains(target)) return;
      setPlusOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [plusOpen]);

  // Load a previous conversation from the sidebar (mirrors ChatPage behavior).
  const loadConversation = useCallback(async (cid: string) => {
    setConversationId(cid);
    const { data: msgs } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", cid)
      .order("created_at", { ascending: true });
    if (!msgs?.length) return;

    // Fetch all persisted research reports for this user so we can hydrate images per query
    const { data: { user } } = await supabase.auth.getUser();
    let reportsByQuery = new Map<string, { session_key: string; report: string; images: string[]; steps: any[] }>();
    if (user) {
      const { data: reports } = await supabase
        .from("research_reports")
        .select("session_key, query, report, images, steps")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (reports) {
        for (const r of reports) {
          if (reportsByQuery.has(r.query)) continue;
          reportsByQuery.set(r.query, {
            session_key: r.session_key,
            report: r.report,
            images: (r.images as any) || [],
            steps: (r.steps as any) || [],
          });
        }
      }
    }

    const restored: ResearchSession[] = [];
    for (let i = 0; i < msgs.length; i += 2) {
      const u = msgs[i];
      const a = msgs[i + 1];
      if (u?.role !== "user" || !a) continue;
      const persisted = reportsByQuery.get(u.content);
      const reportText = persisted?.report || a.content;
      restored.push({
        id: persisted?.session_key || `dr-${cid}-${i}`,
        query: u.content,
        report: reportText,
        summary: reportText.slice(0, 240).replace(/[#*`>|]/g, "").trim(),
        images: persisted?.images ?? [],
        steps: persisted?.steps ?? [],
        expandedStep: null,
        plan: [],
        searches: [],
        sources: extractUrls(reportText).map((url) => ({ url })),
        startedAt: 0,
        isLive: false,
      });
    }
    setSessions(restored);
  }, []);

  // If we arrived here from another page (e.g. /chat sidebar) with a conversation id,
  // hydrate that research session immediately so the user lands inside the report.
  useEffect(() => {
    const cid = (location.state as any)?.loadConversationId as string | undefined;
    if (cid && cid !== conversationId) {
      void loadConversation(cid);
      // clear the state so refresh doesn't reload it
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const handleFile = useCallback((files: FileList | null, kind: "image" | "file") => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name} > 20MB`); return; }
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFiles((prev) => [...prev, { name: f.name, type: kind === "image" ? "image" : "file", data: reader.result as string }]);
      };
      reader.readAsDataURL(f);
    });
    setPlusOpen(false);
  }, []);

  const updateLastSession = (fn: (s: ResearchSession) => ResearchSession) => {
    setSessions((arr) => {
      const copy = [...arr];
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });
  };

  const send = useCallback(async () => {
    if (!input.trim()) return;
    if (isLoading) return;

    const sid = `dr-${Date.now()}`;
    const newSession: ResearchSession = {
      id: sid, query: input.trim(), steps: [], images: [], report: "", summary: "", expandedStep: null,
      plan: [], searches: [], sources: [], startedAt: Date.now(), isLive: true,
    };
    setSessions((s) => [...s, newSession]);
    userJustSentRef.current = true;
    const sentInput = input;
    setInput("");
    setIsLoading(true);

    const ac = new AbortController();
    abortRef.current = ac;

    const apiMessages = [
      { role: "assistant" as const, content: RESEARCH_PROMPT },
      { role: "user" as const, content: sentInput },
    ];

    let reportBuf = "";
    let liveImages: string[] = [];
    let liveSteps: TimelineStep[] = [];
    const seenSources = new Set<string>();

    const addSourcesFromText = (text: string) => {
      const urls = extractUrls(text);
      if (!urls.length) return;
      const fresh = urls.filter((u) => !seenSources.has(u));
      if (!fresh.length) return;
      fresh.forEach((u) => seenSources.add(u));
      updateLastSession((s) => ({
        ...s,
        sources: [...s.sources, ...fresh.map((url) => ({ url }))],
      }));
    };

    await streamChat({
      messages: apiMessages as any,
      model: "moonshotai/kimi-k2.5:nitro",
      chatMode: "deep-research",
      deepResearch: true,
      searchEnabled: true,
      user_id: userId ?? undefined,
      signal: ac.signal,
      onStatus: (st) => {
        // Real status text from backend — extract any URLs as sources
        addSourcesFromText(st);
      },
      onEvent: (ev) => {
        if (ev.event === "plan" && Array.isArray(ev.queries) && ev.queries.length) {
          updateLastSession((s) => ({ ...s, plan: ev.queries.slice(0, 12) }));
        }
        if (ev.event === "search_query" && typeof ev.query === "string") {
          updateLastSession((s) => (
            s.searches.includes(ev.query) ? s : { ...s, searches: [...s.searches, ev.query] }
          ));
        }
        if (ev.event === "source" && typeof ev.url === "string" && !seenSources.has(ev.url)) {
          seenSources.add(ev.url);
          updateLastSession((s) => ({
            ...s,
            sources: [...s.sources, { url: ev.url, title: ev.title }],
          }));
        }
      },
      onImages: (imgs) => {
        liveImages = imgs.slice(0, 20);
        updateLastSession((s) => ({ ...s, images: imgs.slice(0, 20) }));
      },
      onDelta: (d) => {
        reportBuf += d;
        updateLastSession((s) => ({ ...s, report: reportBuf }));
      },
      onDone: async () => {
        let finalSession: ResearchSession | null = null;
        // Also fold any URLs found in the final report text into sources.
        const finalUrls = extractUrls(reportBuf);
        updateLastSession((s) => {
          const merged = [...s.sources];
          for (const u of finalUrls) {
            if (!merged.some((x) => x.url === u)) merged.push({ url: u });
          }
          const updated: ResearchSession = {
            ...s,
            sources: merged,
            isLive: false,
            steps: s.steps.map((x) => ({ ...x, status: "done" as const })),
          };
          liveSteps = updated.steps;
          finalSession = updated;
          return updated;
        });
        setIsLoading(false);
        abortRef.current = null;

        // Generate a short AI summary for the report card (one short sentence in the user's language).
        let summaryText = "";
        try {
          await streamChat({
            messages: [
              { role: "assistant", content: "Write ONE single concise sentence (max 22 words) summarizing the report below. Reply in the user's exact language. No prefix, no headings, no quotes." },
              { role: "user", content: reportBuf.slice(0, 2400) },
            ] as any,
            model: "google/gemini-2.5-flash-lite-preview-09-2025",
            chatMode: "chat",
            user_id: userId ?? undefined,
            onDelta: (d) => { summaryText += d; },
            onDone: () => {},
            onError: () => {},
          });
        } catch { /* non-blocking */ }
        const cleanSummary = summaryText.replace(/[#*`>]/g, "").trim() || reportBuf.slice(0, 180).replace(/[#*`>|]/g, "").trim();
        updateLastSession((s) => ({ ...s, summary: cleanSummary }));

        const effectiveUserId = userId || (await supabase.auth.getUser()).data.user?.id || null;
        if (effectiveUserId && reportBuf) {
          const cid = await saveConversation({
            conversationId, userId: effectiveUserId, mode: "research",
            title: sentInput.slice(0, 60),
            messages: [
              { role: "user", content: sentInput },
              { role: "assistant", content: reportBuf },
            ],
          });
          if (cid && !conversationId) setConversationId(cid);
          await saveResearch(effectiveUserId, {
            session_key: sid,
            query: sentInput,
            report: reportBuf,
            images: liveImages.length ? liveImages : (finalSession?.images ?? []),
            steps: liveSteps.length ? liveSteps : (finalSession?.steps ?? []),
          });
        }
      },
      onError: (e) => {
        updateLastSession((s) => ({ ...s, isLive: false }));
        toast.error(e); setIsLoading(false);
      },
    });
  }, [input, isLoading, userId, conversationId]);

  const stop = () => { abortRef.current?.abort(); setIsLoading(false); };

  const share = async (s: ResearchSession) => {
    if (navigator.share) {
      try { await navigator.share({ title: s.query, text: s.report.slice(0, 200) }); }
      catch { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(s.report);
      toast.success("Copied to clipboard");
    }
  };

  const openPreview = (s: ResearchSession) => {
    navigate(`/research/preview/${s.id}`, {
      state: {
        reportData: {
          query: s.query,
          report: s.report,
          images: s.images,
        },
      },
    });
  };

  const toggleStep = (sIdx: number, stepId: string) => {
    setSessions((arr) => {
      const copy = [...arr];
      copy[sIdx] = { ...copy[sIdx], expandedStep: copy[sIdx].expandedStep === stepId ? null : stepId };
      return copy;
    });
  };

  const hasResults = sessions.length > 0;

  // (outside-click handled via fixed backdrop overlay inside the menu)

  const startNewSession = useCallback(() => {
    setSessions([]);
    setConversationId(null);
    setInput("");
    setAttachedFiles([]);
  }, []);

  return (
    <AppLayout
      onSelectConversation={loadConversation}
      onNewChat={startNewSession}
      activeConversationId={conversationId}
    >
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={startNewSession}
        onSelectConversation={loadConversation}
        activeConversationId={conversationId}
        currentMode="research"
      />

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFile(e.target.files, "file")} />
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFile(e.target.files, "image")} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files, "image")} />

      <div className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-background">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-violet-500/20 blur-[120px] animate-pulse" />
          <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-indigo-500/15 blur-[140px] animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-blue-400/10 blur-[100px] animate-pulse" style={{ animationDelay: "2s" }} />
        </div>

        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-background/40 backdrop-blur-2xl hover:bg-background/60 transition"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>

        {!hasResults ? (
          <div className="relative z-10 mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-5 py-24 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="font-display text-2xl md:text-3xl font-bold text-foreground"
            >
              Research Deeply
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-2 text-sm font-medium text-muted-foreground"
            >
              {getModeDescription("research")}
            </motion.p>
          </div>
        ) : (
          <div className="relative z-10 mx-auto max-w-2xl px-4 pb-48 pt-20 space-y-8">
            {sessions.map((s, idx) => {
              const isLast = idx === sessions.length - 1;
              const isActive = isLast && isLoading;
              return (
                <div key={s.id} className="space-y-4">
                  {/* User query as plain text right-aligned */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-3xl bg-foreground/5 px-4 py-2.5 text-sm text-foreground">
                      {s.query}
                    </div>
                  </div>

                  {/* Live activity feed — real-time progress so the user never feels bored */}
                  {(isActive || s.plan.length > 0 || s.searches.length > 0 || s.sources.length > 0 || s.images.length > 0) && (
                    <LiveResearchActivity
                      isActive={isActive}
                      startedAt={s.startedAt || null}
                      plan={s.plan}
                      searches={s.searches}
                      sources={s.sources}
                      images={s.images}
                      wordCount={s.report ? s.report.split(/\s+/).filter(Boolean).length : 0}
                      isRtl={/[\u0600-\u06FF]/.test(s.query)}
                    />
                  )}

                  {/* Report card — title + AI summary, single Share button on the right */}
                  {s.report && (
                    <div className="relative rounded-3xl border border-foreground/10 bg-background/60 backdrop-blur-xl overflow-hidden">
                      <button
                        onClick={() => openPreview(s)}
                        className="block w-full p-4 text-left transition hover:bg-foreground/[0.03]"
                      >
                        <div className="pr-12">
                          <h3 className="text-sm font-semibold text-foreground truncate">{s.query}</h3>
                          <p className="mt-2 line-clamp-3 text-xs text-foreground/65 leading-relaxed">
                            {s.summary || (isActive ? "Generating summary…" : s.report.slice(0, 200).replace(/[#*`>|]/g, "").trim())}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); share(s); }}
                        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full hover:bg-foreground/10 transition"
                        title="Share"
                      >
                        <Share2 className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-4 pt-2 pointer-events-none">
          <div className="mx-auto max-w-3xl pointer-events-auto">
            <div className="relative rounded-[28px] border border-white/10 bg-background/50 p-2 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
              <div className="flex items-end gap-2">
                <div className="relative">
                  <button
                    ref={plusButtonRef}
                    onClick={(e) => { e.stopPropagation(); setPlusOpen((v) => !v); }}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10 ${plusOpen ? "rotate-45" : ""}`}
                  >
                    <Plus className="h-5 w-5 text-foreground" />
                  </button>
                  {plusOpen && (
                    <>
                      <div className="fixed inset-0 z-[60]" onMouseDown={() => setPlusOpen(false)} onTouchStart={() => setPlusOpen(false)} />
                      <motion.div
                        ref={plusMenuRef}
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.15 }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="absolute bottom-full mb-2 left-0 z-[61] w-72 rounded-3xl border border-white/10 bg-background/80 p-3 backdrop-blur-2xl shadow-2xl"
                      >
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { ref: cameraInputRef, icon: Camera, label: "Camera" },
                            { ref: imageInputRef, icon: ImageIcon, label: "Photos" },
                            { ref: fileInputRef, icon: FileUp, label: "Files" },
                          ].map(({ ref, icon: Icon, label }) => (
                            <button
                              key={label}
                              onClick={() => { ref.current?.click(); setPlusOpen(false); }}
                              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl hover:bg-white/5 active:scale-95 transition"
                            >
                              <Icon className="w-5 h-5 text-violet-400" />
                              <span className="text-[11px] text-foreground/80">{label}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </div>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="What do you want to research?"
                  rows={1}
                  className="flex-1 resize-none bg-transparent px-2 py-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60"
                  style={{ maxHeight: "140px" }}
                />

                {isLoading ? (
                  <button onClick={stop} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={send}
                    disabled={!input.trim()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg transition hover:scale-105 disabled:opacity-40"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DeepResearchPage;
