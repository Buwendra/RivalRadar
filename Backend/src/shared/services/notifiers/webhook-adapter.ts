import { createHmac } from 'crypto';
import { logger } from '../../utils/logger';

export interface WebhookEnvelope<T = unknown> {
  event: string;
  timestamp: string; // ISO
  data: T;
}

/**
 * Generic webhook adapter — POSTs an HMAC-signed JSON envelope to a
 * user-supplied URL.
 *
 * Signature scheme (Stripe-style):
 *   - Header: `X-Kironyx-Signature: t=<unix-ts>,v1=<hex sha256>`
 *   - Signed payload: `<unix-ts>.<raw json body>`
 *   - The user verifies on their end with the `hmacSecret` we returned
 *     once at integration creation time.
 *
 * NEVER logs the URL or hmacSecret. Logs only the integration's userId
 * and a redacted suffix of the URL host for forensic correlation.
 */
export async function sendWebhookNotification(input: {
  url: string;
  hmacSecret: string;
  envelope: WebhookEnvelope;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const tsSec = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(input.envelope);
  const signedPayload = `${tsSec}.${body}`;
  const signature = createHmac('sha256', input.hmacSecret)
    .update(signedPayload)
    .digest('hex');

  try {
    const resp = await fetch(input.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kironyx-Signature': `t=${tsSec},v1=${signature}`,
        'User-Agent': 'Kironyx-Webhook/1.0',
      },
      body,
    });
    if (!resp.ok) {
      const respBody = await resp.text().catch(() => '');
      const error = `webhook ${resp.status}: ${respBody.slice(0, 200)}`;
      logger.warn('webhook-adapter: non-2xx response', {
        status: resp.status,
        bodySnippet: respBody.slice(0, 200),
      });
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn('webhook-adapter: fetch failed', { error });
    return { ok: false, error };
  }
}
