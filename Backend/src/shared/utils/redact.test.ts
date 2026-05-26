import { describe, expect, it } from 'vitest';
import { redactObject, redactSecret } from './redact';

describe('redactSecret', () => {
  it('redacts JWT-shaped strings', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    expect(redactSecret(jwt)).toBe('[REDACTED]');
  });

  it('redacts Anthropic sk-ant keys', () => {
    expect(redactSecret('sk-ant-api03-abcdef1234567890abcdef1234567890')).toBe('[REDACTED]');
  });

  it('redacts Paddle live and sandbox keys', () => {
    expect(redactSecret('pdl_live_abcdef1234567890abcdef1234567890')).toBe('[REDACTED]');
    expect(redactSecret('pdl_sdbx_abcdef1234567890abcdef1234567890')).toBe('[REDACTED]');
  });

  it('redacts Bearer tokens but keeps the scheme', () => {
    expect(redactSecret('Bearer eyJhbGciOi.JzdWIiOi.SflKxwRJSMe')).toBe('Bearer [REDACTED]');
  });

  it('redacts key=value secrets while keeping the parameter name', () => {
    expect(redactSecret('key=abcdef1234567890abcdef1234567890abcdef12')).toBe('key=[REDACTED]');
    expect(redactSecret('secret=abcdef1234567890abcdef1234567890abcdef12')).toBe('secret=[REDACTED]');
  });

  it('leaves non-sensitive strings alone', () => {
    expect(redactSecret('hello world')).toBe('hello world');
    expect(redactSecret('https://stripe.com')).toBe('https://stripe.com');
  });
});

describe('redactObject', () => {
  it('redacts values whose key matches the sensitive-key list', () => {
    const out = redactObject({
      Authorization: 'Bearer abc',
      authorization: 'Bearer def',
      password: 'p',
      x_api_key: 'foo',
      'x-api-key': 'bar',
      apiKey: 'baz',
      cookie: 'session=123',
      safe: 'ok',
    });
    expect(out).toEqual({
      Authorization: '[REDACTED]',
      authorization: '[REDACTED]',
      password: '[REDACTED]',
      x_api_key: '[REDACTED]',
      'x-api-key': '[REDACTED]',
      apiKey: '[REDACTED]',
      cookie: '[REDACTED]',
      safe: 'ok',
    });
  });

  it('recurses into nested objects and arrays', () => {
    const out = redactObject({
      headers: { Authorization: 'Bearer abc' },
      items: [{ token: 't' }, { safe: 'ok' }],
    });
    expect(out).toEqual({
      headers: { Authorization: '[REDACTED]' },
      items: [{ token: '[REDACTED]' }, { safe: 'ok' }],
    });
  });

  it('redacts inline secrets that slip into harmless-looking string values', () => {
    const out = redactObject({ message: 'failed call sk-ant-api03-abcdef1234567890abcdef1234567890' });
    expect(out).toEqual({ message: 'failed call [REDACTED]' });
  });

  it('handles null/undefined/non-object scalars without throwing', () => {
    expect(redactObject(null)).toBeNull();
    expect(redactObject(undefined)).toBeUndefined();
    expect(redactObject(42)).toBe(42);
    expect(redactObject(true)).toBe(true);
  });

  it('survives circular references', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    expect(() => redactObject(a)).not.toThrow();
  });
});
