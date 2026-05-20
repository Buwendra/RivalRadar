"use client";

/**
 * Phase 23 — Brand Pulse. Coverage feed for the Your Brand page. Pulls from
 * /brand/coverage (not /changes) and reuses the existing ChangeCard layout
 * with the competitor name suppressed (always the user's own brand).
 *
 * Mirrors the loading + infinite-scroll pattern in `change-feed.tsx` but is
 * thin enough to inline here rather than refactor the existing component.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ExternalLink, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangeTypeBadge } from "./change-type-badge";
import { SignificanceBadge } from "./significance-badge";
import { useBrandCoverage } from "@/lib/hooks/use-brand";
import { formatSmartDate } from "@/lib/utils/format-date";
import type { BrandCoverageChange } from "@/lib/types";

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function BrandCoverageFeed() {
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useBrandCoverage();

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasNextPage) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full bg-brand-800" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-muted-foreground">
        Coverage feed could not be loaded. Try refreshing.
      </p>
    );
  }

  const items: BrandCoverageChange[] = (data?.pages ?? []).flatMap((p) => p.data);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No coverage detected yet. Findings will appear here after the first research run.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((c) => {
        const hostname = safeHostname(c.pageUrl);
        return (
          <Link key={c.id} href={`/dashboard/changes/${c.id}`}>
            <Card className="border-brand-700 bg-brand-900 transition-colors hover:border-brand-600 hover:bg-brand-800">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ChangeTypeBadge type={c.aiAnalysis.changeType} />
                    <SignificanceBadge score={c.significance} />
                    {c.sourceCategory && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Sparkles className="h-3 w-3" />
                        {c.sourceCategory}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {c.aiAnalysis.summary}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatSmartDate(c.detectedAt)}</span>
                    {hostname && (
                      <span className="flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        {hostname}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
      <div ref={sentinelRef} />
      {isFetchingNextPage && (
        <Skeleton className="h-24 w-full bg-brand-800" />
      )}
    </div>
  );
}
