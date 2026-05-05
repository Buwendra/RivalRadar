"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BellOff, Bell, Loader2, ChevronDown } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useSnoozeCompetitor } from "@/lib/hooks/use-competitors";
import { ApiClientError } from "@/lib/api/client";

interface SnoozeButtonProps {
  competitorId: string;
  competitorName: string;
  snoozedUntil?: string | null;
  /** Compact button variant for in-card placement. */
  variant?: "default" | "compact";
}

const PRESETS: Array<{ label: string; days: number }> = [
  { label: "Snooze 7 days", days: 7 },
  { label: "Snooze 30 days", days: 30 },
  { label: "Snooze 90 days", days: 90 },
];

// Far-future ISO for "indefinitely" — December 31, 9999. The snooze can still
// be cleared at any time via the Unsnooze button.
const INDEFINITE_ISO = "9999-12-31T23:59:59.999Z";

function plusDaysIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function formatRelative(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso.slice(0, 10);
  }
}

export function SnoozeButton({
  competitorId,
  competitorName,
  snoozedUntil,
  variant = "default",
}: SnoozeButtonProps) {
  const [open, setOpen] = useState(false);
  const snoozeMutation = useSnoozeCompetitor();

  // A future timestamp = currently snoozed
  const isCurrentlySnoozed =
    !!snoozedUntil && Date.parse(snoozedUntil) > Date.now();

  const handleSnooze = async (until: string | null) => {
    setOpen(false);
    try {
      await snoozeMutation.mutateAsync({ id: competitorId, snoozedUntil: until });
      toast.success(
        until
          ? `${competitorName} snoozed`
          : `${competitorName} un-snoozed`
      );
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Snooze failed";
      toast.error(msg);
    }
  };

  if (isCurrentlySnoozed) {
    // When snoozed, render a single "Snoozed (until X) · Unsnooze" pill button
    return (
      <Button
        variant="outline"
        size={variant === "compact" ? "sm" : "default"}
        onClick={() => handleSnooze(null)}
        disabled={snoozeMutation.isPending}
        className="border-amber-900/60 bg-amber-950/40 text-amber-300 hover:bg-amber-950/60"
      >
        {snoozeMutation.isPending ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <BellOff className="mr-2 h-3.5 w-3.5" />
        )}
        Snoozed · click to resume
        <Badge variant="outline" className="ml-2 h-5 border-amber-900/60 px-1.5 text-[10px]">
          {snoozedUntil === INDEFINITE_ISO ? "indefinitely" : formatRelative(snoozedUntil!)}
        </Badge>
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={variant === "compact" ? "sm" : "default"}
          disabled={snoozeMutation.isPending}
        >
          {snoozeMutation.isPending ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bell className="mr-2 h-3.5 w-3.5" />
          )}
          Snooze
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Pause monitoring
        </DropdownMenuLabel>
        {PRESETS.map((p) => (
          <DropdownMenuItem
            key={p.days}
            onClick={() => handleSnooze(plusDaysIso(p.days))}
          >
            {p.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleSnooze(INDEFINITE_ISO)}
          className="text-amber-300 focus:text-amber-200"
        >
          Snooze indefinitely
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
