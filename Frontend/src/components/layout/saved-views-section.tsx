"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bookmark, Trash2, Loader2, Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/use-auth";
import {
  useDeleteSavedView,
  useSavedViews,
  useSubscribeSavedView,
  useUnsubscribeSavedView,
} from "@/lib/hooks/use-saved-views";
import { capabilitiesFor } from "@/lib/utils/capabilities";
import { cn } from "@/lib/utils";

export function SavedViewsSection() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const activeViewId = searchParams.get("viewId");
  const { data: views, isLoading } = useSavedViews();
  const deleteMutation = useDeleteSavedView();
  const subscribeMutation = useSubscribeSavedView();
  const unsubscribeMutation = useUnsubscribeSavedView();

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

  const handleToggleSubscribe = async (
    id: string,
    name: string,
    isSubscribed: boolean,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (isSubscribed) {
        await unsubscribeMutation.mutateAsync(id);
        toast.success(`Unsubscribed from "${name}"`);
      } else {
        await subscribeMutation.mutateAsync(id);
        toast.success(`Subscribed to "${name}" — weekly email`);
      }
    } catch {
      toast.error(isSubscribed ? "Failed to unsubscribe" : "Failed to subscribe");
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
          const isSubscribed = view.subscribed === true;
          const subscribeBusy =
            (subscribeMutation.isPending && subscribeMutation.variables === view.id) ||
            (unsubscribeMutation.isPending && unsubscribeMutation.variables === view.id);
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
              {/*
                Bell stays visible (not hover-only) when subscribed — it's a
                state indicator. Outline bell on hover when not subscribed,
                hidden otherwise to keep the row clean.
              */}
              <Button
                variant="ghost"
                size="icon"
                title={
                  isSubscribed
                    ? "Unsubscribe from weekly email"
                    : "Subscribe to weekly email digest"
                }
                className={cn(
                  "h-5 w-5",
                  isSubscribed
                    ? "text-primary"
                    : "opacity-0 group-hover:opacity-100"
                )}
                onClick={(e) =>
                  handleToggleSubscribe(view.id, view.name, isSubscribed, e)
                }
                disabled={subscribeBusy}
              >
                {subscribeBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isSubscribed ? (
                  <BellRing className="h-3 w-3" />
                ) : (
                  <Bell className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Delete saved view"
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
