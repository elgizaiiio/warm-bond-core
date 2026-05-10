import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowUp, FileUp, Image as ImageIcon, Camera, Plus, Copy, FileText, HelpCircle, Layers, BookOpen, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AppLayout from "@/layouts/AppLayout";

const spring = { type: "spring" as const, damping: 22, stiffness: 350 };

interface NoteMessage {
  role: "user" | "assistant";
  content: string;
}

const ACTIONS = [
  { id: "summarize", label: "Summarize", icon: Layers },
  { id: "explain", label: "Explain Simply", icon: BookOpen },
  { id: "questions", label: "Generate Q&A", icon: HelpCircle },
  { id: "keypoints", label: "Key Points", icon: FileText },
];

const SmartNotesPage = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<NoteMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "keypoints" | "qa">("summary");
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; data: string; isImage: boolean }[]>([]);
  const [plusOpen, setPlusOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} too large`); return; }
      const reader = new FileReader();
      const isImage = file.type.startsWith("image/");
      reader.onload = () => {
        const data = reader.result as string;
        setAttachedFiles(prev => [...prev, {
          name: file.name,
          data: isImage ? data : data.slice(0, 30000),
          isImage,
        }]);
      };
      if (isImage) reader.readAsDataURL(file);
      else reader.readAsText(file);
    });
    e.target.value = "";
    setPlusOpen(false);
  };

  const handleSend = useCallback(async (actionOverride?: string) => {
    const text = input.trim();
    if (!text && attachedFiles.length === 0) return;

    const userPreview = text || `[${attachedFiles.length} file(s) attached]`;
    setMessages(prev => [...prev, { role: "user", content: userPreview }]);
    setInput("");
    const files = [...attachedFiles];
    setAttachedFiles([]);
    setIsLoading(true);

    const action = actionOverride || "summarize";
    const actionPrompts: Record<string, string> = {
      summarize: "Provide a comprehensive, well-structured summary. Use headers, bullet points, and clear sections. Make it thorough but easy to scan.",
      explain: "Explain the content in the simplest possible terms. Use analogies, examples, and step-by-step breakdowns. Make complex topics accessible.",
      questions: "Generate a set of smart questions and detailed answers based on this content. Format each as Q: and A: with clear separation.",
      keypoints: "Extract all key points, important facts, dates, names, and critical information. Present as a numbered list with brief explanations.",
    };

    const systemPrompt = `You are a Smart Notes AI assistant. ${actionPrompts[action]}
