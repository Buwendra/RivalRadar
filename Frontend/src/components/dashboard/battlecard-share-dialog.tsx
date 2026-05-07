"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useBattlecards,
  useRevokeBattlecard,
} from "@/lib/hooks/use-battlecards";
import { formatRelativeDate } from "@/lib/utils/format-date";
import type { BattlecardSummary } from "@/lib/types";

interface BattlecardShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitorId: string;
  primary?: BattlecardSummary;
}

export function BattlecardShareDialog({
  open,
  onOpenChange,
  competitorId,
  primary,
}: BattlecardShareDialogProps) {
  const history = useBattlecards(competitorId);
  const revoke = useRevokeBattlecard();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const items = history.data ?? [];
  // Show the most recent first; if `primary` was passed, prefer it (ensures the
  // dialog shows the just-generated row even before the list query refetches).
  const head =
    primary ??
    items.find((b) => !b.revokedAt) ??
    items[0] ??
    null;
  const rest = items.filter((b) => b.id !== head?.id);

  const handleCopy = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.success("Share link copied");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revoke.mutateAsync(id);
      toast.success("Battlecard revoked");
    } catch {
      toast.error("Revoke failed");
    }
  };

  const formatExpires = (epochSec: number) => {
    return new Date(epochSec * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Battlecard ready</DialogTitle>
          <DialogDescription>
            Anyone with this link can view the PDF without signing in. Links
            expire after 30 days; revoke any time.
          </DialogDescription>
        </DialogHeader>

        {head ? (
          <div className="space-y-3 rounded-md border border-brand-700 bg-brand-950/40 p-3">
            <div>
              <div className="truncate text-xs text-muted-foreground">
                {head.filename}
              </div>
              <input
                readOnly
                value={head.shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-2 w-full rounded border border-brand-700 bg-brand-900 px-2 py-1.5 text-xs text-foreground"
              />
              <div className="mt-1 text-[11px] text-muted-foreground">
                Expires {formatExpires(head.expiresAt)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="default">
                <a href={head.shareUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open battlecard
                </a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(head.shareUrl, head.id)}
              >
                {copiedId === head.id ? (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                )}
                Copy link
              </Button>
              {!head.revokedAt && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRevoke(head.id)}
                  disabled={revoke.isPending}
                >
                  {revoke.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Revoke
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No battlecards yet for this competitor.
          </div>
        )}

        {rest.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Earlier battlecards
            </h4>
            <ul className="space-y-2">
              {rest.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded border border-brand-700/60 bg-brand-900 px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground">{b.filename}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Created {formatRelativeDate(b.createdAt)}
                      {b.revokedAt ? " · revoked" : ""}
                    </div>
                  </div>
                  {!b.revokedAt && (
                    <>
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                      >
                        <a
                          href={b.shareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => handleCopy(b.shareUrl, b.id)}
                        aria-label="Copy link"
                      >
                        {copiedId === b.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-muted-foreground hover:text-red-400"
                        onClick={() => handleRevoke(b.id)}
                        aria-label="Revoke"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
