import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Share2, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { detectResearchReportDirection, normalizeResearchReport } from "@/lib/normalizeResearchReport";
import { supabase } from "@/integrations/supabase/client";

interface DeepResearchCardProps {
  query: string;
  report: string;
  images?: string[];
  sessionKey?: string;
}

const DeepResearchCard = ({ query, report, images = [], sessionKey }: DeepResearchCardProps) => {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);

  const cleanReport = normalizeResearchReport(report);
  const isRtl = detectResearchReportDirection(cleanReport) === "rtl";
  const cover = images[0];
  const wordCount = cleanReport.split(/\s+/).filter(Boolean).length;
  const previewLine =
    cleanReport
      .replace(/^#+\s*/gm, "")
      .replace(/[*_`#>~-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140) + (cleanReport.length > 140 ? "…" : "");

  const reportData = { query, report: cleanReport, images };

  const openPreview = () => {
    if (sessionKey) {
      navigate(`/research/preview/${sessionKey}`, { state: { reportData } });
    } else {
      navigate("/research/preview/new", { state: { reportData } });
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (exporting) return;
    setExporting(true);
    const t = toast.loading("Generating PDF…");
    try {
      const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const usableW = pageW - margin * 2;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      const titleLines = pdf.splitTextToSize(query, usableW);
      pdf.text(titleLines, margin, margin + 6);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      const bodyText = cleanReport.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
      const lines = pdf.splitTextToSize(bodyText, usableW);
      let y = margin + 6 + titleLines.length * 7 + 6;
      const lineH = 5.6;
      for (const line of lines) {
        if (y > pageH - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += lineH;
      }
      const safe = query.slice(0, 60).replace(/[\\/:*?"<>|]/g, "-").trim() || "research";
      pdf.save(`${safe}.pdf`);
      toast.success("Downloaded", { id: t });
    } catch (err) {
      console.error("[research-card pdf]", err);
      toast.error("Failed to generate PDF", { id: t });
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sharing) return;
    setSharing(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      const key = sessionKey || `r_${Date.now().toString(36)}`;
      if (uid) {
        await supabase.from("research_reports").upsert(
          {
            user_id: uid,
            session_key: key,
            query,
            report: cleanReport,
            images: images as any,
            steps: [] as any,
          },
          { onConflict: "user_id,session_key" }
        );
      }
      const url = `${window.location.origin}/research/preview/${key}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: query, text: query, url });
          return;
        } catch { /* fall through to clipboard */ }
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch (err) {
      console.error("[research-card share]", err);
      toast.error("Share failed");
    } finally {
      setSharing(false);
    }
  };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={openPreview}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPreview(); } }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      dir="ltr"
      className="group relative w-full text-left rounded-3xl liquid-glass border border-border/40 overflow-hidden hover:border-border/70 transition-colors cursor-pointer"
    >
      {/* Cover */}
      <div className="relative h-32 sm:h-40 w-full overflow-hidden">
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-500/30 via-blue-500/25 to-emerald-500/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-4">
        <div className="min-w-0" dir={isRtl ? "rtl" : "ltr"}>
          <h4 className="text-[15px] font-semibold text-foreground line-clamp-2 leading-snug">{query}</h4>
          {previewLine && (
            <p className="mt-1 text-[12.5px] text-muted-foreground line-clamp-2 leading-relaxed">
              {previewLine}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={exporting}
            className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-2xl bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors disabled:opacity-60"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Download PDF</span>
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-2xl bg-accent/40 text-foreground text-[13px] font-medium hover:bg-accent/60 transition-colors disabled:opacity-60 border border-border/40"
          >
            {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            <span>Share</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default DeepResearchCard;
