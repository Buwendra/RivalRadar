"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Copy,
  Trash2,
  AlertCircle,
  KeyRound,
  Lock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ApiClientError } from "@/lib/api/client";
import {
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
} from "@/lib/hooks/use-api-keys";
import { useCapabilities } from "@/lib/hooks/use-capability";
import {
  CURRENT_WORKSPACE_STORAGE_KEY,
  useWorkspaces,
} from "@/lib/hooks/use-workspaces";
import type { ApiKeyCreated } from "@/lib/types";

export function ApiKeysSection() {
  const capabilities = useCapabilities();
  const { data: workspaces } = useWorkspaces();
  const { data: keys, isLoading } = useApiKeys();
  const createMutation = useCreateApiKey();
  const deleteMutation = useDeleteApiKey();

  const [name, setName] = useState("");
  const [reveal, setReveal] = useState<ApiKeyCreated | null>(null);

  const currentId =
    typeof window !== "undefined"
      ? localStorage.getItem(CURRENT_WORKSPACE_STORAGE_KEY)
      : null;
  const current = useMemo(() => {
    if (!workspaces || workspaces.length === 0) return null;
    return (
      workspaces.find((w) => w.workspaceId === currentId) ??
      workspaces.find((w) => w.role === "owner") ??
      workspaces[0]
    );
  }, [workspaces, currentId]);

  // Owner-only surface; otherwise hide entirely.
  if (!current || current.role !== "owner") return null;

  // Tier gate — Scout sees an upgrade nudge
  if (!capabilities.apiAccess) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            API keys
          </CardTitle>
          <CardDescription>
            Programmatic access to your workspace data. Available on{" "}
            <strong className="text-foreground">Strategist</strong> and{" "}
            <strong className="text-foreground">Command</strong> plans.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Upgrade to mint API keys and pull competitors, changes, and
            recommendations into your BI tools, ABM workflows, or internal Slack
            bots.
          </p>
        </CardContent>
      </Card>
    );
  }

  const atCap =
    capabilities.apiKeys.max > 0 &&
    (keys?.length ?? 0) >= capabilities.apiKeys.max;

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give the key a label");
      return;
    }
    try {
      const created = await createMutation.mutateAsync(trimmed);
      setReveal(created);
      setName("");
      toast.success(`API key "${created.name}" created`);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to create key";
      toast.error(msg);
    }
  };

  const handleRevoke = async (id: string, label: string) => {
    if (!confirm(`Revoke "${label}"? Existing requests using this key will start returning 401.`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Key revoked");
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to revoke";
      toast.error(msg);
    }
  };

  const copyPlaintext = async () => {
    if (!reveal) return;
    try {
      await navigator.clipboard.writeText(reveal.plaintext);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          API keys
        </CardTitle>
        <CardDescription>
          Read-only programmatic access to /v1 endpoints. See{" "}
          <code className="font-mono text-foreground">PUBLIC_API.md</code> for
          the full reference. Default rate limit: 60 req/min per key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {reveal && (
          <RevealBanner reveal={reveal} onCopy={copyPlaintext} onDismiss={() => setReveal(null)} />
        )}

        <div className="space-y-2">
          <Label htmlFor="key-name" className="text-xs uppercase tracking-wide text-muted-foreground">
            New API key
          </Label>
          <div className="flex items-start gap-2">
            <Input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production BI sync"
              maxLength={80}
              disabled={createMutation.isPending || atCap}
            />
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !name.trim() || atCap}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Plus className="mr-1 h-3 w-3" />
              )}
              Create
            </Button>
          </div>
          {atCap && (
            <p className="text-xs text-amber-300/80">
              Plan limit reached ({capabilities.apiKeys.max} keys). Revoke an
              existing key or upgrade.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Existing keys
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !keys || keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No API keys yet. Create one to start integrating.
            </p>
          ) : (
            <ul className="space-y-2">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-brand-700/60 bg-brand-950/30 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{k.name}</span>
                      {k.disabled && (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase">
                          revoked
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                      rsk_live_…{k.keyHint}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70">
                      Created {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt
                        ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                        : " · never used"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleRevoke(k.id, k.name)}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending && deleteMutation.variables === k.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RevealBanner({
  reveal,
  onCopy,
  onDismiss,
}: {
  reveal: ApiKeyCreated;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  // Auto-clear after 5 minutes as a small safety net (page already keeps it
  // in component state only — never persisted).
  useEffect(() => {
    const t = setTimeout(onDismiss, 5 * 60 * 1000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="rounded-md border border-amber-900/60 bg-amber-950/40 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-200">
        <AlertCircle className="h-4 w-4" />
        Copy your new key — we won&apos;t show it again.
      </div>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-brand-950/60 px-2 py-1.5 font-mono text-xs text-amber-100">
          {reveal.plaintext}
        </code>
        <Button size="sm" variant="outline" onClick={onCopy}>
          <Copy className="mr-1 h-3 w-3" /> Copy
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="text-amber-200 hover:text-amber-100"
        >
          I copied it
        </Button>
      </div>
      <p className="mt-2 text-xs text-amber-200/80">
        Send this in the <code className="font-mono">X-API-Key</code> header on
        every request to <code className="font-mono">/v1/*</code>.
      </p>
    </div>
  );
}
