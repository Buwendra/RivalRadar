"use client";

/**
 * "Since you last looked" dashboard hero card. Reads `previousLoginAt` from
 * the user profile (set by the once-per-session ping before it overwrites
 * `lastLoginAt`) and renders a summary of the Change records that arrived in
 * the window between then and now.
 *
 * Pure aggregation — no Anthropic. Hides itself when:
 *   - there's no `previousLoginAt` (first-ever session)
 *   - the window has zero changes (avoids a "you missed nothing" card)
 *   - the window is older than 30 days (treated as a long-absent return; the
 *     dashboard's normal feed is more useful than an inflated count)
 */

import Link from "next/link";
import { Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth/use-auth";
import { useChanges } from "@/lib/hooks/use-changes";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatSmartDate } from "@/lib/utils/format-date";

const MAX_WINDOW_DAYS = 30;
const TOP_ITEMS_TO_SHOW = 3;

function daysBetween(fromIso: string, to: Date): number {
  return Math.max(1, Math.ceil((to.getTime() - new Date(fromIso).getTime()) / 86_400_000));
}

export function SinceLastLookedCard() {
  const { user } = useAuth();
  const previousLoginAt = user?.previousLoginAt;

  // Only fire the changes query when we actually have a window to look at.
  // The hook always runs, but we set sinceDays to a no-op (1) when undefined
  // so the page render stays stable.
  const sinceDays = previousLoginAt
    ? Math.min(MAX_WINDOW_DAYS, daysBetween(previousLoginAt, new Date()))
    : undefined;

  const { data, isLoading } = useChanges(
    sinceDays !== undefined ? { sinceDays, limit: 50 } : {}
  );

  // Card hides on first session, when out-of-window, or while data is loading.
  if (!previousLoginAt) return null;
  if (sinceDays !== undefined && sinceDays >= MAX_WINDOW_DAYS) return null;
  if (isLoading) return null;

  const changes = data?.pages.flatMap((page) => page.data) ?? [];
  if (changes.length === 0) return null;

  const sortedBySig = [...changes].sort(
    (a, b) => (b.significance ?? 0) - (a.significance ?? 0)
  );
  const top = sortedBySig.slice(0, TOP_ITEMS_TO_SHOW);
  const criticalCount = changes.filter((c) => (c.significance ?? 0) >= 8).length;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Since you last looked</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {changes.length} new change{changes.length === 1 ? "" : "s"} in the last{" "}
              {sinceDays} day{sinceDays === 1 ? "" : "s"}
              {criticalCount > 0 ? (
                <>
                  {" "}—{" "}
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    {criticalCount} critical
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            <TrendingUp className="mr-1 h-3 w-3" />
            recap
          </Badge>
        </div>

        <ul className="space-y-2">
          {top.map((change) => (
            <li key={change.id} className="text-sm">
              <Link
                href={`/dashboard/changes/${change.id}`}
                className="flex items-start gap-2 hover:underline"
              >
                <Badge
                  variant={
                    (change.significance ?? 0) >= 8
                      ? "destructive"
                      : (change.significance ?? 0) >= 5
                        ? "default"
                        : "secondary"
                  }
                  className="mt-0.5 text-[10px] tabular-nums"
                >
                  {change.significance ?? "—"}
                </Badge>
                <div className="flex-1">
                  <span className="line-clamp-1 font-medium">
                    {change.aiAnalysis?.summary ?? "Change detected"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {change.competitorName ?? "Unknown"} · {formatSmartDate(change.detectedAt)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {changes.length > TOP_ITEMS_TO_SHOW && (
          <Link
            href="/dashboard/changes"
            className="block text-center text-xs text-primary hover:underline"
          >
            See all {changes.length} changes →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
