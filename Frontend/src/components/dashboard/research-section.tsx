"use client";

import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ResearchCard } from "./research-card";
import { useTriggerResearch } from "@/lib/hooks/use-competitors";
import type { ResearchFinding } from "@/lib/types";

interface ResearchSectionProps {
  competitorId: string;
  research: ResearchFinding[];
}

export function ResearchSection({ competitorId, research }: ResearchSectionProps) {
  const triggerResearch = useTriggerResearch();

  const handleTrigger = async () => {
    try {
      await triggerResearch.mutateAsync(competitorId);
      toast.success("Deep research started. New findings will appear in about 60 seconds.");
    } catch {
      toast.error("Failed to start deep research.");
    }
  };

  const latest = research[0];

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

      {latest ? (
        <ResearchCard finding={latest} />
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
