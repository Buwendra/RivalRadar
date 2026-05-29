"use client";

import { useState } from "react";
import { toast } from "sonner";
import { History, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ResearchCard } from "./research-card";
import { TimeMachineSlider } from "./time-machine-slider";
import { useTriggerResearch } from "@/lib/hooks/use-competitors";
import { formatSmartDate } from "@/lib/utils/format-date";
import type { ResearchFinding } from "@/lib/types";

interface ResearchSectionProps {
  competitorId: string;
  competitorUrl?: string;
  research: ResearchFinding[];
}

export function ResearchSection({ competitorId, competitorUrl, research }: ResearchSectionProps) {
  const triggerResearch = useTriggerResearch();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const handleTrigger = async () => {
    try {
      await triggerResearch.mutateAsync(competitorId);
      toast.success("Deep research started. New findings will appear in about 60 seconds.");
    } catch {
      toast.error("Failed to start deep research.");
    }
  };

  // The newest finding is the default. When the user clicks a tick the
  // slider sends the id back here; we look it up and render.
  const latest = research[0];
  const selected =
    (selectedId ? research.find((r) => r.id === selectedId) : undefined) ?? latest;
  const isHistorical = selected && latest && selected.id !== latest.id;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI Deep Research</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTrigger}
          disabled={triggerResearch.isPending}
        >
          {triggerResearch.isPending ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Run deep research
        </Button>
      </div>

      {latest && research.length >= 2 && (
        <div className="mb-3">
          <TimeMachineSlider
            findings={research}
            selectedId={selected?.id}
            onSelect={setSelectedId}
          />
        </div>
      )}

      {isHistorical && selected && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs">
          <span className="flex items-center gap-2 text-amber-300">
            <History className="h-3.5 w-3.5" />
            Viewing snapshot from {formatSmartDate(selected.generatedAt)}
            <Badge variant="outline" className="ml-1 border-amber-700 text-[10px] text-amber-200">
              Threat / momentum / tags still show current values
            </Badge>
          </span>
          <button
            type="button"
            onClick={() => setSelectedId(undefined)}
            className="text-amber-200 hover:text-amber-100 hover:underline"
          >
            Return to latest →
          </button>
        </div>
      )}

      {selected ? (
        <ResearchCard finding={selected} competitorUrl={competitorUrl} />
      ) : (
        <Card className="border-brand-700 bg-brand-900">
          <CardContent className="p-5 text-center">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">No research yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Click &ldquo;Run deep research&rdquo; to have Claude search the web for news, product
              updates, funding, hiring and social activity.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
