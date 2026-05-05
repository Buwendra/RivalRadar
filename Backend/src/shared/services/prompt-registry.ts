/**
 * Prompt version registry (Phase 8a).
 *
 * Every Anthropic helper passes its current prompt version through
 * `callAnthropic`'s `context` parameter, which gets logged into the
 * `ai_call_completed` event. Phase 8b joins those events to outcome
 * signals (`recommendation_acted_on`, `prediction_realized`) offline
 * to compare prompt-version quality.
 *
 * Bump the version string when you materially change a prompt:
 *   - rewriting the system message → bump (v1 → v2)
 *   - adjusting `max_tokens` only → don't bump (model-config not prompt)
 *   - adding a new field to the JSON output schema → bump (the contract changed)
 *
 * Convention: simple incrementing string ("v1", "v2"). No semver — Phase 8b
 * just needs a join key, not ordering semantics.
 */

export const PROMPT_VERSIONS = {
  analyzeChange: 'v1',
  generateWeeklySummary: 'v1',
  deepResearch: 'v1',
  detectResearchDeltas: 'v1',
  scoreCompetitorThreat: 'v1',
  predictNextMoves: 'v1',
  evaluatePriorPredictions: 'v1',
  classifyResearchTarget: 'v1',
  generateRecommendations: 'v1',
  suggestCompetitors: 'v1',
} as const;

export type PromptOpName = keyof typeof PROMPT_VERSIONS;

/**
 * Returns 'unknown' for unrecognized opNames so a typo doesn't break the
 * Anthropic call — the audit log just records 'unknown' and Phase 8b's
 * analysis surfaces it during the offline join.
 */
export function getPromptVersion(opName: string): string {
  if (opName in PROMPT_VERSIONS) {
    return PROMPT_VERSIONS[opName as PromptOpName];
  }
  return 'unknown';
}
