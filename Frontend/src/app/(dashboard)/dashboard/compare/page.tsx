"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  GitCompare,
  Loader2,
  Lock,
  TrendingDown,
  TrendingUp,
  Minus,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CompetitorTagChips } from "@/components/dashboard/competitor-tag-chips";
import { useAuth } from "@/lib/auth/use-auth";
import { useBrand } from "@/lib/hooks/use-brand";
import { useCapability } from "@/lib/hooks/use-capability";
import { useCompetitorMatrix } from "@/lib/hooks/use-competitor-matrix";
import { exportsApi, triggerCsvDownload } from "@/lib/api/exports";
import { ApiClientError } from "@/lib/api/client";
import { formatRelativeDate } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils";
import type {
  CompetitorMatrixRow,
  Momentum,
  ThreatLevel,
} from "@/lib/types";

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

const THREAT_STYLE: Record<ThreatLevel, string> = {
  critical: "border-red-900/60 bg-red-950/40 text-red-300",
  high: "border-orange-900/60 bg-orange-950/40 text-orange-300",
  medium: "border-amber-900/60 bg-amber-950/40 text-amber-300",
  low: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
  monitor: "border-brand-700 bg-brand-800 text-muted-foreground",
};

const MOMENTUM_ICON: Record<Momentum, { icon: typeof TrendingUp; className: string }> = {
  rising: { icon: TrendingUp, className: "text-emerald-400" },
  stable: { icon: Minus, className: "text-muted-foreground" },
  slowing: { icon: TrendingDown, className: "text-amber-400" },
  declining: { icon: TrendingDown, className: "text-red-400" },
  "insufficient-data": { icon: MoreHorizontal, className: "text-muted-foreground" },
};

const THREAT_FILTERS: ReadonlyArray<{ value: "all" | ThreatLevel; label: string }> = [
  { value: "all", label: "All threats" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "monitor", label: "Monitor" },
];

type SortKey =
  | "default"
  | "name"
  | "threat"
  | "momentum"
  | "latestResearchAt";
type SortDir = "asc" | "desc";

function compareRows(
  a: CompetitorMatrixRow,
  b: CompetitorMatrixRow,
  key: SortKey,
  dir: SortDir
): number {
  const factor = dir === "asc" ? 1 : -1;
  if (key === "default") {
    const ta = a.threatLevel ? THREAT_RANK[a.threatLevel] : THREAT_UNSCORED;
    const tb = b.threatLevel ? THREAT_RANK[b.threatLevel] : THREAT_UNSCORED;
    if (ta !== tb) return ta - tb;
    const ma = MOMENTUM_RANK[a.momentum ?? "insufficient-data"];
    const mb = MOMENTUM_RANK[b.momentum ?? "insufficient-data"];
    if (ma !== mb) return ma - mb;
    return a.name.localeCompare(b.name);
  }
  if (key === "name") {
    return a.name.localeCompare(b.name) * factor;
  }
  if (key === "threat") {
    const ta = a.threatLevel ? THREAT_RANK[a.threatLevel] : THREAT_UNSCORED;
    const tb = b.threatLevel ? THREAT_RANK[b.threatLevel] : THREAT_UNSCORED;
    return (ta - tb) * factor;
  }
  if (key === "momentum") {
    const ma = MOMENTUM_RANK[a.momentum ?? "insufficient-data"];
    const mb = MOMENTUM_RANK[b.momentum ?? "insufficient-data"];
    return (ma - mb) * factor;
  }
  if (key === "latestResearchAt") {
    const av = a.latestResearchAt ?? "";
    const bv = b.latestResearchAt ?? "";
    return av.localeCompare(bv) * factor;
  }
  return 0;
}

