/**
 * Wave 1.4 regression tests — the weekly digest chain must soft-degrade
 * per-subscriber (one user's AI failure can't abort the batch) and must not
 * mail "ghost digests" to users with no competitors (workspace members,
 * empty/cancelled accounts).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../shared/db/queries', () => ({
  getItem: vi.fn(),
  putItem: vi.fn(),
  queryByPK: vi.fn(),
  queryGSI: vi.fn(),
  skPrefixRange: (prefix: string, since: string) => [`${prefix}${since}`, `${prefix}￿`],
  updateItem: vi.fn(),
}));
vi.mock('../../shared/services/anthropic', () => ({
  generateWeeklySummary: vi.fn(),
  generateRecommendations: vi.fn(),
}));
vi.mock('../../shared/services/notifier', () => ({
  dispatchWeeklyDigest: vi.fn(),
}));
vi.mock('../../shared/services/elevenlabs', () => ({
  generateAudioBriefing: vi.fn(),
}));
vi.mock('../../shared/services/audio-briefing-storage', () => ({
  storeAudioBriefing: vi.fn(),
}));

import { handler as aggregateChanges } from './aggregate-changes';
import { handler as generateSummary } from './generate-summary';
import { handler as generateRecs } from './generate-recommendations';
import { handler as renderSendEmail } from './render-send-email';
import { getItem, queryByPK, queryGSI } from '../../shared/db/queries';
import {
  generateWeeklySummary,
  generateRecommendations,
} from '../../shared/services/anthropic';
import { dispatchWeeklyDigest } from '../../shared/services/notifier';

const mockGetItem = vi.mocked(getItem);
const mockQueryByPK = vi.mocked(queryByPK);
const mockQueryGSI = vi.mocked(queryGSI);
const mockSummaryAI = vi.mocked(generateWeeklySummary);
const mockRecsAI = vi.mocked(generateRecommendations);
const mockDispatch = vi.mocked(dispatchWeeklyDigest);

const SUBSCRIBER = { userId: 'u1', email: 'u1@example.com', name: 'User One' };

const CHANGE = {
  competitorName: 'Acme',
  pageUrl: 'https://acme.example',
  summary: 'Launched a thing',
  significanceScore: 8,
  changeType: 'feature',
  detectedAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetItem.mockResolvedValue({ id: 'u1', email: 'u1@example.com', plan: 'scout' });
  mockDispatch.mockResolvedValue({ email: 'sent' } as never);
});

describe('aggregate-changes ghost-digest skip', () => {
  it('returns skip:true when the user has no competitor rows', async () => {
    mockQueryGSI.mockResolvedValue({ items: [] });
    mockQueryByPK.mockResolvedValue({ items: [] }); // no competitors (member/empty acct)

    const out = await aggregateChanges(SUBSCRIBER);

    expect(out.skip).toBe(true);
    expect(out.topChanges).toEqual([]);
  });

  it('does not skip when competitors exist', async () => {
    mockQueryGSI.mockResolvedValue({ items: [] });
    mockQueryByPK.mockResolvedValue({
      items: [{ id: 'c1', name: 'Acme', targetKind: 'competitor' }],
    });

    const out = await aggregateChanges(SUBSCRIBER);

    expect(out.skip).toBeUndefined();
  });
});

describe('generate-summary soft-degrade', () => {
  it('falls back to a changes-only summary when the AI call throws', async () => {
    mockSummaryAI.mockRejectedValue(new Error('529 overloaded'));

    const out = await generateSummary({ ...SUBSCRIBER, topChanges: [CHANGE] });

    expect(out.strategicSummary).toMatch(/could not be generated/i);
  });

  it('passes skip through without calling the AI', async () => {
    const out = await generateSummary({ ...SUBSCRIBER, topChanges: [], skip: true });

    expect(out.skip).toBe(true);
    expect(mockSummaryAI).not.toHaveBeenCalled();
  });
});

describe('generate-recommendations soft-degrade', () => {
  it('returns an empty list when the AI call throws (digest still ships)', async () => {
    mockQueryByPK.mockResolvedValue({ items: [] });
    mockRecsAI.mockRejectedValue(new Error('timeout'));

    const out = await generateRecs({
      ...SUBSCRIBER,
      topChanges: [CHANGE],
      competitorSnapshots: [{ name: 'Acme' }],
      strategicSummary: 'summary',
    });

    expect(out.topRecommendations).toEqual([]);
  });

  it('passes skip through without calling the AI', async () => {
    const out = await generateRecs({
      ...SUBSCRIBER,
      topChanges: [],
      competitorSnapshots: [],
      strategicSummary: '',
      skip: true,
    });

    expect(out.topRecommendations).toEqual([]);
    expect(mockRecsAI).not.toHaveBeenCalled();
  });
});

describe('render-send-email skip', () => {
  it('never dispatches when skip is set', async () => {
    const out = await renderSendEmail({
      ...SUBSCRIBER,
      topChanges: [],
      strategicSummary: '',
      skip: true,
    });

    expect(out).toEqual({ sent: false, skipped: true });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('still sends text-only when the user load fails (audio is an enhancement)', async () => {
    mockGetItem.mockRejectedValue(new Error('ddb blip'));

    const out = await renderSendEmail({
      ...SUBSCRIBER,
      topChanges: [CHANGE],
      strategicSummary: 'A summary',
    });

    expect(out.sent).toBe(true);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });
});
