"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Slack, Webhook, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/use-auth";
import { usersApi } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import type { NotificationPreferences } from "@/lib/types";

type Channel = "email" | "slack" | "webhook";
type Event = "weeklyDigest" | "criticalAlerts";

const DEFAULTS: Required<{
  [C in Channel]: { weeklyDigest: boolean; criticalAlerts: boolean };
}> = {
  email: { weeklyDigest: true, criticalAlerts: true },
  slack: { weeklyDigest: false, criticalAlerts: true },
  webhook: { weeklyDigest: false, criticalAlerts: true },
};

const CHANNEL_LABELS: Record<Channel, { label: string; Icon: typeof Mail }> = {
  email: { label: "Email", Icon: Mail },
  slack: { label: "Slack", Icon: Slack },
  webhook: { label: "Webhook", Icon: Webhook },
};

const EVENT_LABELS: Record<Event, string> = {
  weeklyDigest: "Weekly digest",
  criticalAlerts: "Critical alerts (significance ≥ 8)",
};

function effectivePref(
  prefs: NotificationPreferences | undefined,
  channel: Channel,
  event: Event
): boolean {
  return prefs?.[channel]?.[event] ?? DEFAULTS[channel][event];
}

export function NotificationPreferencesSection() {
  const { user, refreshUser } = useAuth();
  const [draft, setDraft] = useState<NotificationPreferences>(
    user?.notificationPreferences ?? {}
  );
  const [isSaving, setIsSaving] = useState(false);

  const setPref = (channel: Channel, event: Event, value: boolean) => {
    setDraft((d) => ({
      ...d,
      [channel]: { ...(d[channel] ?? {}), [event]: value },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await usersApi.updateProfile({ notificationPreferences: draft });
      await refreshUser();
      toast.success("Notification preferences saved");
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to save preferences";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const channels: Channel[] = ["email", "slack", "webhook"];
  const events: Event[] = ["weeklyDigest", "criticalAlerts"];

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardHeader>
        <CardTitle>Notification preferences</CardTitle>
        <CardDescription>
          Choose which alerts go to which channel. Channels need to be connected first
          (see Integrations below).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-700/60 text-left">
                <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Channel
                </th>
                {events.map((ev) => (
                  <th
                    key={ev}
                    className="pb-2 pr-4 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {EVENT_LABELS[ev]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => {
                const cfg = CHANNEL_LABELS[ch];
                return (
                  <tr key={ch} className="border-b border-brand-700/40 last:border-0">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <cfg.Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{cfg.label}</span>
                      </div>
                    </td>
                    {events.map((ev) => {
                      const id = `${ch}-${ev}`;
                      return (
                        <td key={ev} className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={id}
                              checked={effectivePref(draft, ch, ev)}
                              onCheckedChange={(v) =>
                                setPref(ch, ev, v === true)
                              }
                            />
                            <Label htmlFor={id} className="cursor-pointer text-xs text-muted-foreground">
                              {effectivePref(draft, ch, ev) ? "On" : "Off"}
                            </Label>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
