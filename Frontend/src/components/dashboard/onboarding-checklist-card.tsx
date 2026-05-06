"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOnboardingChecklist } from "@/lib/hooks/use-onboarding-checklist";

interface OnboardingChecklistCardProps {
  onAddCompetitor: () => void;
}

export function OnboardingChecklistCard({ onAddCompetitor }: OnboardingChecklistCardProps) {
  const { tasks, doneCount, pctComplete, dismissed, isLoading, dismiss } =
    useOnboardingChecklist();

  // Hide while data is hydrating to avoid the card flickering then collapsing.
  if (isLoading) return null;
  if (dismissed) return null;
  if (pctComplete === 100) return null;

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Get the most out of RivalScan
            </CardTitle>
            <CardDescription className="mt-1">
              {doneCount} of {tasks.length} done. Each step compounds the value
              you get from your weekly briefing.
            </CardDescription>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-muted-foreground hover:text-foreground"
            aria-label="Dismiss onboarding checklist"
          >
            Dismiss
          </button>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-950/60">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pctComplete}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-brand-700/50">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-start gap-3 py-3">
              <span className="mt-0.5 shrink-0">
                {task.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm font-medium ${
                    task.done ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {task.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {task.description}
                </div>
              </div>
              {!task.done && (
                <TaskAction
                  task={task}
                  onAddCompetitor={onAddCompetitor}
                />
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function TaskAction({
  task,
  onAddCompetitor,
}: {
  task: ReturnType<typeof useOnboardingChecklist>["tasks"][number];
  onAddCompetitor: () => void;
}) {
  if (task.actionId === "open-add-competitor") {
    return (
      <Button size="sm" variant="ghost" onClick={onAddCompetitor}>
        Start <ArrowRight className="ml-1 h-3 w-3" />
      </Button>
    );
  }
  if (task.href) {
    return (
      <Button size="sm" variant="ghost" asChild>
        <Link href={task.href}>
          Start <ArrowRight className="ml-1 h-3 w-3" />
        </Link>
      </Button>
    );
  }
  return null;
}
