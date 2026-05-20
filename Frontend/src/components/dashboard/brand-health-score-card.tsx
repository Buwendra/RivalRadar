"use client";

/**
 * Phase 24 — Brand Health Score card. Composite 0–100 KPI with three
 * component sub-rows. Default variant is the full breakdown for the Your
 * Brand page; `size="sm"` is a compact one-row chip for the dashboard home.
 *
 * Plain SVG / divs — no chart library. Colour buckets: red < 40, amber < 70,
 * emerald ≥ 70.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AiDisclaimer } from "./ai-disclaimer";
import { useBrandHealth } from "@/lib/hooks/use-brand";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { BrandHealthComponent, BrandHealthConfidence } from "@/lib/types";

interface BrandHealthScoreCardProps {
  size?: "default" | "sm";
}

const CONFIDENCE_TONE: Record<BrandHealthConfidence, string> = {
  high: "border-emerald-700/60 bg-emerald-950/40 text-emerald-300",
  medium: "border-amber-700/60 bg-amber-950/40 text-amber-300",
  low: "border-brand-700 bg-brand-800 text-muted-foreground",
};

function scoreColour(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function barColour(score: number): string {
  if (score >= 70) return "bg-emerald-500/70";
  if (score >= 40) return "bg-amber-500/70";
  return "bg-red-500/70";
}

function formatAsOf(iso: string): string {
  try {
    return `Updated ${formatDistanceToNow(parseISO(iso))} ago`;
  } catch {
    return "";
  }
}

export function BrandHealthScoreCard({ size = "default" }: BrandHealthScoreCardProps) {
  const { data, isLoading, isError } = useBrandHealth();

  // 404 (brand not set up) surfaces as isError — hide the card cleanly.
  if (isError) return null;

  if (isLoading || !data) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className={cn(size === "sm" ? "p-3" : "p-5")}>
          <Skeleton className={cn(size === "sm" ? "h-12 w-full" : "h-32 w-full", "bg-brand-800")} />
        </CardContent>
      </Card>
    );
  }

  if (size === "sm") {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className={cn("text-3xl font-bold tabular-nums", scoreColour(data.score))}>
              {data.score}
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Brand Health
              </span>
              <span className="text-xs text-muted-foreground">{formatAsOf(data.asOf)}</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn("h-6 border px-2 text-xs font-medium", CONFIDENCE_TONE[data.confidence])}
            title={`Confidence: ${data.confidence}`}
          >
            {data.confidence}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Brand Health Score</h2>
            <p className="mt-1 text-xs text-muted-foreground">{formatAsOf(data.asOf)}</p>
          </div>
          <Badge
            variant="outline"
            className={cn("h-6 border px-2 text-xs font-medium", CONFIDENCE_TONE[data.confidence])}
            title={`Confidence: ${data.confidence}`}
          >
            {data.confidence} confidence
          </Badge>
        </div>

        <div className="flex items-end gap-4">
          <div className={cn("text-6xl font-bold tabular-nums", scoreColour(data.score))}>
            {data.score}
          </div>
          <div className="pb-2 text-xs text-muted-foreground">/ 100</div>
        </div>

        <div className="space-y-3">
          <ComponentRow label="Sentiment" component={data.components.sentiment} />
          <ComponentRow label="Share of voice" component={data.components.voice} />
          <ComponentRow label="Momentum" component={data.components.momentum} />
        </div>

        <AiDisclaimer />
      </CardContent>
    </Card>
  );
}

function ComponentRow({ label, component }: { label: string; component: BrandHealthComponent }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("tabular-nums font-medium", scoreColour(component.score))}>
          {component.score}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-800">
        <div
          className={cn("h-full rounded-full transition-all", barColour(component.score))}
          style={{ width: `${component.score}%` }}
        />
      </div>
      <p className="text-[11px] leading-tight text-muted-foreground">{component.detail}</p>
    </div>
  );
}
