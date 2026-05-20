"use client";

/**
 * Phase 24 — Share of Voice stacked bar component. Renders a single horizontal
 * stacked bar where each segment represents one entity's percentage of voice.
 * The self-brand row gets the emerald accent; competitors cycle through a
 * fixed palette of muted accent colours so the chart stays legible without a
 * full chart library.
 *
 * Pass `compact` for a slimmer bar variant (used by the per-category grid on
 * the SoV page where there are five charts side by side).
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SoVRow } from "@/lib/types";

interface ShareOfVoiceChartProps {
  rows: SoVRow[];
  /** Optional label rendered above the bar (e.g. "News"). */
  title?: string;
  compact?: boolean;
  /** When all rows have count 0, show this message instead of an empty bar. */
  emptyMessage?: string;
}

const COMPETITOR_PALETTE = [
  "bg-blue-500/70",
  "bg-violet-500/70",
  "bg-amber-500/70",
  "bg-pink-500/70",
  "bg-cyan-500/70",
  "bg-orange-500/70",
  "bg-rose-500/70",
];

function colourFor(row: SoVRow, index: number): string {
  if (row.isSelf) return "bg-emerald-500/70";
  return COMPETITOR_PALETTE[index % COMPETITOR_PALETTE.length];
}

export function ShareOfVoiceChart({
  rows,
  title,
  compact = false,
  emptyMessage = "No mentions in this category yet.",
}: ShareOfVoiceChartProps) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const segments = rows.filter((r) => r.count > 0);

  return (
    <div className={cn("space-y-2", compact ? "" : "space-y-3")}>
      {title && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">{title}</span>
          <span className="text-muted-foreground tabular-nums">
            {total} mention{total === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {segments.length === 0 ? (
        <div
          className={cn(
            "flex w-full items-center justify-center rounded-md border border-brand-700 bg-brand-900 text-xs text-muted-foreground",
            compact ? "h-6" : "h-8"
          )}
        >
          {emptyMessage}
        </div>
      ) : (
        <TooltipProvider delayDuration={80}>
          <div
            className={cn(
              "flex w-full overflow-hidden rounded-md border border-brand-700/60",
              compact ? "h-6" : "h-8"
            )}
          >
            {segments.map((row, i) => (
              <Tooltip key={row.competitorId}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "cursor-default transition-opacity hover:opacity-100",
                      colourFor(row, i)
                    )}
                    style={{ width: `${row.percent}%` }}
                    aria-label={`${row.name}: ${row.count} mentions, ${row.percent}%`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="font-medium">
                    {row.name}
                    {row.isSelf ? " (you)" : ""}
                  </div>
                  <div className="mt-0.5 text-muted-foreground tabular-nums">
                    {row.count} mention{row.count === 1 ? "" : "s"} · {row.percent}%
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      )}

      {/* Legend — only when not compact and we have at least one segment */}
      {!compact && segments.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {segments.map((row, i) => (
            <span
              key={row.competitorId}
              className="inline-flex items-center gap-1 text-muted-foreground"
            >
              <span className={cn("inline-block h-2 w-2 rounded-full", colourFor(row, i))} />
              <span className={row.isSelf ? "text-emerald-300" : ""}>{row.name}</span>
              <span className="tabular-nums">{row.percent}%</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
