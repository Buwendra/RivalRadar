/**
 * Anthropic API pricing per million tokens (USD), used to convert observed
 * token counts into cost dollars in the `ai_call_completed` audit log.
 *
 * Update this table when Anthropic publishes price changes. Keys must match
 * the model identifiers used in callsites (alias OR dated snapshot).
 *
 * Source of truth (as of 2026-01): https://www.anthropic.com/pricing
 *   - Sonnet 4.5: $3 / $15 per million tokens (input / output)
 *   - Haiku 4.5:  $1 / $5  per million tokens (input / output)
 */

interface ModelPrice {
  inputPerMillion: number;
  outputPerMillion: number;
}

const PRICE_TABLE: Record<string, ModelPrice> = {
  // Sonnet 4.5 (alias + known dated snapshots)
  'claude-sonnet-4-5': { inputPerMillion: 3, outputPerMillion: 15 },
  // Haiku 4.5
  'claude-haiku-4-5-20251001': { inputPerMillion: 1, outputPerMillion: 5 },
  'claude-haiku-4-5': { inputPerMillion: 1, outputPerMillion: 5 },
};

// Conservative default for unknown models — matches Sonnet 4.5 so we
// never under-report cost. Better to over-attribute than to lose it.
const FALLBACK_PRICE: ModelPrice = { inputPerMillion: 3, outputPerMillion: 15 };

/**
 * Compute USD cost for a single Anthropic call from token counts.
 * Returns 0 cleanly when token counts are missing/zero (some endpoint
 * responses omit usage fields on early errors).
 */
export function computeAnthropicCostUsd(
  model: string,
  inputTokens: number | undefined,
  outputTokens: number | undefined
): number {
  const price = PRICE_TABLE[model] ?? FALLBACK_PRICE;
  const input = (inputTokens ?? 0) / 1_000_000;
  const output = (outputTokens ?? 0) / 1_000_000;
  return input * price.inputPerMillion + output * price.outputPerMillion;
}
