import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the DynamoDB helpers; the key builders (../db/keys) stay real since
// they're pure string functions.
vi.mock('../db/queries', () => ({
  conditionalUpdate: vi.fn(),
  getItem: vi.fn(),
}));

import { enforceAuthRateLimit } from './auth-rate-limit';
import { conditionalUpdate, getItem } from '../db/queries';

const mockConditionalUpdate = vi.mocked(conditionalUpdate);
const mockGetItem = vi.mocked(getItem);

const SCOPE = 'SIGNIN_IP';
const ID = '203.0.113.7';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('enforceAuthRateLimit', () => {
  it('passes when the live-window increment succeeds (phase 1)', async () => {
    mockConditionalUpdate.mockResolvedValueOnce(true);

    await expect(enforceAuthRateLimit(SCOPE, ID, 10, 300)).resolves.toBeUndefined();

    expect(mockConditionalUpdate).toHaveBeenCalledTimes(1);
    const call = mockConditionalUpdate.mock.calls[0][0];
    expect(call.pk).toBe(`RATELIMIT#AUTH#${SCOPE}#${ID}`);
    expect(call.sk).toBe('WINDOW');
    expect(call.update).toContain('ADD');
    // Headroom is limit - 1 so the post-ADD count never exceeds the limit.
    expect(call.values[':headroom']).toBe(9);
  });

  it('starts a fresh window when no live window exists (phase 2)', async () => {
    mockConditionalUpdate
      .mockResolvedValueOnce(false) // phase 1: no row / expired window
      .mockResolvedValueOnce(true); // phase 2: fresh window claimed

    await expect(enforceAuthRateLimit(SCOPE, ID, 10, 300)).resolves.toBeUndefined();

    expect(mockConditionalUpdate).toHaveBeenCalledTimes(2);
    const phase2 = mockConditionalUpdate.mock.calls[1][0];
    expect(phase2.update).toContain('SET');
    expect(phase2.values[':one']).toBe(1);
    // TTL (epoch seconds) lands after the window end (epoch ms).
    const fresh = phase2.values[':fresh'] as number;
    const ttl = phase2.values[':ttl'] as number;
    expect(ttl).toBeGreaterThan(Math.floor(fresh / 1000));
  });

  it('throws 429 with a computed retry-after when both phases lose', async () => {
    const resetInMs = 90_000;
    mockConditionalUpdate.mockResolvedValue(false); // live window at the limit
    mockGetItem.mockResolvedValue({ windowResetAt: Date.now() + resetInMs });

    await expect(enforceAuthRateLimit(SCOPE, ID, 5, 300)).rejects.toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMITED',
    });

    // Retry-after reflects the stored window end, not a fresh full window.
    mockGetItem.mockResolvedValue({ windowResetAt: Date.now() + resetInMs });
    await expect(enforceAuthRateLimit(SCOPE, ID, 5, 300)).rejects.toThrow(/Retry after 9[01]s/);
  });

  it('falls back to a full window for retry-after when the row read misses', async () => {
    mockConditionalUpdate.mockResolvedValue(false);
    mockGetItem.mockResolvedValue(null);

    await expect(enforceAuthRateLimit(SCOPE, ID, 5, 300)).rejects.toThrow(/Retry after 300s/);
  });

  it('fails open on unexpected DDB errors', async () => {
    mockConditionalUpdate.mockRejectedValue(new Error('ProvisionedThroughputExceededException'));

    await expect(enforceAuthRateLimit(SCOPE, ID, 5, 300)).resolves.toBeUndefined();
  });

  it('fails open when the retry-after read itself blows up', async () => {
    mockConditionalUpdate.mockResolvedValue(false);
    mockGetItem.mockRejectedValue(new Error('network'));

    await expect(enforceAuthRateLimit(SCOPE, ID, 5, 300)).resolves.toBeUndefined();
  });
});
