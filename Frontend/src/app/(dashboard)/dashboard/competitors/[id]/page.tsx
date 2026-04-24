"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ExternalLink,
  Radar,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { useCompetitorDetail } from "@/lib/hooks/use-competitor-detail";
import { useDeleteCompetitor, useScrapeCompetitor } from "@/lib/hooks/use-competitors";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorAlert } from "@/components/shared/error-alert";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SignificanceBadge } from "@/components/dashboard/significance-badge";
import { ChangeTypeBadge } from "@/components/dashboard/change-type-badge";
import { ResearchSection } from "@/components/dashboard/research-section";
import { formatSmartDate } from "@/lib/utils/format-date";
import Link from "next/link";

export default function CompetitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: competitor, isLoading, isError, error, refetch } = useCompetitorDetail(id);
  const deleteCompetitor = useDeleteCompetitor();
  const scrapeCompetitor = useScrapeCompetitor();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteCompetitor.mutateAsync(id);
      toast.success("Competitor deleted");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to delete competitor");
    }
  };

  const handleScrape = async () => {
    try {
      await scrapeCompetitor.mutateAsync(id);
      toast.success("Scrape started. Changes will appear shortly.");
    } catch {
      toast.error("Failed to start scrape");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 bg-brand-800" />
        <Skeleton className="h-40 w-full bg-brand-800" />
        <Skeleton className="h-60 w-full bg-brand-800" />
      </div>
    );
  }

  if (isError || !competitor) {
    return (
      <ErrorAlert
        message={error?.message ?? "Competitor not found"}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title={competitor.name}>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleScrape}
              disabled={scrapeCompetitor.isPending}
            >
              {scrapeCompetitor.isPending ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Radar className="mr-2 h-4 w-4" />
              )}
              Scan Now
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </PageHeader>
      </div>

      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <a
              href={competitor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {competitor.url}
              <ExternalLink className="h-3 w-3" />
            </a>
            <Badge variant={competitor.status === "active" ? "default" : "secondary"}>
              {competitor.status}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">Tracking:</span>
            {competitor.pagesToTrack.map((page) => (
              <Badge key={page} variant="outline" className="text-xs capitalize">
                {page}
              </Badge>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Added {formatSmartDate(competitor.createdAt)}
          </p>
        </CardContent>
      </Card>

      <ResearchSection
        competitorId={id}
        research={competitor.recentResearch ?? []}
      />

      <div>
        <h2 className="mb-4 text-lg font-semibold">Recent Changes</h2>
        {competitor.recentChanges.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No changes detected yet. Check back after the next scan.
          </p>
        ) : (
          <div className="space-y-3">
            {competitor.recentChanges.map((change) => (
              <Link key={change.id} href={`/dashboard/changes/${change.id}`}>
                <Card className="border-brand-700 bg-brand-900 transition-colors hover:bg-brand-800">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <ChangeTypeBadge type={change.aiAnalysis.changeType} />
                        <SignificanceBadge score={change.significance} />
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {change.aiAnalysis.summary}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatSmartDate(change.detectedAt)}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete competitor"
        description={`Are you sure you want to delete ${competitor.name}? This will also remove all tracked changes.`}
        confirmLabel="Delete"
        variant="destructive"
        isPending={deleteCompetitor.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
