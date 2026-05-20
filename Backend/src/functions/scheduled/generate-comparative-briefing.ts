/**
 * Phase 24 — Comparative Briefing pipeline step 2.
 *
 * Calls `generateComparativeBriefing()` and threads the prose + suggested
 * angles into the downstream render step. Failures soft-degrade: an empty
 * briefing string still produces a renderable email body.
 */

import { generateComparativeBriefing } from '../../shared/services/anthropic';
import { logger } from '../../shared/utils/logger';
import type { ComparativeBriefingPayload } from './aggregate-brand-coverage';

interface Output extends ComparativeBriefingPayload {
  briefingText: string;
  suggestedAngles: string[];
}

export const handler = async (event: ComparativeBriefingPayload): Promise<Output> => {
  // No coverage at all? Skip the AI call — the render step has a static
  // fallback message that's cheaper and cleaner than an empty Sonnet output.
  if (event.brand.mentions7d === 0 && event.competitors.length === 0) {
    return {
      ...event,
      briefingText:
        'No significant brand or competitor coverage was detected this week. Your media landscape was quiet.',
      suggestedAngles: [],
    };
  }

  try {
    const result = await generateComparativeBriefing({
      userId: event.userId,
      userCompanyName: event.userCompanyName,
      userIndustry: event.userIndustry,
      brand: event.brand,
      competitors: event.competitors,
      sovByCategory: event.sovByCategory,
    });
    logger.info('GenerateComparativeBriefing completed', {
      userId: event.userId,
      anglesCount: result.suggestedAngles.length,
      briefingLength: result.briefingText.length,
    });
    return { ...event, ...result };
  } catch (err) {
    logger.warn('GenerateComparativeBriefing failed — continuing with empty prose', {
      userId: event.userId,
      error: String(err),
    });
    return {
      ...event,
      briefingText:
        'The comparative briefing for this week could not be generated. Your dashboard still reflects the latest coverage.',
      suggestedAngles: [],
    };
  }
};
