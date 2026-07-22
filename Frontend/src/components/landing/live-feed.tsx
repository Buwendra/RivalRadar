"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Self-updating mock intelligence feed for the hero product preview.
 * Companies and findings are fictional; the feed illustrates the real
 * product surface (category, significance score, same-day detection).
 */
const FINDINGS = [
  {
    company: "Acme Analytics",
    category: "Product",
    significance: 8,
    text: "Launched usage-based pricing for their enterprise tier",
    time: "2m ago",
  },
  {
    company: "Northwind",
    category: "Funding",
    significance: 9,
    text: "Raised a $12M Series A to expand into EMEA",
    time: "14m ago",
  },
  {
    company: "BoldMetrics",
    category: "Hiring",
    significance: 6,
    text: "Posted 4 senior enterprise sales roles this week",
    time: "31m ago",
  },
  {
    company: "Acme Analytics",
    category: "News",
    significance: 5,
    text: "Featured in a major SMB tools roundup",
    time: "1h ago",
  },
  {
    company: "Vantage Labs",
    category: "Social",
    significance: 4,
    text: "Spike in engagement on AI-positioning posts",
    time: "2h ago",
  },
  {
    company: "Northwind",
    category: "Product",
    significance: 7,
    text: "Shipped a Slack integration for deal alerts",
    time: "3h ago",
  },
];

const VISIBLE = 4;

function significanceClasses(score: number) {
  if (score >= 8) return "bg-significance-high/10 text-significance-high";
  if (score >= 6) return "bg-significance-medium/10 text-significance-medium";
  return "bg-significance-low/10 text-significance-low";
}

export function LiveFeed() {
  const [head, setHead] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      // Step backwards so the newly visible finding enters at the top.
      setHead((h) => (h - 1 + FINDINGS.length) % FINDINGS.length);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-full flex-col rounded-lg border border-ink/[0.06] bg-obsidian-950/50 p-4">
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
          return (
            // Keyed by finding identity: a newly mounted row (the one
            // entering at the top) plays fade-up; persisting rows don't.
            <div
              key={index}
              className="animate-fade-up rounded-md border border-ink/[0.06] bg-obsidian-900/80 p-3"
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 font-medium text-ink/70">
                  {item.category}
                </span>
                <span className="truncate text-muted-foreground">
                  {item.company} · {item.time}
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
