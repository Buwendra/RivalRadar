"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Single storage/consent notice for the public surface.
 *
 * Replaces the two overlapping banners (cookie notice + storage notice) that
 * previously both mounted here and collided on mobile — they said the same
 * thing. One calm bottom-anchored card, dismissed to localStorage. Migrates
 * either legacy ack key so returning visitors aren't re-prompted.
 */
const KEY = "kx_consent_ack";
const LEGACY_KEYS = ["kx_cookie_notice_acknowledged", "kx_storage_notice_ack"];

export function ConsentNotice() {
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    try {
      const acked =
        localStorage.getItem(KEY) ||
        LEGACY_KEYS.some((k) => localStorage.getItem(k));
      if (!acked) {
        setVisible(true);
        // next frame → transition from the starting style
        requestAnimationFrame(() => setEntered(true));
      }
    } catch {
      /* storage blocked — show nothing rather than nag */
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setEntered(false);
    window.setTimeout(() => setVisible(false), 220);
  };

  return (
    <div
      role="dialog"
      aria-label="Storage notice"
      className={cn(
        "fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-lg border border-ink/12 bg-obsidian-900/95 p-5 shadow-2xl shadow-black/40 backdrop-blur-md",
        "transition-[transform,opacity] duration-200 ease-out-strong",
        entered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
    >
      <p className="font-mono text-label uppercase text-muted-foreground">
        Notice
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Kironyx uses browser storage to keep you signed in. No tracking
        cookies, no third-party analytics. See our{" "}
        <Link
          href="/legal/privacy"
          className="text-foreground underline underline-offset-2 hover:text-foreground/80"
        >
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-4 flex justify-end">
        <Button
          size="sm"
          onClick={dismiss}
          className="bg-cta text-obsidian-950 transition-[transform,background-color] duration-150 ease-out-strong hover:bg-cta-hover active:scale-[0.97]"
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
