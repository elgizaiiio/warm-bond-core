import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { detectResearchReportDirection, normalizeResearchReport } from "@/lib/normalizeResearchReport";
import { toast } from "sonner";
import { goBackOr } from "@/lib/navigation";
import {
  ReportData,
  extractUrls,
  ScrollProgress,
} from "@/components/research/templateUtils";
import ResearchArticleTemplate from "@/components/research/ResearchArticleTemplate";

const ResearchPreviewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const stateReport = (location.state as { reportData?: ReportData } | null)?.reportData ?? null;

  const cacheKey = id ? `research-preview:${id}` : "";
  const openConversationInChat = (conversationId: string) => {
    navigate("/chat", { replace: true, state: { loadConversationId: conversationId } });
  };

  useEffect(() => {
    // 1) Hydrate from navigation state (first visit from chat).
    if (stateReport?.report) {
      const fresh = {
        query: stateReport.query,
        report: stateReport.report,
        images: Array.isArray(stateReport.images) ? stateReport.images : [],
      };
      setData(fresh);
      try { sessionStorage.setItem(cacheKey, JSON.stringify(fresh)); } catch {}
      setLoading(false);
      return;
    }
    // 2) Hydrate from sessionStorage so back-nav doesn't lose images.
    if (cacheKey) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as ReportData;
          if (parsed?.report) {
            setData(parsed);
            setLoading(false);
            return;
          }
        }
      } catch {}
    }
    if (!id) { setLoading(false); return; }
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      if (!uid) { setLoading(false); return; }

      // Parse URL id: may be "<uuid>" or "conv_<uuid>_<idx>".
      const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const uuidMatch = id.match(uuidRe);
      const conversationId = uuidMatch ? uuidMatch[0] : null;
      if (conversationId && id === conversationId) {
        openConversationInChat(conversationId);
        return;
      }

      // 1) Direct session_key match (URL id used as-is).
      let { data: row } = await supabase
        .from("research_reports")
        .select("query, report, images")
        .eq("user_id", uid)
        .eq("session_key", id)
        .maybeSingle();

      // 2) Newest report saved against this conversation (any index).
      if (!row && conversationId) {
        const { data: rows } = await supabase
          .from("research_reports")
          .select("query, report, images, created_at")
          .eq("user_id", uid)
          .like("session_key", `conv_${conversationId}_%`)
          .order("created_at", { ascending: false })
          .limit(1);
        row = rows?.[0] ?? null;
      }

      if (row) {
        const fresh = {
          query: row.query,
          report: row.report,
          images: (row.images as any) || [],
        };
        setData(fresh);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(fresh)); } catch {}
        setLoading(false);
        return;
      }

      // 3) Fallback: reconstruct from messages of the conversation.
      if (conversationId) {
        const { data: convo } = await supabase
          .from("conversations")
          .select("id, title, mode")
          .eq("id", conversationId)
          .eq("user_id", uid)
          .maybeSingle();
        if (convo) {
          const { data: msgs } = await supabase
            .from("messages")
            .select("role, content, created_at")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true });
          const userMsg = msgs?.find((m) => m.role === "user");
          const assistantMsg = [...(msgs || [])].reverse().find((m) => m.role === "assistant");
          if (assistantMsg?.content) {
            const fresh = {
              query: convo.title || userMsg?.content || "Research",
              report: assistantMsg.content,
              images: [] as string[],
            };
            setData(fresh);
            try { sessionStorage.setItem(cacheKey, JSON.stringify(fresh)); } catch {}
          }
        }
      }
      setLoading(false);
    })();
  }, [id, stateReport]);

  const cleanReport = useMemo(() => (data ? normalizeResearchReport(data.report) : ""), [data]);
  const isRtl = cleanReport ? detectResearchReportDirection(cleanReport) === "rtl" : false;
  const sources = useMemo(() => extractUrls(cleanReport), [cleanReport]);
  const wordCount = cleanReport.split(/\s+/).filter(Boolean).length;
  const readMins = Math.max(1, Math.round(wordCount / 220));
  const reportEmpty = cleanReport.trim().length < 10;

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Report not found.</p>
      </div>
    );
  }

  const handleDownload = async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    const t = toast.loading(isRtl ? "جارٍ إنشاء ملف PDF…" : "Generating PDF…");
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"), import("jspdf"),
      ]);
      const node = reportRef.current;
      const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
      const canvas = await html2canvas(node, {
        scale: 2, useCORS: true, backgroundColor: bg, logging: false, windowWidth: node.scrollWidth,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;
      const pxPerMm = canvas.width / usableW;
      const sliceH = Math.floor(usableH * pxPerMm);
      let rendered = 0, pageIndex = 0;
      while (rendered < canvas.height) {
        const cur = Math.min(sliceH, canvas.height - rendered);
        const sc = document.createElement("canvas");
        sc.width = canvas.width; sc.height = cur;
        const ctx = sc.getContext("2d");
        if (!ctx) break;
        ctx.drawImage(canvas, 0, rendered, canvas.width, cur, 0, 0, canvas.width, cur);
        const imgData = sc.toDataURL("image/jpeg", 0.92);
        const imgHmm = cur / pxPerMm;
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, margin, usableW, imgHmm, undefined, "FAST");
        rendered += cur; pageIndex++;
      }
      const safe = data.query.slice(0, 60).replace(/[\\/:*?"<>|]/g, "-").trim() || "research";
      pdf.save(`${safe}.pdf`);
      toast.success(isRtl ? "تم التحميل" : "Downloaded", { id: t });
    } catch (e) {
      console.error("[pdf]", e);
      toast.error(isRtl ? "فشل إنشاء الملف" : "Failed to generate PDF", { id: t });
    } finally { setExporting(false); }
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const url = window.location.href;
      if (navigator.share) {
        try { await navigator.share({ title: data.query, url }); return; } catch {}
      }
      await navigator.clipboard.writeText(url);
      toast.success(isRtl ? "تم نسخ الرابط" : "Link copied");
    } finally { setSharing(false); }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground" dir={isRtl ? "rtl" : "ltr"}>
      <ScrollProgress />

      <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:px-6">
          <button
            onClick={() => goBackOr(navigate, "/chat")}
            className="-ms-1 flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 hover:bg-foreground/5 transition"
            aria-label="Back"
          >
            <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
          </button>
          <div className="flex-1" />
          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 hover:bg-foreground/5 transition disabled:opacity-50"
            aria-label="Share"
          >
            {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          </button>
          <button
            onClick={handleDownload}
            disabled={exporting}
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 hover:bg-foreground/5 transition disabled:opacity-50"
            aria-label="Download PDF"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <div ref={reportRef} className="animate-fade-in">
        <ResearchArticleTemplate
          data={data}
          cleanReport={cleanReport}
          isRtl={isRtl}
          sources={sources}
          wordCount={wordCount}
          readMins={readMins}
          reportEmpty={reportEmpty}
        />
      </div>
    </div>
  );
};

export default ResearchPreviewPage;
