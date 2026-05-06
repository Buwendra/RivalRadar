/**
 * Workspace + Membership + Invitation entities (Phase 4a).
 *
 * The pragmatic Phase 4a shape: a Workspace is a thin layer where the
 * `ownerUserId` is the canonical "tenant" key. All existing entities
 * (Competitor, Subscription, IntegrationCredential, etc.) STAY keyed
 * under `USER#<id>` where `id` is the workspace owner. Members of the
 * workspace see the same data because the auth middleware resolves
 * any signed-in user's email to the workspace owner's userId.
 *
 * Trade-off: the workspace owner is special — they can't be replaced
 * without a data migration. Phase 4b will rekey to `WORKSPACE#<wsId>`
 * for true ownership-independence; for now, "workspace" is a sharing
 * abstraction.
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
  ownerUserId: string;
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
