import { apiHandler, getUserEmail, parseBody, HttpError } from '../../../shared/middleware/handler';
import { getItem, queryByPK, queryGSI, updateItem } from '../../../shared/db/queries';
import { audioBriefingPK, audioBriefingSKPrefix, userPK, userSK } from '../../../shared/db/keys';
import { AudioBriefing, User } from '../../../shared/types';
import { hasCapability } from '../../../shared/utils/capability';
import { refreshAudioBriefingUrl } from '../../../shared/services/audio-briefing-storage';
import { logger } from '../../../shared/utils/logger';
import { validate } from '../../../shared/middleware/validation';
import { z } from 'zod';

const channelPrefsSchema = z
  .object({
    weeklyDigest: z.boolean().optional(),
    criticalAlerts: z.boolean().optional(),
  })
  .optional();

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  notificationPreferences: z
    .object({
      email: channelPrefsSchema,
      slack: channelPrefsSchema,
      webhook: channelPrefsSchema,
    })
    .optional(),
  /**
   * Phase 6a — Command-tier exclusive. Users can submit empty array to clear
   * their categories. The handler tier-checks before writing.
   */
  customRecommendationCategories: z
    .array(z.string().min(1).max(100))
    .max(3)
    .optional(),
  /**
   * Phase 6c — Command-tier exclusive. Toggle for the monthly PDF briefing
   * cron (1st of month, 8am UTC).
   */
  scheduledReports: z
    .object({
      monthly: z.boolean().optional(),
    })
    .optional(),
  /**
   * Phase 7b — workspace-shared feed threshold. Stored on the tenant owner's
   * User row; all members see the same filtered feed. Critical alerts bypass.
   */
  feedSignificanceThreshold: z.number().int().min(0).max(10).optional(),
});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const method = event.requestContext.http.method;

  // Find userId via GSI3 (email lookup)
  const { items } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (items.length === 0) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  }
  const userId = (items[0].GSI3SK as string).replace('USER#', '');

  if (method === 'GET') {
    const user = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
    if (!user) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Phase 2 demo-wow — latest audio briefing. Only for tiers that have it.
    // If the stored presigned URL has < 1h left, re-mint a fresh 7-day one.
    let audioBriefing:
      | { url: string; durationSec: number; generatedAt: string }
      | undefined;
    if (hasCapability(user, 'audioBriefing')) {
      try {
        const { items } = await queryByPK(
          audioBriefingPK(userId),
          audioBriefingSKPrefix(),
          { limit: 1, scanForward: false }
        );
        const latest = items[0] as (AudioBriefing & Record<string, unknown>) | undefined;
        if (latest) {
          const nowSec = Math.floor(Date.now() / 1000);
          const oneHour = 60 * 60;
          let url = latest.presignedUrl;
          if (!url || (latest.presignedUrlExpiresAt ?? 0) - nowSec < oneHour) {
            const fresh = await refreshAudioBriefingUrl(latest.s3Key);
            url = fresh.url;
          }
          audioBriefing = {
            url,
            durationSec: latest.durationSec,
            generatedAt: latest.generatedAt,
          };
        }
      } catch (err) {
        logger.warn('profile_audio_briefing_lookup_failed', {
          userId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      statusCode: 200,
      body: {
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          onboardingComplete: user.onboardingComplete,
          createdAt: user.createdAt,
          notificationPreferences: user.notificationPreferences,
          customRecommendationCategories: user.customRecommendationCategories,
          scheduledReports: user.scheduledReports,
          feedSignificanceThreshold: user.feedSignificanceThreshold ?? 0,
          // Phase 9a — frontend re-consent banner reads these to detect drift
          // against the current TOS_VERSION / PRIVACY_VERSION constants.
          tosVersion: user.tosVersion,
          privacyVersion: user.privacyVersion,
          // Phase 9a self-suspend — frontend renders the suspend/resume button
          // based on this. Default 'active' if absent (existing accounts).
          status: user.status ?? 'active',
          // Phase 8a / "Since you last looked" hero card — frontend computes
          // the change-feed window from previousLoginAt. lastLoginAt is the
          // current session's anchor; previousLoginAt was bumped by the most
          // recent ping (see api/users/ping.ts).
          lastLoginAt: user.lastLoginAt,
          previousLoginAt: user.previousLoginAt,
          // Phase 2 demo-wow — latest weekly audio briefing. Strategist+.
          // Undefined when no briefing exists yet or the user is on Scout.
          ...(audioBriefing ? { audioBriefing } : {}),
        },
      },
    };
  }

  // PUT
  const body = validate(updateSchema, parseBody(event));
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name) updates.name = body.name;
  if (body.notificationPreferences) updates.notificationPreferences = body.notificationPreferences;
  if (body.feedSignificanceThreshold !== undefined) {
    updates.feedSignificanceThreshold = body.feedSignificanceThreshold;
  }

  // Custom categories + scheduled reports are tier-gated (Command only). Lower
  // tiers attempting to set them get a 403 — backend is the source of truth
  // even though the frontend hides the UI behind useCapability(). Both gates
  // load the user record; do it once if either field is present.
  if (
    body.customRecommendationCategories !== undefined ||
    body.scheduledReports !== undefined
  ) {
    const userForGate = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
    if (body.customRecommendationCategories !== undefined) {
      if (!hasCapability(userForGate ?? undefined, 'customRecommendationCategories')) {
        throw new HttpError(
          403,
          'PLAN_REQUIRED',
          'Custom recommendation focus areas require the Command plan.'
        );
      }
      updates.customRecommendationCategories = body.customRecommendationCategories;
    }
    if (body.scheduledReports !== undefined) {
      if (!hasCapability(userForGate ?? undefined, 'scheduledReports')) {
        throw new HttpError(
          403,
          'PLAN_REQUIRED',
          'Scheduled reports require the Command plan.'
        );
      }
      updates.scheduledReports = body.scheduledReports;
    }
  }

  await updateItem(userPK(userId), userSK(), updates);

  return {
    statusCode: 200,
    body: { data: { message: 'Profile updated' } },
  };
});
