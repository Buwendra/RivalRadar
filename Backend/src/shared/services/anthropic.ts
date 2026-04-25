import { getSecret } from './secrets';
import {
  AiAnalysis,
  ResearchFinding,
  FindingItem,
  Citation,
  ResearchDelta,
  ResearchCategory,
  ResearchChangeType,
  FindingSentiment,
  FindingTimeSensitivity,
  DerivedState,
  DerivedStage,
  DerivedFundingState,
  DerivedHiringState,
  DerivedStrategicDirection,
  DerivedTechPositioning,
  DerivedPacing,
  Momentum,
  ThreatLevel,
} from '../types';
import { logger } from '../utils/logger';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-5';
const WEB_SEARCH_MAX_USES = 8;

/**
 * Parse a `{ "deltas": [ {...}, {...}, ... ] }` JSON blob, tolerating
 * truncation: if the full JSON doesn't parse, extract as many complete
 * top-level `{ ... }` objects from the array as possible and parse the
 * rest as valid partial output.
 */
function parseDeltasJson(text: string): { deltas: Array<Record<string, unknown>> } {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('no JSON object in response');

  // Happy path: complete JSON parses cleanly
  try {
    return JSON.parse(jsonMatch[0]) as { deltas: Array<Record<string, unknown>> };
  } catch {
    // Fall through to partial recovery
  }

  // Partial recovery: walk the "deltas" array and collect complete objects
  const arrayStart = text.indexOf('"deltas"');
  if (arrayStart < 0) throw new Error('no "deltas" array found');
  const bracketStart = text.indexOf('[', arrayStart);
  if (bracketStart < 0) throw new Error('no "deltas" array bracket found');

  const recovered: Array<Record<string, unknown>> = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escape = false;

  for (let i = bracketStart + 1; i < text.length; i++) {
    const c = text[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (c === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const chunk = text.slice(objStart, i + 1);
        try {
          recovered.push(JSON.parse(chunk) as Record<string, unknown>);
        } catch {
          // Skip malformed object silently — continue scanning
        }
        objStart = -1;
      }
    } else if (c === ']' && depth === 0) {
      // End of array
      break;
    }
  }

  if (recovered.length === 0) {
    throw new Error('partial recovery found no complete delta objects');
  }
  return { deltas: recovered };
}

/**
 * Call the Anthropic messages API, retrying on 429 rate-limit responses.
 * Honors the `retry-after` response header (seconds) when present.
 */
async function callAnthropic(
  apiKey: string,
  body: unknown,
  opName: string,
  maxRetries = 2
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (response.status !== 429 || attempt === maxRetries) return response;

    const retryAfter = Number(response.headers.get('retry-after') ?? '');
    const waitSec = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 65;
    logger.warn(`${opName}: 429 rate-limited, waiting ${waitSec}s before retry ${attempt + 1}/${maxRetries}`);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
  }
  // Unreachable; TypeScript needs a return
  throw new Error('callAnthropic: exhausted retries');
}

/**
 * Analyze a detected change using Claude Haiku.
 * Returns structured JSON with change type, significance, and recommendations.
 */
