import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { TemplateProps, splitIntoSections, hostname } from "./templateUtils";

/**
 * Editorial reading template inspired by leerob.com and Vercel's open-source blog.
 * - Generous whitespace, serif headings + sans body
 * - Sticky table of contents on desktop
 * - Inline numbered citations, footnote-style sources
 * - 100% theme tokens (light/dark)
 */

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);

const md = {
  h1: ({ node: _n, ...p }: any) => (
    <h2 dir="auto" className="mt-10 mb-4 break-words font-display text-2xl font-semibold tracking-tight text-foreground sm:mt-16 sm:text-4xl" {...p} />
  ),
  h2: ({ node: _n, ...p }: any) => (
    <h2 dir="auto" className="mt-10 mb-4 break-words font-display text-2xl font-semibold tracking-tight text-foreground sm:mt-16 sm:text-4xl" {...p} />
  ),
  h3: ({ node: _n, ...p }: any) => (
    <h3 dir="auto" className="mt-8 mb-3 break-words font-display text-lg font-semibold tracking-tight text-foreground sm:mt-10 sm:text-2xl" {...p} />
  ),
  p: ({ node: _n, ...p }: any) => (
    <p dir="auto" className="my-4 break-words text-[16px] leading-[1.85] text-foreground/85 sm:my-5 sm:text-[17px]" {...p} />
  ),
  ul: ({ node: _n, ...p }: any) => (
    <ul dir="auto" className="my-5 space-y-2 ps-5 list-disc marker:text-muted-foreground" {...p} />
  ),
  ol: ({ node: _n, ...p }: any) => (
    <ol dir="auto" className="my-5 space-y-2 ps-5 list-decimal marker:text-muted-foreground" {...p} />
  ),
  li: ({ node: _n, ...p }: any) => (
    <li dir="auto" className="break-words text-[16px] leading-[1.8] text-foreground/85 sm:text-[17px]" {...p} />
  ),
  blockquote: ({ node: _n, ...p }: any) => (
    <blockquote
      dir="auto"
      className="my-6 border-s-2 border-primary ps-4 font-display text-lg italic text-foreground/90 sm:my-8 sm:ps-5 sm:text-2xl"
      {...p}
    />
  ),
  table: ({ node: _n, ...p }: any) => (
    <div className="my-10 -mx-4 overflow-x-auto sm:mx-0">
      <div className="inline-block min-w-full align-middle px-4 sm:px-0">
        <table
          className="min-w-full border-separate border-spacing-0 text-[15px] [&_tbody_tr:nth-child(even)]:bg-muted/30 [&_tbody_tr:hover]:bg-muted/60 [&_tbody_tr]:transition-colors"
          {...p}
        />
      </div>
    </div>
  ),
  thead: ({ node: _n, ...p }: any) => (
    <thead {...p} />
  ),
  tbody: ({ node: _n, ...p }: any) => (
    <tbody {...p} />
  ),
  tr: ({ node: _n, ...p }: any) => (
    <tr {...p} />
  ),
  th: ({ node: _n, ...p }: any) => (
    <th
      dir="auto"
      className="border-y-2 border-foreground px-4 py-3.5 text-start text-[11px] font-bold uppercase tracking-[0.14em] text-foreground [&:not(:last-child)]:border-e [&:not(:last-child)]:border-border"
      {...p}
    />
  ),
  td: ({ node: _n, ...p }: any) => (
    <td
      dir="auto"
      className="border-b border-border px-4 py-3.5 align-top text-[15px] leading-[1.65] text-foreground/85 first:font-medium first:text-foreground [&:not(:last-child)]:border-e [&:not(:last-child)]:border-border"
      {...p}
    />
  ),
  hr: () => <hr className="my-12 border-border" />,
  code: ({ inline, ...p }: any) =>
    inline ? (
      <code className="font-mono text-[0.88em] text-primary" {...p} />
    ) : (
      <pre className="my-6 overflow-x-auto p-0">
        <code className="font-mono text-[13.5px] leading-[1.65] text-foreground/90" {...p} />
      </pre>
    ),
  img: () => null,
  a: ({ node: _n, href, children, ...p }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline decoration-primary/30 underline-offset-[3px] transition hover:decoration-primary"
      {...p}
    >
      {children}
    </a>
  ),
};

