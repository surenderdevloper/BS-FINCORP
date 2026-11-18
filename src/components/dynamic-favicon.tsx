"use client";

import { useEffect } from "react";
import { faviconDataUri } from "@/lib/favicon";

export function DynamicFavicon({ logo }: { logo?: string | null }) {
  useEffect(() => {
    try {
      const dataUri = faviconDataUri(logo);
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.type = "image/svg+xml";
      link.href = dataUri;
    } catch {
      // Best-effort favicon update
    }
  }, [logo]);

  return null;
}
