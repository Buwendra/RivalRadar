"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Shield,
  ShieldCheck,
  Eye,
  TrendingUp,
  TrendingDown,
  Minus,
  MoreHorizontal,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Competitor, Momentum, ThreatLevel } from "@/lib/types";

const THREAT_RANK: Record<ThreatLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  monitor: 4,
};
const THREAT_UNSCORED = 5;

const MOMENTUM_RANK: Record<Momentum, number> = {
  rising: 0,
  stable: 1,
  slowing: 2,
  declining: 3,
  "insufficient-data": 4,
};

const THREAT_BUCKETS: Array<{
  level: ThreatLevel;
  label: string;
  icon: typeof ShieldAlert;
  className: string;
}> = [
  {
    level: "critical",
    label: "Critical",
    icon: ShieldAlert,
    className: "border-red-900/60 bg-red-950/40 text-red-300",
  },
  {
    level: "high",
    label: "High",
    icon: AlertTriangle,
    className: "border-orange-900/60 bg-orange-950/40 text-orange-300",
  },
  {
    level: "medium",
    label: "Medium",
    icon: Shield,
    className: "border-amber-900/60 bg-amber-950/40 text-amber-300",
  },
  {
    level: "low",
    label: "Low",
    icon: ShieldCheck,
    className: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
  },
  {
    level: "monitor",
    label: "Monitor",
    icon: Eye,
    className: "border-brand-700 bg-brand-800 text-muted-foreground",
  },
];

const MOMENTUM_ICON: Record<Momentum, { icon: typeof TrendingUp; className: string }> = {
  rising: { icon: TrendingUp, className: "text-emerald-400" },
  stable: { icon: Minus, className: "text-muted-foreground" },
  slowing: { icon: TrendingDown, className: "text-amber-400" },
  declining: { icon: TrendingDown, className: "text-red-400" },
  "insufficient-data": { icon: MoreHorizontal, className: "text-muted-foreground" },
};

export type DashboardFilter =
  | "all"
  | "critical-only"
  | "rising-momentum"
  | "just-raised"
  | "hiring-fast";

interface CompetitorRankedStripProps {
  competitors: Competitor[];
}

function applyFilter(competitors: Competitor[], filter: DashboardFilter): Competitor[] {
  switch (filter) {
    case "critical-only":
      return competitors.filter(
        (c) => c.threatLevel === "critical" || c.threatLevel === "high"
      );
    case "rising-momentum":
      return competitors.filter((c) => c.momentum === "rising");
    case "just-raised":
      return competitors.filter((c) => c.derivedTags?.includes("just-raised"));
    case "hiring-fast":
      return competitors.filter((c) =>
        c.derivedTags?.includes("hiring-aggressively")
      );
    case "all":
    default:
      return competitors;
  }
}

const FILTER_OPTIONS: Array<{ key: DashboardFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "critical-only", label: "Critical only" },
  { key: "rising-momentum", label: "Rising momentum" },
  { key: "just-raised", label: "Just raised" },
  { key: "hiring-fast", label: "Hiring fast" },
];

export function CompetitorRankedStrip({ competitors }: CompetitorRankedStripProps) {
  const [filter, setFilter] = useState<DashboardFilter>("all");

  // Bucket counts — always computed against full list, not filtered, so the
  // counts shown represent your portfolio overall regardless of filter.
  const bucketCounts = useMemo(() => {
    const counts: Record<ThreatLevel | "unscored", number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      monitor: 0,
      unscored: 0,
    };
    for (const c of competitors) {
      if (c.threatLevel) counts[c.threatLevel]++;
      else counts.unscored++;
    }
    return counts;
  }, [competitors]);

  // Hide the strip if literally nothing is scored yet — avoids a wall of
  // "unscored" greys for fresh accounts.
  const allUnscored = competitors.length > 0 && bucketCounts.unscored === competitors.length;

  const filtered = useMemo(() => {
    return [...applyFilter(competitors, filter)].sort((a, b) => {
      const ta = a.threatLevel ? THREAT_RANK[a.threatLevel] : THREAT_UNSCORED;
      const tb = b.threatLevel ? THREAT_RANK[b.threatLevel] : THREAT_UNSCORED;
      if (ta !== tb) return ta - tb;
      const ma = MOMENTUM_RANK[a.momentum ?? "insufficient-data"];
      const mb = MOMENTUM_RANK[b.momentum ?? "insufficient-data"];
      if (ma !== mb) return ma - mb;
      return a.name.localeCompare(b.name);
    });
  }, [competitors, filter]);

  if (competitors.length === 0) return null;
  if (allUnscored) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your competitors
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Run research on your competitors to see them ranked by threat and
            momentum here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your competitors, ranked by threat
          </h3>
          <span className="text-xs text-muted-foreground">
            {filtered.length} shown · {competitors.length} total
          </span>
        </div>

        {/* Threat bucket counters */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {THREAT_BUCKETS.map((b) => {
            const count = bucketCounts[b.level];
            const Icon = b.icon;
            return (
              <div
                key={b.level}
                className={cn(
                  "flex items-center justify-between rounded-md border px-3 py-2 text-xs",
                  b.className,
                  count === 0 && "opacity-50"
                )}
              >
                <span className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {b.label}
                </span>
                <span className="font-bold tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilter(opt.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-brand-700 bg-brand-800 text-muted-foreground hover:bg-brand-700 hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Competitor cards */}
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No competitors match this filter.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((c) => (
              <CompetitorChip key={c.id} competitor={c} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompetitorChip({ competitor }: { competitor: Competitor }) {
  const threatLevel = competitor.threatLevel;
  const threatCfg = threatLevel
    ? THREAT_BUCKETS.find((b) => b.level === threatLevel)
    : undefined;
  const ThreatIcon = threatCfg?.icon ?? Eye;
  const momentum = competitor.momentum ?? "insufficient-data";
  const MomentumIcon = MOMENTUM_ICON[momentum].icon;

  return (
    <Link
      href={`/dashboard/competitors/${competitor.id}`}
      className={cn(
        "group flex items-center gap-2 rounded-md border bg-brand-950/40 px-3 py-2 transition-colors hover:bg-brand-800",
        threatCfg?.className ?? "border-brand-700"
      )}
      title={competitor.threatReasoning ?? competitor.name}
    >
      <ThreatIcon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1 truncate text-sm font-medium">{competitor.name}</span>
      <MomentumIcon
        className={cn("h-3.5 w-3.5 flex-shrink-0", MOMENTUM_ICON[momentum].className)}
      />
      {competitor.derivedTags?.includes("just-raised") && (
        <Badge
          variant="outline"
          className="h-4 border-amber-900/60 bg-amber-950/40 px-1 text-[9px] text-amber-300"
        >
          $
        </Badge>
      )}
    </Link>
  );
}
