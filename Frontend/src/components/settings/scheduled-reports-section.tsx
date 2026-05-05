"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Calendar, Loader2, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth/use-auth";
import { useCapability } from "@/lib/hooks/use-capability";
import { usersApi } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import Link from "next/link";

/**
 * Phase 6c — Command-tier exclusive opt-in for the monthly PDF briefing
 * sent on the 1st of each month at 8am UTC. Lower tiers see a locked card
 * with upgrade CTA, mirroring the Phase 6a custom-categories pattern.
 */
export function ScheduledReportsSection() {
  const allowed = useCapability("scheduledReports");
  const { user, refreshUser } = useAuth();
  const [monthly, setMonthly] = useState<boolean>(
    user?.scheduledReports?.monthly ?? false
  );
  const [isSaving, setIsSaving] = useState(false);

  const dirty = monthly !== (user?.scheduledReports?.monthly ?? false);

  if (!allowed) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Scheduled briefings</CardTitle>
            <Badge variant="outline" className="text-xs">Command</Badge>
          </div>
          <CardDescription>
            Get a board-ready PDF briefing emailed to you on the 1st of every
            month — covers the past 30 days of competitor activity, threat
            ranking, and recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard/settings?tab=billing">Upgrade to Command</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await usersApi.updateProfile({ scheduledReports: { monthly } });
      await refreshUser();
      toast.success(
        monthly
          ? "Monthly briefings enabled — first one arrives on the 1st."
          : "Monthly briefings disabled."
      );
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to save";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-cta" />
          <CardTitle>Scheduled briefings</CardTitle>
        </div>
        <CardDescription>
          Receive a PDF executive briefing by email on a recurring schedule.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-brand-700/60 bg-brand-950/30 p-3">
          <Checkbox
            checked={monthly}
            onCheckedChange={(v) => setMonthly(v === true)}
            className="mt-1"
          />
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="cursor-pointer text-sm font-medium">
                Monthly executive briefing
              </Label>
              <span className="text-[11px] text-muted-foreground">1st of every month · 8am UTC</span>
            </div>
            <p className="text-xs text-muted-foreground">
              PDF covering the past 30 days. Includes threat-ranked competitors,
              top changes, and active recommendations. Download link valid for
              30 days from delivery.
            </p>
          </div>
        </label>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!dirty || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
