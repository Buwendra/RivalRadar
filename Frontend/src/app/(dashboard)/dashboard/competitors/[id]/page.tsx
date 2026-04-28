"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ExternalLink,
  Trash2,
  ArrowLeft,
  Activity,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useCompetitorDetail } from "@/lib/hooks/use-competitor-detail";
import {
  useDeleteCompetitor,
  useTriggerResearch,
} from "@/lib/hooks/use-competitors";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorAlert } from "@/components/shared/error-alert";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SignificanceBadge } from "@/components/dashboard/significance-badge";
import { ChangeTypeBadge } from "@/components/dashboard/change-type-badge";
import { ResearchSection } from "@/components/dashboard/research-section";
import { ResearchCard } from "@/components/dashboard/research-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ActivitySparkline } from "@/components/dashboard/activity-sparkline";
import { PageActivityList } from "@/components/dashboard/page-activity-list";
import { MomentumChip } from "@/components/dashboard/momentum-chip";
import { ThreatCard } from "@/components/dashboard/threat-card";
import { CompetitorTagChips } from "@/components/dashboard/competitor-tag-chips";
import { formatSmartDate } from "@/lib/utils/format-date";
import type { CompetitorDetailChange, PageType } from "@/lib/types";

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  try {
    return `${formatDistanceToNow(parseISO(iso))} ago`;
  } catch {
    return "Never";
  }
}

