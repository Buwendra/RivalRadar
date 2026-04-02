import { getSecret } from './secrets';
import { AiAnalysis } from '../types';
import { logger } from '../utils/logger';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-5-20241022';

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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': secrets.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': secrets.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: SONNET_MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    logger.error('Anthropic API error for weekly summary', { status: response.status });
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  return data.content[0].text;
}
