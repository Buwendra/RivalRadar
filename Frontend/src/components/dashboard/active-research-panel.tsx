"use client";

import { useState } from "react";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useResearchRuns } from "@/lib/hooks/use-research-runs";
import { ResearchRunCard } from "./research-run-card";
import type { ResearchRunSummary } from "@/lib/types";

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

function isActive(r: ResearchRunSummary): boolean {
  return r.status === "queued" || r.status === "running";
}

function isRecent(r: ResearchRunSummary): boolean {
  if (isActive(r)) return false;
  const finishedAt = r.finishedAt ?? r.startedAt;
  return Date.now() - Date.parse(finishedAt) < RECENT_WINDOW_MS;
}

export function ActiveResearchPanel() {
  const { data, isLoading } = useResearchRuns();
  const [recentExpanded, setRecentExpanded] = useState(false);

  if (isLoading) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="space-y-2 p-5">
          <Skeleton className="h-4 w-40 bg-brand-800" />
          <Skeleton className="h-12 w-full bg-brand-800" />
        </CardContent>
      </Card>
    );
  }

  const runs = data ?? [];
  const active = runs.filter(isActive);
  const recent = runs.filter(isRecent);

  // Hide entirely when there's nothing useful to show — keeps the dashboard
  // clean for users who haven't run research recently.
  if (active.length === 0 && recent.length === 0) {
    return null;
  }

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cta" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Active research
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {active.length} active · {recent.length} recent
          </span>
        </div>

        {active.length > 0 && (
          <div className="space-y-2">
            {active.map((run) => (
              <ResearchRunCard key={run.id} run={run} />
            ))}
          </div>
        )}

        {recent.length > 0 && (
          <div className="space-y-2 border-t border-brand-700 pt-3">
            <button
              type="button"
              onClick={() => setRecentExpanded((v) => !v)}
              className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Recent (last 24h)</span>
              {recentExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {recentExpanded && (
              <div className="space-y-2">
                {recent.map((run) => (
                  <ResearchRunCard key={run.id} run={run} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
