/**
 * Phase 3D — human captions for the 8 ResearchRun event types emitted by
 * `Backend/src/functions/pipeline/deep-research.ts`. Reads like Claude is
 * narrating its own work — demo-friendly but not twee.
 *
 * Templates reference `event.data` fields by interpolating `{name}`. If a
 * referenced field is missing the placeholder is dropped (the rendered text
 * stays readable).
 */

export type ResearchEventData = Record<string, unknown> | undefined;

interface EventConfig {
  /** User-facing caption template. `{name}` placeholders are replaced from event.data. */
  caption: string;
  /** `true` if this event marks a successful terminal state. */
  isTerminal?: boolean;
  /** `true` if this event marks a failure terminal state. */
  isFailure?: boolean;
}

const EVENT_CONFIG: Record<string, EventConfig> = {
  research_started: {
    caption: "Starting research…",
  },
  deep_research_completed: {
    caption:
      "Read the web and found {findings} findings across {citations} sources",
  },
  deltas_detected: {
    caption: "Compared to last week — {count} new strategic moves",
  },
  first_run_no_prior_finding: {
    caption: "First research run — no prior baseline to compare to",
  },
  enrichment_completed: {
    caption: "Updated threat score, momentum, and tags",
  },
  enrichment_failed: {
    caption: "Couldn't update derived signals (research itself succeeded)",
  },
  research_succeeded: {
    caption: "Done",
    isTerminal: true,
  },
  research_failed: {
    caption: "Research couldn't complete",
    isFailure: true,
  },
};

function interpolate(template: string, data: ResearchEventData): string {
  if (!data) return template.replace(/\s*\{[^}]+\}/g, "");
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = (data as Record<string, unknown>)[key];
    if (value === undefined || value === null) return "";
    return String(value);
  }).replace(/\s+/g, " ").trim();
}

/**
 * Render a human caption for an event. Falls back to the raw `message`
 * when no mapping exists — defensive against new event names added by
 * backend before frontend is updated.
 */
export function captionForResearchEvent(
  message: string,
  data?: ResearchEventData
): string {
  const cfg = EVENT_CONFIG[message];
  if (!cfg) return message;
  return interpolate(cfg.caption, data);
}

export function isTerminalResearchEvent(message: string): boolean {
  return EVENT_CONFIG[message]?.isTerminal === true;
}

export function isFailureResearchEvent(message: string): boolean {
  return EVENT_CONFIG[message]?.isFailure === true;
}
