"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface CompetitorUrlInputProps {
  index: number;
  name: string;
  url: string;
  onNameChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function CompetitorUrlInput({
  index,
  name,
  url,
  onNameChange,
  onUrlChange,
  onRemove,
  canRemove,
}: CompetitorUrlInputProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-6 items-center justify-center text-sm text-muted-foreground">
        {index + 1}.
      </span>
      <div className="flex flex-1 flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Competitor name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="sm:w-1/3"
        />
        <Input
          placeholder="https://competitor.com"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          className="flex-1"
        />
      </div>
      {canRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
