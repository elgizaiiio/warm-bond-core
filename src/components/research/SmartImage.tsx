import { useState } from "react";

interface Props {
  src: string;
  alt?: string;
  className?: string;
  loading?: "eager" | "lazy";
  aspect?: string; // tailwind aspect class
}

/**
 * Image wrapper that:
 * - validates the URL (http/https only, not data:, not empty)
 * - sets referrerPolicy="no-referrer" so hotlink-protected CDNs serve us
 * - hides itself completely on load error (no broken icon)
 * - shows a soft skeleton while loading
 */
const SmartImage = ({ src, alt = "", className = "", loading = "lazy" }: Props) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const ok = typeof src === "string" && /^https?:\/\//i.test(src) && !/\.svg(\?|$)/i.test(src);
  if (!ok || failed) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-muted/30">
      {!loaded && (
        <div className="aspect-[16/9] w-full animate-pulse bg-gradient-to-br from-muted/60 to-muted/20" />
      )}
      <img
        src={src}
        alt={alt}
        loading={loading}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth < 200 || img.naturalHeight < 150) {
            setFailed(true);
            return;
          }
          setLoaded(true);
        }}
        onError={() => setFailed(true)}
        className={`block w-full h-auto max-h-[80vh] object-contain transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0 absolute inset-0"} ${className}`}
      />
    </div>
  );
};

export default SmartImage;
