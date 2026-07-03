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
import { ScoreInfo } from "./score-info";

interface ShareOfVoiceChartProps {
  rows: SoVRow[];
  /** Optional label rendered above the bar (e.g. "News"). */
  title?: string;
  compact?: boolean;
  /** When all rows have count 0, show this message instead of an empty bar. */
  emptyMessage?: string;
  /** Show the ⓘ "how is this calculated?" link next to the title. */
  showInfo?: boolean;
  /**
   * competitorId → colour class, shared across sibling charts so the same
   * entity keeps the same colour everywhere. Build one with
   * `buildSovColorMap(overallRows)` and pass it to every per-category chart —
   * without it, colours were assigned by each chart's own filtered segment
   * index, so a competitor with zero News mentions shifted every other
   * competitor's colour in the News chart and the overall legend misled.
   */
  colorMap?: Record<string, string>;
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

const SELF_COLOR = "bg-emerald-500/70";

/** Assign stable colours by roster position (self always emerald). */
export function buildSovColorMap(rows: SoVRow[]): Record<string, string> {
  const map: Record<string, string> = {};
  let paletteIdx = 0;
  for (const row of rows) {
    map[row.competitorId] = row.isSelf
      ? SELF_COLOR
      : COMPETITOR_PALETTE[paletteIdx++ % COMPETITOR_PALETTE.length];
  }
  return map;
}

export function ShareOfVoiceChart({
  rows,
  title,
  compact = false,
  emptyMessage = "No mentions in this category yet.",
  showInfo = false,
  colorMap,
}: ShareOfVoiceChartProps) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const segments = rows.filter((r) => r.count > 0);
  // Identity-keyed colours: from the shared map when provided, else from
  // THIS chart's full roster (still stable against zero-count filtering).
  const colours = colorMap ?? buildSovColorMap(rows);
  const colourFor = (row: SoVRow): string =>
    colours[row.competitorId] ?? (row.isSelf ? SELF_COLOR : COMPETITOR_PALETTE[0]);

  return (
    <div className={cn("space-y-2", compact ? "" : "space-y-3")}>
      {title && (
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 font-medium text-foreground">
            {title}
            {showInfo && <ScoreInfo metric="shareOfVoice" />}
          </span>
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
            {segments.map((row) => (
              <Tooltip key={row.competitorId}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "cursor-default transition-opacity hover:opacity-100",
                      colourFor(row)
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
          {segments.map((row) => (
            <span
              key={row.competitorId}
              className="inline-flex items-center gap-1 text-muted-foreground"
            >
              <span className={cn("inline-block h-2 w-2 rounded-full", colourFor(row))} />
              <span className={row.isSelf ? "text-emerald-300" : ""}>{row.name}</span>
              <span className="tabular-nums">{row.percent}%</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
