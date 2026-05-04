"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Slack,
  Webhook,
  Check,
  AlertCircle,
  Trash2,
  Send,
  Copy,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ApiClientError } from "@/lib/api/client";
import {
  useIntegrations,
  useSetIntegration,
  useTestIntegration,
  useDeleteIntegration,
} from "@/lib/hooks/use-integrations";
import type { IntegrationListItem, IntegrationProvider } from "@/lib/types";

interface ProviderConfig {
  provider: IntegrationProvider;
  title: string;
  description: string;
  Icon: typeof Slack;
  placeholder: string;
  helpText: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    provider: "slack",
    title: "Slack",
    description: "Send weekly digests and critical alerts to a Slack channel.",
    Icon: Slack,
    placeholder: "https://hooks.slack.com/services/...",
    helpText:
      "Create an Incoming Webhook in your Slack workspace settings, then paste the URL here.",
  },
  {
    provider: "webhook",
    title: "Custom webhook",
    description: "POST signed JSON payloads to your own endpoint.",
    Icon: Webhook,
    placeholder: "https://your-app.example.com/webhooks/rivalscan",
    helpText:
      "We'll POST JSON envelopes signed with HMAC-SHA256. You'll get a signing secret to verify on your end (shown once).",
  },
];

export function IntegrationsSection() {
  const { data: integrations, isLoading } = useIntegrations();
  const setMutation = useSetIntegration();
  const testMutation = useTestIntegration();
  const deleteMutation = useDeleteIntegration();
  const [drafts, setDrafts] = useState<Record<IntegrationProvider, string>>({
    slack: "",
    webhook: "",
  });
  const [hmacReveal, setHmacReveal] = useState<{ provider: IntegrationProvider; secret: string } | null>(null);

  const integrationByProvider = new Map<IntegrationProvider, IntegrationListItem>(
    (integrations ?? []).map((i) => [i.provider, i])
  );

  const handleSave = async (provider: IntegrationProvider) => {
    const url = drafts[provider].trim();
    if (!url) {
      toast.error("Paste a URL first");
      return;
    }
    try {
      const result = await setMutation.mutateAsync({ provider, url });
      toast.success(`${provider === "slack" ? "Slack" : "Webhook"} integration saved`);
      setDrafts((d) => ({ ...d, [provider]: "" }));
      if (result.hmacSecret) {
        setHmacReveal({ provider, secret: result.hmacSecret });
      }
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to save integration";
      toast.error(msg);
    }
  };

  const handleTest = async (provider: IntegrationProvider) => {
    try {
      await testMutation.mutateAsync(provider);
      toast.success("Test ping delivered");
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Test ping failed";
      toast.error(msg);
    }
  };

  const handleDelete = async (provider: IntegrationProvider) => {
    try {
      await deleteMutation.mutateAsync(provider);
      toast.success("Integration disconnected");
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  const copyHmac = async () => {
    if (!hmacReveal) return;
    try {
      await navigator.clipboard.writeText(hmacReveal.secret);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>
          Connect Slack or your own webhook to receive RivalScan alerts outside email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {hmacReveal && (
          <div className="rounded-md border border-amber-900/60 bg-amber-950/40 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-200">
              <AlertCircle className="h-4 w-4" />
              Save your signing secret now — we won&apos;t show it again.
            </div>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-brand-950/60 px-2 py-1.5 font-mono text-xs text-amber-100">
                {hmacReveal.secret}
              </code>
              <Button size="sm" variant="outline" onClick={copyHmac}>
                <Copy className="mr-1 h-3 w-3" /> Copy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHmacReveal(null)}
                className="text-amber-200 hover:text-amber-100"
              >
                Dismiss
              </Button>
            </div>
            <p className="mt-2 text-xs text-amber-200/80">
              Use this secret to verify the HMAC-SHA256 signature on every payload
              we send. Verify the <code className="font-mono">X-RivalScan-Signature</code>{" "}
              header against <code className="font-mono">{`{timestamp}.{body}`}</code>.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          PROVIDERS.map((cfg) => {
            const existing = integrationByProvider.get(cfg.provider);
            const isMutating =
              (setMutation.isPending && setMutation.variables?.provider === cfg.provider) ||
              (testMutation.isPending && testMutation.variables === cfg.provider) ||
              (deleteMutation.isPending && deleteMutation.variables === cfg.provider);
            return (
              <div
                key={cfg.provider}
                className="space-y-3 rounded-md border border-brand-700/60 bg-brand-950/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <cfg.Icon className="mt-0.5 h-5 w-5 text-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{cfg.title}</span>
                        {existing ? (
                          <Badge variant="outline" className="h-5 border-emerald-900/60 bg-emerald-950/40 px-1.5 text-[10px] text-emerald-300">
                            <Check className="mr-1 h-3 w-3" /> Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                            Not connected
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{cfg.description}</p>
                    </div>
                  </div>
                </div>

                {existing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded bg-brand-950/60 px-2 py-1 font-mono text-xs text-muted-foreground">
                        {existing.secretHint}
                      </code>
                      {existing.lastDeliveryStatus === "ok" && (
                        <Badge variant="outline" className="h-5 border-emerald-900/60 bg-emerald-950/40 px-1.5 text-[10px] text-emerald-300">
                          last delivery ok
                        </Badge>
                      )}
                      {existing.lastDeliveryStatus === "failed" && (
                        <Badge variant="outline" className="h-5 border-red-900/60 bg-red-950/40 px-1.5 text-[10px] text-red-300">
                          last delivery failed
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTest(cfg.provider)}
                        disabled={isMutating}
                      >
                        <Send className="mr-1 h-3 w-3" /> Send test ping
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(cfg.provider)}
                        disabled={isMutating}
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Disconnect
                      </Button>
                    </div>
                    {existing.lastDeliveryError && (
                      <p className="text-xs text-red-300/80">
                        {existing.lastDeliveryError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor={`url-${cfg.provider}`} className="text-xs uppercase tracking-wide text-muted-foreground">
                      URL
                    </Label>
                    <Input
                      id={`url-${cfg.provider}`}
                      type="url"
                      value={drafts[cfg.provider]}
                      placeholder={cfg.placeholder}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [cfg.provider]: e.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">{cfg.helpText}</p>
                    <Button
                      size="sm"
                      onClick={() => handleSave(cfg.provider)}
                      disabled={isMutating || !drafts[cfg.provider].trim()}
                    >
                      {isMutating && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      Connect {cfg.title}
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
