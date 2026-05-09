"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/utils/format-date";
import {
  useResearchRun,
  useResearchRunTechnical,
} from "@/lib/hooks/use-research-runs";
import type {
  ApplicationEvent,
  ResearchRunStatus,
  ResearchRunSummary,
  ResearchTriggerSource,
} from "@/lib/types";

const STUCK_THRESHOLD_MS = 10 * 60 * 1000;

type DerivedStatus = ResearchRunStatus | "stuck";

function deriveStatus(run: ResearchRunSummary): DerivedStatus {
  if (run.status === "running" || run.status === "queued") {
    const start = run.runStartedAt ?? run.startedAt;
    if (start && Date.now() - Date.parse(start) > STUCK_THRESHOLD_MS) {
      return "stuck";
    }
  }
  return run.status;
}

const STATUS_CONFIG: Record<
  DerivedStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  queued: {
    label: "Queued",
    className: "border-brand-700 bg-brand-800 text-muted-foreground",
    icon: Clock,
  },
  running: {
    label: "Running",
    className: "border-amber-900/60 bg-amber-950/40 text-amber-300",
    icon: Loader2,
  },
  succeeded: {
    label: "Succeeded",
    className: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "border-red-900/60 bg-red-950/40 text-red-300",
    icon: XCircle,
  },
  stuck: {
    label: "Stuck",
    className: "border-orange-900/60 bg-orange-950/40 text-orange-300",
    icon: AlertTriangle,
  },
};

const TRIGGER_LABEL: Record<ResearchTriggerSource, string> = {
  manual: "Manual",
  onboarding: "Onboarding",
  recurring: "Recurring",
};

interface ResearchRunCardProps {
  run: ResearchRunSummary;
  /** Hide the competitor link (true on the per-competitor history tab). */
  hideCompetitorLink?: boolean;
}

export function ResearchRunCard({ run, hideCompetitorLink }: ResearchRunCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [technicalOpen, setTechnicalOpen] = useState(false);

  const derived = useMemo(() => deriveStatus(run), [run]);
  const cfg = STATUS_CONFIG[derived];
  const StatusIcon = cfg.icon;
  const isActive = derived === "running" || derived === "queued";

  // Lazy fetches when the card is expanded.
  const detailQuery = useResearchRun(run.id, expanded);
  const technicalQuery = useResearchRunTechnical(run.id, technicalOpen);

  const events: ApplicationEvent[] = expanded
    ? detailQuery.data?.events ?? run.events ?? []
    : run.events ?? [];

  return (
    <div
      className={cn(
        "rounded-md border bg-brand-950/40 p-3 transition-colors",
        derived === "stuck" ? "border-orange-900/60" : "border-brand-700/60"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "h-5 gap-1 border px-1.5 text-[10px] font-medium",
                cfg.className
              )}
            >
              <StatusIcon
                className={cn(
                  "h-3 w-3",
                  derived === "running" && "animate-spin"
                )}
              />
              {cfg.label}
            </Badge>
            {hideCompetitorLink ? (
              <span className="text-sm font-medium">{run.competitorName}</span>
            ) : (
              <Link
                href={`/dashboard/competitors/${run.competitorId}`}
                className="text-sm font-medium hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {run.competitorName}
              </Link>
            )}
            <Badge
              variant="outline"
              className="h-5 border-brand-700 px-1.5 text-[10px] font-medium text-muted-foreground"
            >
              {TRIGGER_LABEL[run.triggerSource]}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>Started {formatRelativeDate(run.startedAt)}</span>
            {typeof run.deltaCount === "number" && (
              <span>
                {run.deltaCount} delta{run.deltaCount === 1 ? "" : "s"}
              </span>
            )}
            {typeof run.citationCount === "number" && (
              <span>{run.citationCount} citations</span>
            )}
            {run.triggerSource !== "recurring" && (
              <span className="truncate">By {run.triggeredByEmail}</span>
            )}
          </div>
          {run.errorMessage && (
            <div className="rounded border border-red-900/50 bg-red-950/30 px-2 py-1 text-xs text-red-300">
              {run.errorMessage}
            </div>
          )}
          {derived === "stuck" && (
            <div className="text-xs text-orange-300">
              No update for over 10 minutes. The Lambda may have timed out —
              click &ldquo;Technical details&rdquo; for execution history.
            </div>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-brand-700/60 pt-3">
          <div>
            <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Events
            </h4>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground">No events yet.</p>
            ) : (
              <ul className="space-y-1">
                {events.map((ev, i) => (
                  <li
                    key={`${ev.ts}-${i}`}
                    className={cn(
                      "flex items-start gap-2 text-xs",
                      ev.level === "error" && "text-red-300",
                      ev.level === "warn" && "text-amber-300"
                    )}
                  >
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {new Date(ev.ts).toLocaleTimeString()}
                    </span>
                    <span className="font-mono">{ev.message}</span>
                    {ev.data && (
                      <span className="text-muted-foreground">
                        {Object.entries(ev.data)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(" ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => setTechnicalOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Terminal className="h-3 w-3" />
            {technicalOpen ? "Hide" : "Show"} technical details
          </button>

          {technicalOpen && (
            <div className="space-y-3 rounded border border-brand-700/60 bg-brand-950/60 p-2">
              {technicalQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : technicalQuery.isError ? (
                <p className="text-xs text-red-300">
                  Could not load execution history.
                </p>
              ) : (
                <>
                  <div>
                    <h5 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Step Function history
                    </h5>
                    {technicalQuery.data?.executionArn ? (
                      <p className="mb-1 break-all text-[10px] text-muted-foreground">
                        {technicalQuery.data.executionArn}
                      </p>
                    ) : null}
                    {(technicalQuery.data?.sfnEvents ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No execution history available.
                      </p>
                    ) : (
                      <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                        {technicalQuery.data!.sfnEvents.map((e, i) => (
                          <li
                            key={`sfn-${i}`}
                            className="flex items-start gap-2 font-mono text-[11px]"
                          >
                            <span className="shrink-0 text-muted-foreground">
                              {new Date(e.timestamp).toLocaleTimeString()}
                            </span>
                            <span>{e.type}</span>
                            {e.stateName && (
                              <span className="text-muted-foreground">
                                {e.stateName}
                              </span>
                            )}
                            {e.error && (
                              <span className="text-red-300">{e.error}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h5 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      CloudWatch tail
                    </h5>
                    {technicalQuery.data?.logsConfigured === false ? (
                      <p className="text-xs text-muted-foreground">
                        Log group not configured for this environment.
                      </p>
                    ) : (technicalQuery.data?.logLines ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No log lines mention this run id yet.
                      </p>
                    ) : (
                      <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                        {technicalQuery.data!.logLines.map((l, i) => (
                          <li
                            key={`log-${i}`}
                            className="font-mono text-[10px] text-muted-foreground"
                          >
                            <span>
                              {new Date(l.timestamp).toLocaleTimeString()}
                            </span>{" "}
                            <span className="text-foreground">{l.message}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {!hideCompetitorLink && (
            <Link
              href={`/dashboard/competitors/${run.competitorId}`}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              View competitor
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}

      {/* Active state visible flag is informational; the polling hook drives refetch */}
      {!expanded && isActive && events.length > 0 && (
        <div className="mt-2 border-t border-brand-700/60 pt-2 text-[11px] text-muted-foreground">
          Latest:{" "}
          <span className="font-mono">
            {events[events.length - 1].message}
          </span>
        </div>
      )}
    </div>
  );
}
