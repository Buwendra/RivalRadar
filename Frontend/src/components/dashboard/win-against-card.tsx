"use client";

import { Swords } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  WinAgainstTactic,
  WinAgainstDifficulty,
  WinAgainstImpact,
} from "@/lib/types";
import { AiDisclaimer } from "./ai-disclaimer";

const IMPACT_CLASS: Record<WinAgainstImpact, string> = {
  high: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
  medium: "border-amber-900/60 bg-amber-950/40 text-amber-300",
  low: "border-brand-700 bg-brand-800 text-muted-foreground",
};

const DIFFICULTY_CLASS: Record<WinAgainstDifficulty, string> = {
  easy: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
  moderate: "border-brand-700 bg-brand-800 text-foreground",
  hard: "border-red-900/60 bg-red-950/40 text-red-300",
};

interface WinAgainstCardProps {
  tactics?: WinAgainstTactic[];
  asOf?: string;
}

function formatRelative(iso: string): string {
  try {
    return `${formatDistanceToNow(parseISO(iso))} ago`;
  } catch {
    return "earlier";
  }
}

export function WinAgainstCard({ tactics, asOf }: WinAgainstCardProps) {
  const hasTactics = tactics && tactics.length > 0;

  if (!hasTactics) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="space-y-2 p-5">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Win-against tactics
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Generate a battlecard for this competitor to populate concrete
            sales-enablement tactics tailored to their current state.
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
            <Swords className="h-4 w-4 text-cta" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Win-against tactics
            </h3>
          </div>
          {asOf && (
            <span className="text-[10px] text-muted-foreground/70">
              Generated {formatRelative(asOf)}
            </span>
          )}
        </div>

        <ol className="space-y-3">
          {tactics.map((t, idx) => (
            <li
              key={`${t.tactic}-${idx}`}
              className="space-y-1.5 rounded-md border border-brand-700/60 bg-brand-950/40 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold tabular-nums text-muted-foreground">
                    {idx + 1}.
                  </span>
                  <span className="text-sm font-medium leading-snug">
                    {t.tactic}
                  </span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 border px-1.5 text-[10px] font-medium capitalize",
                      IMPACT_CLASS[t.impact]
                    )}
                    title="Expected impact"
                  >
                    {t.impact} impact
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 border px-1.5 text-[10px] font-medium capitalize",
                      DIFFICULTY_CLASS[t.difficulty]
                    )}
                    title="Execution difficulty"
                  >
                    {t.difficulty}
                  </Badge>
                </div>
              </div>
              <p className="pl-6 text-xs leading-relaxed text-muted-foreground">
                {t.reasoning}
              </p>
            </li>
          ))}
        </ol>

        <AiDisclaimer />
      </CardContent>
    </Card>
  );
}
