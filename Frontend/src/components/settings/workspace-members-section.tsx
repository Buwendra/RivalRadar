"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Trash2, Loader2, Copy, Mail, Info } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiClientError } from "@/lib/api/client";
import {
  useChangeMemberRole,
  useInviteMember,
  useRemoveMember,
  useWorkspaceMembers,
  useWorkspaces,
  CURRENT_WORKSPACE_STORAGE_KEY,
} from "@/lib/hooks/use-workspaces";
import type { WorkspaceRole } from "@/lib/types";

type InviteRole = "member" | "admin";

export function WorkspaceMembersSection() {
  const { data: workspaces } = useWorkspaces();
  const { data: members, isLoading } = useWorkspaceMembers();
  const inviteMutation = useInviteMember();
  const removeMutation = useRemoveMember();
  const roleChangeMutation = useChangeMemberRole();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("member");
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

  // Phase 14 — admins + owners see this panel; members don't.
  if (!workspaces) return null;
  if (!current || (current.role !== "owner" && current.role !== "admin")) return null;

  const isOwner = current.role === "owner";

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Enter an email");
      return;
    }
    try {
      const result = await inviteMutation.mutateAsync({
        email: trimmed,
        role: inviteRole,
      });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/accept-invitation/${result.token}`;
      setLastInviteUrl(url);
      setLastInvitedEmail(result.inviteeEmail);
      setEmail("");
      setInviteRole("member");
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

  const handleRoleChange = async (userId: string, role: InviteRole) => {
    try {
      await roleChangeMutation.mutateAsync({ userId, role });
      toast.success(`Role updated to ${role}`);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to update role";
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
        <div className="rounded-md border border-brand-700/60 bg-brand-950/30 p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Info className="h-3 w-3" /> Roles
          </div>
          <ul className="mt-1.5 space-y-1">
            <li>
              <strong className="text-foreground">Owner</strong> — full control:
              billing, API keys, workspace delete, ownership transfer. One per workspace.
            </li>
            <li>
              <strong className="text-foreground">Admin</strong> — invite + kick
              members, manage integrations, delete competitors, rename workspace,
              view audit log.
            </li>
            <li>
              <strong className="text-foreground">Member</strong> — read everything;
              create competitors, run research, write notes, manage saved views.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-email" className="text-xs uppercase tracking-wide text-muted-foreground">
            Invite by email
          </Label>
          <div className="flex flex-wrap items-start gap-2">
            <Input
              id="invite-email"
              type="email"
              value={email}
              placeholder="teammate@yourcompany.com"
              onChange={(e) => setEmail(e.target.value)}
              disabled={inviteMutation.isPending}
              className="min-w-[200px] flex-1"
            />
            <Select
              value={inviteRole}
              onValueChange={(v) => setInviteRole(v as InviteRole)}
              disabled={inviteMutation.isPending}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                {/* Admins can only invite members; only owners see the Admin option */}
                {isOwner && <SelectItem value="admin">Admin</SelectItem>}
              </SelectContent>
            </Select>
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
            {!isOwner && " Admins can invite members; only the workspace owner can invite admins."}
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
              {members.map((m) => {
                const memberRole = m.role as WorkspaceRole;
                const canChangeRole =
                  isOwner && !m.isYou && memberRole !== "owner";
                return (
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
                      {canChangeRole ? (
                        <Select
                          value={memberRole === "admin" ? "admin" : "member"}
                          onValueChange={(v) => handleRoleChange(m.userId, v as InviteRole)}
                          disabled={roleChangeMutation.isPending}
                        >
                          <SelectTrigger className="h-7 w-[110px] text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[10px] uppercase"
                        >
                          {memberRole}
                        </Badge>
                      )}
                      {!m.isYou && memberRole !== "owner" && (
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
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
