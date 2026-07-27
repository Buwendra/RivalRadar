"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Rule — the editorial hairline divider that draws itself in from the left as
 * it scrolls into view. The section-break gesture of the whole site.
 *
 * Robustness: starts at scaleX(0) and only draws once observed, so there's no
 * load-flash for rules below the fold. Under reduced motion the draw collapses
 * to ~instant (globals.css targets `.animate-rule-draw`). It's decorative, so
 * a no-JS client simply never draws it — acceptable for a divider.
 */
export function Rule({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          io.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "rule-hairline w-full origin-left scale-x-0",
        drawn && "animate-rule-draw",
        className,
      )}
    />
  );
}
