import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock only the DynamoDB helpers callAnthropic touches. Key builders, the
// pricing util, id, logger, and prompt-registry stay real (pure / harmless).
vi.mock('../db/queries', () => ({
  atomicAdd: vi.fn(),
  atomicAddGuarded: vi.fn(),
  getItem: vi.fn(),
  putItem: vi.fn(),
}));

import { callAnthropic } from './anthropic';
import { atomicAdd, atomicAddGuarded, getItem, putItem } from '../db/queries';
import { userPK, userSK, rateLimitPK } from '../db/keys';

const mockAtomicAdd = vi.mocked(atomicAdd);
const mockAtomicAddGuarded = vi.mocked(atomicAddGuarded);
const mockGetItem = vi.mocked(getItem);
const mockPutItem = vi.mocked(putItem);
const mockFetch = vi.fn();

// 200 response carrying an Anthropic-style usage block. Fresh object each call
// (a Response body can only be consumed once).
function okResponse(inputTokens = 1000, outputTokens = 500): Response {
  return new Response(
    JSON.stringify({ usage: { input_tokens: inputTokens, output_tokens: outputTokens } }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

function rateLimited(retryAfterSec: string): Response {
  return new Response('', { status: 429, headers: { 'retry-after': retryAfterSec } });
}

const BODY = { model: 'claude-haiku-4-5', messages: [{ role: 'user', content: 'hi' }] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  // Default: rate-limit bucket well under threshold, writes succeed.
  mockAtomicAdd.mockResolvedValue(undefined as never);
  mockAtomicAddGuarded.mockResolvedValue(undefined as never);
  mockGetItem.mockResolvedValue({ tokensUsed: 100 } as never);
  mockPutItem.mockResolvedValue(undefined as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('callAnthropic — Issue 8 (input-TPM rate-limit bucket)', () => {
  it('pre-checks the rate-limit bucket before calling Anthropic', async () => {
    mockFetch.mockResolvedValue(okResponse());

    await callAnthropic('key', BODY, 'unit-test');

    // ADD to the per-minute bucket happened, keyed under the rate-limit PK.
    expect(mockAtomicAdd).toHaveBeenCalledWith(
      rateLimitPK(),
      expect.any(String),
      'tokensUsed',
      expect.any(Number),
      expect.any(Object)
    );
    expect(mockGetItem).toHaveBeenCalledWith(rateLimitPK(), expect.any(String));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('fails open and still calls Anthropic when the bucket read errors', async () => {
    mockGetItem.mockRejectedValue(new Error('ddb down'));
    mockFetch.mockResolvedValue(okResponse());

    const res = await callAnthropic('key', BODY, 'unit-test');

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1); // not blocked by our own tracker
  });

  it('throttles to the next minute when the bucket is over threshold, then proceeds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T12:00:30Z')); // 30s into the minute
    // First read over the 25k threshold, second read clear.
    mockGetItem
      .mockResolvedValueOnce({ tokensUsed: 30_000 } as never)
      .mockResolvedValueOnce({ tokensUsed: 100 } as never);
    mockFetch.mockResolvedValue(okResponse());

    const p = callAnthropic('key', BODY, 'unit-test');
    await vi.advanceTimersByTimeAsync(30_000); // sleep to the minute boundary
    const res = await p;

    expect(res.status).toBe(200);
    expect(mockAtomicAdd.mock.calls.filter((c) => c[0] === rateLimitPK()).length).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('callAnthropic — Issue 7 (real-time cost cap)', () => {
  it('atomically bumps monthToDateCostUsd on the user row after a successful call', async () => {
    mockFetch.mockResolvedValue(okResponse(1000, 500)); // haiku: 0.001 + 0.0025 = 0.0035

    await callAnthropic('key', BODY, 'unit-test', { userId: 'u-1' });

    expect(mockAtomicAddGuarded).toHaveBeenCalledWith(
      userPK('u-1'),
      userSK(),
      'monthToDateCostUsd',
      expect.closeTo(0.0035, 6),
      expect.objectContaining({
        attr: 'monthToDateCostMonth',
        value: expect.stringMatching(/^\d{4}-\d{2}$/),
      }),
      expect.objectContaining({ lastAiCallAt: expect.any(String) })
    );
  });

  it('does not bump the cost cap when there is no userId (system task)', async () => {
    mockFetch.mockResolvedValue(okResponse());

    await callAnthropic('key', BODY, 'unit-test'); // no context.userId

    expect(mockAtomicAddGuarded).not.toHaveBeenCalled();
  });
});

describe('callAnthropic — Issue 9 (forensic audit log)', () => {
  it('writes an AILOG row (fire-and-forget) for the call', async () => {
    mockFetch.mockResolvedValue(okResponse());

    await callAnthropic('key', BODY, 'unit-test', { userId: 'u-1' });

    // persistAiLog awaits response.text() before putItem, so let microtasks flush.
    await vi.waitFor(() => expect(mockPutItem).toHaveBeenCalledTimes(1));
    const row = mockPutItem.mock.calls[0][0] as { PK: string };
    expect(row.PK).toMatch(/^AILOG#/);
  });
});

describe('callAnthropic — 429 retry', () => {
  it('retries after the retry-after delay and returns the eventual 200', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(rateLimited('1')) // honor retry-after: 1s, not the 65s default
      .mockResolvedValueOnce(okResponse());

    const p = callAnthropic('key', BODY, 'unit-test');
    await vi.advanceTimersByTimeAsync(1_000);
    const res = await p;

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
