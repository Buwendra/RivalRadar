/**
 * Log redaction helpers. Defence-in-depth against accidental credential
 * leakage when a handler does `logger.info('x', { headers: event.headers })`
 * or spreads a request body that happens to carry a token.
 *
 * Not a substitute for handler discipline — secrets should never be near a
 * logger call in the first place. But the cost of catching the slip-up here
 * is low and the cost of leaking a token in CloudWatch is high.
 */

const SENSITIVE_KEY = /password|token|secret|authorization|cookie|api[_-]?key|x-api-key|webhook[_-]?secret|client[_-]?secret/i;

const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /pdl_(?:live|sdbx)_[A-Za-z0-9]{20,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi,
  /(?:key|secret|token)=([A-Za-z0-9+/=_-]{40,})/gi,
];

const REDACTED = '[REDACTED]';

export function redactSecret(value: string): string {
  let out = value;
  for (const pat of SECRET_PATTERNS) {
    out = out.replace(pat, (match) => {
      if (match.toLowerCase().startsWith('bearer ')) return `Bearer ${REDACTED}`;
      const eqIdx = match.indexOf('=');
      if (eqIdx > 0) return `${match.slice(0, eqIdx + 1)}${REDACTED}`;
      return REDACTED;
    });
  }
  return out;
}

export function redactObject<T>(input: T, seen: WeakSet<object> = new WeakSet()): T {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') return redactSecret(input) as unknown as T;
  if (typeof input !== 'object') return input;
  if (seen.has(input as object)) return input;
  seen.add(input as object);

  if (Array.isArray(input)) {
    return input.map((v) => redactObject(v, seen)) as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = REDACTED;
    } else {
      out[key] = redactObject(value, seen);
    }
  }
  return out as unknown as T;
}
