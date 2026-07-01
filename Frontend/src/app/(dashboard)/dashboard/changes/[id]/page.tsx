"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useChangeDetail } from "@/lib/hooks/use-change-detail";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorAlert } from "@/components/shared/error-alert";
import { AiAnalysisPanel } from "@/components/dashboard/ai-analysis-panel";
import { DiffViewer } from "@/components/dashboard/diff-viewer";
import { FeedbackButtons } from "@/components/dashboard/feedback-buttons";
import { ChangeNotesSection } from "@/components/dashboard/change-notes-section";
import { SignificanceBadge } from "@/components/dashboard/significance-badge";
import { CitationList } from "@/components/dashboard/citation-list";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFullDate } from "@/lib/utils/format-date";

export default function ChangeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: change, isLoading, isError, error, refetch } = useChangeDetail(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 bg-brand-800" />
        <Skeleton className="h-60 w-full bg-brand-800" />
        <Skeleton className="h-40 w-full bg-brand-800" />
      </div>
    );
  }

  if (isError || !change) {
    return (
      <ErrorAlert
        message={error?.message ?? "Change not found"}
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
        <PageHeader title={change.competitorName ?? "Change Detail"}>
          <SignificanceBadge score={change.significance} showInfo />
        </PageHeader>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>Detected {formatFullDate(change.detectedAt)}</span>
        <span>|</span>
        <a
          href={change.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-primary hover:underline"
        >
          {new URL(change.pageUrl).hostname}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <AiAnalysisPanel analysis={change.aiAnalysis} />

      {change.citations && change.citations.length > 0 && (
        <>
          <Separator className="bg-brand-700" />
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Sources
            </h2>
            <CitationList citations={change.citations} />
          </div>
        </>
      )}

      <Separator className="bg-brand-700" />

      {change.diffSummary && <DiffViewer diffSummary={change.diffSummary} />}

      <Separator className="bg-brand-700" />

      <FeedbackButtons changeId={change.id} currentFeedback={change.feedbackHelpful} />

      <Separator className="bg-brand-700" />

      <ChangeNotesSection changeId={change.id} />
    </div>
  );
}
