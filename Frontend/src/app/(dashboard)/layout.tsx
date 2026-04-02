"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/layout/auth-guard";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
