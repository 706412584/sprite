import { useEffect, useState } from "react";
import { resolveMediaUrl } from "@/api/spriteApi";

export function RemoteImage({ src, alt }: { src: string; alt: string }) {
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    let cancelled = false;
    resolveMediaUrl(src)
      .then((nextSrc) => {
        if (!cancelled) setResolvedSrc(nextSrc);
      })
      .catch(() => setResolvedSrc(src));
    return () => { cancelled = true; };
  }, [src]);

  return <img src={resolvedSrc} alt={alt} />;
}
