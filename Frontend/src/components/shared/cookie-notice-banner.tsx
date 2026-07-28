"use client";

/**
 * Cookie / storage notice banner (Issue 2 launch-impact).
 *
 * ePrivacy Directive Recital 25 requires disclosure of browser storage use
 * even when no consent is needed (functional / auth tokens are exempt from
 * consent but disclosure is still mandatory).
 *
 * Permanent dismissal via localStorage so this only ever shows once per
 * device. Distinct from the re-consent banner pattern (sessionStorage,
 * session-only) because cookie disclosure isn't periodic.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "kx_cookie_notice_acknowledged";

export function CookieNoticeBanner() {
  // Default to ack'd to avoid hydration flash: server renders nothing, then
  // the effect below flips to "show" only if the user actually hasn't seen
  // the banner. Otherwise SSR would render the banner briefly until the
  // localStorage check kicks in on the client.
  const [acknowledged, setAcknowledged] = useState<boolean>(true);

  useEffect(() => {
    setAcknowledged(Boolean(localStorage.getItem(DISMISS_KEY)));
  }, []);

  if (acknowledged) return null;

  const handleAck = () => {
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch {
      // localStorage can fail in private-mode browsers; the banner just
      // re-appears on next page load, which is acceptable.
    }
    setAcknowledged(true);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl rounded-md border border-border bg-card/95 p-4 shadow-lg backdrop-blur"
    >
      <p className="text-sm leading-relaxed">
        Kironyx uses browser storage (<code className="rounded bg-muted px-1 text-xs">localStorage</code>)
        to keep you signed in. No tracking cookies, no third-party analytics.
        See our{" "}
        <Link
          href="/legal/privacy"
          className="text-primary hover:underline"
        >
          Privacy Policy
        </Link>{" "}
        for details.
      </p>
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={handleAck}>
          Got it
        </Button>
      </div>
    </div>
  );
}
