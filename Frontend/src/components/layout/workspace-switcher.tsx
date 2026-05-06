"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CURRENT_WORKSPACE_STORAGE_KEY,
  useWorkspaces,
} from "@/lib/hooks/use-workspaces";

export function WorkspaceSwitcher() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const qc = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentId(localStorage.getItem(CURRENT_WORKSPACE_STORAGE_KEY));
  }, []);

  const current = useMemo(() => {
    if (!workspaces || workspaces.length === 0) return null;
    return (
      workspaces.find((w) => w.workspaceId === currentId) ??
      workspaces.find((w) => w.role === "owner") ??
      workspaces[0]
    );
  }, [workspaces, currentId]);

  if (isLoading || !workspaces || workspaces.length === 0) {
    return null;
  }

  // Single workspace — render as plain label without a menu.
  if (workspaces.length === 1) {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-brand-100">
        <Building2 className="h-4 w-4" />
        <span className="hidden md:inline">{workspaces[0].workspaceName}</span>
      </div>
    );
  }

  const handleSelect = (workspaceId: string) => {
    if (workspaceId === current?.workspaceId) return;
    localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, workspaceId);
    setCurrentId(workspaceId);
    // Force every data hook to refetch under the new tenant header.
    qc.invalidateQueries();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 text-brand-100">
          <Building2 className="h-4 w-4" />
          <span className="hidden max-w-[160px] truncate md:inline">
            {current?.workspaceName ?? "Select workspace"}
          </span>
          <ChevronsUpDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.workspaceId}
            onClick={() => handleSelect(w.workspaceId)}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex flex-col">
              <span className="truncate text-sm">{w.workspaceName}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {w.role}
              </span>
            </span>
            {w.workspaceId === current?.workspaceId ? (
              <Check className="h-4 w-4 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