export async function analyzeChange(
  competitorName: string,
  pageUrl: string,
  _oldContent: string,
  _newContent: string,
  diffPatch: string
): Promise<AiAnalysis> {
  const secrets = await getSecret('rivalscan/api-keys');

  const prompt = `You are a competitive intelligence analyst. Analyze the following change detected on a competitor's website.

Competitor: ${competitorName}
Page: ${pageUrl}

DIFF (lines starting with - are removed, + are added):
${diffPatch.slice(0, 3000)}

Respond with ONLY valid JSON in this exact format:
{
  "changeType": "pricing" | "feature" | "messaging" | "hiring" | "content",
  "summary": "2-sentence human-readable summary of what changed",
  "significanceScore": 1-10,
  "strategicImplication": "What this change means strategically for competitors",
  "recommendedAction": "What the user should consider doing in response"
}

Scoring guide:
- 1-3: Minor content updates, typo fixes, cosmetic changes
- 4-6: Notable but not urgent changes (new blog post, small feature update)
- 7-10: Strategic changes requiring attention (pricing change, major feature launch, key hire)`;

  const response = await callAnthropic(
    secrets.ANTHROPIC_API_KEY,
    {
      model: HAIKU_MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    },
    'analyzeChange'
  );

  if (!response.ok) {
    logger.error('Anthropic API error', { status: response.status });
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  const text = data.content[0].text;
  const json = JSON.parse(text) as {
    changeType: string;
    summary: string;
    significanceScore: number;
    strategicImplication: string;
    recommendedAction: string;
  };

  return {
    changeType: json.changeType as AiAnalysis['changeType'],
    summary: json.summary,
    significanceScore: Math.min(10, Math.max(1, json.significanceScore)),
    strategicImplication: json.strategicImplication,
    recommendedAction: json.recommendedAction,
  };
}

/**
 * Generate a weekly strategic summary using Claude Sonnet.
 */
export async function generateWeeklySummary(
  changes: Array<{
    competitorName: string;
    summary: string;
    significanceScore: number;
    changeType: string;
  }>
): Promise<string> {
  const secrets = await getSecret('rivalscan/api-keys');

  const changeList = changes
    .map((c, i) => `${i + 1}. [${c.changeType.toUpperCase()}] ${c.competitorName}: ${c.summary} (Significance: ${c.significanceScore}/10)`)
    .join('\n');

  const prompt = `You are a senior competitive intelligence strategist. Based on the following competitor changes detected this week, write a concise strategic briefing.

CHANGES THIS WEEK:
${changeList}

Write a 3-4 paragraph strategic briefing that:
1. Identifies the most important trend or pattern across these changes
2. Highlights immediate threats or opportunities
3. Provides 2-3 specific recommended actions
4. Notes any notable trends to watch

Keep it actionable and concise. Write for a busy founder or marketing leader.`;

  const response = await callAnthropic(
    secrets.ANTHROPIC_API_KEY,
    {
      model: SONNET_MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    },
    'generateWeeklySummary'
  );

  if (!response.ok) {
    logger.error('Anthropic API error for weekly summary', { status: response.status });
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  return data.content[0].text;
}

/**
 * Deep research on a competitor using Claude Sonnet + the web_search server tool.
 * Claude runs up to 8 web searches and synthesizes findings into structured JSON.
 */
export async function deepResearch(input: {
  competitorId: string;
  userId: string;
  name: string;
  url: string;
  industry?: string;
}): Promise<Omit<ResearchFinding, 'id' | 'generatedAt'>> {
  const secrets = await getSecret('rivalscan/api-keys');

  const prompt = `You are a competitive intelligence analyst. Research the competitor below across the public web.

Competitor: ${input.name}
Website: ${input.url}${input.industry ? `\nIndustry: ${input.industry}` : ''}

Search the web for recent, substantive findings about this company. Cover these categories:
- news: press releases, announcements, press coverage
- product: product launches, feature releases, roadmap hints
- funding: investment rounds, valuation news, financial performance
- hiring: notable hires, leadership changes, layoffs, headcount signals
- social: LinkedIn posts from leaders, prominent Twitter/X activity, community buzz

Prioritize the last 30 days. Use up to ${WEB_SEARCH_MAX_USES} targeted searches.

After your searches, respond with ONLY valid JSON in this exact shape — no prose, no code fences:
{
  "summary": "3-4 sentence executive summary of what you learned",
  "categories": {
    "news": [{
      "title": "...",
      "detail": "1-2 sentences",
      "sourceUrl": "https://...",
      "importance": 1|2|3,
      "sentiment": "positive" | "neutral" | "negative",
      "timeSensitivity": "breaking" | "recent" | "historical"
    }],
    "product": [...],
    "funding": [...],
    "hiring": [...],
    "social": [...]
  },
  "searchQueries": ["the queries you actually ran"],
  "derivedState": {
    "stage": "early" | "growth" | "late" | "public" | "declining" | "unknown",
    "fundingState": "bootstrapped" | "recently-raised" | "actively-raising" | "runway-concerns" | "public" | "unknown",
    "hiringState": "aggressive" | "steady" | "slowing" | "frozen" | "layoffs" | "unknown",
    "strategicDirection": "going-upmarket" | "going-downmarket" | "expanding-geo" | "expanding-vertical" | "specializing" | "diversifying" | "steady" | "unknown",
    "techPositioning": "ai-native" | "ai-adjacent" | "legacy" | "open-source" | "mixed" | "unknown",
    "pacing": "shipping-fast" | "steady" | "slow" | "frozen",
    "evidenceNotes": "2-3 sentence justification citing which findings informed these labels"
  }
}

Field guidance:
- importance: 3 = must-know strategic, 2 = notable, 1 = minor.
- sentiment: from the COMPETITOR's POV (positive = good for them, negative = bad for them).
- timeSensitivity: breaking = published within last 7 days, recent = last 30 days, historical = older.
- derivedState: use "unknown" liberally when evidence is thin. Do NOT guess. Every label must be supported by a finding.
- Omit a category entirely (empty array) if nothing relevant found. Every finding MUST include a sourceUrl from your searches.`;

  const response = await callAnthropic(
    secrets.ANTHROPIC_API_KEY,
    {
      model: SONNET_MODEL,
      max_tokens: 4096,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: WEB_SEARCH_MAX_USES,
        },
      ],
      messages: [{ role: 'user', content: prompt }],
    },
    'deepResearch'
  );

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    logger.error('Anthropic deepResearch API error', { status: response.status, body: errBody.slice(0, 500) });
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<
      | { type: 'text'; text: string }
      | { type: 'server_tool_use'; name: string; input: { query?: string } }
      | { type: 'web_search_tool_result'; content: Array<{ url: string; title: string }> }
    >;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  // Collect citations from web_search_tool_result blocks
  const now = new Date().toISOString();
  const citationMap = new Map<string, Citation>();
  for (const block of data.content) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) {
        if (r?.url && !citationMap.has(r.url)) {
          citationMap.set(r.url, { url: r.url, title: r.title ?? r.url, accessedAt: now });
        }
      }
    }
  }
  const citations = Array.from(citationMap.values());

  // Extract the final text block containing structured JSON
  const textBlocks = data.content.filter((b): b is { type: 'text'; text: string } => b.type === 'text');
  const finalText = textBlocks.map((b) => b.text).join('\n').trim();

  // Tolerate minor wrappers: strip ```json fences if present
  const jsonMatch = finalText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.error('deepResearch: no JSON found in response', { finalText: finalText.slice(0, 500) });
    throw new Error('deepResearch: no JSON in Claude response');
  }

  let parsed: {
    summary: string;
    categories?: Partial<Record<string, FindingItem[]>>;
    searchQueries?: string[];
    derivedState?: Partial<DerivedState>;
  };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    logger.error('deepResearch: JSON parse failed', { error: String(err), text: jsonMatch[0].slice(0, 500) });
    throw new Error('deepResearch: Claude returned invalid JSON');
  }

  const validSentiments: FindingSentiment[] = ['positive', 'neutral', 'negative'];
  const validTimeSensitivities: FindingTimeSensitivity[] = ['breaking', 'recent', 'historical'];

  const sanitizeCategory = (items?: FindingItem[]): FindingItem[] =>
    (items ?? []).map((item) => {
      const sentiment = validSentiments.includes(item.sentiment as FindingSentiment)
        ? (item.sentiment as FindingSentiment)
        : undefined;
      const timeSensitivity = validTimeSensitivities.includes(item.timeSensitivity as FindingTimeSensitivity)
        ? (item.timeSensitivity as FindingTimeSensitivity)
        : undefined;
      return {
        title: String(item.title ?? ''),
        detail: String(item.detail ?? ''),
        sourceUrl: item.sourceUrl ? String(item.sourceUrl) : undefined,
        importance: ([1, 2, 3].includes(item.importance) ? item.importance : 1) as 1 | 2 | 3,
        ...(sentiment ? { sentiment } : {}),
        ...(timeSensitivity ? { timeSensitivity } : {}),
      };
    });

  const sanitizeDerivedState = (raw?: Partial<DerivedState>): DerivedState | undefined => {
    if (!raw || typeof raw !== 'object') return undefined;
    const stages: DerivedStage[] = ['early', 'growth', 'late', 'public', 'declining', 'unknown'];
    const fundings: DerivedFundingState[] = ['bootstrapped', 'recently-raised', 'actively-raising', 'runway-concerns', 'public', 'unknown'];
    const hirings: DerivedHiringState[] = ['aggressive', 'steady', 'slowing', 'frozen', 'layoffs', 'unknown'];
    const strategies: DerivedStrategicDirection[] = ['going-upmarket', 'going-downmarket', 'expanding-geo', 'expanding-vertical', 'specializing', 'diversifying', 'steady', 'unknown'];
    const techs: DerivedTechPositioning[] = ['ai-native', 'ai-adjacent', 'legacy', 'open-source', 'mixed', 'unknown'];
    const paces: DerivedPacing[] = ['shipping-fast', 'steady', 'slow', 'frozen'];
    const pickEnum = <T extends string>(value: unknown, valid: T[], fallback: T): T =>
      valid.includes(value as T) ? (value as T) : fallback;
    return {
      stage: pickEnum(raw.stage, stages, 'unknown'),
      fundingState: pickEnum(raw.fundingState, fundings, 'unknown'),
      hiringState: pickEnum(raw.hiringState, hirings, 'unknown'),
      strategicDirection: pickEnum(raw.strategicDirection, strategies, 'unknown'),
      techPositioning: pickEnum(raw.techPositioning, techs, 'unknown'),
      pacing: pickEnum(raw.pacing, paces, 'steady'),
      evidenceNotes: String(raw.evidenceNotes ?? '').slice(0, 600),
    };
  };

  const tokensUsed =
    (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
  const derivedState = sanitizeDerivedState(parsed.derivedState);

  return {
    competitorId: input.competitorId,
    userId: input.userId,
    summary: String(parsed.summary ?? ''),
    categories: {
      news: sanitizeCategory(parsed.categories?.news),
      product: sanitizeCategory(parsed.categories?.product),
      funding: sanitizeCategory(parsed.categories?.funding),
      hiring: sanitizeCategory(parsed.categories?.hiring),
      social: sanitizeCategory(parsed.categories?.social),
    },
    citations,
    searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries.map(String) : [],
    ...(derivedState ? { derivedState } : {}),
    tokensUsed,
  };
}

