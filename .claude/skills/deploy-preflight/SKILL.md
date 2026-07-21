---
name: deploy-preflight
description: Pre-deploy safety sequence for the CDK backend — env sourcing, stage selection, fresh synth, secret existence, and diff review before cdk deploy. Use before any backend deploy, or when asked to deploy, ship, or push infrastructure to AWS.
---

# Deploy preflight

The authoritative procedure is `docs/security/CHANGE_MANAGEMENT_POLICY.md` (gate sequence) and `docs/runbooks/DEPLOYMENT.md` (full runbook). This skill is the pre-deploy checklist that catches what CI cannot.

**Both docs have known drift:** the runbook says "7 stacks" (there are 8 — `StatusPage` was added), documents Vercel (the frontend is on **Amplify**), and its §5.2 env list omits `ALERT_EMAIL`. Trust the code over the runbook where they disagree.

## 1. Source the environment

```bash
cd Backend && set -a && source .env && set +a
```

`set -a` is not optional. The runbook's plain `source .env` does **not** export to the `cdk` child process, and `bin/app.ts` validates at module top level — before the App is constructed — so everything fails identically at parse time.

## 2. Assert the required vars

- `CDK_DEFAULT_ACCOUNT` — throws if unset
- `FRONTEND_URL` — throws if unset; must match the Amplify URL **exactly** or CORS blocks the browser
- `CDK_DEFAULT_REGION` — silently defaults to `us-east-1`
- **`ALERT_EMAIL`** — absent from `.env.example`. Unset means the monthly AWS budget and the alarms SNS email subscriber are **silently skipped**. Set it for any real deploy.

Note: `FROM_EMAIL` appears in `.env` and the docs, but **no stack injects it into any Lambda**. `shared/services/ses.ts` reads it at runtime and falls back to a hardcoded address, so setting it in your shell has no effect. Don't rely on it.

## 3. Confirm the stage — highest-risk step

`stage` is read via `app.node.tryGetContext('stage')`. It is a **CDK context flag, not an environment variable**:

```bash
npx cdk deploy --all -c stage=prod     # prod
npx cdk deploy --all                   # defaults to dev
```

Exporting `STAGE=prod` does nothing. `cdk.json` sets no default, so omitting the flag silently retargets the **entire dev environment** — stack names, Lambda function names, and alarm prefixes all derive from it (`Kironyx-${stage}-${StackType}`).

State out loud which stage you are deploying to before running anything.

## 4. Fresh synth

```bash
npx cdk synth --quiet
```

Use `npx cdk`, never a global `cdk` — a CLI older than `aws-cdk-lib` fails with a cloud-assembly schema mismatch. A populated `Backend/cdk.out/` may be stale; synth fresh rather than deploying an old assembly.

Synth is the only gate for: esbuild bundling failures, bad `entry:` paths in `addRoute` (string literals joined by `path.join` — typos aren't type errors), cross-stack dependency cycles, and the Api stack's CloudFormation resource ceiling. CI skips it deliberately.

## 5. Check synth output for silent degradations

Grep stderr for `ALERT_EMAIL is unset`. CDK annotations are warnings and do **not** fail synth without `--strict`.

## 6. Confirm the secret exists

```bash
aws secretsmanager describe-secret --secret-id kironyx/api-keys --region us-east-1
```

The stacks use `Secret.fromSecretNameV2`, which resolves at runtime, not synth. A missing or misnamed secret **synths and deploys perfectly** and then fails on every Lambda invocation. Expected keys: `PADDLE_SECRET_KEY`, `PADDLE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, and optionally `ELEVENLABS_API_KEY`.

## 7. Review the diff before deploying

```bash
npx cdk diff
```

Read it. Specifically look for `DeletionPolicy: Delete` on stateful resources, and resource-count growth on the Api stack — it carries ~588 of CloudFormation's 1000-resource limit and `api.stack.ts` comments note it flirts with the ceiling.

## 8. Deploy

```bash
npx cdk deploy --all --require-approval broadening
```

Effective order is Database / Storage / Auth / Email (parallel) → Pipeline → Api → Monitoring → StatusPage. There are no `addDependency()` calls; ordering is implied by cross-stack references, so let CDK sequence it rather than deploying stacks individually unless you have a specific reason.

Single stack when needed: `npm run deploy:stack -- Kironyx-dev-Api`.

## On Windows

Paths with a leading `/` (CloudWatch log group names, IAM ARNs) get mangled by Git Bash. Prefix those `aws` CLI calls with `MSYS_NO_PATHCONV=1`.
