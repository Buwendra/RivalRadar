"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bookmark, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/use-auth";
import {
  useDeleteSavedView,
  useSavedViews,
} from "@/lib/hooks/use-saved-views";
import { capabilitiesFor } from "@/lib/utils/capabilities";
import { cn } from "@/lib/utils";

export function SavedViewsSection() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const activeViewId = searchParams.get("viewId");
  const { data: views, isLoading } = useSavedViews();
  const deleteMutation = useDeleteSavedView();

  // Hide the section entirely for tiers without saved views (Scout).
  const cap = capabilitiesFor(user).savedViews.max;
  if (cap === 0) return null;
  if (isLoading || !views || views.length === 0) return null;

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete saved view "${name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("View deleted");
    } catch {
      toast.error("Failed to delete view");
    }
  };

  return (
    <>
      <div className="px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Saved views
        </span>
      </div>
      <div className="space-y-1 px-3 pb-2">
        {views.map((view) => {
          const isActive = activeViewId === view.id;
          return (
            <Link
              key={view.id}
              href={`/dashboard?viewId=${view.id}`}
              className={cn(
                "group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-brand-800 text-foreground"
                  : "text-muted-foreground hover:bg-brand-800 hover:text-foreground"
              )}
            >
              <Bookmark className="h-3 w-3 shrink-0" />
              <span className="flex-1 truncate">{view.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100"
                onClick={(e) => handleDelete(view.id, view.name, e)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && deleteMutation.variables === view.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </Link>
          );
        })}
      </div>
    </>
  );
}
