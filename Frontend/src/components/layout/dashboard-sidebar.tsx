"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, Plus } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompetitors } from "@/lib/hooks/use-competitors";
import { useAuth } from "@/lib/auth/use-auth";
import { cn } from "@/lib/utils";
import type { Momentum } from "@/lib/types";

interface DashboardSidebarProps {
  onAddCompetitor?: () => void;
}

// Ranked order: rising > stable > slowing > declining > insufficient-data.
// Competitors with higher priority sort first in the sidebar.
const MOMENTUM_RANK: Record<Momentum, number> = {
  rising: 0,
  stable: 1,
  slowing: 2,
  declining: 3,
  "insufficient-data": 4,
};

export function DashboardSidebar({ onAddCompetitor }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { data: competitors, isLoading } = useCompetitors();

  const sortedCompetitors = [...(competitors ?? [])].sort((a, b) => {
    const ra = MOMENTUM_RANK[a.momentum ?? "insufficient-data"];
    const rb = MOMENTUM_RANK[b.momentum ?? "insufficient-data"];
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <div className="flex h-full w-[280px] flex-col border-r border-brand-700 bg-brand-900">
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard">
          <Logo />
        </Link>
      </div>

      <Separator className="bg-brand-700" />

      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-brand-800 text-foreground"
                : "text-muted-foreground hover:bg-brand-800 hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <Separator className="bg-brand-700" />

      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Competitors
        </span>
        {onAddCompetitor && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onAddCompetitor}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 px-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-brand-800" />
            ))}
          </div>
        ) : sortedCompetitors.length > 0 ? (
          <div className="space-y-1">
            {sortedCompetitors.map((competitor) => (
              <Link
                key={competitor.id}
                href={`/dashboard/competitors/${competitor.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  pathname === `/dashboard/competitors/${competitor.id}`
                    ? "bg-brand-800 text-foreground"
                    : "text-muted-foreground hover:bg-brand-800 hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    competitor.status === "active" ? "bg-significance-low" : "bg-muted-foreground"
                  )}
                />
                <span className="flex-1 truncate">{competitor.name}</span>
                {competitor.momentum === "rising" && (
                  <span aria-label="rising" className="text-xs">🚀</span>
                )}
                {competitor.momentum === "declining" && (
                  <span aria-label="declining" className="text-xs">📉</span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            No competitors yet. Add one to get started.
          </p>
        )}
      </ScrollArea>

      <Separator className="bg-brand-700" />

      <div className="p-4">
        <div className="rounded-md bg-brand-800 px-3 py-2">
          <p className="text-xs text-muted-foreground">Current plan</p>
          <p className="text-sm font-medium capitalize">{user?.plan ?? "scout"}</p>
        </div>
      </div>
    </div>
  );
}
