"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FINDINGS, SIGNAL_DELIVERY_EVENT } from "./feed-data";

/**
 * Mock intelligence feed for the hero product preview, driven by the
 * SignalCollapse canvas: each delivery event (the intro absorption, then every
 * ambient ignition that streaks into the dashboard) inserts its finding at the
 * top with a gold "born" flash — the gathered noise visibly becoming an entry.
 *
 * A slow fallback interval keeps the feed alive if the canvas never fires
 * (below the fold, canvas failure); it advances without the flash, since a
 * row with no visible cause shouldn't claim one. Under reduced motion the
 * feed is deliberately static.
 */
const VISIBLE = 4;

/** Longer than the ~4.5s intro so the first change is always the collapse's. */
const FALLBACK_MS = 9000;

function significanceClasses(score: number) {
  if (score >= 8) return "bg-significance-high/10 text-significance-high";
  if (score >= 6) return "bg-significance-medium/10 text-significance-medium";
  return "bg-significance-low/10 text-significance-low";
}

export function LiveFeed() {
  const [head, setHead] = useState(0);
  const [born, setBorn] = useState<number | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let interval = 0;
    const restartFallback = () => {
      window.clearInterval(interval);
      interval = window.setInterval(() => {
        // Step backwards so the newly visible finding enters at the top.
        setHead((h) => (h - 1 + FINDINGS.length) % FINDINGS.length);
      }, FALLBACK_MS);
    };

    const onDelivery = (e: WindowEventMap[typeof SIGNAL_DELIVERY_EVENT]) => {
      setHead(e.detail.findingIndex);
      setBorn(e.detail.findingIndex);
      restartFallback();
    };

    window.addEventListener(SIGNAL_DELIVERY_EVENT, onDelivery);
    restartFallback();
    return () => {
      window.removeEventListener(SIGNAL_DELIVERY_EVENT, onDelivery);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div
      data-signal-feed
      className="flex h-full flex-col rounded-lg border border-ink/[0.06] bg-obsidian-950/50 p-4"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-significance-low opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-significance-low" />
        </span>
        <p className="text-sm font-medium">Live intelligence feed</p>
      </div>
      <div className="mt-3 space-y-2">
        {Array.from({ length: VISIBLE }, (_, i) => {
          const index = (head + i) % FINDINGS.length;
          const item = FINDINGS[index];
          const isBorn = index === born;
          return (
            // Keyed by finding identity: a newly mounted row (the one
            // entering at the top) plays fade-up; persisting rows don't. If a
            // delivered finding was already visible mid-list, React reorders
            // without remounting — no fade-up, but the born class still
            // animates. Benign and rare (only after a fallback desync).
            <div
              key={index}
              className={cn(
                "animate-fade-up rounded-md border border-ink/[0.06] bg-obsidian-900/80 p-3",
                isBorn && "feed-row-born"
              )}
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 font-medium text-ink/70">
                  {item.category}
                </span>
                <span className="truncate text-muted-foreground">
                  {item.company} · {isBorn ? "just now" : item.time}
                </span>
                <span
                  className={cn(
                    "ml-auto shrink-0 rounded-full px-2 py-0.5 font-medium",
                    significanceClasses(item.significance)
                  )}
                >
                  {item.significance}/10
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-snug">{item.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
