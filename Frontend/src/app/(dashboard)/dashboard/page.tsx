"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useCompetitors } from "@/lib/hooks/use-competitors";
import { useChanges } from "@/lib/hooks/use-changes";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ChangeFilters } from "@/components/dashboard/change-filters";
import { ChangeFeed } from "@/components/dashboard/change-feed";
import { AddCompetitorDialog } from "@/components/dashboard/add-competitor-dialog";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [competitorFilter, setCompetitorFilter] = useState<string | undefined>();
  const [significanceFilter, setSignificanceFilter] = useState<string | undefined>();

  const { data: competitors = [] } = useCompetitors();
  const { data: changesData } = useChanges({
    competitorId: competitorFilter,
    minSignificance: significanceFilter ? Number(significanceFilter) : undefined,
  });

  const allChanges = changesData?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your competitive intelligence feed"
      >
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Competitor
        </Button>
      </PageHeader>

      <StatsCards competitors={competitors} changes={allChanges} />

      <ChangeFilters
        competitors={competitors}
        selectedCompetitorId={competitorFilter}
        selectedSignificance={significanceFilter}
        onCompetitorChange={setCompetitorFilter}
        onSignificanceChange={setSignificanceFilter}
      />

      <ChangeFeed
        filters={{
          competitorId: competitorFilter,
          minSignificance: significanceFilter ? Number(significanceFilter) : undefined,
        }}
      />

      <AddCompetitorDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  );
}
