/**
 * Tenant resolution middleware (Phase 4a).
 *
 * Translates a JWT email into the workspace owner's userId — the canonical
 * "tenant" identifier under which all entities (Competitor, Subscription,
 * recommendations, etc.) are keyed. This is the central abstraction that
 * lets multiple users share the same data: every member of a workspace
 * resolves to the SAME ownerUserId, so handlers querying `USER#<ownerId>`
 * see the workspace's data.
 *
 * Resolution order:
 *   1. Look up the user by email (existing GSI3 pattern).
 *   2. Look up the user's memberships under PK=USER#<userId>, SK begins_with MEMBERSHIP#.
 *   3. If the user has memberships:
 *        a. If only one — that's their tenant. Return its ownerUserId.
 *        b. If multiple — pick the one matching X-Workspace-Id header,
 *           else fall back to the user's own-owned workspace (their default).
 *   4. If no memberships at all (legacy users from before Phase 4a):
 *        Return the user's own userId. They're effectively their own tenant.
 *
 * The resolver also returns the calling user's actual userId + email for
 * audit-log / activity-attribution use cases. Most handlers only need
 * `tenantUserId`; a few (recommendation_acted_on logging) want both.
 */

import { queryGSI, queryByPK, getItem } from '../db/queries';
import {
  membershipByUserPK,
  membershipByUserSKPrefix,
  workspacePK,
  workspaceSK,
} from '../db/keys';
import { HttpError } from './handler';
import type { Membership, Workspace } from '../types';

export interface TenantContext {
  /** The userId under which workspace data is keyed (workspace owner). */
  tenantUserId: string;
  /** The actual signed-in user's userId. May equal tenantUserId for owners. */
  callerUserId: string;
  /** The signed-in user's email (lowercased). */
  callerEmail: string;
  /** Workspace identity for audit logging + UI display. */
  workspaceId: string;
  workspaceName: string;
  /** 'owner' or 'member' — informational; full role-gating is deferred. */
  role: Membership['role'];
}

/**
 * Resolve the tenant context for an authenticated request.
 *
 * @param email JWT email claim (lowercased)
 * @param requestedWorkspaceId Optional X-Workspace-Id header value. Ignored
 *   if the caller is not a member of that workspace (defaults to primary
 *   instead of erroring — keeps the UX forgiving on stale localStorage).
 */
export async function resolveTenantContext(
  email: string,
  requestedWorkspaceId?: string
): Promise<TenantContext> {
  // 1. Resolve email → callerUserId (the actual signed-in user)
  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  }
  const callerUserId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  // 2. Look up the caller's memberships
  const { items: membershipItems } = await queryByPK(
    membershipByUserPK(callerUserId),
    membershipByUserSKPrefix()
  );
  const memberships = membershipItems as unknown as Membership[];

  // 4. Legacy fallback — no memberships yet (existing users from before Phase 4a)
  if (memberships.length === 0) {
    return {
      tenantUserId: callerUserId,
      callerUserId,
      callerEmail: email,
      workspaceId: callerUserId, // synthetic — same as user id for legacy
      workspaceName: '(personal)',
      role: 'owner',
    };
  }

  // 3. Pick a membership.
  let chosen: Membership | undefined;
  if (requestedWorkspaceId) {
    chosen = memberships.find((m) => m.workspaceId === requestedWorkspaceId);
  }
  // Fallbacks: caller's own-owned workspace, else first by joinedAt
  if (!chosen) {
    chosen = memberships.find((m) => m.role === 'owner') ?? memberships[0];
  }

  // Resolve the workspace's owner. Cheap: a single GET on WORKSPACE#<id>.
  const workspace = await getItem<Workspace>(
    workspacePK(chosen.workspaceId),
    workspaceSK()
  );
  if (!workspace) {
    // The membership references a nonexistent workspace — data inconsistency.
    // Don't 500; fall back to the caller as their own tenant.
    return {
      tenantUserId: callerUserId,
      callerUserId,
      callerEmail: email,
      workspaceId: callerUserId,
      workspaceName: '(personal)',
      role: 'owner',
    };
  }

  // Phase 4c — `tenantUserId` is the immutable data-tenancy key (set at
  // workspace creation). Falls back to `ownerUserId` for pre-4c rows that
  // haven't been touched since the upgrade.
  return {
    tenantUserId: workspace.tenantUserId ?? workspace.ownerUserId,
    callerUserId,
    callerEmail: email,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    role: chosen.role,
  };
}

/**
 * Convenience extractor for the X-Workspace-Id header. Returns undefined
 * when the header is absent — callers default to the primary workspace.
 */
export function getRequestedWorkspaceId(headers: Record<string, string | undefined>): string | undefined {
  // API Gateway lowercases header names automatically
  return headers['x-workspace-id'];
}

/**
 * Phase 4b — guard for handlers that mutate persistent / financial state.
 * Throws 403 FORBIDDEN if the caller isn't the workspace owner. Legacy
 * single-seat users always pass (resolver returns role 'owner' for them).
 *
 * Use for: billing, API key minting, workspace delete, ownership transfer,
 * member role assignment.
 */
export function assertOwner(ctx: TenantContext, what = 'this workspace'): void {
  if (ctx.role !== 'owner') {
    throw new HttpError(
      403,
      'FORBIDDEN',
      `Only the workspace owner can manage ${what}.`
    );
  }
}

/**
 * Phase 14 — guard for handlers that perform day-to-day delegation work.
 * Both 'owner' and 'admin' pass; 'member' rejects with 403 FORBIDDEN.
 *
 * Use for: invite / kick members, manage integrations, delete competitors,
 * rename workspace, read audit log.
 */
export function assertAdminOrOwner(ctx: TenantContext, what = 'this workspace'): void {
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    throw new HttpError(
      403,
      'FORBIDDEN',
      `Only workspace owners or admins can manage ${what}.`
    );
  }
}
