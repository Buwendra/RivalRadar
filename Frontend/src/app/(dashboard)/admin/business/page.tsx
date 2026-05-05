"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, TrendingUp, TrendingDown, Wallet, MessageSquareWarning } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { adminApi } from "@/lib/api/admin";
import { ApiClientError } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";

/**
 * Phase 8b — owner-only business snapshot. Not linked from any nav; only
 * accessible by direct URL. Backend gates via `ADMIN_EMAILS` allowlist
 * (returns 403 FORBIDDEN for non-admins). Pre-launch with no paying users
 * most numbers will be zero — that's expected and useful as a stake in the
 * ground for when the first cohort lands.
 */

function formatUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminBusinessPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "business"],
    queryFn: () => adminApi.business(),
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading snapshot…
      </div>
    );
  }

  if (error) {
    const msg = error instanceof ApiClientError ? error.message : "Failed to load snapshot";
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4" /> {msg}
        </div>
        <p className="mt-1 text-xs opacity-80">
          This page is admin-only. If you&apos;re not in the ADMIN_EMAILS allowlist, the
          backend returns 403 by design.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const tiers = ["scout", "strategist", "command"] as const;
  const margin = data.grossMarginUsd;
  const marginPositive = margin >= 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Business" description={`Snapshot as of ${new Date(data.asOf).toLocaleString()}`} />

      {/* Top-line metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="MRR" value={formatUsd(data.mrrUsd)} sub={`${formatUsd(data.arrUsd)} ARR`} />
        <MetricCard label="Active subs" value={data.activeSubscriptions.toString()} />
        <MetricCard
          label="Churn (30d)"
          value={`${data.churnRatePercent.toFixed(1)}%`}
          sub={`${data.canceledLast30Days} canceled`}
          trend={data.churnRatePercent > 5 ? "up-bad" : "neutral"}
        />
        <MetricCard
          label="Gross margin"
          value={formatUsd(margin)}
          sub={`AI cost: ${formatUsd(data.ai30dSpendUsd)}`}
          trend={marginPositive ? "up" : "down"}
        />
      </div>

      {/* MRR by tier */}
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="space-y-3 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            MRR by tier
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-700/60 text-left text-xs text-muted-foreground">
                <th className="pb-2">Tier</th>
                <th className="pb-2">Subscribers</th>
                <th className="pb-2 text-right">MRR</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t} className="border-b border-brand-700/40 last:border-0">
                  <td className="py-2 capitalize">{t}</td>
                  <td className="py-2 tabular-nums">{data.mrrByTier[t].count}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatUsd(data.mrrByTier[t].mrrUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Top-cost users */}
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Top 10 highest-cost users (last 30 days)
            </h3>
          </div>
          {data.topCostUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No cost attributed yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-700/60 text-left text-xs text-muted-foreground">
                  <th className="pb-2">User</th>
                  <th className="pb-2 text-right">AI cost</th>
                </tr>
              </thead>
              <tbody>
                {data.topCostUsers.map((u) => (
                  <tr key={u.userId} className="border-b border-brand-700/40 last:border-0">
                    <td className="py-2">
                      <div className="text-sm">{u.email ?? "—"}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{u.userId}</div>
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatUsd(u.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Recent cancellation reasons */}
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <MessageSquareWarning className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recent cancellations
            </h3>
          </div>
          {data.recentCancellations.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No cancellation feedback submitted yet. Survey emails fire automatically when a
              subscription is canceled via Paddle.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.recentCancellations.map((c, i) => (
                <li
                  key={i}
                  className="space-y-1 rounded-md border border-brand-700/60 bg-brand-950/30 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {c.plan}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-amber-900/60 bg-amber-950/40 text-xs text-amber-300"
                      >
                        {c.reason.replace(/-/g, " ")}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {(() => {
                        try {
                          return `${formatDistanceToNow(parseISO(c.submittedAt))} ago`;
                        } catch {
                          return c.submittedAt;
                        }
                      })()}
                    </span>
                  </div>
                  {c.freeText && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      &ldquo;{c.freeText}&rdquo;
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "up-bad" | "neutral";
}) {
  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardContent className="space-y-1 p-4">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
          {trend === "up" && <TrendingUp className="h-4 w-4 text-emerald-400" />}
          {trend === "down" && <TrendingDown className="h-4 w-4 text-red-400" />}
          {trend === "up-bad" && <TrendingUp className="h-4 w-4 text-red-400" />}
        </div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