/**
 * Compare two research findings and extract deltas with impact analysis.
 * One Sonnet call produces both "what's new" and "how significant" for each delta.
 */
export async function detectResearchDeltas(input: {
  competitorName: string;
  previous: Pick<ResearchFinding, 'summary' | 'categories' | 'generatedAt'>;
  current: Pick<ResearchFinding, 'summary' | 'categories'>;
}): Promise<ResearchDelta[]> {
  const secrets = await getSecret('rivalscan/api-keys');

  const compactFinding = (f: { categories: Record<ResearchCategory, FindingItem[]> }) =>
    Object.fromEntries(
      (Object.keys(f.categories) as ResearchCategory[]).map((cat) => [
        cat,
        f.categories[cat].map((item) => ({
          title: item.title,
          detail: item.detail.slice(0, 150),
          sourceUrl: item.sourceUrl ?? '',
        })),
      ])
    );

  const prompt = `You are a competitive intelligence analyst. Compare two research snapshots of the same competitor and identify what is genuinely NEW in the CURRENT snapshot compared to the PREVIOUS one.

Competitor: ${input.competitorName}
Previous snapshot generated: ${input.previous.generatedAt}

PREVIOUS FINDINGS (JSON):
${JSON.stringify(compactFinding(input.previous), null, 2)}

CURRENT FINDINGS (JSON):
${JSON.stringify(compactFinding(input.current), null, 2)}

Treat a current item as NEW if the core fact/event it describes is not substantively present in previous (regardless of minor wording differences). Ignore items that are just rephrasings of previously known facts.

For each new item, analyze its impact. Respond with ONLY valid JSON (no prose, no code fences):

{
  "deltas": [
    {
      "title": "short headline from the current item",
      "detail": "2-sentence explanation of what's new",
      "sourceUrl": "the sourceUrl from the current item (required)",
      "category": "news" | "product" | "funding" | "hiring" | "social",
      "changeType": "pricing" | "feature" | "messaging" | "hiring" | "content",
      "significanceScore": 1-10,
      "strategicImplication": "what this change means strategically for competitors",
      "recommendedAction": "what the user should consider doing in response"
    }
  ]
}

Scoring guide:
- 1-3: Minor content (routine blog post, small social post)
- 4-6: Notable (product update, mid-size hire, positive press)
- 7-10: Strategic (pricing change, major launch, funding round, key exec move, acquisition)

If nothing substantively new: return { "deltas": [] }.`;

  const response = await callAnthropic(
    secrets.ANTHROPIC_API_KEY,
    {
      model: SONNET_MODEL,
      max_tokens: 16384,
      messages: [{ role: 'user', content: prompt }],
    },
    'detectResearchDeltas'
  );

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    logger.error('Anthropic detectResearchDeltas API error', {
      status: response.status,
      body: errBody.slice(0, 500),
    });
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = (data.content.find((b) => b.type === 'text')?.text ?? '').trim();
  const wasTruncated = data.stop_reason === 'max_tokens';
  if (wasTruncated) {
    logger.warn('detectResearchDeltas: response hit max_tokens limit; will try partial recovery', {
      outputTokens: data.usage?.output_tokens,
      textLength: text.length,
    });
  }

  let parsed: { deltas?: Array<Record<string, unknown>> };
  try {
    parsed = parseDeltasJson(text);
  } catch (err) {
    logger.error('detectResearchDeltas: JSON parse failed even after partial recovery', {
      error: String(err),
      stopReason: data.stop_reason,
      textLength: text.length,
      textTail: text.slice(-200),
    });
    throw new Error(
      `detectResearchDeltas: could not parse Claude response (stop_reason=${data.stop_reason ?? 'unknown'}, length=${text.length})`
    );
  }

  const validCategories: ResearchCategory[] = ['news', 'product', 'funding', 'hiring', 'social'];
  const validChangeTypes: ResearchChangeType[] = [
    'pricing',
    'feature',
    'messaging',
    'hiring',
    'content',
  ];

  const rawDeltas = Array.isArray(parsed.deltas) ? parsed.deltas : [];
  const deltas: ResearchDelta[] = [];
  for (const d of rawDeltas) {
    const category = validCategories.includes(d.category as ResearchCategory)
      ? (d.category as ResearchCategory)
      : 'news';
    const changeType = validChangeTypes.includes(d.changeType as ResearchChangeType)
      ? (d.changeType as ResearchChangeType)
      : 'content';
    const rawScore = Number(d.significanceScore ?? 1);
    const significanceScore = Math.min(10, Math.max(1, Number.isFinite(rawScore) ? rawScore : 1));
    const sourceUrl = String(d.sourceUrl ?? '').trim();
    if (!sourceUrl) continue;

    deltas.push({
      title: String(d.title ?? '').slice(0, 200),
      detail: String(d.detail ?? '').slice(0, 800),
      sourceUrl,
      category,
      changeType,
      significanceScore,
      strategicImplication: String(d.strategicImplication ?? '').slice(0, 800),
      recommendedAction: String(d.recommendedAction ?? '').slice(0, 500),
    });
  }

  return deltas;
}

