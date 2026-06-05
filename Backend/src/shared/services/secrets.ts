import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});

// Cache secrets in Lambda memory to avoid repeated API calls
const cache: Record<string, { value: AppSecrets; expiresAt: number }> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface AppSecrets {
  PADDLE_SECRET_KEY: string;
  PADDLE_WEBHOOK_SECRET: string;
  ANTHROPIC_API_KEY: string;
  /**
   * Phase 2 (demo-wow) — ElevenLabs Flash voice for the weekly audio
   * briefing. OPTIONAL: if missing, audio generation is skipped silently
   * and the weekly digest still ships as text-only. See
   * `shared/services/elevenlabs.ts` for the call site.
   */
  ELEVENLABS_API_KEY?: string;
}

export async function getSecret(secretName: string): Promise<AppSecrets> {
  const now = Date.now();
  const cached = cache[secretName];
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  let secretString: string;
  try {
    const result = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    if (!result.SecretString) {
      throw new Error(`Secret "${secretName}" exists but has no string value`);
    }
    secretString = result.SecretString;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to retrieve secret "${secretName}": ${message}`);
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(secretString) as Record<string, string>;
  } catch {
    throw new Error(`Secret "${secretName}" is not valid JSON`);
  }

  const required: (keyof AppSecrets)[] = [
    'PADDLE_SECRET_KEY',
    'PADDLE_WEBHOOK_SECRET',
    'ANTHROPIC_API_KEY',
  ];
  const missing = required.filter((k) => !parsed[k]);
  if (missing.length > 0) {
    throw new Error(`Secret "${secretName}" is missing required keys: ${missing.join(', ')}`);
  }

  const value = parsed as unknown as AppSecrets;
  cache[secretName] = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}
