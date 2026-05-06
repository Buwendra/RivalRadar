"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Trash2, Loader2, Copy, Mail } from "lucide-react";
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
  useInviteMember,
  useRemoveMember,
  useWorkspaceMembers,
  useWorkspaces,
  CURRENT_WORKSPACE_STORAGE_KEY,
} from "@/lib/hooks/use-workspaces";

export function WorkspaceMembersSection() {
  const { data: workspaces } = useWorkspaces();
  const { data: members, isLoading } = useWorkspaceMembers();
  const inviteMutation = useInviteMember();
  const removeMutation = useRemoveMember();
  const [email, setEmail] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [lastInvitedEmail, setLastInvitedEmail] = useState<string | null>(null);

  const currentId =
    (typeof window !== "undefined" &&
      localStorage.getItem(CURRENT_WORKSPACE_STORAGE_KEY)) ||
    null;
  const current =
    workspaces?.find((w) => w.workspaceId === currentId) ??
    workspaces?.find((w) => w.role === "owner") ??
    workspaces?.[0];

  // Hide entirely until we know whether the caller is an owner
  if (!workspaces) return null;
  if (!current || current.role !== "owner") return null;

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Enter an email");
      return;
    }
    try {
      const result = await inviteMutation.mutateAsync(trimmed);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/accept-invitation/${result.token}`;
      setLastInviteUrl(url);
      setLastInvitedEmail(result.inviteeEmail);
      setEmail("");
      toast.success(`Invitation sent to ${result.inviteeEmail}`);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to send invitation";
      toast.error(msg);
    }
  };

  const handleRemove = async (userId: string, label: string) => {
    if (!confirm(`Remove ${label} from this workspace?`)) return;
    try {
      await removeMutation.mutateAsync(userId);
      toast.success("Member removed");
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to remove member";
      toast.error(msg);
    }
  };

  const copyInvite = async () => {
    if (!lastInviteUrl) return;
    try {
      await navigator.clipboard.writeText(lastInviteUrl);
      toast.success("Copied invite link");
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardHeader>
        <CardTitle>Workspace members</CardTitle>
        <CardDescription>
          Invite teammates to share the same competitor data and weekly briefings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="invite-email" className="text-xs uppercase tracking-wide text-muted-foreground">
            Invite by email
          </Label>
          <div className="flex items-start gap-2">
            <Input
              id="invite-email"
              type="email"
              value={email}
              placeholder="teammate@yourcompany.com"
              onChange={(e) => setEmail(e.target.value)}
              disabled={inviteMutation.isPending}
            />
            <Button
              onClick={handleInvite}
              disabled={inviteMutation.isPending || !email.trim()}
            >
              {inviteMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <UserPlus className="mr-1 h-3 w-3" />
              )}
              Send invite
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            We&apos;ll email them a tokenized link that expires in 14 days.
          </p>
        </div>

        {lastInviteUrl && (
          <div className="rounded-md border border-brand-700/60 bg-brand-950/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4 text-emerald-300" />
              Invite sent to {lastInvitedEmail}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              In case the email is delayed, you can also share this direct link:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-brand-950/60 px-2 py-1.5 font-mono text-xs text-muted-foreground">
                {lastInviteUrl}
              </code>
              <Button size="sm" variant="outline" onClick={copyInvite}>
                <Copy className="mr-1 h-3 w-3" /> Copy
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Members
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !members || members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center justify-between gap-3 rounded-md border border-brand-700/60 bg-brand-950/30 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-sm">
                      {m.email ?? m.userId}
                      {m.isYou && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Joined {new Date(m.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase">
                      {m.role}
                    </Badge>
                    {!m.isYou && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(m.userId, m.email ?? m.userId)}
                        disabled={removeMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
