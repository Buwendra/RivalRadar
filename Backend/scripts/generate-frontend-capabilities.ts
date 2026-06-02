/**
 * Generates `Frontend/src/lib/utils/capabilities.ts` from the canonical
 * backend definition at `Backend/src/shared/types/capabilities.ts`.
 *
 * Why this exists: the backend and frontend each have their own
 * `Capabilities` definition + `CAPABILITIES` matrix. Keeping them in sync
 * by hand is drift-prone — when you add a new flag (e.g. audioBriefing)
 * and forget the frontend mirror, UI gating silently no-ops. This script
 * regenerates the frontend file mechanically from the backend source.
 *
 * Usage:
 *   cd Backend && npx ts-node scripts/generate-frontend-capabilities.ts
 *
 * Run after editing `Backend/src/shared/types/capabilities.ts`. The CI
 * integration is deferred (would tangle with the verify.yml work); for
 * now the dev runs this manually + commits both files together.
 *
 * Idempotent: running with no backend changes produces a byte-identical
 * frontend file. Diff the output before committing.
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { CAPABILITIES, type Capabilities } from '../src/shared/types/capabilities';

const FRONTEND_PATH = resolve(
  __dirname,
  '..',
  '..',
  'Frontend',
  'src',
  'lib',
  'utils',
  'capabilities.ts'
);

// Build the Capabilities interface shape by introspecting the scout row.
// Every flag must be present on every tier (TS enforces this on the
// backend side), so scout is a fine reference.
function describeShape(sample: Capabilities): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(sample)) {
    if (typeof value === 'boolean') {
      lines.push(`  ${key}: boolean;`);
    } else if (typeof value === 'object' && value !== null) {
      const inner = Object.entries(value)
        .map(([k, v]) => `${k}: ${typeof v === 'number' ? 'number' : 'string'}`)
        .join('; ');
      lines.push(`  ${key}: { ${inner} };`);
    } else if (typeof value === 'number') {
      lines.push(`  ${key}: number;`);
    } else {
      lines.push(`  ${key}: ${typeof value};`);
    }
  }
  return lines.join('\n');
}

const out = `/**
 * AUTO-GENERATED — do not edit by hand.
 *
 * Source of truth: Backend/src/shared/types/capabilities.ts
 * Regenerate via: cd Backend && npx ts-node scripts/generate-frontend-capabilities.ts
 *
 * Mirror of the backend Capabilities matrix. Backend remains the
 * enforcement source of truth — frontend uses this only for UI gating
 * (showing/hiding upgrade prompts, disabling buttons).
 */

import type { PlanTier } from "@/lib/types";

export interface Capabilities {
${describeShape(CAPABILITIES.scout)}
}

export const CAPABILITIES: Record<PlanTier, Capabilities> = ${JSON.stringify(
  CAPABILITIES,
  null,
  2
)};

export function capabilitiesFor(user: { plan?: PlanTier } | null | undefined): Capabilities {
  return CAPABILITIES[user?.plan ?? "scout"];
}
`;

writeFileSync(FRONTEND_PATH, out);
console.log(`Wrote ${FRONTEND_PATH}`);
console.log(`If \`git diff Frontend/src/lib/utils/capabilities.ts\` shows changes,`);
console.log(`commit them with the backend Capabilities change in a single PR.`);
