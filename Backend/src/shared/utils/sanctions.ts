/**
 * Hardcoded subset of sanctioned/denylisted entities for misuse defense.
 *
 * Source: U.S. OFAC SDN list (https://sanctionssearch.ofac.treas.gov),
 * EU Consolidated Sanctions list, and known high-risk patterns. This list
 * intentionally errs on the side of caution — false positives are recoverable
 * (user contacts support); false negatives are not (we research a sanctioned
 * party).
 *
 * For production scale this should be replaced with a daily cron that pulls
 * the OFAC SDN.XML feed and rebuilds an in-memory map. For MVP, hardcoded.
 */

// Domains tied to entities currently listed under OFAC SDN, EU sanctions, or
// UK HMT sanctions. Stored lowercased; check is on URL hostname.
const SANCTIONED_DOMAINS: ReadonlySet<string> = new Set([
  // Russian state-affiliated / SDN-listed
  'gazprom.ru',
  'rosneft.com',
  'rosneft.ru',
  'sberbank.ru',
  'vtb.ru',
  'lukoil.com',
  'lukoil.ru',
  'rt.com',
  'sputniknews.com',

  // Iranian state-affiliated
  'irna.ir',
  'irgc.ir',
  'irna.com',

  // North Korean state media / state-affiliated
  'kcna.kp',
  'rodong.rep.kp',

  // Cuban state-controlled
  'cubadebate.cu',

  // Belarusian state-affiliated (post-2022)
  'belaz.by',

  // Add more as OFAC list updates
]);

// Keyword fragments that strongly indicate non-business research targets.
// Checked against the competitor `name` field (case-insensitive).
const PERSONAL_NAME_INDICATORS: ReadonlyArray<RegExp> = [
  /\b(ceo|cto|cfo|coo|vp|svp|evp|founder|director|manager)\s+of\b/i,
  /\b(mr|mrs|ms|dr|prof)\.?\s+[a-z]+/i,
  /^[a-z]+\s+[a-z]+$/i, // bare "first last" pattern with no company context
];

export interface SanctionsCheckResult {
  isBlocked: boolean;
  reason?: string;
  category?: 'sanctioned-domain' | 'personal-name-pattern';
}

function safeHostname(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Synchronous denylist check. Run BEFORE the (more expensive) Haiku classifier
 * — denylist is the cheap, deterministic gate; classifier handles the fuzzy
 * cases the deny list cannot enumerate.
 */
export function checkSanctions(input: { name: string; url: string }): SanctionsCheckResult {
  // Domain check
  const hostname = safeHostname(input.url);
  if (hostname) {
    if (SANCTIONED_DOMAINS.has(hostname)) {
      return {
        isBlocked: true,
        reason: `The domain ${hostname} is on the sanctions denylist and cannot be researched.`,
        category: 'sanctioned-domain',
      };
    }
    // Match any subdomain of a sanctioned root, e.g. blog.gazprom.ru
    for (const sanctioned of SANCTIONED_DOMAINS) {
      if (hostname.endsWith(`.${sanctioned}`)) {
        return {
          isBlocked: true,
          reason: `The domain ${hostname} is on the sanctions denylist and cannot be researched.`,
          category: 'sanctioned-domain',
        };
      }
    }
  }

  // Personal-name heuristic on the name field (cheap pre-filter; the Haiku
  // classifier handles edge cases).
  const trimmed = input.name.trim();
  if (trimmed.length > 0) {
    for (const pattern of PERSONAL_NAME_INDICATORS) {
      if (pattern.test(trimmed)) {
        return {
          isBlocked: true,
          reason:
            'This appears to describe an individual person rather than a business entity. RivalScan researches companies, not people. If this is a company, please use the official company name (e.g., "Acme Corp" not "John Smith of Acme").',
          category: 'personal-name-pattern',
        };
      }
    }
  }

  return { isBlocked: false };
}
