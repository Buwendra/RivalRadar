import { z } from 'zod';
import { apiHandler, getUserEmail, parseBody } from '../../../shared/middleware/handler';
import { validate } from '../../../shared/middleware/validation';
import { suggestCompetitors } from '../../../shared/services/anthropic';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';

const suggestSchema = z.object({
  companyName: z.string().min(1).max(100),
  companyUrl: z.string().url(),
  industry: z.string().min(1).max(100),
});

/**
 * POST /onboarding/suggest-competitors
 *
 * Phase 5 onboarding accelerator. Returns 0–8 AI-suggested competitors so
 * the Discover step can pre-fill the Competitors step. Authenticated because
 * the suggested-competitors call is attributed for cost tracking via the
 * `userId` plumbed into callAnthropic. Empty array is a valid response.
 */
export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(suggestSchema, parseBody(event));

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const suggestions = await suggestCompetitors({
    userId,
    companyName: body.companyName,
    companyUrl: body.companyUrl,
    industry: body.industry,
  });

  return {
    statusCode: 200,
    body: { data: { suggestions } },
  };
});
