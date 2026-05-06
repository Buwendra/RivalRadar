"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/use-auth";
import { usersApi } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import { TOS_VERSION, PRIVACY_VERSION } from "@/lib/utils/constants";

const DISMISS_KEY = "rs_reconsent_dismissed";

/**
 * Phase 9a — re-consent banner. When the published TOS_VERSION /
 * PRIVACY_VERSION constants drift past the user's stored versions
 * (e.g. legal updates), this banner asks them to re-accept. The Accept
 * action POSTs the current versions back to /users/me/accept-tos which
 * fail-closes if the submitted versions don't match the live ones.
 *
 * Banner is dismissible per-session (sessionStorage), but it'll come back
 * on the next session until the user actually accepts. We don't gate the
 * dashboard behind acceptance — the goal is informed visibility, not a
 * forced cookie wall.
 */
export function ReconsentBanner() {
  const { user, refreshUser } = useAuth();
  const [isAccepting, setIsAccepting] = useState(false);
  const [dismissedNow, setDismissedNow] = useState(false);

  // Drift check — only show if the user has a stored version AND it differs
  // from the current. If `tosVersion` / `privacyVersion` are absent (older
  // accounts not yet stamped), we DON'T show the banner — onboarding new
  // users already see the consent checkbox.
  const tosDrifted =
    typeof user?.tosVersion === "string" && user.tosVersion !== TOS_VERSION;
  const privacyDrifted =
    typeof user?.privacyVersion === "string" && user.privacyVersion !== PRIVACY_VERSION;

  if (!user || (!tosDrifted && !privacyDrifted)) return null;

  // Session-dismissed (still nag on next session)
  if (
    typeof window !== "undefined" &&
    !dismissedNow &&
    window.sessionStorage.getItem(DISMISS_KEY) === "1"
  ) {
    return null;
  }
  if (dismissedNow) return null;

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await usersApi.acceptTos({
        tosVersion: TOS_VERSION,
        privacyVersion: PRIVACY_VERSION,
      });
      await refreshUser();
      toast.success("Thanks — your acceptance is recorded.");
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Couldn't record acceptance";
      toast.error(msg);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    }
    setDismissedNow(true);
  };

  return (
    <div className="border-b border-amber-900/60 bg-amber-950/30 px-4 py-3 text-amber-100">
      <div className="mx-auto flex max-w-screen-xl flex-wrap items-start gap-3">
        <Scale className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">
            We&apos;ve updated our{" "}
            {tosDrifted && (
              <Link href="/legal/terms" target="_blank" className="underline hover:text-amber-50">
                Terms of Service
              </Link>
            )}
            {tosDrifted && privacyDrifted && " and "}
            {privacyDrifted && (
              <Link href="/legal/privacy" target="_blank" className="underline hover:text-amber-50">
                Privacy Policy
              </Link>
            )}
            .
          </p>
          <p className="text-xs text-amber-200/80">
            Please review and confirm to keep using RivalScan.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Button
            size="sm"
            onClick={handleAccept}
            disabled={isAccepting}
            className="bg-amber-300 text-amber-950 hover:bg-amber-200"
          >
            {isAccepting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            I accept
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded p-1 text-amber-300 hover:bg-amber-900/40 hover:text-amber-100"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
