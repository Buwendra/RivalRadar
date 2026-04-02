import { Environment, Paddle, WebhooksValidator } from '@paddle/paddle-node-sdk';
import { getSecret } from './secrets';

const SECRETS_ARN = process.env.SECRETS_ARN!;

let paddleClient: Paddle | null = null;

export async function getPaddleClient(): Promise<Paddle> {
  if (paddleClient) return paddleClient;
  const secrets = await getSecret(SECRETS_ARN);
  paddleClient = new Paddle(secrets.PADDLE_SECRET_KEY, {
    environment: Environment.production,
  });
  return paddleClient;
}

export async function verifyPaddleWebhook(
  rawBody: string,
  signature: string
): Promise<boolean> {
  const secrets = await getSecret(SECRETS_ARN);
  const validator = new WebhooksValidator();
  return validator.isValidSignature(rawBody, secrets.PADDLE_WEBHOOK_SECRET, signature);
}
