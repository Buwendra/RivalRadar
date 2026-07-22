"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/layout/auth-guard";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { ReconsentBanner } from "@/components/shared/reconsent-banner";
import { CookieNoticeBanner } from "@/components/shared/cookie-notice-banner";
import { StorageNotice } from "@/components/shared/storage-notice";
import { usersApi } from "@/lib/api/users";

const PING_SESSION_KEY = "kx_pinged_this_session";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Phase 8a — bump server-side lastLoginAt once per session for the
  // retention-nudge cron. sessionStorage guard prevents re-firing on
  // intra-session navigation; cleared automatically on tab close.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(PING_SESSION_KEY)) return;
    window.sessionStorage.setItem(PING_SESSION_KEY, "1");
    // Best-effort — failures don't affect the user experience
    usersApi.ping().catch((err) => {
      console.warn("login ping failed", err);
    });
  }, []);

  return (
    <AuthGuard>
      <div className="flex h-screen bg-brand-950">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <DashboardSidebar />
        </div>

        {/* Mobile sidebar */}
        <MobileSidebar
          open={mobileSidebarOpen}
          onOpenChange={setMobileSidebarOpen}
        />

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader onMenuClick={() => setMobileSidebarOpen(true)} />
          <ReconsentBanner />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
      <CookieNoticeBanner />
      <StorageNotice />
    </AuthGuard>
  );
}
