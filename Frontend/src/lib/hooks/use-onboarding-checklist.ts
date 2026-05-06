"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/use-auth";
import { useCompetitors } from "@/lib/hooks/use-competitors";
import { useChanges } from "@/lib/hooks/use-changes";
import { useIntegrations } from "@/lib/hooks/use-integrations";
import { useWorkspaceMembers } from "@/lib/hooks/use-workspaces";

const DISMISSED_KEY = "rs_onboarding_dismissed";

export type ChecklistTaskId =
  | "add-competitor"
  | "run-research"
  | "invite-teammate"
  | "connect-channel"
  | "tune-feed";

export interface ChecklistTask {
  id: ChecklistTaskId;
  label: string;
  description: string;
  done: boolean;
  /** Where to send the user to complete this task. Either an in-app link
   *  or a hint that the parent should call its own action handler. */
  href?: string;
  actionId?: "open-add-competitor";
  /** A specific actionable competitor id, used by run-research. */
  competitorId?: string;
}

export function useOnboardingChecklist() {
  const { user } = useAuth();
  const { data: competitors = [], isLoading: competitorsLoading } = useCompetitors();
  const { data: changesData, isLoading: changesLoading } = useChanges();
  const { data: integrations = [], isLoading: integrationsLoading } = useIntegrations();
  const { data: members = [], isLoading: membersLoading } = useWorkspaceMembers();

  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "true");
  }, []);

  const isLoading =
    competitorsLoading || changesLoading || integrationsLoading || membersLoading;

  const tasks = useMemo<ChecklistTask[]>(() => {
    const totalChanges =
      changesData?.pages.reduce((acc, page) => acc + page.data.length, 0) ?? 0;
    const firstCompetitorId = competitors[0]?.id;

    return [
      {
        id: "add-competitor",
        label: "Add your first competitor",
        description: "Start tracking who you're up against.",
        done: competitors.length > 0,
        actionId: "open-add-competitor",
      },
      {
        id: "run-research",
        label: "Run deep research",
        description: "Generate findings + initial change baseline.",
        done: totalChanges > 0,
        href: firstCompetitorId
          ? `/dashboard/competitors/${firstCompetitorId}`
          : undefined,
        competitorId: firstCompetitorId,
      },
      {
        id: "invite-teammate",
        label: "Invite a teammate",
        description: "Share the workspace with someone who'll act on intel.",
        done: members.length > 1,
        href: "/dashboard/settings",
      },
      {
        id: "connect-channel",
        label: "Connect Slack or webhook",
        description: "Get critical alerts where you actually live.",
        done: integrations.length > 0,
        href: "/dashboard/settings",
      },
      {
        id: "tune-feed",
        label: "Set your feed threshold",
        description: "Hide low-significance noise from the dashboard + digest.",
        done:
          typeof user?.feedSignificanceThreshold === "number" &&
          user.feedSignificanceThreshold > 0,
        href: "/dashboard/settings",
      },
    ];
  }, [
    user?.feedSignificanceThreshold,
    competitors,
    changesData,
    members.length,
    integrations.length,
  ]);

  const doneCount = tasks.filter((t) => t.done).length;
  const pctComplete = Math.round((doneCount / tasks.length) * 100);

  // Auto-mark dismissed when fully complete so the card never re-emerges.
  useEffect(() => {
    if (!isLoading && pctComplete === 100 && !dismissed) {
      localStorage.setItem(DISMISSED_KEY, "true");
      setDismissed(true);
    }
  }, [isLoading, pctComplete, dismissed]);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  return { tasks, doneCount, pctComplete, dismissed, isLoading, dismiss };
}
