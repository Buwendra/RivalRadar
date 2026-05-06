"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/api/client";
import { useCreateSavedView } from "@/lib/hooks/use-saved-views";
import type { SavedViewFilters } from "@/lib/types";

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: SavedViewFilters;
  /** Called with the new view's id once create succeeds. */
  onCreated?: (viewId: string) => void;
}

export function SaveViewDialog({ open, onOpenChange, filters, onCreated }: SaveViewDialogProps) {
  const [name, setName] = useState("");
  const createMutation = useCreateSavedView();

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give the view a name");
      return;
    }
    try {
      const view = await createMutation.mutateAsync({ name: trimmed, filters });
      toast.success(`View "${view.name}" saved`);
      setName("");
      onOpenChange(false);
      onCreated?.(view.id);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to save view";
      toast.error(msg);
    }
  };

  const filterDescription = describeFilters(filters);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save view</DialogTitle>
          <DialogDescription>
            Pin the current filter combination as a named view in the sidebar.
            Workspace members will see it too.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="view-name">Name</Label>
            <Input
              id="view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="High-priority pricing changes"
              maxLength={80}
              disabled={createMutation.isPending}
            />
          </div>
          <div className="rounded-md border border-brand-700/60 bg-brand-950/30 p-3 text-xs">
            <span className="font-medium text-muted-foreground">Filters:</span>
            <span className="ml-2 text-foreground">{filterDescription}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createMutation.isPending || !name.trim()}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save view
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function describeFilters(filters: SavedViewFilters): string {
  const parts: string[] = [];
  if (filters.minSignificance) parts.push(`Significance ≥ ${filters.minSignificance}`);
  if (filters.competitorIds && filters.competitorIds.length > 0) {
    parts.push(`${filters.competitorIds.length} competitor${filters.competitorIds.length === 1 ? "" : "s"}`);
  }
  if (filters.changeTypes && filters.changeTypes.length > 0) {
    parts.push(`Types: ${filters.changeTypes.join(", ")}`);
  }
  if (filters.sinceDays) parts.push(`Last ${filters.sinceDays}d`);
  return parts.length > 0 ? parts.join(" · ") : "No filters (matches all changes)";
}
