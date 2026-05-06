"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Pencil, UserCog } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiClientError } from "@/lib/api/client";
import {
  CURRENT_WORKSPACE_STORAGE_KEY,
  useDeleteWorkspace,
  useRenameWorkspace,
  useTransferOwnership,
  useWorkspaceMembers,
  useWorkspaces,
} from "@/lib/hooks/use-workspaces";

export function WorkspaceSettingsSection() {
  const router = useRouter();
  const { data: workspaces } = useWorkspaces();
  const { data: members } = useWorkspaceMembers();
  const renameMutation = useRenameWorkspace();
  const deleteMutation = useDeleteWorkspace();
  const transferMutation = useTransferOwnership();

  const currentId = useCurrentWorkspaceId();
  const current = useMemo(() => {
    if (!workspaces || workspaces.length === 0) return null;
    return (
      workspaces.find((w) => w.workspaceId === currentId) ??
      workspaces.find((w) => w.role === "owner") ??
      workspaces[0]
    );
  }, [workspaces, currentId]);

  const [name, setName] = useState("");
  useEffect(() => {
    if (current?.workspaceName) setName(current.workspaceName);
  }, [current?.workspaceName]);

  const [confirmText, setConfirmText] = useState("");
  const [transferTargetUserId, setTransferTargetUserId] = useState<string>("");
  const [transferConfirmText, setTransferConfirmText] = useState("");

  if (!current || current.role !== "owner") return null;

  const dirty = name.trim().length > 0 && name.trim() !== current.workspaceName;
  const canDelete = confirmText === current.workspaceName;
  const transferableMembers = (members ?? []).filter((m) => !m.isYou);
  const transferTarget = transferableMembers.find((m) => m.userId === transferTargetUserId);
  const canTransfer =
    !!transferTarget && transferConfirmText === current.workspaceName;

  const handleRename = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === current.workspaceName) return;
    try {
      await renameMutation.mutateAsync(trimmed);
      toast.success("Workspace renamed");
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to rename";
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    try {
      await deleteMutation.mutateAsync();
      // After delete, drop the active workspace id so the resolver falls
      // back to the user's personal (legacy) workspace next request.
      localStorage.removeItem(CURRENT_WORKSPACE_STORAGE_KEY);
      toast.success("Workspace deleted");
      router.push("/dashboard");
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to delete";
      toast.error(msg);
    }
  };

  const handleTransfer = async () => {
    if (!canTransfer || !transferTarget) return;
    try {
      await transferMutation.mutateAsync(transferTarget.userId);
      toast.success(
        `Ownership transferred to ${transferTarget.email ?? transferTarget.userId}`
      );
      setTransferTargetUserId("");
      setTransferConfirmText("");
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to transfer";
      toast.error(msg);
    }
  };

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pencil className="h-4 w-4" />
          Workspace settings
        </CardTitle>
        <CardDescription>
          Rename the workspace or dissolve the team. Deleting only removes the
          team — your data stays with your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="ws-name" className="text-xs uppercase tracking-wide text-muted-foreground">
            Workspace name
          </Label>
          <div className="flex items-start gap-2">
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              disabled={renameMutation.isPending}
            />
            <Button onClick={handleRename} disabled={!dirty || renameMutation.isPending}>
              {renameMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-brand-700/60 bg-brand-950/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <UserCog className="h-4 w-4" />
            Transfer ownership
          </div>
          <p className="text-xs text-muted-foreground">
            Hand off admin authority to a teammate. The new owner can rename,
            delete, and manage members.{" "}
            <strong className="text-foreground">
              Billing and underlying data stay with your account
            </strong>{" "}
            — if you delete your account, the workspace is also deleted.
          </p>
          {transferableMembers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Invite at least one member first.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  New owner
                </Label>
                <Select
                  value={transferTargetUserId}
                  onValueChange={(v) => {
                    setTransferTargetUserId(v);
                    setTransferConfirmText("");
                  }}
                  disabled={transferMutation.isPending}
                >
                  <SelectTrigger className="w-full bg-brand-950/60">
                    <SelectValue placeholder="Select a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {transferableMembers.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.email ?? m.userId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {transferTarget && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Type{" "}
                    <code className="font-mono text-foreground">
                      {current.workspaceName}
                    </code>{" "}
                    to confirm transfer to{" "}
                    <strong className="text-foreground">
                      {transferTarget.email ?? transferTarget.userId}
                    </strong>
                    . You&apos;ll become a member with no admin powers.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={transferConfirmText}
                      onChange={(e) => setTransferConfirmText(e.target.value)}
                      placeholder={current.workspaceName}
                      disabled={transferMutation.isPending}
                      className="bg-brand-950/60"
                    />
                    <Button
                      onClick={handleTransfer}
                      disabled={!canTransfer || transferMutation.isPending}
                    >
                      {transferMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Transfer ownership
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-md border border-red-900/60 bg-red-950/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-red-300">
            <AlertTriangle className="h-4 w-4" />
            Danger zone
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Deleting the workspace kicks every member and removes every
            invitation. Your competitors, briefings, and integrations stay on
            your personal account. To confirm, type{" "}
            <code className="font-mono text-foreground">{current.workspaceName}</code>{" "}
            below.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={current.workspaceName}
              disabled={deleteMutation.isPending}
              className="bg-brand-950/60"
            />
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!canDelete || deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete workspace
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function useCurrentWorkspaceId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    setId(localStorage.getItem(CURRENT_WORKSPACE_STORAGE_KEY));
  }, []);
  return id;
}
