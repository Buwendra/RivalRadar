---
name: add-capability
description: Add or change a tier-capability flag across the backend matrix, both hand-written unions, and the generated frontend mirror. Use when adding a capability flag, changing what a plan tier includes, or adjusting a numeric capacity limit (seats, saved views, API keys, recommendations).
---

# Add or change a capability flag

The flag list exists in **three hand-maintained copies**. A generator rebuilds only one of them. Most of the ways to get this wrong compile cleanly.

## Read this first — the silent failure

**If you are changing only tier _values_** (flipping `strategist.audioBriefing` to `true`, bumping `savedViews.max`), steps 1–4 don't apply — but **step 5 is still mandatory**.

The frontend interface shape is unchanged, so **nothing type-errors anywhere**. The backend enforces the new entitlement while the frontend keeps gating on stale values, showing upgrade prompts to users who now have the feature (or hiding them from users who don't). There is no CI guard for this, the generator has no `--check` mode, and no test enumerates the key set.

## Steps

Each is marked LOUD (the compiler stops you) or SILENT (it ships wrong).

**1. Add the key to the `Capabilities` interface** — `Backend/src/shared/types/capabilities.ts`

Booleans are declared flat. Numeric capacity flags are nested single-property objects (`recommendations: { maxVisible: number }`), by convention `-1` = unlimited, `0` = feature locked. Include a JSDoc line; the generator drops comments, but the backend file is the one humans read.

**2. Add the value to all three tier rows** — same file — *LOUD*

`CAPABILITIES` is typed `Record<PlanTier, Capabilities>`, so `scout`, `strategist`, and `command` must each carry the key. Missing one fails `tsc`.

**3. Add the name to the `hasCapability` union** — `Backend/src/shared/utils/capability.ts` — *LOUD-ish*

The second parameter is a hand-written inline literal union, not `keyof Capabilities`. **Booleans only** — the four nested numeric flags (`recommendations.maxVisible`, `seats.max`, `savedViews.max`, `apiKeys.max`) are excluded by design and read directly off `capabilitiesFor(user)`.

Silent if you never call `hasCapability` for the new flag and read it off `capabilitiesFor()` instead — that compiles fine and leaves the codebase inconsistent.

**4. Add the same name to the `useCapability` union** — `Frontend/src/lib/hooks/use-capability.ts` — *LOUD*

A verbatim duplicate of the backend union, double-quoted. **The generator does not touch this file.** This is the third hand-written copy and the one most often missed.

**5. Regenerate the frontend mirror** — *SILENT if skipped*

```bash
cd Backend && npx ts-node scripts/generate-frontend-capabilities.ts
```

No env vars, no AWS. Fully overwrites `Frontend/src/lib/utils/capabilities.ts` from the backend source — **never hand-edit that file**, any manual change is destroyed on the next run. The script is idempotent: a no-op run produces a byte-identical file.

**6. Check the diff is non-empty**

```bash
git diff Frontend/src/lib/utils/capabilities.ts
```

After any backend capability change this **must** show changes. An empty diff means you didn't save step 1/2, or you edited the wrong file. A dirty diff when you changed nothing means pre-existing drift — investigate before continuing.

**7. Update the flag list in `CLAUDE.md`** (Capability Gating section, ~line 228) — *SILENT*

**8. Add assertions to `Backend/src/shared/utils/capability.test.ts`** — *SILENT*

No existing test enumerates the key set, so nothing fails if you skip this.

**9. Commit backend and generated frontend together**

Splitting them across commits leaves a window where the deployed halves disagree.

## Verify

```bash
cd Backend && npm run lint && npx vitest run
cd ../Frontend && npx tsc --noEmit && npm run lint
```

Note `Backend/tsconfig.json` excludes `scripts/`, so the generator itself is never type-checked by `npm run lint` — a break in it surfaces only when you run it.
