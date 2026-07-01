"use client";

/**
 * Inline "how is this calculated?" explainer for a score.
 *
 * The ⓘ icon IS a link to the matching section of /dashboard/methodology, with
 * a hover tooltip showing the one-line summary. Making the icon the link (vs.
 * putting an interactive link inside tooltip content) keeps it robust — Radix
 * tooltips aren't meant to hold clickable content.
 *
 * Content comes from `lib/content/methodology.ts` so the tooltip and the full
 * methodology page never drift.
 */

import Link from "next/link";
import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getMetricDoc, methodologyHref, type MetricKey } from "@/lib/content/methodology";

interface ScoreInfoProps {
  metric: MetricKey;
  className?: string;
  /** Icon size in Tailwind units. Defaults to h-3.5 w-3.5. */
  iconClassName?: string;
}

export function ScoreInfo({ metric, className, iconClassName }: ScoreInfoProps) {
  const doc = getMetricDoc(metric);
  if (!doc) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={methodologyHref(metric)}
            aria-label={`How ${doc.title} is calculated`}
            // Stop propagation so the ⓘ never triggers an enclosing clickable
            // card/row (e.g. a competitor card that navigates on click).
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex shrink-0 text-muted-foreground transition-colors hover:text-foreground",
              className
            )}
          >
            <Info className={cn("h-3.5 w-3.5", iconClassName)} />
          </Link>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{doc.oneLiner}</p>
          <p className="mt-1 text-xs font-medium text-foreground">How is this calculated? →</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
