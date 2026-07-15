"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in ms, applied to the reveal animation */
  delay?: number;
  /** "up" = fade + rise (default), "fade" = opacity only */
  variant?: "up" | "fade";
}

/**
 * Scroll-reveal wrapper for landing sections. Server HTML is always fully
 * visible ("idle" state has no hiding class), so content survives no-JS,
 * crawlers, and hydration failures; hiding only happens post-mount for
 * elements still below the viewport.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  variant = "up",
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "hidden" | "revealed">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Already (near) in view at hydration: stay visible, never animate.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    setState("hidden");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("revealed");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        state === "hidden" && "opacity-0",
        state === "revealed" &&
          (variant === "up" ? "animate-fade-up" : "animate-fade-in"),
        className
      )}
      style={
        state === "revealed" && delay > 0
          ? { animationDelay: `${delay}ms` }
          : undefined
      }
    >
      {children}
    </div>
  );
}