function humanizeState(value: string | undefined): string {
  if (!value || value === "unknown") return "—";
  return value
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function ComparePage() {
  useAuth();
  const router = useRouter();
  const allowed = useCapability("comparatorMatrix");

  if (!allowed) {
    return <UpgradeGate />;
  }

  return <MatrixView router={router} />;
}

function MatrixView({ router }: { router: ReturnType<typeof useRouter> }) {
  const query = useCompetitorMatrix();
  // The self-brand row comes back from the matrix endpoint like any other
  // row; match it by id against GET /brand (same Competitor-row id space).
  const { data: brand } = useBrand();
  const selfId = brand?.id;
  const [threatFilter, setThreatFilter] = useState<"all" | ThreatLevel>("all");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [exporting, setExporting] = useState(false);

  const rows = useMemo<CompetitorMatrixRow[]>(() => {
    const base = query.data ?? [];
    const filtered =
      threatFilter === "all"
        ? base
        : base.filter((r) => r.threatLevel === threatFilter);
    const selfRow = selfId
      ? filtered.find((r) => r.id === selfId)
      : undefined;
    const rest = selfRow ? filtered.filter((r) => r.id !== selfId) : filtered;
    const sorted = [...rest].sort((a, b) => compareRows(a, b, sortKey, sortDir));
    // Pin the self-brand row to the top: it's the fixed reference line the
    // matrix is read against, not a rank claim.
    return selfRow ? [selfRow, ...sorted] : sorted;
  }, [query.data, threatFilter, sortKey, sortDir, selfId]);

  const handleSort = (key: SortKey) => {
    if (key === "default") return;
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportsApi.csv("competitor-matrix");
      triggerCsvDownload({ csv: result.csv, filename: result.filename });
      toast.success(
        `Exported ${result.rowCount} row${result.rowCount === 1 ? "" : "s"}`
      );
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Export failed";
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="How You Stack Up"
        description="You and every competitor side by side — threat, momentum, posture. Click a row for the full profile."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting || !rows.length}
        >
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export CSV
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-1.5">
        {THREAT_FILTERS.map((opt) => {
          const active = threatFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setThreatFilter(opt.value)}
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

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full bg-brand-800" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="rounded-md border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-300">
          Failed to load comparison matrix. Try refreshing.
        </div>
      ) : rows.length === 0 ? (
        <EmptyState hasAnyCompetitors={(query.data?.length ?? 0) > 0} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-brand-700 bg-brand-900">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-brand-900 text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-brand-700">
                <SortHeader
                  label="Name"
                  active={sortKey === "name"}
                  dir={sortDir}
                  onClick={() => handleSort("name")}
                />
                <SortHeader
                  label="Threat"
                  active={sortKey === "threat"}
                  dir={sortDir}
                  onClick={() => handleSort("threat")}
                />
                <SortHeader
                  label="Momentum"
                  active={sortKey === "momentum"}
                  dir={sortDir}
                  onClick={() => handleSort("momentum")}
                />
                <th className="px-3 py-2 font-medium">Tags</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Funding</th>
                <th className="px-3 py-2 font-medium">Hiring</th>
                <th className="px-3 py-2 font-medium">Direction</th>
                <th className="px-3 py-2 font-medium">Tech</th>
                <th className="px-3 py-2 font-medium">Pacing</th>
                <SortHeader
                  label="Last research"
                  active={sortKey === "latestResearchAt"}
                  dir={sortDir}
                  onClick={() => handleSort("latestResearchAt")}
                />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const MomentumIcon =
                  MOMENTUM_ICON[row.momentum ?? "insufficient-data"].icon;
                const isSelf = row.id === selfId;
                return (
                  <tr
                    key={row.id}
                    onClick={() =>
                      router.push(
                        // The competitor detail endpoint 404s on the self row
                        // by design — its home is the Your Brand page.
                        isSelf
                          ? "/dashboard/your-brand"
                          : `/dashboard/competitors/${row.id}`
                      )
                    }
                    className={cn(
                      "cursor-pointer border-b border-brand-700/60 transition-colors hover:bg-brand-800",
                      isSelf && "bg-emerald-950/20"
                    )}
                  >
                    <td className="px-3 py-3 align-top font-medium">
                      <div className="flex items-center gap-2 text-foreground">
                        {row.name}
                        {isSelf && (
                          <Badge
                            variant="outline"
                            className="border-emerald-900/60 bg-emerald-950/40 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300"
                          >
                            You
                          </Badge>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {row.url}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {row.threatLevel ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "border px-2 text-[11px] capitalize",
                            THREAT_STYLE[row.threatLevel]
                          )}
                          title={row.threatReasoning ?? undefined}
                        >
                          {row.threatLevel}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="flex items-center gap-1.5 text-xs">
                        <MomentumIcon
                          className={cn(
                            "h-3.5 w-3.5",
                            MOMENTUM_ICON[row.momentum ?? "insufficient-data"]
                              .className
                          )}
                        />
                        <span className="capitalize">
                          {row.momentum ?? "—"}
                        </span>
                        {typeof row.momentumChangePercent === "number" && (
                          <span className="text-muted-foreground">
                            {row.momentumChangePercent > 0 ? "+" : ""}
                            {row.momentumChangePercent}%
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {row.derivedTags && row.derivedTags.length > 0 ? (
                        <CompetitorTagChips tags={row.derivedTags.slice(0, 3)} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-xs">
                      {humanizeState(row.derivedState?.stage)}
                    </td>
                    <td className="px-3 py-3 align-top text-xs">
                      {humanizeState(row.derivedState?.fundingState)}
                    </td>
                    <td className="px-3 py-3 align-top text-xs">
                      {humanizeState(row.derivedState?.hiringState)}
                    </td>
                    <td className="px-3 py-3 align-top text-xs">
                      {humanizeState(row.derivedState?.strategicDirection)}
                    </td>
                    <td className="px-3 py-3 align-top text-xs">
                      {humanizeState(row.derivedState?.techPositioning)}
                    </td>
                    <td className="px-3 py-3 align-top text-xs">
                      {humanizeState(row.derivedState?.pacing)}
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-muted-foreground">
                      {row.latestResearchAt
                        ? formatRelativeDate(row.latestResearchAt)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className="px-3 py-2 font-medium">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 transition-colors hover:text-foreground",
          active && "text-foreground"
        )}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

function EmptyState({ hasAnyCompetitors }: { hasAnyCompetitors: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-brand-700/60 bg-brand-900 py-12 text-center">
      <GitCompare className="h-10 w-10 text-muted-foreground" />
      <div>
        <h3 className="text-lg font-semibold">
          {hasAnyCompetitors ? "No matches" : "Add competitors to see how you stack up"}
        </h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {hasAnyCompetitors
            ? "Try clearing the filter to see your full set."
            : "Side-by-side analysis is the fastest way to spot the rival you should pay attention to — and the gap between you. Add at least one competitor to get started."}
        </p>
      </div>
      {!hasAnyCompetitors && (
        <Button asChild size="sm">
          <Link href="/dashboard/competitors/new">Add a competitor</Link>
        </Button>
      )}
    </div>
  );
}

function UpgradeGate() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="How You Stack Up"
        description="Side-by-side analysis of you and your full competitive set."
      />
      <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-brand-700/60 bg-brand-900 px-6 py-16 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <div>
          <h3 className="text-lg font-semibold">Strategist plan required</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            The comparison matrix unlocks at Strategist. See yourself in the
            matrix: every competitor ranked side by side with you — threat,
            momentum, funding state, hiring posture, and strategic direction —
            with one-click CSV export.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/settings?tab=billing">Upgrade plan</Link>
        </Button>
      </div>
    </div>
  );
}
