import { useEffect, useState } from "react";
import { resolveMediaUrl } from "@/api/spriteApi";

export function RemoteLink({ href, children }: { href: string; children: string }) {
  const [resolvedHref, setResolvedHref] = useState(href);

  useEffect(() => {
    let cancelled = false;
    resolveMediaUrl(href)
      .then((nextHref) => {
        if (!cancelled) setResolvedHref(nextHref);
      })
      .catch(() => setResolvedHref(href));
    return () => { cancelled = true; };
  }, [href]);

  return <a href={resolvedHref} target="_blank" rel="noreferrer">{children}</a>;
}
