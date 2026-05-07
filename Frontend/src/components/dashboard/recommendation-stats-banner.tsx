"use client";

import {
  TrendingUp,
  CheckCircle2,
  XCircle,
  Activity,
  Target,
  Clock,
  Tag,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Recommendation, RecommendationCategory } from "@/lib/types";
import { CATEGORY_LABEL } from "./recommendation-row";

interface Props {
  open: Recommendation[];
  actedOn: Recommendation[];
  dismissed: Recommendation[];
  /** True when the OPEN query hit the per-tier maxVisible cap. */
  openIsCapped: boolean;
  /** -1 means unlimited. */
  tierMax: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function RecommendationStatsBanner({
  open,
  actedOn,
  dismissed,
  openIsCapped,
  tierMax,
}: Props) {
  const total = open.length + actedOn.length + dismissed.length;
  const denom = actedOn.length + dismissed.length;
  const actionRate = denom > 0 ? Math.round((actedOn.length / denom) * 100) : null;

  const allLoaded = [...open, ...actedOn, ...dismissed];
  const avgConfidence =
    allLoaded.length > 0
      ? allLoaded.reduce((sum, r) => sum + r.confidence, 0) / allLoaded.length
      : null;

  // avg days-to-act: only acted-on with both timestamps
  const actedWithTs = actedOn.filter((r) => r.actedAt && r.createdAt);
  const avgDaysToAct =
    actedWithTs.length > 0
      ? actedWithTs.reduce((sum, r) => {
          const ms = Date.parse(r.actedAt!) - Date.parse(r.createdAt);
          return sum + (Number.isFinite(ms) ? ms : 0);
        }, 0) /
        actedWithTs.length /
        DAY_MS
      : null;

  // top category by acted-on count
  const categoryCounts: Partial<Record<RecommendationCategory, number>> = {};
  for (const r of actedOn) {
    categoryCounts[r.category] = (categoryCounts[r.category] ?? 0) + 1;
  }
  let topCategory: RecommendationCategory | null = null;
  let topCount = 0;
  for (const cat of Object.keys(categoryCounts) as RecommendationCategory[]) {
    const count = categoryCounts[cat] ?? 0;
    if (count > topCount) {
      topCategory = cat;
      topCount = count;
    }
  }

  const openLabel =
    openIsCapped && tierMax > 0 ? `${open.length} of ${tierMax}+` : `${open.length}`;
  const openHint = openIsCapped && tierMax > 0 ? "upgrade to see all" : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Stat icon={Activity} label="Total loaded" value={total} color="text-primary" />
        <Stat
          icon={TrendingUp}
          label="Open"
          value={openLabel}
          color="text-amber-300"
          hint={openHint}
        />
        <Stat
          icon={CheckCircle2}
          label="Acted on"
          value={actedOn.length}
          color="text-emerald-300"
        />
        <Stat
          icon={XCircle}
          label="Dismissed"
          value={dismissed.length}
          color="text-muted-foreground"
        />
        <Stat
          icon={Target}
          label="Action rate"
          value={actionRate !== null ? `${actionRate}%` : "—"}
          color="text-primary"
          hint={
            actionRate !== null
              ? `${actedOn.length}/${denom} resolved`
              : "no resolved recs yet"
          }
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SmallStat
          icon={Target}
          label="Avg confidence"
          value={
            avgConfidence !== null
              ? `${Math.round(avgConfidence * 100)}%`
              : "—"
          }
        />
        <SmallStat
          icon={Clock}
          label="Avg days-to-act"
          value={avgDaysToAct !== null ? avgDaysToAct.toFixed(1) : "—"}
          hint={
            avgDaysToAct !== null
              ? `${actedWithTs.length} acted-on rec${actedWithTs.length === 1 ? "" : "s"}`
              : "no acted-on recs yet"
          }
        />
        <SmallStat
          icon={Tag}
          label="Top acted-on category"
          value={topCategory ? CATEGORY_LABEL[topCategory] : "—"}
          hint={topCategory ? `${topCount} acted on` : "no acted-on recs yet"}
        />
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
  hint,
}: {
  icon: typeof Activity;
  label: string;
  value: number | string;
  color: string;
  hint?: string | null;
}) {
  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-7 w-7 ${color}`} />
        <div>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function SmallStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardContent className="flex items-center gap-3 p-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">{value}</p>
          <p className="text-[11px] text-muted-foreground">{label}</p>
          {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
