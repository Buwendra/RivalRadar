"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PredictedMove, PredictedMoveCategory } from "@/lib/types";

const CATEGORY_TONE: Record<PredictedMoveCategory, string> = {
  product: "border-brand-700 bg-brand-800 text-foreground",
  pricing: "border-red-900/60 bg-red-950/40 text-red-300",
  funding: "border-amber-900/60 bg-amber-950/40 text-amber-300",
  hiring: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
  geo: "border-brand-700 bg-transparent text-muted-foreground",
  strategic: "border-brand-700 bg-transparent text-muted-foreground",
};

const CATEGORY_LABEL: Record<PredictedMoveCategory, string> = {
  product: "Product",
  pricing: "Pricing",
  funding: "Funding",
  hiring: "Hiring",
  geo: "Geo",
  strategic: "Strategy",
};

interface PredictedMovesCardProps {
  moves?: PredictedMove[];
}

export function PredictedMovesCard({ moves }: PredictedMovesCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!moves || moves.length === 0) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="space-y-2 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Predicted next moves
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Run research at least twice on this competitor to see predictions.
            Predictions need at least one prior research snapshot to compare against.
          </p>
        </CardContent>
      </Card>
    );
  }

  const visible = expanded ? moves : moves.slice(0, 1);
  const hidden = moves.length - visible.length;

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cta" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Predicted next moves
            </h3>
          </div>
          <Badge variant="outline" className="text-xs">
            {moves.length} prediction{moves.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <ol className="space-y-3">
          {visible.map((m, idx) => (
            <li
              key={`${m.move}-${idx}`}
              className="space-y-1.5 rounded-md border border-brand-700/60 bg-brand-950/40 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold tabular-nums text-muted-foreground">
                    {idx + 1}.
                  </span>
                  <span className="text-sm font-medium leading-snug">
                    {m.move}
                  </span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 border px-1.5 text-[10px] font-medium",
                      CATEGORY_TONE[m.category]
                    )}
                  >
                    {CATEGORY_LABEL[m.category]}
                  </Badge>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] tabular-nums">
                    {m.timeHorizon}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 px-1.5 text-[10px] tabular-nums",
                      m.probability >= 0.7
                        ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-300"
                        : m.probability >= 0.4
                        ? "border-amber-900/60 bg-amber-950/40 text-amber-300"
                        : "border-brand-700 bg-brand-800 text-muted-foreground"
                    )}
                  >
                    {Math.round(m.probability * 100)}%
                  </Badge>
                </div>
              </div>
              <p className="pl-6 text-xs leading-relaxed text-muted-foreground">
                {m.reasoning}
              </p>
            </li>
          ))}
        </ol>

        {moves.length > 1 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Show all {hidden + 1} <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