Respond in the same language as the user's content.
Format your response with clear markdown: headers, bullet points, numbered lists, bold text for emphasis.
Be thorough and detailed.`;

    // Build multimodal user message: text + image_url for images, text for files
    const imageFiles = files.filter(f => f.isImage);
    const textFiles = files.filter(f => !f.isImage);
    let promptText = text;
    textFiles.forEach(f => { promptText += `\n\n--- File: ${f.name} ---\n${f.data}`; });

    const userContent: any = imageFiles.length > 0
      ? [
          { type: "text", text: promptText || "Analyze the attached image(s)" },
          ...imageFiles.map(f => ({ type: "image_url", image_url: { url: f.data } })),
        ]
      : promptText;

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: userContent },
          ],
          model: "google/gemini-2.5-flash-lite-preview-09-2025",
          mode: "chat",
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let result = "";
      let buffer = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

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
            if (delta) {
              result += delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: result };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    }

    setIsLoading(false);
  }, [input, attachedFiles, messages]);

  const hasMessages = messages.length > 0;

  return (
    <AppLayout>
      <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3">
          <motion.button whileTap={{ scale: 0.9 }} transition={spring} onClick={() => navigate("/chat")} className="w-9 h-9 rounded-full liquid-glass-button flex items-center justify-center text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
          <h1 className="text-base font-semibold text-foreground">Smart Notes</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center min-h-full px-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center max-w-md w-full">
                <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight mb-2">
                  <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Transform Content</span>
                </h2>
                <p className="text-muted-foreground/60 text-sm mb-8">Paste text, upload files, or images — get instant summaries, key points, and Q&A</p>

                <div className="liquid-glass rounded-3xl p-4 mb-6">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Paste your text, notes, or content here..."
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none min-h-[100px] max-h-[200px] select-text"
                    rows={4}
                  />
                  {attachedFiles.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {attachedFiles.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full liquid-glass-pill text-xs text-foreground">
                          {f.isImage ? <ImageIcon className="w-3 h-3 text-emerald-400" /> : <FileText className="w-3 h-3 text-emerald-400" />}
                          {f.name.length > 18 ? f.name.slice(0, 18) + "…" : f.name}
                          <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20 relative">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setPlusOpen(v => !v)} className={`flex items-center justify-center w-9 h-9 rounded-full liquid-glass-button text-muted-foreground hover:text-foreground transition ${plusOpen ? "rotate-45" : ""}`}>
                      <Plus className="w-4 h-4" />
                    </motion.button>
                    <AnimatePresence>
                      {plusOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setPlusOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.92 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.92 }}
                            transition={{ type: "spring", damping: 22, stiffness: 350 }}
                            className="absolute bottom-full left-0 mb-2 z-50 w-60 rounded-3xl border border-border/30 bg-background/85 p-2.5 backdrop-blur-2xl shadow-2xl"
                          >
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { ref: cameraInputRef, icon: Camera, label: "Camera" },
                                { ref: imageInputRef, icon: ImageIcon, label: "Photos" },
                                { ref: fileInputRef, icon: FileUp, label: "Files" },
                              ].map(({ ref, icon: Icon, label }) => (
                                <button
                                  key={label}
                                  onClick={() => { ref.current?.click(); setPlusOpen(false); }}
                                  className="flex flex-col items-center gap-1 py-2.5 rounded-2xl hover:bg-foreground/5 transition"
                                >
                                  <Icon className="w-4 h-4 text-emerald-400" />
                                  <span className="text-[10px] text-foreground/80">{label}</span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                    <div className="flex-1" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {ACTIONS.map(action => (
                    <motion.button
                      key={action.id}
                      whileTap={{ scale: 0.95 }}
                      transition={spring}
                      onClick={() => handleSend(action.id)}
                      disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                      className="flex items-center gap-2 px-4 py-3.5 rounded-2xl liquid-glass-button text-sm text-foreground/80 hover:text-foreground disabled:opacity-30 transition-all"
                    >
                      <action.icon className="w-4 h-4 text-emerald-400" />
                      <span className="font-medium">{action.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-32">
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
                  {msg.role === "user" ? (
                    <div className="flex justify-end mb-3">
                      <div className="max-w-[85%] liquid-glass-subtle text-foreground px-4 py-2.5 rounded-[1.6rem] rounded-br-md text-sm">{msg.content}</div>
                    </div>
                  ) : (
                    <div className="prose-chat text-foreground text-sm leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      {isLoading && i === messages.length - 1 && <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5" />}
                      {!isLoading && msg.content && (
                        <div className="flex gap-2 mt-3">
                          <motion.button whileTap={{ scale: 0.9 }} onClick={async () => { await navigator.clipboard.writeText(msg.content); toast.success("Copied"); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass-button text-xs text-muted-foreground hover:text-foreground">
                            <Copy className="w-3 h-3" /> Copy
                          </motion.button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom input when in chat mode */}
        {hasMessages && (
          <div className="sticky bottom-0 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background to-transparent">
            <div className="max-w-2xl mx-auto liquid-glass rounded-3xl">
              {attachedFiles.length > 0 && (
                <div className="flex gap-2 px-3 pt-2 flex-wrap">
                  {attachedFiles.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full liquid-glass-pill text-xs text-foreground">
                      {f.isImage ? <ImageIcon className="w-3 h-3 text-emerald-400" /> : <FileText className="w-3 h-3 text-emerald-400" />}
                      {f.name.length > 16 ? f.name.slice(0, 16) + "…" : f.name}
                      <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2 px-3 py-2 relative">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setPlusOpen(v => !v)} className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition ${plusOpen ? "rotate-45" : ""}`}>
                  <Plus className="w-4 h-4" />
                </motion.button>
                <AnimatePresence>
                  {plusOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setPlusOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.92 }}
                        transition={{ type: "spring", damping: 22, stiffness: 350 }}
                        className="absolute bottom-full left-2 mb-2 z-50 w-60 rounded-3xl border border-border/30 bg-background/85 p-2.5 backdrop-blur-2xl shadow-2xl"
                      >
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { ref: cameraInputRef, icon: Camera, label: "Camera" },
                            { ref: imageInputRef, icon: ImageIcon, label: "Photos" },
                            { ref: fileInputRef, icon: FileUp, label: "Files" },
                          ].map(({ ref, icon: Icon, label }) => (
                            <button
                              key={label}
                              onClick={() => { ref.current?.click(); setPlusOpen(false); }}
                              className="flex flex-col items-center gap-1 py-2.5 rounded-2xl hover:bg-foreground/5 transition"
                            >
                              <Icon className="w-4 h-4 text-emerald-400" />
                              <span className="text-[10px] text-foreground/80">{label}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Ask about the content..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none min-h-[24px] max-h-[120px] py-2 select-text"
                  rows={1}
                />
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleSend()} disabled={isLoading || (!input.trim() && attachedFiles.length === 0)} className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-foreground disabled:opacity-20">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                </motion.button>
              </div>
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileAttach} accept=".txt,.pdf,.doc,.docx,.csv,.json,.md,.xlsx" multiple />
        <input ref={imageInputRef} type="file" className="hidden" onChange={handleFileAttach} accept="image/*" multiple />
        <input ref={cameraInputRef} type="file" className="hidden" onChange={handleFileAttach} accept="image/*" capture="environment" />
      </div>
    </AppLayout>
  );
};

export default SmartNotesPage;
