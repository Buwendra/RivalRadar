/**
 * Workspace + Membership + Invitation entities (Phase 4a + 4c).
 *
 * Phase 4a established "Workspace" as a sharing abstraction where data
 * (Competitor, Subscription, IntegrationCredential, etc.) is keyed under
 * the owner's `USER#<id>`. Phase 4c added ownership transfer by splitting
 * one mutable field into two:
 *
 *   - `tenantUserId` (immutable) — whose `USER#<id>` row holds the data.
 *     Set once at workspace creation = the original `ownerUserId`. Never
 *     changes. This is what `resolveTenantContext` returns as the data
 *     tenant key. Optional in the type to support lazy backfill of
 *     pre-Phase-4c rows.
 *   - `ownerUserId` (mutable) — who has admin authority. Changes on
 *     transfer; drives role assignment in `resolveTenantContext`.
 *
 * Storage layout:
 *   Workspace        — PK=WORKSPACE#<wsId>, SK=PROFILE
 *   Membership       — PK=USER#<userId>,    SK=MEMBERSHIP#<wsId>      (per-user lookup)
 *                    + PK=WORKSPACE#<wsId>, SK=MEMBER#<userId>        (reverse / member list)
 *   Invitation       — PK=INVITE#<token>,   SK=META
 */

export type MembershipRole = 'owner' | 'member';

export interface Workspace {
  id: string;
  name: string;
  /** Mutable — admin authority. Updated on ownership transfer. */
  ownerUserId: string;
  /**
   * Immutable — whose USER#<id> row holds the workspace's data. Optional
   * during the lazy-backfill window for rows created before Phase 4c.
   * Resolver falls back to `ownerUserId` when absent.
   */
  tenantUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  workspaceId: string;
  userId: string;
  role: MembershipRole;
  joinedAt: string;
  /** Denormalized owner-side fields for cheap rendering: workspace.name. */
  workspaceName?: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface WorkspaceInvitation {
  token: string;
  workspaceId: string;
  /** Denormalized so the public accept handler can return a friendly name. */
  workspaceName: string;
  inviterUserId: string;
  inviterEmail: string;
  inviteeEmail: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: number;            // epoch seconds — DynamoDB TTL
  acceptedAt?: string;
  acceptedByUserId?: string;
}
