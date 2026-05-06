"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PauseCircle, PlayCircle, Loader2, ShieldOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/lib/auth/use-auth";
import { usersApi } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";

/**
 * Phase 9a — GDPR Art. 18 (Right to Restriction). Lets a user voluntarily
 * pause processing on their own account without deleting it. Different from
 * canceling a subscription (Paddle handles that) — suspend stops research +
 * pipeline activity but keeps data + competitor list intact, so resuming is
 * one click.
 */
export function AccountStatusSection() {
  const { user, refreshUser } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const status = user?.status ?? "active";
  const isRestricted = status === "restricted";
  const isPendingDeletion = status === "pending-deletion";

  // Pending-deletion is terminal — the GDPR Art. 17 delete handler is
  // irreversible. Show a simple read-only badge.
  if (isPendingDeletion) {
    return (
      <Card className="border-red-900/60 bg-red-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldOff className="h-4 w-4 text-red-400" />
            Account pending deletion
          </CardTitle>
          <CardDescription>
            Your account is being deleted. This is irreversible.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleConfirm = async () => {
    setIsPending(true);
    try {
      if (isRestricted) {
        await usersApi.resume();
        toast.success("Account resumed — research will continue on the next cycle.");
      } else {
        await usersApi.suspend();
        toast.success("Account paused — research stopped.");
      }
      await refreshUser();
      setConfirmOpen(false);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Couldn't update account status";
      toast.error(msg);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <Card className="border-brand-700 bg-brand-900">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Account status</CardTitle>
            {isRestricted ? (
              <Badge variant="outline" className="border-amber-900/60 bg-amber-950/40 text-amber-300">
                Paused
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-900/60 bg-emerald-950/40 text-emerald-300">
                Active
              </Badge>
            )}
          </div>
          <CardDescription>
            {isRestricted
              ? "Your account is paused. No research runs, no recurring activity. Resume any time."
              : "Pause processing on your account without deleting anything. Stops research, the recurring scheduler, and the weekly pipeline. Resume any time."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant={isRestricted ? "default" : "outline"}
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isRestricted ? (
              <>
                <PlayCircle className="mr-2 h-4 w-4" />
                Resume account
              </>
            ) : (
              <>
                <PauseCircle className="mr-2 h-4 w-4" />
                Pause account
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isRestricted ? "Resume account?" : "Pause account?"}
        description={
          isRestricted
            ? "Research will resume on the next scheduled cycle. Existing data is unchanged."
            : "Research stops immediately. The weekly digest stops. Your competitors and history stay put — resume any time. This is reversible (use Settings → Delete account for permanent removal)."
        }
        confirmLabel={isRestricted ? "Resume" : "Pause"}
        variant={isRestricted ? "default" : "destructive"}
        isPending={isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
