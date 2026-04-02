"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DashboardSidebar } from "./dashboard-sidebar";

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCompetitor?: () => void;
}

export function MobileSidebar({ open, onOpenChange, onAddCompetitor }: MobileSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0">
        <DashboardSidebar onAddCompetitor={onAddCompetitor} />
      </SheetContent>
    </Sheet>
  );
}
