"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  durationMs?: number;
}

/**
 * Counts up to `value` when scrolled into view. Server-renders the exact
 * final string so the resting text is identical with JS disabled or
 * reduced motion enabled.
 */
export function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  durationMs = 1400,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value.toFixed(decimals));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let rafId: number;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / durationMs, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay((value * eased).toFixed(decimals));
          if (t < 1) rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [value, decimals, durationMs]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
