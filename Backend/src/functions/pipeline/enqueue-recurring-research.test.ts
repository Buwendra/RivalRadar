import { describe, expect, it, vi, beforeEach } from 'vitest';

const { sfnSend } = vi.hoisted(() => ({ sfnSend: vi.fn() }));
vi.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: class {
    send = sfnSend;
  },
  StartExecutionCommand: class {
    constructor(public input: { stateMachineArn: string; input: string }) {}
  },
}));

vi.mock('../../shared/db/queries', () => ({
  queryGSI: vi.fn(),
  getItem: vi.fn(),
  updateItem: vi.fn(),
}));
vi.mock('../../shared/utils/research-eligibility', () => ({
  enforceResearchEligibility: vi.fn(),
}));
vi.mock('../../shared/services/research-run', () => ({
  createResearchRun: vi.fn(),
  markRunStarted: vi.fn(),
  markRunFinished: vi.fn(),
}));

import { handler } from './enqueue-recurring-research';
import { queryGSI, getItem } from '../../shared/db/queries';
import { enforceResearchEligibility } from '../../shared/utils/research-eligibility';
import { createResearchRun } from '../../shared/services/research-run';

const mockQueryGSI = vi.mocked(queryGSI);
const mockGetItem = vi.mocked(getItem);
const mockEligibility = vi.mocked(enforceResearchEligibility);
const mockCreateRun = vi.mocked(createResearchRun);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function competitor(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'comp-1',
    userId: 'user-1',
    name: 'Acme',
    url: 'https://acme.example',
    status: 'active',
    ...overrides,
  };
}

function startedExecutionPayloads(): Array<Record<string, unknown>> {
  return sfnSend.mock.calls.map((call) => {
    const cmd = call[0] as { input: { input: string } };
    return JSON.parse(cmd.input.input) as Record<string, unknown>;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEARCH_PIPELINE_ARN = 'arn:aws:states:::test';
  sfnSend.mockResolvedValue({ executionArn: 'arn:exec' });
  mockGetItem.mockResolvedValue({ id: 'user-1', email: 'u@example.com', plan: 'scout' });
  mockEligibility.mockResolvedValue({ allowed: true } as never);
  let runN = 0;
  mockCreateRun.mockImplementation(async () => ({
    id: `run-${++runN}`,
    startedAt: new Date().toISOString(),
  }) as never);
});

describe('enqueue-recurring-research', () => {
  it('includes targetKind in the SFN payload — self rows keep self framing', async () => {
    mockQueryGSI.mockResolvedValue({
      items: [
        competitor({ id: 'self-1', targetKind: 'self' }),
        competitor({ id: 'rival-1' }), // legacy row: no targetKind attr
      ],
      cursor: undefined,
    });

    await handler();

    const payloads = startedExecutionPayloads();
    expect(payloads).toHaveLength(1);
    const comps = payloads[0].competitors as Array<Record<string, unknown>>;
    expect(comps.find((c) => c.competitorId === 'self-1')?.targetKind).toBe('self');
    expect(comps.find((c) => c.competitorId === 'rival-1')?.targetKind).toBe('competitor');
  });

  it('an updatedAt-only bump no longer defers a due competitor', async () => {
    // Old behavior: renaming a competitor on Saturday made Sunday's cron treat
    // it as freshly researched. updatedAt must not count as research recency.
    mockQueryGSI.mockResolvedValue({
      items: [competitor({ updatedAt: new Date(Date.now() - 1 * HOUR).toISOString() })],
      cursor: undefined,
    });

    const result = await handler();

    expect(result.competitorsDue).toBe(1);
    expect(sfnSend).toHaveBeenCalledTimes(1);
  });

  it('a fresh lastResearchedAt stamp does defer the competitor', async () => {
    mockQueryGSI.mockResolvedValue({
      items: [
        competitor({ lastResearchedAt: new Date(Date.now() - 1 * DAY).toISOString() }),
      ],
      cursor: undefined,
    });

    const result = await handler();

    expect(result.competitorsDue).toBe(0);
    expect(sfnSend).not.toHaveBeenCalled();
  });
});
