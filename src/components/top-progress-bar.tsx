"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function TopProgressBar() {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    if (el.dataset.active === "true") {
      el.style.width = "100%";
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        el.style.opacity = "0";
        el.dataset.active = "false";
        setTimeout(() => {
          el.style.width = "0%";
          el.style.opacity = "1";
        }, 300);
      }, 150);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("/#") &&
        target.getAttribute("target") !== "_blank" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        const currentUrl = window.location.pathname + window.location.search;
        if (href !== currentUrl) {
          const el = barRef.current;
          if (el) {
            el.dataset.active = "true";
            el.style.opacity = "1";
            el.style.width = "25%";
            setTimeout(() => {
              if (el.dataset.active === "true") el.style.width = "65%";
            }, 100);
            setTimeout(() => {
              if (el.dataset.active === "true") el.style.width = "85%";
            }, 300);
          }
        }
      }
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent"
      aria-hidden="true"
    >
      <div
        ref={barRef}
        data-active="false"
        className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.7)] transition-all duration-300 ease-out"
        style={{ width: "0%", opacity: 0 }}
      />
    </div>
  );
}