const ResearchArticleTemplate = ({
  data, cleanReport, isRtl, sources, wordCount, readMins, reportEmpty,
}: TemplateProps) => {
  const { intro, sections } = splitIntoSections(cleanReport);
  const dateText = new Date().toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const cover = data.images[0];
  const inlineImages = data.images.slice(1);

  // Active section tracking for the TOC
  const tocItems = useMemo(
    () => sections.map((s, i) => ({ id: `${i}-${slugify(s.heading)}`, label: s.heading })),
    [sections],
  );
  const [activeId, setActiveId] = useState<string>("");
  useEffect(() => {
    if (tocItems.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    tocItems.forEach((t) => {
      const el = document.getElementById(t.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [tocItems]);

  return (
    <div className="bg-background text-foreground">
      <article className="mx-auto max-w-[1200px] px-4 sm:px-8 lg:px-12">
        {/* Header */}
        <header className="mx-auto max-w-[760px] pt-8 pb-8 sm:pt-20 sm:pb-14">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {isRtl ? "بحث معمّق" : "Deep Research"}
          </div>
          <motion.h1
            dir="auto"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 break-words font-display text-3xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl"
          >
            {data.query}
          </motion.h1>
        </header>

        {/* Cover image */}
        {cover && (
          <motion.figure
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mx-auto mb-12 max-w-[1100px] overflow-hidden sm:mb-16"
          >
            <img src={cover} alt="" className="aspect-[16/9] w-full object-cover" loading="eager" />
          </motion.figure>
        )}

        {/* Body + sticky TOC */}
        <div className="grid gap-12 lg:grid-cols-[1fr_220px] lg:gap-16">
          {/* Main column */}
          <div className="mx-auto w-full max-w-[720px] min-w-0 pb-20">
            {reportEmpty ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                {isRtl ? "التقرير قيد التحضير." : "Report is being prepared."}
              </div>
            ) : (
              <>
                {intro && (
                  <section
                    lang={isRtl ? "ar" : "en"}
                    dir={isRtl ? "rtl" : "ltr"}
                    className=""
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                      {intro}
                    </ReactMarkdown>
                  </section>
                )}

                {sections.map((s, i) => {
                  const id = `${i}-${slugify(s.heading)}`;
                  const img = inlineImages[i];
                  return (
                    <section
                      key={id}
                      id={id}
                      lang={isRtl ? "ar" : "en"}
                      dir={isRtl ? "rtl" : "ltr"}
                      className="scroll-mt-24"
                    >
                      <div className="mt-14 mb-5 sm:mt-20 sm:mb-6">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-medium tabular-nums text-primary">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="h-px flex-1 bg-border" />
                        </div>
                        <h2
                          dir="auto"
                          className="mt-3 break-words font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[40px] sm:leading-[1.15]"
                        >
                          {s.heading}
                        </h2>
                      </div>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                        {s.body}
                      </ReactMarkdown>
                      {img && (
                        <motion.figure
                          initial={{ opacity: 0, y: 16 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "-80px" }}
                          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          className="my-10 overflow-hidden"
                        >
                          <img src={img} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
                        </motion.figure>
                      )}
                    </section>
                  );
                })}

                {/* Sources — footnote style */}
                {sources.length > 0 && (
                  <section className="mt-20 border-t border-border pt-10">
                    <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                      {isRtl ? "المصادر" : "Sources"}
                    </h2>
                    <ol className="mt-6 space-y-3 text-sm">
                      {sources.map((u, i) => (
                        <li key={u + i} className="flex gap-3 text-foreground/80">
                          <span className="w-6 shrink-0 text-muted-foreground tabular-nums">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <a
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex min-w-0 items-center gap-1.5 break-all underline decoration-border underline-offset-[3px] transition hover:decoration-primary hover:text-primary"
                          >
                            <span className="truncate">{hostname(u)}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-100" />
                          </a>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </>
            )}
          </div>

          {/* Sticky TOC sidebar */}
          {tocItems.length > 0 && (
            <aside className="hidden lg:block">
              <nav className="sticky top-24">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {isRtl ? "المحتوى" : "On this page"}
                </div>
                <ul className="mt-4 space-y-2.5 border-s border-border ps-4">
                  {tocItems.map((t) => {
                    const active = activeId === t.id;
                    return (
                      <li key={t.id}>
                        <a
                          href={`#${t.id}`}
                          className={`-ms-px block border-s-2 ps-3 text-sm leading-snug transition ${
                            active
                              ? "border-primary text-foreground font-medium"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {t.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </aside>
          )}
        </div>
      </article>
    </div>
  );
};

export default ResearchArticleTemplate;
