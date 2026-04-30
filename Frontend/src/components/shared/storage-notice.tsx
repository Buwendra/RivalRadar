"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const STORAGE_KEY = "rs_storage_notice_ack";

/**
 * Storage / cookie disclosure banner.
 *
 * Compliance basis: ePrivacy Directive Recital 25 exempts strictly necessary
 * functional storage from prior-consent requirements, but disclosure is still
 * required. We use browser localStorage for auth tokens and a single
 * dismissible UI flag — no tracking cookies. The banner discloses this and
 * disappears once acknowledged on a given device.
 */
export function StorageNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const acked = window.localStorage.getItem(STORAGE_KEY);
      if (!acked) setVisible(true);
    } catch {
      // localStorage may be unavailable (private mode, locked-down browsers).
      // Fail-quiet: don't show banner; user gets no notice but app works.
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Ignore — banner just won't persist its dismissal
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Browser storage notice"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border border-brand-700 bg-brand-900 p-4 shadow-lg sm:left-auto sm:right-4"
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-brand-800 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="pr-6 text-sm font-medium">
        We use browser storage to keep you signed in.
      </p>
      <p className="mt-1 pr-6 text-xs leading-relaxed text-muted-foreground">
        Functional only — no tracking cookies. Auth tokens are stored in your
        browser&apos;s localStorage. See our{" "}
        <Link href="/legal/privacy" className="text-primary hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        Got it
      </button>
    </div>
  );
}
