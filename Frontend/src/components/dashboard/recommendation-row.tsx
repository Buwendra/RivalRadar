"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Check,
  X,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUpdateRecommendationStatus } from "@/lib/hooks/use-recommendations";
import type {
  Recommendation,
  RecommendationCategory,
  RecommendationEffortLevel,
  RecommendationTimeHorizon,
} from "@/lib/types";

export const CATEGORY_TONE: Record<RecommendationCategory, string> = {
  positioning: "border-brand-700 bg-brand-800 text-foreground",
  pricing: "border-red-900/60 bg-red-950/40 text-red-300",
  messaging: "border-purple-900/60 bg-purple-950/40 text-purple-300",
  product: "border-blue-900/60 bg-blue-950/40 text-blue-300",
  sales: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
  talent: "border-amber-900/60 bg-amber-950/40 text-amber-300",
};

export const CATEGORY_LABEL: Record<RecommendationCategory, string> = {
  positioning: "Positioning",
  pricing: "Pricing",
  messaging: "Messaging",
  product: "Product",
  sales: "Sales",
  talent: "Talent",
};

export const EFFORT_LABEL: Record<RecommendationEffortLevel, string> = {
  low: "Low effort",
  medium: "Medium effort",
  high: "High effort",
};

export const HORIZON_LABEL: Record<RecommendationTimeHorizon, string> = {
  "this-week": "This week",
  "this-month": "This month",
  "this-quarter": "This quarter",
};

interface RecommendationRowProps {
  rec: Recommendation;
  index?: number;
  showIndex?: boolean;
  showActions?: boolean;
}

export function RecommendationRow({
  rec,
  index,
  showIndex = false,
  showActions = true,
}: RecommendationRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const updateStatus = useUpdateRecommendationStatus();
  const confPct = Math.round(rec.confidence * 100);
  const isMutating = updateStatus.isPending && updateStatus.variables?.id === rec.id;

  const isOpen = rec.status === "open";
  const isActedOn = rec.status === "acted-on";
  const isDismissed = rec.status === "dismissed";

  return (
    <li className="space-y-2 rounded-md border border-brand-700/60 bg-brand-950/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-baseline gap-2">
          {showIndex && typeof index === "number" && (
            <span className="text-xs font-bold tabular-nums text-muted-foreground">
              {index + 1}.
            </span>
          )}
          <span
            className={cn(
              "text-sm font-medium leading-snug",
              isDismissed && "text-muted-foreground line-through"
            )}
          >
            {rec.title}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {isActedOn && (
            <Badge
              variant="outline"
              className="h-5 border-emerald-900/60 bg-emerald-950/40 px-1.5 text-[10px] text-emerald-300"
            >
              <Check className="mr-1 h-3 w-3" /> Acted on
            </Badge>
          )}
          {isDismissed && (
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] uppercase text-muted-foreground"
            >
              Dismissed
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn(
              "h-5 border px-1.5 text-[10px] font-medium",
              CATEGORY_TONE[rec.category]
            )}
          >
            {CATEGORY_LABEL[rec.category]}
          </Badge>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {HORIZON_LABEL[rec.timeHorizon]}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "h-5 px-1.5 text-[10px] tabular-nums",
              rec.confidence >= 0.7
                ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-300"
                : rec.confidence >= 0.4
                ? "border-amber-900/60 bg-amber-950/40 text-amber-300"
                : "border-brand-700 bg-brand-800 text-muted-foreground"
            )}
          >
            {confPct}%
          </Badge>
        </div>
      </div>

      <p
        className={cn(
          "pl-6 text-xs leading-relaxed text-muted-foreground",
          !showIndex && "pl-0"
        )}
      >
        {rec.body}
      </p>

      {rec.competitorName && (
        <p
          className={cn(
            "pl-6 text-[11px] text-muted-foreground/70",
            !showIndex && "pl-0"
          )}
        >
          Re: <span className="font-medium">{rec.competitorName}</span>
          {" · "}
          {EFFORT_LABEL[rec.effortLevel]}
        </p>
      )}

      <div
        className={cn(
          "flex items-center justify-between gap-2 pl-6",
          !showIndex && "pl-0"
        )}
      >
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          {isExpanded ? (
            <>
              Hide details <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Why this? <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
        {showActions && (
          <div className="flex items-center gap-1">
            {!isActedOn && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={isMutating}
                onClick={() =>
                  updateStatus.mutate({ id: rec.id, status: "acted-on" })
                }
              >
                <Check className="mr-1 h-3 w-3" />
                Acted
              </Button>
            )}
            {!isDismissed && isOpen && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                disabled={isMutating}
                onClick={() =>
                  updateStatus.mutate({ id: rec.id, status: "dismissed" })
                }
              >
                <X className="mr-1 h-3 w-3" />
                Dismiss
              </Button>
            )}
            {(isActedOn || isDismissed) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                disabled={isMutating}
                onClick={() =>
                  updateStatus.mutate({ id: rec.id, status: "open" })
                }
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Reopen
              </Button>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div
          className={cn(
            "ml-6 mt-1 space-y-1 border-t border-brand-700/40 pt-2",
            !showIndex && "ml-0"
          )}
        >
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
            Triggered by
          </p>
          {rec.triggeringChangeIds.length > 0 ? (
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">
              {rec.triggeringChangeIds.map((cid) => (
                <li key={cid} className="font-mono">
                  change · {cid.slice(0, 12)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] italic text-muted-foreground/60">
              Cross-portfolio pattern (no single triggering change)
            </p>
          )}
        </div>
      )}
    </li>
  );
}
