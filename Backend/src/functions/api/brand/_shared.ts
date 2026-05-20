/**
 * Phase 23 — Brand Pulse. Shared helpers for the `/brand/*` handler family.
 *
 * The self-brand row is stored as a Competitor row with `targetKind === 'self'`
 * under the workspace's tenant PK. There is exactly one per workspace; the
 * helpers below load it (returning `null` when absent — legacy users who
 * haven't completed the setup modal) and assert the capability flag.
 */

import { queryByPK, getItem } from '../../../shared/db/queries';
import { competitorPK, userPK, userSK } from '../../../shared/db/keys';
import { hasCapability } from '../../../shared/utils/capability';
import { HttpError } from '../../../shared/middleware/handler';
import type { User } from '../../../shared/types';

export interface SelfBrandRow extends Record<string, unknown> {
  id: string;
  name: string;
  url: string;
  industry?: string;
  targetKind: 'self';
}

export async function loadSelfBrand(tenantUserId: string): Promise<SelfBrandRow | null> {
  const { items } = await queryByPK(competitorPK(tenantUserId), 'COMP#', {
    scanForward: true,
  });
  const self = (items as Array<Record<string, unknown>>).find(
    (c) => c.targetKind === 'self'
  );
  return (self as SelfBrandRow | undefined) ?? null;
}

export async function loadUserForBrand(
  tenantUserId: string
): Promise<User & Record<string, unknown>> {
  const user = await getItem<User & Record<string, unknown>>(userPK(tenantUserId), userSK());
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  return user;
}

export function assertBrandPulseCapability(user: Pick<User, 'plan'>): void {
  if (!hasCapability(user, 'brandPulse')) {
    throw new HttpError(
      403,
      'CAPABILITY_LOCKED',
      'Brand Pulse is not available on your current plan.'
    );
  }
}
