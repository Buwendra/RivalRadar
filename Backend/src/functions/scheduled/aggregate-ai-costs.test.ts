import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../shared/db/queries', () => ({
  getItem: vi.fn(),
  putItem: vi.fn(),
  queryByPK: vi.fn(),
  updateItem: vi.fn(),
}));

import { reconcileUserMonthToDate } from './aggregate-ai-costs';
import { getItem, queryByPK, updateItem } from '../../shared/db/queries';

const mockGetItem = vi.mocked(getItem);
const mockQueryByPK = vi.mocked(queryByPK);
const mockUpdateItem = vi.mocked(updateItem);

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

function costDay(totalCostUsd: number) {
  return { totalCostUsd };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reconcileUserMonthToDate', () => {
  it('raises the cache to the CostDay floor when it drifted below', async () => {
    mockGetItem.mockResolvedValue({
      monthToDateCostUsd: 1.0,
      monthToDateCostMonth: CURRENT_MONTH,
    });
    mockQueryByPK.mockResolvedValue({ items: [costDay(2.5), costDay(1.5)] });

    await reconcileUserMonthToDate('u1');

    expect(mockUpdateItem).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        monthToDateCostUsd: 4.0,
        monthToDateCostMonth: CURRENT_MONTH,
      })
    );
  });

  it("keeps the cache when it is ahead of the floor (today's real-time spend) — no double count", async () => {
    // The old implementation ADDed yesterday's total onto a cache that
    // already contained it. The reconciler must never exceed max(cache, floor).
    mockGetItem.mockResolvedValue({
      monthToDateCostUsd: 4.2, // floor (4.0) + $0.20 spent since midnight
      monthToDateCostMonth: CURRENT_MONTH,
    });
    mockQueryByPK.mockResolvedValue({ items: [costDay(4.0)] });

    await reconcileUserMonthToDate('u1');

    expect(mockUpdateItem).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ monthToDateCostUsd: 4.2 })
    );
  });

  it('ignores a stale-month cache entirely (month rollover)', async () => {
    mockGetItem.mockResolvedValue({
      monthToDateCostUsd: 55.0, // last month's total — must not leak in
      monthToDateCostMonth: '1999-12',
    });
    mockQueryByPK.mockResolvedValue({ items: [costDay(0.7)] });

    await reconcileUserMonthToDate('u1');

    expect(mockUpdateItem).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        monthToDateCostUsd: 0.7,
        monthToDateCostMonth: CURRENT_MONTH,
      })
    );
  });

  it('queries only the current month of CostDay rows', async () => {
    mockGetItem.mockResolvedValue({ monthToDateCostMonth: CURRENT_MONTH });
    mockQueryByPK.mockResolvedValue({ items: [] });

    await reconcileUserMonthToDate('u1');

    expect(mockQueryByPK).toHaveBeenCalledWith(
      expect.any(String),
      `COST#${CURRENT_MONTH}`,
      expect.objectContaining({ scanForward: true })
    );
  });

  it('skips cleanly when the user row is missing', async () => {
    mockGetItem.mockResolvedValue(null);
    mockQueryByPK.mockResolvedValue({ items: [] });

    await reconcileUserMonthToDate('ghost');

    expect(mockUpdateItem).not.toHaveBeenCalled();
  });
});
