"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Bookmark, X, Upload } from "lucide-react";
import { useCompetitors } from "@/lib/hooks/use-competitors";
import { useChanges } from "@/lib/hooks/use-changes";
import { useSavedViews } from "@/lib/hooks/use-saved-views";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ChangeFilters } from "@/components/dashboard/change-filters";
import { ChangeFeed } from "@/components/dashboard/change-feed";
import { AddCompetitorDialog } from "@/components/dashboard/add-competitor-dialog";
import { BulkImportDialog } from "@/components/dashboard/bulk-import-dialog";
import { CompetitorRankedStrip } from "@/components/dashboard/competitor-ranked-strip";
import { RecommendationsCard } from "@/components/dashboard/recommendations-card";
import { FirstRunTour } from "@/components/dashboard/first-run-tour";
import { ExportButton } from "@/components/dashboard/export-button";
import { SaveViewDialog } from "@/components/dashboard/save-view-dialog";
import { OnboardingChecklistCard } from "@/components/dashboard/onboarding-checklist-card";
import { ActiveResearchPanel } from "@/components/dashboard/active-research-panel";
import { BrandHealthScoreCard } from "@/components/dashboard/brand-health-score-card";
import { SinceLastLookedCard } from "@/components/dashboard/since-last-looked-card";
import { Button } from "@/components/ui/button";
import { useCapabilities, useCapability } from "@/lib/hooks/use-capability";

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewId = searchParams.get("viewId");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [competitorFilter, setCompetitorFilter] = useState<string | undefined>();
  const [significanceFilter, setSignificanceFilter] = useState<string | undefined>();

  const capabilities = useCapabilities();
  const brandPulseEnabled = useCapability("brandPulse");
  const { data: competitors = [] } = useCompetitors();
  const { data: views = [] } = useSavedViews();

  // Apply a saved view's filters to the local state when ?viewId= is present.
  // Effects only on viewId change so manual filter edits aren't reset on re-render.
  const activeView = useMemo(
    () => views.find((v) => v.id === viewId) ?? null,
    [views, viewId]
  );
  useEffect(() => {
    if (!activeView) return;
    const f = activeView.filters;
    setCompetitorFilter(f.competitorIds?.[0]);
    setSignificanceFilter(f.minSignificance ? String(f.minSignificance) : undefined);
  }, [activeView]);

  const filters = {
    competitorId: competitorFilter,
    minSignificance: significanceFilter ? Number(significanceFilter) : undefined,
    changeTypes: activeView?.filters.changeTypes,
    sinceDays: activeView?.filters.sinceDays,
  };

  const { data: changesData } = useChanges(filters);
  const allChanges = changesData?.pages.flatMap((page) => page.data) ?? [];

  const hasFilters = Boolean(competitorFilter || significanceFilter);
  const canSaveView = capabilities.savedViews.max > 0;

  const handleClearView = () => {
    setCompetitorFilter(undefined);
    setSignificanceFilter(undefined);
    router.replace("/dashboard");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your competitive intelligence feed"
      >
        <div className="flex items-center gap-2">
          <ExportButton />
          <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk import
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Competitor
          </Button>
        </div>
      </PageHeader>

      <SinceLastLookedCard />

      <ActiveResearchPanel />

      <div data-tour="competitor-strip">
        <CompetitorRankedStrip competitors={competitors} />
      </div>

      <div data-tour="recommendations">
        <RecommendationsCard />
      </div>

      {brandPulseEnabled && <BrandHealthScoreCard size="sm" />}

      <div data-tour="stats-cards">
        <StatsCards
          competitors={competitors}
          changes={allChanges}
          onAddCompetitor={() => setAddDialogOpen(true)}
          onBulkImport={() => setBulkImportOpen(true)}
        />
      </div>

      <OnboardingChecklistCard
        onAddCompetitor={() => setAddDialogOpen(true)}
      />

      {activeView && (
        <div className="flex items-center gap-2 rounded-md border border-brand-700/60 bg-brand-900 px-3 py-2 text-sm">
          <Bookmark className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Active view:</span>
          <span className="font-medium">{activeView.name}</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-6 w-6"
            onClick={handleClearView}
            aria-label="Clear active view"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChangeFilters
          competitors={competitors}
          selectedCompetitorId={competitorFilter}
          selectedSignificance={significanceFilter}
          onCompetitorChange={setCompetitorFilter}
          onSignificanceChange={setSignificanceFilter}
        />
        {canSaveView && hasFilters && !activeView && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSaveDialogOpen(true)}
          >
            <Bookmark className="mr-2 h-3 w-3" />
            Save view
          </Button>
        )}
      </div>

      <ChangeFeed filters={filters} />

      <AddCompetitorDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <BulkImportDialog open={bulkImportOpen} onOpenChange={setBulkImportOpen} />

      <SaveViewDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        filters={{
          minSignificance: significanceFilter ? Number(significanceFilter) : undefined,
          competitorIds: competitorFilter ? [competitorFilter] : undefined,
        }}
        onCreated={(id) => router.replace(`/dashboard?viewId=${id}`)}
      />

      <FirstRunTour />
    </div>
  );
}
