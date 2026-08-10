---
name: verify
description: Run the CI checks locally for whichever side of the repo changed, plus cdk synth for infra changes (which CI deliberately skips). Use before pushing, after finishing a change, or when asked to "check", "verify", or "make sure this builds".
---

# Verify

Reproduce the `verify.yml` gates locally, and close the one gap CI leaves open.

## 1. Detect what changed

```bash
git status --short
git diff --name-only HEAD
```

Include untracked files — a brand-new handler or component still needs checking.

## 2. Run the checks for each side that changed

**Backend** (`Backend/**`):

```bash
cd Backend && npm run lint && npx vitest run
```

`npm run lint` here is `tsc --noEmit`, **not** ESLint — there is no ESLint config in `Backend/`.

**Frontend** (`Frontend/**`):

```bash
cd Frontend && npx tsc --noEmit && npm run lint
```

This `npm run lint` **is** ESLint (`next lint`). Both commands are required; neither implies the other.

If both sides changed, run both. Report each result separately — don't collapse them into one "passed".

## 3. Infra changes: also run synth

If anything under `Backend/lib/**` or `Backend/bin/**` changed:

```bash
cd Backend && set -a && source .env && set +a && npx cdk synth --quiet
```

**This is the point of this skill.** `verify.yml` excludes `cdk synth` deliberately (slow, costly), so a broken stack definition passes CI and fails at deploy. `tsc --noEmit` will not catch: esbuild bundling failures or cross-stack dependency cycles. (Router `entry` path typos and the Api stack's 500-resource ceiling ARE now caught in CI by the template test `lib/stacks/api.stack.test.ts`, which synths with bundling disabled — full synth is still the only check that runs esbuild.)

Notes:
- Use `npx cdk`, never a global `cdk` — a globally installed CLI older than `aws-cdk-lib` fails with a cloud-assembly schema mismatch.
- `set -a` is required. A plain `source .env` does not export the vars to the `cdk` child process, and `bin/app.ts` throws at parse time without `CDK_DEFAULT_ACCOUNT` and `FRONTEND_URL`.
- If you're about to deploy rather than just check, use the `deploy-preflight` skill instead — it covers stage selection, secrets, and diff review.

## 4. Capability changes

If `Backend/src/shared/types/capabilities.ts` is in the diff, stop and use the `add-capability` skill. Type-checking alone does not catch capability mirror drift — see that skill for why.

## Reporting

State plainly what ran and what happened. If something failed, show the actual error output rather than summarizing it. If you skipped a check because that side didn't change, say so — don't imply broader coverage than you ran.
