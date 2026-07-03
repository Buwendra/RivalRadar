import { describe, expect, it, vi, beforeEach } from 'vitest';

// Capture every command sent to the DocumentClient so tests can assert on the
// exact KeyConditionExpression / ExpressionAttributeValues we build.
const sendMock = vi.fn();
vi.mock('./client', () => ({
  ddb: { send: (...args: unknown[]) => sendMock(...args) },
  TABLE_NAME: 'TestTable',
}));

import { atomicAddGuarded, queryByPK, queryGSI, skPrefixRange } from './queries';

function lastQueryInput(): Record<string, unknown> {
  const call = sendMock.mock.calls.at(-1);
  if (!call) throw new Error('ddb.send was never called');
  return (call[0] as { input: Record<string, unknown> }).input;
}

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue({ Items: [] });
});

describe('skPrefixRange', () => {
  it('builds an inclusive range capped inside the prefix namespace', () => {
    const [lo, hi] = skPrefixRange('CHANGE#', '2026-06-26T08:00:00.000Z');
    expect(lo).toBe('CHANGE#2026-06-26T08:00:00.000Z');
    expect(hi.startsWith('CHANGE#')).toBe(true);
    // The upper bound must sort after every real CHANGE# timestamp…
    expect(hi > 'CHANGE#2999-12-31T23:59:59.999Z').toBe(true);
    // …but BEFORE the other GSI1 namespaces, so a range query cannot bleed
    // into REC#/RESEARCH# rows (the original weekly-digest bug).
    expect(hi < 'REC#').toBe(true);
    expect(hi < 'RESEARCH#').toBe(true);
  });
});

describe('queryGSI', () => {
  it('uses BETWEEN when skBetween is provided', async () => {
    const since = '2026-06-26T08:00:00.000Z';
    await queryGSI('GSI1', 'GSI1PK', 'user-1', undefined, {
      skName: 'GSI1SK',
      skBetween: skPrefixRange('CHANGE#', since),
    });

    const input = lastQueryInput();
    expect(input.KeyConditionExpression).toBe(
      'GSI1PK = :pk AND GSI1SK BETWEEN :skLo AND :skHi'
    );
    const values = input.ExpressionAttributeValues as Record<string, string>;
    expect(values[':pk']).toBe('user-1');
    expect(values[':skLo']).toBe(`CHANGE#${since}`);
    expect(values[':skHi'].startsWith('CHANGE#')).toBe(true);
  });

  it('keeps begins_with semantics for plain prefixes', async () => {
    await queryGSI('GSI1', 'GSI1PK', 'user-1', 'CHANGE#', { skName: 'GSI1SK' });

    const input = lastQueryInput();
    expect(input.KeyConditionExpression).toBe(
      'GSI1PK = :pk AND begins_with(GSI1SK, :skPrefix)'
    );
    expect(
      (input.ExpressionAttributeValues as Record<string, string>)[':skPrefix']
    ).toBe('CHANGE#');
  });

  it('rejects skPrefix + skBetween together', async () => {
    await expect(
      queryGSI('GSI1', 'GSI1PK', 'user-1', 'CHANGE#', {
        skBetween: skPrefixRange('CHANGE#', '2026-01-01'),
      })
    ).rejects.toThrow(/mutually exclusive/);
  });
});

describe('atomicAddGuarded', () => {
  const guard = { attr: 'monthToDateCostMonth', value: '2026-07' };

  it('ADDs while the guard window still matches', async () => {
    await atomicAddGuarded('USER#u1', 'PROFILE', 'monthToDateCostUsd', 0.5, guard, {
      lastAiCallAt: 't',
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const input = lastQueryInput();
    expect(input.UpdateExpression).toBe('ADD #a :d SET #g = :g, #s0 = :s0');
    expect(input.ConditionExpression).toBe('#g = :g');
    const values = input.ExpressionAttributeValues as Record<string, unknown>;
    expect(values[':d']).toBe(0.5);
    expect(values[':g']).toBe('2026-07');
  });

  it('RESETs the counter when the window rolled over (condition fails)', async () => {
    const conditionErr = Object.assign(new Error('conditional'), {
      name: 'ConditionalCheckFailedException',
    });
    sendMock.mockRejectedValueOnce(conditionErr).mockResolvedValueOnce({});

    await atomicAddGuarded('USER#u1', 'PROFILE', 'monthToDateCostUsd', 0.3, guard);

    expect(sendMock).toHaveBeenCalledTimes(2);
    const input = lastQueryInput();
    // Second write must SET (reset to this call's cost), never ADD onto the
    // previous month's total — the original bug carried June into July.
    expect(input.UpdateExpression).toBe('SET #a = :d, #g = :g');
    expect(input.ConditionExpression).toBeUndefined();
    expect((input.ExpressionAttributeValues as Record<string, unknown>)[':d']).toBe(0.3);
  });

  it('propagates non-conditional errors', async () => {
    sendMock.mockRejectedValueOnce(new Error('boom'));
    await expect(
      atomicAddGuarded('USER#u1', 'PROFILE', 'x', 1, guard)
    ).rejects.toThrow('boom');
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

describe('queryByPK', () => {
  it('uses BETWEEN on the base-table SK when skBetween is provided', async () => {
    await queryByPK('USER#u1', undefined, {
      skBetween: skPrefixRange('COST#2026-06', ''),
    });

    const input = lastQueryInput();
    expect(input.KeyConditionExpression).toBe('PK = :pk AND SK BETWEEN :skLo AND :skHi');
  });

  it('is unchanged for prefix queries', async () => {
    await queryByPK('USER#u1', 'COMP#');
    const input = lastQueryInput();
    expect(input.KeyConditionExpression).toBe('PK = :pk AND begins_with(SK, :skPrefix)');
  });
});