/**
 * Score the competitive threat a competitor poses to the user, given the user's
 * own company context, the competitor's latest research finding, recent changes,
 * and momentum trend.
 *
 * Uses Haiku — single short call (~$0.002) producing structured threat level + reasoning.
 */
export async function scoreCompetitorThreat(input: {
  competitorName: string;
  userCompanyName?: string;
  userIndustry?: string;
  latestFinding: Pick<ResearchFinding, 'summary' | 'categories' | 'derivedState'>;
  recentChanges: Array<{ summary: string; significance: number; detectedAt: string }>;
  momentum: Momentum;
}): Promise<{ threatLevel: ThreatLevel; reasoning: string }> {
  const secrets = await getSecret('rivalscan/api-keys');

  // Compact the categories — only need top items by importance to score threat
  const compactCategories = (Object.keys(input.latestFinding.categories) as ResearchCategory[])
    .map((cat) => {
      const top = input.latestFinding.categories[cat]
        .filter((item) => item.importance >= 2)
        .slice(0, 3)
        .map((item) => `${cat}: ${item.title}`);
      return top;
    })
    .flat();

  const compactChanges = input.recentChanges
    .filter((c) => c.significance >= 5)
    .slice(0, 8)
    .map((c) => `[${c.significance}/10] ${c.summary}`);

  const userContext =
    input.userCompanyName || input.userIndustry
      ? `User's company: ${input.userCompanyName ?? 'unknown'} (industry: ${input.userIndustry ?? 'unknown'}).`
      : `User context: not provided. Score the competitor's threat in absolute terms based on its momentum and recent strategic moves.`;

  const prompt = `You are a competitive intelligence analyst. Rate the threat level that competitor "${input.competitorName}" poses, then justify in 1-2 sentences citing specific evidence.

${userContext}

Scoring rubric:
- "critical" — direct competitor in same segment, currently rising momentum, recent major strategic move (pricing change, product launch, large funding round, key acquisition)
- "high" — direct competitor OR major strategic move in last 30 days
- "medium" — adjacent threat with notable activity
- "low" — adjacent / tangential, low activity
- "monitor" — tangential — for awareness only

Latest research summary:
${input.latestFinding.summary}

Derived state: ${
    input.latestFinding.derivedState
      ? JSON.stringify(input.latestFinding.derivedState)
      : '(not available)'
  }

Top findings (importance >= 2):
${compactCategories.length > 0 ? compactCategories.map((s) => `- ${s}`).join('\n') : '(none)'}

Recent significant changes (last 30 days, significance >= 5):
${compactChanges.length > 0 ? compactChanges.map((s) => `- ${s}`).join('\n') : '(none)'}

Momentum: ${input.momentum}

Respond with ONLY valid JSON — no prose, no code fences:
{
  "threatLevel": "critical" | "high" | "medium" | "low" | "monitor",
  "reasoning": "1-2 sentence rationale citing the specific evidence (e.g. 'Rising momentum + recent Series B + pricing changes detected')."
}`;

  const response = await callAnthropic(
    secrets.ANTHROPIC_API_KEY,
    {
      model: HAIKU_MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    },
    'scoreCompetitorThreat'
  );

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    logger.error('Anthropic scoreCompetitorThreat API error', {
      status: response.status,
      body: errBody.slice(0, 500),
    });
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const text = (data.content.find((b) => b.type === 'text')?.text ?? '').trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.error('scoreCompetitorThreat: no JSON in response', { text: text.slice(0, 500) });
    throw new Error('scoreCompetitorThreat: no JSON in Claude response');
  }
  const parsed = JSON.parse(jsonMatch[0]) as {
    threatLevel?: string;
    reasoning?: string;
  };

  const validLevels: ThreatLevel[] = ['critical', 'high', 'medium', 'low', 'monitor'];
  const threatLevel = validLevels.includes(parsed.threatLevel as ThreatLevel)
    ? (parsed.threatLevel as ThreatLevel)
    : 'monitor';
  const reasoning = String(parsed.reasoning ?? '').slice(0, 400);

  return { threatLevel, reasoning };
}
