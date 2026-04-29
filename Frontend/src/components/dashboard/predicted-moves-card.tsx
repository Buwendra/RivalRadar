"use client";

import { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  CircleDashed,
  Circle,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  PredictedMove,
  PredictedMoveCategory,
  EvaluatedPrediction,
  PredictionStatus,
} from "@/lib/types";

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

const STATUS_CONFIG: Record<
  PredictionStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    badgeClass: string;
  }
> = {
  realized: {
    label: "Realized",
    icon: CheckCircle2,
    badgeClass: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
  },
  "partially-realized": {
    label: "Partial",
    icon: CircleDashed,
    badgeClass: "border-amber-900/60 bg-amber-950/40 text-amber-300",
  },
  expired: {
    label: "Expired",
    icon: XCircle,
    badgeClass: "border-brand-700 bg-brand-800 text-muted-foreground",
  },
  pending: {
    label: "Pending",
    icon: Circle,
    badgeClass: "border-brand-700 bg-transparent text-muted-foreground",
  },
};

function formatRelative(iso: string): string {
  try {
    return `${formatDistanceToNow(parseISO(iso))} ago`;
  } catch {
    return "earlier";
  }
}

interface PredictedMovesCardProps {
  moves?: PredictedMove[];
  history?: EvaluatedPrediction[];
}

export function PredictedMovesCard({ moves, history }: PredictedMovesCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Track record: only show evaluated entries (skip "pending" since current
  // predictions are implicitly pending and would be redundant)
  const trackRecord = (history ?? [])
    .filter((h) => h.status !== "pending")
    .slice(0, 3);

  const hasMoves = moves && moves.length > 0;

  if (!hasMoves && trackRecord.length === 0) {
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

  const movesArr = moves ?? [];
  const visible = expanded ? movesArr : movesArr.slice(0, 1);
  const hidden = movesArr.length - visible.length;

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
          {hasMoves && (
            <Badge variant="outline" className="text-xs">
              {movesArr.length} prediction{movesArr.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>

        {hasMoves && (
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
                    <span className="text-sm font-medium leading-snug">{m.move}</span>
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
        )}

        {hasMoves && movesArr.length > 1 && (
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

        {trackRecord.length > 0 && (
          <div className="space-y-2 border-t border-brand-700 pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Track record
            </h4>
            <ul className="space-y-2">
              {trackRecord.map((h, idx) => {
                const cfg = STATUS_CONFIG[h.status];
                const StatusIcon = cfg.icon;
                return (
                  <li
                    key={`history-${idx}-${h.evaluatedAt}`}
                    className="space-y-1 rounded-md border border-brand-700/60 bg-brand-950/30 p-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="text-sm leading-snug">{h.move}</span>
                      <Badge
                        variant="outline"
                        className={cn("h-5 gap-1 px-1.5 text-[10px] font-medium", cfg.badgeClass)}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </div>
                    {h.evidence && (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {h.evidence}
                        {h.evidenceUrl && (
                          <>
                            {" "}
                            <a
                              href={h.evidenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-primary hover:underline"
                            >
                              source <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </>
                        )}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70">
                      Predicted {formatRelative(h.predictedAt)} · Evaluated{" "}
                      {formatRelative(h.evaluatedAt)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
