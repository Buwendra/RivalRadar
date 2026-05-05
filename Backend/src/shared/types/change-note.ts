/**
 * ChangeNote — analyst annotation attached to a Change record (Phase 7a).
 *
 * - `PK = COMP#<compId>`, `SK = NOTE#<changeId>#<timestamp>` so every note
 *   for every change on a competitor is colocated under that competitor's PK.
 * - `authorUserId` is the user who wrote the note. Today this is always the
 *   account owner; once Phase 4 (workspaces) ships, multiple workspace
 *   members will be able to add notes and the author field becomes the
 *   "comment thread" attribution.
 * - `body` is plain text. No markdown rendering today — keeps the surface
 *   small and avoids XSS risk in the UI.
 */

export interface ChangeNote {
  id: string;
  changeId: string;
  competitorId: string;
  authorUserId: string;
  authorName: string;          // denormalized so the UI doesn't need a second lookup
  body: string;
  createdAt: string;
}
