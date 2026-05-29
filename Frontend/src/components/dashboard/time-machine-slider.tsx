"use client";

/**
 * Phase 3E — time-machine for a competitor's research history. Renders a
 * horizontal row of clickable ticks (one per ResearchFinding), each labelled
 * with a relative timestamp ("3 weeks ago", "today"). Clicking jumps the
 * surrounding ResearchSection to that finding.
 *
 * Per the design decision: only the finding's summary + categories +
 * citations rewind. Threat / momentum / tags / predicted moves on the same
 * page stay current. The ghost badge above the ResearchCard tells the user
 * why ("Viewing 3 weeks ago — drag the slider to return to current").
 *
 * Hides itself when there's only 0 or 1 findings — the slider doesn't
 * unlock until there's a second snapshot to compare to.
 */

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSmartDate } from "@/lib/utils/format-date";
import type { ResearchFinding } from "@/lib/types";

interface TimeMachineSliderProps {
  /** Findings ordered with NEWEST first (matches the API response). */
  findings: Array<Pick<ResearchFinding, "id" | "generatedAt">>;
  /** Currently selected finding id; defaults to the newest when undefined. */
  selectedId?: string;
  onSelect: (findingId: string) => void;
}

export function TimeMachineSlider({
  findings,
  selectedId,
  onSelect,
}: TimeMachineSliderProps) {
  if (findings.length < 2) return null;

  // Render oldest → newest so the timeline reads left-to-right like a number
  // line. The API returns newest-first, so we reverse a local copy.
  const ordered = [...findings].reverse();
  const activeId = selectedId ?? findings[0].id;

  return (
    <div className="rounded-md border border-brand-700 bg-brand-900/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Time machine — {findings.length} snapshots
        </span>
      </div>

      <div className="relative">
        {/* Decorative connecting line behind the ticks. */}
        <div
          aria-hidden
          className="absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-brand-700"
        />

        {/* Tick buttons. Horizontally scrolls if the timeline is wider than
            the container — better than wrapping which would break the line. */}
        <div className="relative flex items-center gap-2 overflow-x-auto pb-1">
          {ordered.map((f, idx) => {
            const isActive = f.id === activeId;
            const isNewest = idx === ordered.length - 1;
            const label = isNewest ? "Now" : formatSmartDate(f.generatedAt);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelect(f.id)}
                title={new Date(f.generatedAt).toLocaleString()}
                className={cn(
                  "relative z-10 flex shrink-0 flex-col items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] transition-colors",
                  isActive
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-brand-700 bg-brand-900 text-muted-foreground hover:border-primary/60 hover:text-foreground"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-2 w-2 rounded-full",
                    isActive
                      ? "bg-primary"
                      : isNewest
                        ? "bg-foreground/60"
                        : "bg-brand-700"
                  )}
                />
                <span className="font-medium leading-none">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
