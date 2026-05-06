"use client";

import { useMemo } from "react";
import { History, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspaceAuditLog, useWorkspaces } from "@/lib/hooks/use-workspaces";
import { CURRENT_WORKSPACE_STORAGE_KEY } from "@/lib/hooks/use-workspaces";
import type { AuditAction, AuditEventListItem } from "@/lib/types";

const ACTION_LABEL: Record<AuditAction, string> = {
  "workspace.renamed": "Renamed workspace",
  "workspace.deleted": "Deleted workspace",
  "workspace.ownership_transferred": "Transferred ownership",
  "workspace.invitation_created": "Invited member",
  "workspace.invitation_accepted": "Accepted invitation",
  "workspace.member_removed": "Removed member",
  "integration.connected": "Connected integration",
  "integration.disconnected": "Disconnected integration",
  "competitor.deleted": "Deleted competitor",
  "subscription.checkout_started": "Started checkout",
  "subscription.portal_opened": "Opened billing portal",
  "gdpr.export_requested": "Requested data export",
  "gdpr.deletion_requested": "Requested account deletion",
  "account.suspended": "Suspended account",
  "account.resumed": "Resumed account",
};

export function ActivityLogSection() {
  const { data: workspaces } = useWorkspaces();
  const { data, isLoading } = useWorkspaceAuditLog();

  const current = useMemo(() => {
    if (!workspaces) return null;
    const id =
      typeof window !== "undefined"
        ? localStorage.getItem(CURRENT_WORKSPACE_STORAGE_KEY)
        : null;
    return (
      workspaces.find((w) => w.workspaceId === id) ??
      workspaces.find((w) => w.role === "owner") ??
      workspaces[0] ??
      null
    );
  }, [workspaces]);

  if (!current || current.role !== "owner") return null;

  const events = data?.data ?? [];

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Activity log
        </CardTitle>
        <CardDescription>
          The 50 most recent governance actions in this workspace. Older events
          are retained for 90 days; long-term audit evidence lives in CloudTrail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <TooltipProvider delayDuration={150}>
            <ul className="divide-y divide-brand-700/50">
              {events.map((e) => (
                <ActivityRow key={e.id} event={e} />
              ))}
            </ul>
          </TooltipProvider>
        )}
        {data?.meta?.hasMore && (
          <p className="mt-3 text-[10px] text-muted-foreground/70">
            Showing latest 50 events.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityRow({ event }: { event: AuditEventListItem }) {
  const label = ACTION_LABEL[event.action] ?? event.action;
  const target = event.resourceLabel ?? event.resourceId;
  const ts = new Date(event.createdAt);
  const tsLabel = isNaN(ts.getTime())
    ? event.createdAt
    : ts.toLocaleString();
  return (
    <li className="flex items-start gap-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="text-foreground">
          <span className="font-medium">{event.actorEmail}</span>{" "}
          <span className="text-muted-foreground">{label.toLowerCase()}</span>
          {target ? (
            <>
              {" "}
              <span className="text-muted-foreground">·</span>{" "}
              <span className="text-foreground">{target}</span>
            </>
          ) : null}
        </div>
        <div className="text-[11px] text-muted-foreground/80">{tsLabel}</div>
      </div>
      {event.sourceIp && event.sourceIp !== "unknown" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="rounded bg-brand-950/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {event.sourceIp}
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs break-words">
            <div className="text-[10px] uppercase text-muted-foreground">
              User-Agent
            </div>
            <div className="font-mono text-[11px]">{event.userAgent ?? "unknown"}</div>
          </TooltipContent>
        </Tooltip>
      )}
    </li>
  );
}
