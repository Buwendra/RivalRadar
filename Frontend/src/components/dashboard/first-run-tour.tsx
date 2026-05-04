"use client";

import { useEffect, useRef, useState } from "react";
import { X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "rs_tour_dismissed";

interface TourStep {
  /** Optional — if absent, step is centered (used for welcome). */
  targetSelector?: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    title: "Welcome to RivalScan",
    body:
      "Quick 30-second tour of what's on your dashboard. You can skip any time.",
  },
  {
    targetSelector: '[data-tour="competitor-strip"]',
    title: "Threat-ranked competitors",
    body:
      "Your competitors at a glance, sorted by threat level. Click any card to drill into their full intelligence profile.",
  },
  {
    targetSelector: '[data-tour="recommendations"]',
    title: "Recommended actions",
    body:
      "Strategic actions our AI thinks you should consider this week, based on what your competitors are doing. Mark them as Acted or Dismiss to train the system.",
  },
  {
    targetSelector: '[data-tour="stats-cards"]',
    title: "At-a-glance metrics",
    body:
      "Total competitors, changes detected, and high-significance alerts — all updated as new research lands.",
  },
];

/**
 * Wait up to `timeoutMs` for an element matching `selector` to appear in the DOM.
 * Used so the tour doesn't try to position around a card that's still fetching
 * its first TanStack Query response.
 */
async function waitForSelector(selector: string, timeoutMs = 1500): Promise<Element | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

export function FirstRunTour() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Mount-time check: only start the tour if not previously dismissed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setActive(true);
  }, []);

  // Resolve the target element + position when step changes.
  useEffect(() => {
    if (!active) return;
    const step = STEPS[stepIndex];
    if (!step.targetSelector) {
      setTargetRect(null);
      return;
    }
    let cancelled = false;
    waitForSelector(step.targetSelector).then((el) => {
      if (cancelled) return;
      if (el) {
        setTargetRect(el.getBoundingClientRect());
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setTargetRect(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [active, stepIndex]);

  // Reposition on viewport resize / scroll
  useEffect(() => {
    if (!active || !STEPS[stepIndex].targetSelector) return;
    const handler = () => {
      const sel = STEPS[stepIndex].targetSelector;
      if (!sel) return;
      const el = document.querySelector(sel);
      if (el) setTargetRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [active, stepIndex]);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
    setActive(false);
  };

  const next = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      dismiss();
    }
  };

  if (!active) return null;

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const hasTarget = !!step.targetSelector && !!targetRect;

  // Tooltip positioning: if we have a target, place below+right with offset.
  // Otherwise center on the viewport.
  const tooltipStyle: React.CSSProperties = hasTarget
    ? {
        position: "fixed",
        top: Math.min(
          targetRect!.bottom + 12,
          window.innerHeight - 220
        ),
        left: Math.min(
          Math.max(targetRect!.left, 16),
          window.innerWidth - 360
        ),
        width: 340,
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 340,
      };

  return (
    <>
      {/* Backdrop — semi-transparent. Click to advance, not dismiss. */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        aria-hidden="true"
      />

      {/* Highlight ring around the target element */}
      {hasTarget && (
        <div
          className="pointer-events-none fixed z-40 rounded-md ring-2 ring-cta ring-offset-2 ring-offset-brand-950"
          style={{
            top: targetRect!.top - 4,
            left: targetRect!.left - 4,
            width: targetRect!.width + 8,
            height: targetRect!.height + 8,
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-live="polite"
        aria-label={step.title}
        className={cn(
          "z-50 rounded-lg border border-brand-700 bg-brand-900 p-4 shadow-2xl"
        )}
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-cta">
              Step {stepIndex + 1} of {STEPS.length}
            </p>
            <h3 className="text-sm font-semibold">{step.title}</h3>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded p-1 text-muted-foreground hover:bg-brand-800 hover:text-foreground"
            aria-label="Dismiss tour"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={dismiss}
            className="text-[11px] text-muted-foreground hover:underline"
          >
            Skip tour
          </button>
          <Button size="sm" onClick={next} className="h-7 text-xs">
            {isLast ? "Got it" : "Next"}
            {!isLast && <ChevronRight className="ml-1 h-3 w-3" />}
          </Button>
        </div>
      </div>
    </>
  );
}