export default function CompetitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: competitor, isLoading, isError, error, refetch } =
    useCompetitorDetail(id);
  const deleteCompetitor = useDeleteCompetitor();
  const triggerResearch = useTriggerResearch();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") ?? "overview"
  );

  const handleDelete = async () => {
    try {
      await deleteCompetitor.mutateAsync(id);
      toast.success("Competitor deleted");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to delete competitor");
    }
  };

  const handleResearch = async () => {
    try {
      await triggerResearch.mutateAsync(id);
      toast.success(
        "Research started. New findings and changes will appear in ~60-90 seconds."
      );
    } catch {
      toast.error("Failed to start research");
    }
  };

  const handlePageClick = (page: PageType) => {
    setActiveTab("changes");
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "changes");
    params.set("page", page);
    router.replace(`?${params.toString()}`, { scroll: false });
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

  const { stats, recentChanges, recentResearch, pagesToTrack } = competitor;
  const pageFilter = (searchParams.get("page") as PageType | null) ?? null;

  const filteredChanges: CompetitorDetailChange[] = pageFilter
    ? recentChanges.filter((c) => {
        if (!c.pageUrl) return pageFilter === "homepage";
        try {
          const path = new URL(c.pageUrl).pathname.toLowerCase();
          return path.includes(`/${pageFilter}`);
        } catch {
          return pageFilter === "homepage";
        }
      })
    : recentChanges;

  return (
    <div className="space-y-6">
      {/* Header bar: always visible */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader title={competitor.name}>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleResearch}
                disabled={triggerResearch.isPending}
                className="bg-cta text-brand-950 hover:bg-cta-hover"
              >
                {triggerResearch.isPending ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Research Now
              </Button>
            </div>
          </PageHeader>
        </div>
        <CompetitorTagChips tags={competitor.derivedTags} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="changes">
            Changes
            {stats.changes30d > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {stats.changes30d}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="research">
            Research
            {recentResearch.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {recentResearch.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW ─── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ThreatCard
              threatLevel={competitor.threatLevel}
              reasoning={competitor.threatReasoning}
            />
            <MetricCard
              label="Changes (30d)"
              value={stats.changes30d}
              sublabel={`${stats.changes7d} this week`}
              icon={Activity}
            />
            <MetricCard
              label="High Priority"
              value={stats.highSignificance30d}
              sublabel="Significance ≥ 7"
              icon={AlertTriangle}
              tone={stats.highSignificance30d > 0 ? "destructive" : "default"}
            />
            <MetricCard
              label="Last Research"
              value={formatRelative(stats.lastResearchAt)}
              icon={Sparkles}
            />
          </div>

          <Card className="border-brand-700 bg-brand-900">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Activity (last 30 days)
                </h3>
                <MomentumChip
                  momentum={competitor.momentum}
                  momentumChangePercent={competitor.momentumChangePercent}
                />
              </div>
              <ActivitySparkline data={stats.changesByDay} />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-brand-700 bg-brand-900">
              <CardContent className="space-y-3 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Tracked Pages
                </h3>
                <PageActivityList
                  pagesToTrack={pagesToTrack}
                  changesByPage={stats.changesByPage}
                  onPageClick={handlePageClick}
                />
              </CardContent>
            </Card>

            <Card className="border-brand-700 bg-brand-900">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Latest Research Summary
                  </h3>
                  {recentResearch.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("research")}
                      className="text-xs text-primary hover:underline"
                    >
                      Open →
                    </button>
                  )}
                </div>
                {recentResearch[0] ? (
                  <p className="text-sm leading-relaxed">
                    {recentResearch[0].summary}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No research yet. Open the Research tab to generate findings.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {recentChanges.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent Changes
                </h3>
                {recentChanges.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("changes")}
                    className="text-xs text-primary hover:underline"
                  >
                    See all {recentChanges.length} →
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {recentChanges.slice(0, 5).map((c) => (
                  <CompactChangeRow key={c.id} change={c} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── CHANGES ─── */}
        <TabsContent value="changes" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {pageFilter
                  ? `Changes on ${pageFilter}`
                  : `All recent changes`}
              </h3>
              {pageFilter && (
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams(
                      searchParams.toString()
                    );
                    params.delete("page");
                    router.replace(
                      `?${params.toString()}`,
                      { scroll: false }
                    );
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {filteredChanges.length} shown
            </span>
          </div>

          {filteredChanges.length === 0 ? (
            <Card className="border-brand-700 bg-brand-900">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No changes detected yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredChanges.map((c) => (
                <Link key={c.id} href={`/dashboard/changes/${c.id}`}>
                  <Card className="border-brand-700 bg-brand-900 transition-colors hover:bg-brand-800">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <ChangeTypeBadge type={c.aiAnalysis.changeType} />
                          <SignificanceBadge score={c.significance} />
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {c.aiAnalysis.summary}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatSmartDate(c.detectedAt)}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── RESEARCH ─── */}
        <TabsContent value="research" className="space-y-6">
          <ResearchSection
            competitorId={id}
            research={recentResearch}
          />

          {recentResearch.length > 1 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Earlier research runs
              </h3>
              <Accordion type="single" collapsible>
                {recentResearch.slice(1).map((r) => (
                  <AccordionItem
                    key={r.id}
                    value={r.id}
                    className="border-brand-700"
                  >
                    <AccordionTrigger className="text-sm hover:no-underline">
                      {formatSmartDate(r.generatedAt)} ·{" "}
                      {r.citations.length} source
                      {r.citations.length === 1 ? "" : "s"}
                    </AccordionTrigger>
                    <AccordionContent>
                      <ResearchCard finding={r} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </TabsContent>

        {/* ─── SETTINGS ─── */}
        <TabsContent value="settings" className="space-y-4">
          <Card className="border-brand-700 bg-brand-900">
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Website
                </p>
                <a
                  href={competitor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {competitor.url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Status
                </p>
                <Badge
                  variant={
                    competitor.status === "active" ? "default" : "secondary"
                  }
                  className="mt-1"
                >
                  {competitor.status}
                </Badge>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tracking
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {competitor.pagesToTrack.map((page) => (
                    <Badge
                      key={page}
                      variant="outline"
                      className="text-xs capitalize"
                    >
                      {page}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Added
                </p>
                <p className="mt-1 text-sm">
                  {formatSmartDate(competitor.createdAt)}
                </p>
              </div>

              <Separator className="bg-brand-700" />

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Danger Zone
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Competitor
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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

function CompactChangeRow({ change }: { change: CompetitorDetailChange }) {
  return (
    <Link href={`/dashboard/changes/${change.id}`}>
      <Card className="border-brand-700 bg-brand-900 transition-colors hover:bg-brand-800">
        <CardContent className="flex items-center justify-between gap-3 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <SignificanceBadge score={change.significance} />
            <ChangeTypeBadge type={change.aiAnalysis.changeType} />
            <p className="min-w-0 truncate text-sm text-muted-foreground">
              {change.aiAnalysis.summary}
            </p>
          </div>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatSmartDate(change.detectedAt)}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
