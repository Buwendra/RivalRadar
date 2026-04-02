import { ulid } from 'ulid';

/** Generate a time-sortable unique ID (ULID) */
export function generateId(): string {
  return ulid();
}
