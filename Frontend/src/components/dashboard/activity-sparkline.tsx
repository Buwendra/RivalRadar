"use client";

import { format, parseISO } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ActivitySparklineProps {
  data: Array<{ date: string; count: number }>;
}

const BAR_MAX_HEIGHT_PX = 60;
const BAR_MIN_HEIGHT_PX = 2;

export function ActivitySparkline({ data }: ActivitySparklineProps) {
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  const firstDate = data[0]?.date;
  const lastDate = data[data.length - 1]?.date;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between text-xs text-muted-foreground">
        <span>
          {total} change{total === 1 ? "" : "s"} in the last 30 days
        </span>
        {firstDate && lastDate && (
          <span>
            {format(parseISO(firstDate), "MMM d")} –{" "}
            {format(parseISO(lastDate), "MMM d")}
          </span>
        )}
      </div>

      <TooltipProvider delayDuration={100}>
        <div
          className="flex items-end gap-[2px]"
          style={{ height: `${BAR_MAX_HEIGHT_PX}px` }}
        >
          {data.map((bar) => {
            const heightPx =
              bar.count === 0
                ? BAR_MIN_HEIGHT_PX
                : Math.max(
                    BAR_MIN_HEIGHT_PX,
                    Math.round((bar.count / maxCount) * BAR_MAX_HEIGHT_PX)
                  );
            return (
              <Tooltip key={bar.date}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex-1 cursor-default rounded-t-sm transition-colors",
                      bar.count === 0
                        ? "bg-brand-700 hover:bg-brand-600"
                        : "bg-primary/70 hover:bg-primary"
                    )}
                    style={{ height: `${heightPx}px` }}
                    aria-label={`${bar.count} changes on ${bar.date}`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div>{format(parseISO(bar.date), "EEE, MMM d")}</div>
                  <div className="font-medium">
                    {bar.count} change{bar.count === 1 ? "" : "s"}
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
