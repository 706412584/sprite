import { useEffect, useState } from "react";
import { resolveMediaUrl } from "@/api/spriteApi";

export function RemoteVideo({ src }: { src: string }) {
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

  return <video src={resolvedSrc} controls muted playsInline preload="metadata" />;
}
