/**
 * corsHeaders() — multi-origin echo behavior (Phase: kironyx.com cutover).
 * The gateway's corsPreflight answers preflights; these headers cover the
 * actual responses, where `allowCredentials: true` forbids '*' and a static
 * single-origin header would CORS-block every origin but one.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { corsHeaders } from './handler';

const PRIMARY = 'https://kironyx.com';
const WWW = 'https://www.kironyx.com';
const AMPLIFY = 'https://main.d1zrq9gf129s9u.amplifyapp.com';

const savedEnv = { ...process.env };

function eventWithOrigin(origin?: string) {
  return { headers: origin ? { origin } : {} };
}

beforeEach(() => {
  process.env.ALLOWED_ORIGINS = `${PRIMARY},${WWW},${AMPLIFY}`;
  process.env.FRONTEND_URL = PRIMARY;
});

afterEach(() => {
  process.env.ALLOWED_ORIGINS = savedEnv.ALLOWED_ORIGINS;
  process.env.FRONTEND_URL = savedEnv.FRONTEND_URL;
});

describe('corsHeaders', () => {
  it('echoes an allow-listed origin back', () => {
    expect(corsHeaders(eventWithOrigin(WWW))['Access-Control-Allow-Origin']).toBe(WWW);
    expect(corsHeaders(eventWithOrigin(AMPLIFY))['Access-Control-Allow-Origin']).toBe(AMPLIFY);
  });

  it('falls back to the primary origin for unknown origins', () => {
    expect(corsHeaders(eventWithOrigin('https://evil.example'))['Access-Control-Allow-Origin']).toBe(
      PRIMARY
    );
  });

  it('falls back to the primary origin when no Origin header is sent', () => {
    expect(corsHeaders(eventWithOrigin())['Access-Control-Allow-Origin']).toBe(PRIMARY);
  });

  it('never emits a wildcard (allowCredentials forbids it)', () => {
    for (const origin of [undefined, 'https://evil.example', WWW]) {
      expect(corsHeaders(eventWithOrigin(origin))['Access-Control-Allow-Origin']).not.toBe('*');
    }
  });

  it('handles whitespace in the ALLOWED_ORIGINS list', () => {
    process.env.ALLOWED_ORIGINS = ` ${PRIMARY} , ${WWW} `;
    expect(corsHeaders(eventWithOrigin(WWW))['Access-Control-Allow-Origin']).toBe(WWW);
  });

  it('falls back to FRONTEND_URL when ALLOWED_ORIGINS is unset', () => {
    delete process.env.ALLOWED_ORIGINS;
    expect(corsHeaders(eventWithOrigin(WWW))['Access-Control-Allow-Origin']).toBe(PRIMARY);
    expect(corsHeaders(eventWithOrigin(PRIMARY))['Access-Control-Allow-Origin']).toBe(PRIMARY);
  });

  it('falls back to FRONTEND_URL when ALLOWED_ORIGINS is set but EMPTY', () => {
    // A blank `ALLOWED_ORIGINS=` line in .env exports an empty string, which
    // `??` treats as set — the fallback must engage on empty-after-parse or
    // the whole API deploys with a dead CORS allow-list.
    process.env.ALLOWED_ORIGINS = '';
    expect(corsHeaders(eventWithOrigin(PRIMARY))['Access-Control-Allow-Origin']).toBe(PRIMARY);
    process.env.ALLOWED_ORIGINS = ' , ,';
    expect(corsHeaders(eventWithOrigin(PRIMARY))['Access-Control-Allow-Origin']).toBe(PRIMARY);
  });

  it('varies on Origin and keeps credentials + header allow-list', () => {
    const headers = corsHeaders(eventWithOrigin(WWW));
    expect(headers.Vary).toBe('Origin');
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    expect(headers['Access-Control-Allow-Headers']).toContain('X-Workspace-Id');
    expect(headers['Access-Control-Allow-Headers']).toContain('X-Api-Key');
  });
});
