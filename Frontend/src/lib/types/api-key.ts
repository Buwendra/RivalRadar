export type ApiKeyScope = "read" | "write";

export interface ApiKeyListItem {
  id: string;
  name: string;
  keyHint: string;
  /** Phase 13 — read (default) or write (mutates state). */
  scope: ApiKeyScope;
  createdAt: string;
  lastUsedAt?: string;
  disabled?: boolean;
}

export interface ApiKeyCreated extends ApiKeyListItem {
  /** Returned ONCE on creation. UI must surface a copy-now banner; the
   *  plaintext is never echoed back on subsequent reads. */
  plaintext: string;
}
