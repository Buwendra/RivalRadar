"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/use-auth";
import { useRecommendations } from "@/lib/hooks/use-recommendations";
import { useCapabilities } from "@/lib/hooks/use-capability";
import { RecommendationRow } from "@/components/dashboard/recommendation-row";
import { RecommendationStatsBanner } from "@/components/dashboard/recommendation-stats-banner";
import { AiDisclaimer } from "@/components/dashboard/ai-disclaimer";
import { cn } from "@/lib/utils";
import type { Recommendation, RecommendationStatus } from "@/lib/types";

type StatusFilter = "all" | RecommendationStatus;

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "acted-on", label: "Acted on" },
  { value: "dismissed", label: "Dismissed" },
];

export default function RecommendationsPage() {
  useAuth();
  const capabilities = useCapabilities();
  const tierMax = capabilities.recommendations.maxVisible;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Three parallel infinite queries — one per status. Stats banner reads all
  // three; the active list view picks one based on the filter.
  const openQuery = useRecommendations({ status: "open" });
  const actedOnQuery = useRecommendations({ status: "acted-on" });
  const dismissedQuery = useRecommendations({ status: "dismissed" });

  const open = useMemo<Recommendation[]>(
    () => (openQuery.data?.pages ?? []).flatMap((p) => p.data),
    [openQuery.data]
  );
  const actedOn = useMemo<Recommendation[]>(
    () => (actedOnQuery.data?.pages ?? []).flatMap((p) => p.data),
    [actedOnQuery.data]
  );
  const dismissed = useMemo<Recommendation[]>(
    () => (dismissedQuery.data?.pages ?? []).flatMap((p) => p.data),
    [dismissedQuery.data]
  );

  // Detect tier-cap. We assume cap-hit when open count == tierMax AND the
  // backend says no more pages. tierMax = -1 means unlimited.
  const openIsCapped =
    tierMax > 0 &&
    open.length >= tierMax &&
    !openQuery.hasNextPage;

  // Drive the active list off the chosen filter.
  const activeQuery =
    statusFilter === "open"
      ? openQuery
      : statusFilter === "acted-on"
      ? actedOnQuery
      : statusFilter === "dismissed"
      ? dismissedQuery
      : null;

  // 'all' merges the three and re-sorts by createdAt desc.
  const activeRecs = useMemo<Recommendation[]>(() => {
    if (statusFilter === "all") {
      const merged = [...open, ...actedOn, ...dismissed];
      merged.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      return merged;
    }
    if (statusFilter === "open") return open;
    if (statusFilter === "acted-on") return actedOn;
    return dismissed;
  }, [statusFilter, open, actedOn, dismissed]);

  const isLoading =
    openQuery.isLoading || actedOnQuery.isLoading || dismissedQuery.isLoading;

  // IntersectionObserver-based infinite scroll for the active filter.
  // Skipped in 'all' mode — the merged list is finite per the loaded set;
  // user can switch to a specific status to keep paging.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeQuery || !sentinelRef.current) return;
    if (!activeQuery.hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          activeQuery.hasNextPage &&
          !activeQuery.isFetchingNextPage
        ) {
          activeQuery.fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [activeQuery, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recommendations"
        description="Strategic actions generated from this week's competitor changes plus your company context."
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full bg-brand-800" />
          ))}
        </div>
      ) : (
        <RecommendationStatsBanner
          open={open}
          actedOn={actedOn}
          dismissed={dismissed}
          openIsCapped={openIsCapped}
          tierMax={tierMax}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTER_OPTIONS.map((opt) => {
          const isActive = opt.value === statusFilter;
          const count =
            opt.value === "all"
              ? open.length + actedOn.length + dismissed.length
              : opt.value === "open"
              ? open.length
              : opt.value === "acted-on"
              ? actedOn.length
              : dismissed.length;
          return (
            <Button
              key={opt.value}
              size="sm"
              variant={isActive ? "default" : "outline"}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                "h-8 px-3 text-xs",
                isActive && "bg-primary text-primary-foreground"
              )}
            >
              {opt.label}
              <span className="ml-2 rounded bg-brand-950/40 px-1.5 py-0.5 text-[10px] tabular-nums">
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      {activeRecs.length === 0 ? (
        <EmptyForFilter status={statusFilter} />
      ) : (
        <ol className="space-y-3">
          {activeRecs.map((r) => (
            <RecommendationRow key={r.id} rec={r} showActions />
          ))}
        </ol>
      )}

      {activeQuery && activeQuery.hasNextPage && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {activeQuery.isFetchingNextPage && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      <AiDisclaimer />
    </div>
  );
}

function EmptyForFilter({ status }: { status: StatusFilter }) {
  const copy: Record<StatusFilter, { title: string; body: string }> = {
    all: {
      title: "No recommendations yet",
      body: "Recommendations appear after your weekly digest. They use this week's changes plus your company context to suggest 3–7 strategic actions tagged by category, effort, and time horizon.",
    },
    open: {
      title: "No open recommendations",
      body: "Looks like you've worked through everything currently open. Next week's digest will surface new ones.",
    },
    "acted-on": {
      title: "No acted-on recommendations yet",
      body: "When you mark a recommendation as acted-on, it shows up here as a record of what your team has executed.",
    },
    dismissed: {
      title: "No dismissed recommendations yet",
      body: "Dismissed recommendations live here so you can revisit if context changes.",
    },
  };
  const c = copy[status];
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-brand-700/60 bg-brand-900 py-12 text-center">
      <Lightbulb className="h-10 w-10 text-muted-foreground" />
      <div>
        <h3 className="text-lg font-semibold">{c.title}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{c.body}</p>
      </div>
    </div>
  );
}
