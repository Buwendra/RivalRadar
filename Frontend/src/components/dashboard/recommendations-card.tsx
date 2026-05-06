"use client";

import { useState } from "react";
import {
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRecommendations, useUpdateRecommendationStatus } from "@/lib/hooks/use-recommendations";
import type {
  Recommendation,
  RecommendationCategory,
  RecommendationEffortLevel,
  RecommendationTimeHorizon,
} from "@/lib/types";
import { AiDisclaimer } from "./ai-disclaimer";

const CATEGORY_TONE: Record<RecommendationCategory, string> = {
  positioning: "border-brand-700 bg-brand-800 text-foreground",
  pricing: "border-red-900/60 bg-red-950/40 text-red-300",
  messaging: "border-purple-900/60 bg-purple-950/40 text-purple-300",
  product: "border-blue-900/60 bg-blue-950/40 text-blue-300",
  sales: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
  talent: "border-amber-900/60 bg-amber-950/40 text-amber-300",
};

const CATEGORY_LABEL: Record<RecommendationCategory, string> = {
  positioning: "Positioning",
  pricing: "Pricing",
  messaging: "Messaging",
  product: "Product",
  sales: "Sales",
  talent: "Talent",
};

const EFFORT_LABEL: Record<RecommendationEffortLevel, string> = {
  low: "Low effort",
  medium: "Medium effort",
  high: "High effort",
};

const HORIZON_LABEL: Record<RecommendationTimeHorizon, string> = {
  "this-week": "This week",
  "this-month": "This month",
  "this-quarter": "This quarter",
};

export function RecommendationsCard() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data, isLoading } = useRecommendations({ status: "open" });
  const updateStatus = useUpdateRecommendationStatus();

  const recs: Recommendation[] = (data?.pages ?? []).flatMap((p) => p.data);

  if (isLoading) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading recommendations…
        </CardContent>
      </Card>
    );
  }

  if (recs.length === 0) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="space-y-2 p-5">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recommended actions
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Recommendations appear after your weekly digest. They use this
            week&apos;s changes plus your company context to suggest 3–7
            strategic actions tagged by category, effort, and time horizon.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-cta" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recommended actions
            </h3>
          </div>
          <Badge variant="outline" className="text-xs">
            {recs.length} open
          </Badge>
        </div>

        <ol className="space-y-3">
          {recs.map((r, idx) => {
            const isExpanded = expandedId === r.id;
            const confPct = Math.round(r.confidence * 100);
            const isMutating = updateStatus.isPending && updateStatus.variables?.id === r.id;
            return (
              <li
                key={r.id}
                className="space-y-2 rounded-md border border-brand-700/60 bg-brand-950/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold tabular-nums text-muted-foreground">
                      {idx + 1}.
                    </span>
                    <span className="text-sm font-medium leading-snug">
                      {r.title}
                    </span>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 border px-1.5 text-[10px] font-medium",
                        CATEGORY_TONE[r.category]
                      )}
                    >
                      {CATEGORY_LABEL[r.category]}
                    </Badge>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      {HORIZON_LABEL[r.timeHorizon]}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 px-1.5 text-[10px] tabular-nums",
                        r.confidence >= 0.7
                          ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-300"
                          : r.confidence >= 0.4
                          ? "border-amber-900/60 bg-amber-950/40 text-amber-300"
                          : "border-brand-700 bg-brand-800 text-muted-foreground"
                      )}
                    >
                      {confPct}%
                    </Badge>
                  </div>
                </div>

                <p className="pl-6 text-xs leading-relaxed text-muted-foreground">
                  {r.body}
                </p>

                {r.competitorName && (
                  <p className="pl-6 text-[11px] text-muted-foreground/70">
                    Re: <span className="font-medium">{r.competitorName}</span>
                    {" · "}
                    {EFFORT_LABEL[r.effortLevel]}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 pl-6">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
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
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={isMutating}
                      onClick={() =>
                        updateStatus.mutate({ id: r.id, status: "acted-on" })
                      }
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Acted
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      disabled={isMutating}
                      onClick={() =>
                        updateStatus.mutate({ id: r.id, status: "dismissed" })
                      }
                    >
                      <X className="mr-1 h-3 w-3" />
                      Dismiss
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="ml-6 mt-1 space-y-1 border-t border-brand-700/40 pt-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                      Triggered by
                    </p>
                    {r.triggeringChangeIds.length > 0 ? (
                      <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                        {r.triggeringChangeIds.map((cid) => (
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
          })}
        </ol>

        <AiDisclaimer />
      </CardContent>
    </Card>
  );
}
