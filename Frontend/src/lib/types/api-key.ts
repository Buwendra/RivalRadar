export interface ApiKeyListItem {
  id: string;
  name: string;
  keyHint: string;
  createdAt: string;
  lastUsedAt?: string;
  disabled?: boolean;
}

export interface ApiKeyCreated extends ApiKeyListItem {
  /** Returned ONCE on creation. UI must surface a copy-now banner; the
   *  plaintext is never echoed back on subsequent reads. */
  plaintext: string;
}
