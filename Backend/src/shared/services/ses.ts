import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { logger } from '../utils/logger';

const ses = new SESv2Client({});

const FROM_EMAIL = process.env.FROM_EMAIL ?? 'noreply@rivalscan.com';

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: FROM_EMAIL,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject },
          Body: { Html: { Data: htmlBody } },
        },
      },
    })
  );

  logger.info('Email sent', { to, subject });
}
