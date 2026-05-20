"use client";

/**
 * Phase 23 — Brand Pulse. The "Your Brand" page — self-monitoring surface
 * for the workspace's own brand. Mirrors the competitor detail page structure
 * with threat / predicted-moves / battlecard removed and a sentiment trend +
 * brand-flavoured coverage feed added.
 *
 * Three render states:
 *  1. Loading → skeletons
 *  2. `needsSetup` (data === null) → empty-state CTA opening the setup dialog
 *  3. Loaded → metrics + sentiment trend + tag chips + latest research + coverage
 */

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Activity, Sparkles, Calendar } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

import { useBrand, useTriggerBrandResearch, useBrandSentiment } from "@/lib/hooks/use-brand";
import { useCapability } from "@/lib/hooks/use-capability";
import { useAuth } from "@/lib/auth/use-auth";

import { PageHeader } from "@/components/shared/page-header";
import { ErrorAlert } from "@/components/shared/error-alert";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

import { MetricCard } from "@/components/dashboard/metric-card";
import { ActivitySparkline } from "@/components/dashboard/activity-sparkline";
import { MomentumChip } from "@/components/dashboard/momentum-chip";
import { CompetitorTagChips } from "@/components/dashboard/competitor-tag-chips";
import { ResearchCard } from "@/components/dashboard/research-card";
import { AiDisclaimer } from "@/components/dashboard/ai-disclaimer";
import { SentimentTrend } from "@/components/dashboard/sentiment-trend";
import { BrandCoverageFeed } from "@/components/dashboard/brand-coverage-feed";
import { BrandSetupDialog } from "@/components/dashboard/brand-setup-dialog";
import { BrandHealthScoreCard } from "@/components/dashboard/brand-health-score-card";

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    return `${formatDistanceToNow(parseISO(iso))} ago`;
  } catch {
    return "Never";
  }
}

export default function YourBrandPage() {
  const { user } = useAuth();
  const brandPulseEnabled = useCapability("brandPulse");
  const { data, isLoading, isError, error, refetch } = useBrand();
  const { data: sentiment } = useBrandSentiment();
  const triggerResearch = useTriggerBrandResearch();
  const [setupOpen, setSetupOpen] = useState(false);

  if (!brandPulseEnabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="Your Brand" />
        <Card className="border-brand-700 bg-brand-900">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Brand Pulse is not available on your current plan.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Your Brand" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-brand-800" />
          ))}
        </div>
        <Skeleton className="h-40 w-full bg-brand-800" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Your Brand" />
        <ErrorAlert message={error?.message ?? "Unable to load brand data."} onRetry={refetch} />
      </div>
    );
  }

  // Empty state — legacy user with no self-brand row.
  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Your Brand" />
        <Card className="border-brand-700 bg-brand-900">
          <CardContent className="space-y-4 p-8 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-emerald-400" />
            <h2 className="text-xl font-semibold">Monitor your own brand</h2>
            <p className="mx-auto max-w-xl text-sm text-muted-foreground">
              Track how the market is talking about you — third-party coverage, sentiment,
              and narratives forming around your brand. Same deep-research engine you use
              for competitors.
            </p>
            <Button
              onClick={() => setSetupOpen(true)}
              className="bg-cta text-brand-950 hover:bg-cta-hover"
            >
              Set up brand monitoring
            </Button>
          </CardContent>
        </Card>
        <BrandSetupDialog
          open={setupOpen}
          onOpenChange={setSetupOpen}
          defaultCompanyName={user?.companyName}
          defaultIndustry={user?.industry}
        />
      </div>
    );
  }

  const handleResearch = async () => {
    try {
      await triggerResearch.mutateAsync();
      toast.success(
        "Research started. New findings will appear in ~60-90 seconds."
      );
    } catch {
      toast.error("Failed to start research");
    }
  };

  const totalChanges30d = data.changesByDay.reduce((sum, d) => sum + d.count, 0);
  const lastResearchAt = data.latestResearch?.generatedAt ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title={data.name} description="How the market is talking about you.">
        <Button variant="outline" asChild>
          <a href={data.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Visit site
          </a>
        </Button>
        <Button
          onClick={handleResearch}
          disabled={triggerResearch.isPending}
          className="bg-cta text-brand-950 hover:bg-cta-hover"
        >
          {triggerResearch.isPending && <LoadingSpinner size="sm" className="mr-2" />}
          <Sparkles className="mr-2 h-4 w-4" />
          Research now
        </Button>
      </PageHeader>

      {/* Brand Health Score (Phase 24) */}
      <BrandHealthScoreCard />

      {/* Top metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          label="Coverage (30d)"
          value={totalChanges30d}
          sublabel={totalChanges30d === 0 ? "No mentions yet" : "Tracked mentions"}
          icon={Activity}
        />
        <Card className="border-brand-700 bg-brand-900">
          <CardContent className="space-y-2 p-4">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Momentum
            </span>
            <div>
              <MomentumChip
                momentum={data.momentum}
                momentumChangePercent={data.momentumChangePercent}
                size="md"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {data.momentumAsOf ? `Updated ${formatRelative(data.momentumAsOf)}` : ""}
            </p>
          </CardContent>
        </Card>
        <MetricCard
          label="Last research"
          value={formatRelative(lastResearchAt)}
          sublabel={lastResearchAt ?? "Never run"}
          icon={Calendar}
        />
      </div>

      {/* Tag chips */}
      {data.derivedTags.length > 0 && (
        <Card className="border-brand-700 bg-brand-900">
          <CardContent className="space-y-2 p-4">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Brand signals
            </span>
            <CompetitorTagChips tags={data.derivedTags} />
          </CardContent>
        </Card>
      )}

      {/* Activity sparkline */}
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Mentions over time</h2>
          <ActivitySparkline data={data.changesByDay} />
        </CardContent>
      </Card>

      {/* Sentiment trend */}
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Sentiment trend</h2>
            <span className="text-xs text-muted-foreground">Last 12 weeks</span>
          </div>
          {sentiment ? (
            <SentimentTrend weeks={sentiment.weeks} />
          ) : (
            <Skeleton className="h-24 w-full bg-brand-800" />
          )}
          <AiDisclaimer />
        </CardContent>
      </Card>

      {/* Latest research summary */}
      {data.latestResearch && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Latest research</h2>
          <ResearchCard
            finding={{
              id: data.latestResearch.id,
              competitorId: data.id,
              userId: "",
              generatedAt: data.latestResearch.generatedAt,
              summary: data.latestResearch.summary,
              categories: data.latestResearch.categories,
              citations: data.latestResearch.citations,
              searchQueries: data.latestResearch.searchQueries,
              tokensUsed: 0,
            }}
            competitorUrl={data.url}
          />
        </div>
      )}

      <Separator className="bg-brand-700" />

      {/* Coverage feed */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Recent coverage</h2>
        <BrandCoverageFeed />
      </div>
    </div>
  );
}
