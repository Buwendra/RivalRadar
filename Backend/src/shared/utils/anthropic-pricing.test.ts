import { describe, expect, it } from 'vitest';
import { computeAnthropicCostUsd } from './anthropic-pricing';

// The cost cap (research-eligibility.ts) and the real-time MTD update in
// callAnthropic both rest on this math, so the branches matter.
describe('computeAnthropicCostUsd', () => {
  it('prices Sonnet 4.5 at $3/$15 per million tokens', () => {
    // 1M input + 1M output = 3 + 15 = 18
    expect(computeAnthropicCostUsd('claude-sonnet-4-5', 1_000_000, 1_000_000)).toBeCloseTo(18, 6);
  });

  it('prices Haiku 4.5 at $1/$5 per million tokens (alias + dated snapshot)', () => {
    expect(computeAnthropicCostUsd('claude-haiku-4-5', 1_000_000, 1_000_000)).toBeCloseTo(6, 6);
    expect(
      computeAnthropicCostUsd('claude-haiku-4-5-20251001', 1_000_000, 1_000_000)
    ).toBeCloseTo(6, 6);
  });

  it('computes fractional token costs correctly', () => {
    // 10k input @ $3/M = 0.03 ; 2k output @ $15/M = 0.03 ; total 0.06
    expect(computeAnthropicCostUsd('claude-sonnet-4-5', 10_000, 2_000)).toBeCloseTo(0.06, 6);
  });

  it('falls back to Sonnet pricing for unknown models (never under-report)', () => {
    expect(computeAnthropicCostUsd('some-future-model', 1_000_000, 0)).toBeCloseTo(3, 6);
  });

  it('returns 0 when token counts are missing or zero', () => {
    expect(computeAnthropicCostUsd('claude-sonnet-4-5', undefined, undefined)).toBe(0);
    expect(computeAnthropicCostUsd('claude-sonnet-4-5', 0, 0)).toBe(0);
  });

  it('handles input-only and output-only usage', () => {
    expect(computeAnthropicCostUsd('claude-sonnet-4-5', 1_000_000, undefined)).toBeCloseTo(3, 6);
    expect(computeAnthropicCostUsd('claude-sonnet-4-5', undefined, 1_000_000)).toBeCloseTo(15, 6);
  });
});
