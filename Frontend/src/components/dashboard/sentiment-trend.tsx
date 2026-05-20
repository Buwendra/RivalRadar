"use client";

/**
 * Phase 23 — Brand Pulse. Weekly sentiment trend visualisation.
 * Stacked bar per week (positive / neutral / negative) with totals on hover.
 * No chart library — plain SVG so the bundle doesn't grow.
 */

import { format, parseISO } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BrandSentimentWeek } from "@/lib/types";

interface SentimentTrendProps {
  weeks: BrandSentimentWeek[];
}

const BAR_MAX_HEIGHT_PX = 80;
const BAR_MIN_HEIGHT_PX = 2;

export function SentimentTrend({ weeks }: SentimentTrendProps) {
  const maxTotal = Math.max(1, ...weeks.map((w) => w.total));
  const grandTotal = weeks.reduce((sum, w) => sum + w.total, 0);

  if (grandTotal === 0) {
    return (
      <div className="rounded-md border border-brand-700 bg-brand-900 p-6 text-center text-sm text-muted-foreground">
        Sentiment data will appear here after the first few research runs.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {grandTotal} sentiment-tagged mentions over the last {weeks.length} weeks
        </span>
        <div className="flex items-center gap-3">
          <LegendDot tone="positive" />
          <LegendDot tone="neutral" />
          <LegendDot tone="negative" />
        </div>
      </div>

      <TooltipProvider delayDuration={100}>
        <div className="flex items-end gap-1" style={{ height: `${BAR_MAX_HEIGHT_PX}px` }}>
          {weeks.map((week) => {
            const totalH =
              week.total === 0
                ? BAR_MIN_HEIGHT_PX
                : Math.max(
                    BAR_MIN_HEIGHT_PX,
                    Math.round((week.total / maxTotal) * BAR_MAX_HEIGHT_PX)
                  );
            const posH = week.total === 0 ? 0 : (week.positive / week.total) * totalH;
            const neuH = week.total === 0 ? 0 : (week.neutral / week.total) * totalH;
            const negH = week.total === 0 ? totalH : totalH - posH - neuH;
            return (
              <Tooltip key={week.weekStart}>
                <TooltipTrigger asChild>
                  <div
                    className="flex flex-1 cursor-default flex-col-reverse overflow-hidden rounded-sm border border-brand-700/40"
                    style={{ height: `${totalH}px` }}
                    aria-label={`Week of ${week.weekStart}: ${week.positive} positive, ${week.neutral} neutral, ${week.negative} negative`}
                  >
                    {week.positive > 0 && (
                      <div className="bg-emerald-500/70" style={{ height: `${posH}px` }} />
                    )}
                    {week.neutral > 0 && (
                      <div className="bg-slate-500/60" style={{ height: `${neuH}px` }} />
                    )}
                    {week.negative > 0 && (
                      <div className="bg-red-500/70" style={{ height: `${negH}px` }} />
                    )}
                    {week.total === 0 && <div className="h-full bg-brand-700/50" />}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="font-medium">
                    Week of {format(parseISO(week.weekStart), "MMM d")}
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-2 tabular-nums">
                    <div>
                      <span className="text-emerald-300">Pos</span> {week.positive}
                    </div>
                    <div>
                      <span className="text-slate-300">Neu</span> {week.neutral}
                    </div>
                    <div>
                      <span className="text-red-300">Neg</span> {week.negative}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}

function LegendDot({ tone }: { tone: "positive" | "neutral" | "negative" }) {
  const map = {
    positive: { color: "bg-emerald-500/70", label: "Positive" },
    neutral: { color: "bg-slate-500/60", label: "Neutral" },
    negative: { color: "bg-red-500/70", label: "Negative" },
  };
  const cfg = map[tone];
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-2 w-2 rounded-full ${cfg.color}`} />
      {cfg.label}
    </span>
  );
}
