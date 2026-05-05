/**
 * CancellationFeedback — exit-survey response captured when a user cancels
 * their subscription (Phase 8b).
 *
 * Storage layout:
 *   PK = CANCEL_FEEDBACK#<token>, SK = META
 * The token is a ULID generated at email-send time and embedded in the
 * survey link. Single-PK keying lets the public submit handler resolve
 * the row from just the URL token without needing the userId. TTL field
 * (`expiresAt`) auto-deletes rows 30 days after creation.
 *
 * Empty `responses` + missing `submittedAt` = email sent but user didn't
 * fill out the survey. Both are useful signals (the count of unfilled
 * surveys is itself a "didn't even bother to tell us why" datum).
 */

export type CancellationReason =
  | 'price'              // Too expensive
  | 'value'              // Didn't see enough value
  | 'missing-features'   // Missing features I needed
  | 'usability'          // Hard to use / confusing
  | 'switched'           // Switched to another tool
  | 'no-longer-needed'   // Don't need competitive intel anymore
  | 'temporary-pause'    // Just taking a break
  | 'other';             // Other (free-text in `freeText`)

export interface CancellationFeedback {
  token: string;
  userId: string;
  email: string;
  plan: string;            // The plan they were on when they canceled
  paddleSubscriptionId?: string;
  createdAt: string;
  expiresAt: number;       // Epoch seconds — DynamoDB TTL
  // Set when the user submits the survey:
  reason?: CancellationReason;
  freeText?: string;
  submittedAt?: string;
}
