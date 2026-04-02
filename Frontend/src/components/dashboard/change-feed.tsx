"use client";

import { useEffect, useRef } from "react";
import { Activity } from "lucide-react";
import { ChangeCard } from "./change-card";
import { EmptyState } from "./empty-state";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorAlert } from "@/components/shared/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useChanges } from "@/lib/hooks/use-changes";
import type { ChangeFilters } from "@/lib/types";

interface ChangeFeedProps {
  filters?: ChangeFilters;
}

export function ChangeFeed({ filters = {} }: ChangeFeedProps) {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useChanges(filters);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full bg-brand-800" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorAlert
        message={error?.message ?? "Failed to load changes"}
        onRetry={() => refetch()}
      />
    );
  }

  const allChanges = data?.pages.flatMap((page) => page.data) ?? [];

  if (allChanges.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="h-12 w-12" />}
        title="No changes detected yet"
        description="We're monitoring your competitors. Changes will appear here as they're detected."
      />
    );
  }

  return (
    <div className="space-y-3">
      {allChanges.map((change) => (
        <ChangeCard key={change.id} change={change} />
      ))}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="flex justify-center py-4">
        {isFetchingNextPage && <LoadingSpinner />}
      </div>
    </div>
  );
}
