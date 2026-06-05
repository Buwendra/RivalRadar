import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventName } from '@paddle/paddle-node-sdk';
import type { Context } from 'aws-lambda';

vi.mock('../../../shared/db/queries', () => ({
  getItem: vi.fn(),
  putItem: vi.fn(),
  putItemIfNotExists: vi.fn(),
  updateItem: vi.fn(),
}));
vi.mock('../../../shared/services/paddle', () => ({ verifyPaddleWebhook: vi.fn() }));
vi.mock('../../../shared/services/ses', () => ({ sendEmail: vi.fn() }));

import { handler } from './paddle';
import { getItem, putItem, putItemIfNotExists, updateItem } from '../../../shared/db/queries';
import { verifyPaddleWebhook } from '../../../shared/services/paddle';
import { sendEmail } from '../../../shared/services/ses';
import { subscriptionPK, userPK } from '../../../shared/db/keys';
import type { PublicEvent } from '../../../shared/middleware/handler';

const mockGetItem = vi.mocked(getItem);
const mockPutItem = vi.mocked(putItem);
const mockPutIfNotExists = vi.mocked(putItemIfNotExists);
const mockUpdateItem = vi.mocked(updateItem);
const mockVerify = vi.mocked(verifyPaddleWebhook);
const mockSendEmail = vi.mocked(sendEmail);

async function invoke(opts: { signature?: string | null; eventType?: string; data?: unknown }) {
  const event = {
    body: JSON.stringify({ event_type: opts.eventType ?? 'x', data: opts.data ?? {} }),
    isBase64Encoded: false,
    headers: opts.signature === null ? {} : { 'paddle-signature': opts.signature ?? 'sig' },
    requestContext: { http: { method: 'POST', path: '/webhooks/paddle' } },
  } as unknown as PublicEvent;
  const ctx = { awsRequestId: 'req-1' } as unknown as Context;
  const res = (await handler(event, ctx)) as { statusCode: number; body: string };
  return { statusCode: res.statusCode, json: JSON.parse(res.body) as Record<string, unknown> };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerify.mockResolvedValue(true);
  mockGetItem.mockResolvedValue(null as never);
  mockPutItem.mockResolvedValue(undefined as never);
  mockPutIfNotExists.mockResolvedValue(true as never);
  mockUpdateItem.mockResolvedValue(undefined as never);
  mockSendEmail.mockResolvedValue(undefined as never);
});

describe('Paddle webhook — signature gate', () => {
  it('rejects a request with no Paddle-Signature header (400)', async () => {
    const { statusCode, json } = await invoke({ signature: null });
    expect(statusCode).toBe(400);
    expect((json.error as { code: string }).code).toBe('MISSING_SIGNATURE');
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature (400) and does no DB work', async () => {
    mockVerify.mockResolvedValue(false);
    const { statusCode, json } = await invoke({
      signature: 'bad',
      eventType: EventName.SubscriptionCreated,
    });
    expect(statusCode).toBe(400);
    expect((json.error as { code: string }).code).toBe('INVALID_SIGNATURE');
    expect(mockPutIfNotExists).not.toHaveBeenCalled();
    expect(mockUpdateItem).not.toHaveBeenCalled();
  });
});

describe('Paddle webhook — subscription.created', () => {
  it('creates the Subscription row and sets the User plan', async () => {
    const { statusCode } = await invoke({
      eventType: EventName.SubscriptionCreated,
      data: {
        id: 'sub_1',
        customerId: 'cus_1',
        customData: { userId: 'u-1', plan: 'strategist' },
        currentBillingPeriod: { endsAt: '2026-07-01T00:00:00Z' },
      },
    });

    expect(statusCode).toBe(200);
    expect(mockPutIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        PK: subscriptionPK('u-1'),
        plan: 'strategist',
        status: 'active',
        paddleSubscriptionId: 'sub_1',
      })
    );
    expect(mockUpdateItem).toHaveBeenCalledWith(
      userPK('u-1'),
      expect.any(String),
      expect.objectContaining({ plan: 'strategist', paddleCustomerId: 'cus_1' })
    );
  });

  it('no-ops (no DB writes) when customData is missing', async () => {
    const { statusCode } = await invoke({
      eventType: EventName.SubscriptionCreated,
      data: { id: 'sub_1', customerId: 'cus_1', customData: null },
    });
    expect(statusCode).toBe(200);
    expect(mockPutIfNotExists).not.toHaveBeenCalled();
    expect(mockUpdateItem).not.toHaveBeenCalled();
  });
});

describe('Paddle webhook — subscription.canceled', () => {
  it('downgrades the user to scout and writes a cancellation survey + email', async () => {
    mockGetItem.mockResolvedValue({ email: 'gone@example.com', name: 'Gus', plan: 'command' } as never);

    const { statusCode } = await invoke({
      eventType: EventName.SubscriptionCanceled,
      data: { id: 'sub_1', customData: { userId: 'u-1' } },
    });

    expect(statusCode).toBe(200);
    // Subscription marked canceled, user downgraded to scout.
    expect(mockUpdateItem).toHaveBeenCalledWith(
      subscriptionPK('u-1'),
      expect.any(String),
      expect.objectContaining({ status: 'canceled' })
    );
    expect(mockUpdateItem).toHaveBeenCalledWith(
      userPK('u-1'),
      expect.any(String),
      expect.objectContaining({ plan: 'scout' })
    );
    // CancellationFeedback row captures the *canceled* tier, not scout.
    const feedbackCall = mockPutItem.mock.calls.find((c) =>
      String((c[0] as { PK?: string }).PK).startsWith('CANCEL_FEEDBACK#')
    );
    expect(feedbackCall).toBeDefined();
    expect((feedbackCall![0] as { plan: string }).plan).toBe('command');
    expect(mockSendEmail).toHaveBeenCalledWith(
      'gone@example.com',
      expect.stringMatching(/sorry to see you go/i),
      expect.any(String)
    );
  });

  it('still downgrades even if the survey email throws (best-effort)', async () => {
    mockGetItem.mockResolvedValue({ email: 'gone@example.com', plan: 'strategist' } as never);
    mockSendEmail.mockRejectedValue(new Error('SES down'));

    const { statusCode } = await invoke({
      eventType: EventName.SubscriptionCanceled,
      data: { id: 'sub_1', customData: { userId: 'u-1' } },
    });

    expect(statusCode).toBe(200);
    expect(mockUpdateItem).toHaveBeenCalledWith(
      userPK('u-1'),
      expect.any(String),
      expect.objectContaining({ plan: 'scout' })
    );
  });
});

describe('Paddle webhook — unknown event', () => {
  it('returns 200 and performs no writes for an unhandled event type', async () => {
    const { statusCode, json } = await invoke({ eventType: 'transaction.completed', data: {} });
    expect(statusCode).toBe(200);
    expect((json.data as { received: boolean }).received).toBe(true);
    expect(mockPutIfNotExists).not.toHaveBeenCalled();
    expect(mockUpdateItem).not.toHaveBeenCalled();
    expect(mockPutItem).not.toHaveBeenCalled();
  });
});
