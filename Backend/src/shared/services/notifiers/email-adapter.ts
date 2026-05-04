import { sendEmail } from '../ses';
import { logger } from '../../utils/logger';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

/**
 * Email adapter — wraps the existing SES service. Best-effort: never throws,
 * returns a structured outcome the notifier facade can log.
 */
export async function sendEmailNotification(
  payload: EmailPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await sendEmail(payload.to, payload.subject, payload.html);
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn('email-adapter: send failed', { error });
    return { ok: false, error };
  }
}
