"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompetitorUrlInput } from "./competitor-url-input";

export interface CompetitorEntry {
  name: string;
  url: string;
}

interface StepCompetitorsProps {
  competitors: CompetitorEntry[];
  maxCompetitors: number;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: "name" | "url", value: string) => void;
}

export function StepCompetitors({
  competitors,
  maxCompetitors,
  onAdd,
  onRemove,
  onUpdate,
}: StepCompetitorsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Add your competitors</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the companies you want to monitor. You can add up to {maxCompetitors} competitors on your plan.
        </p>
      </div>

      <div className="space-y-3">
        {competitors.map((competitor, index) => (
          <CompetitorUrlInput
            key={index}
            index={index}
            name={competitor.name}
            url={competitor.url}
            onNameChange={(value) => onUpdate(index, "name", value)}
            onUrlChange={(value) => onUpdate(index, "url", value)}
            onRemove={() => onRemove(index)}
            canRemove={competitors.length > 1}
          />
        ))}
      </div>

      {competitors.length < maxCompetitors && (
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add another competitor
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        {competitors.length} of {maxCompetitors} competitor slots used
      </p>
    </div>
  );
}
