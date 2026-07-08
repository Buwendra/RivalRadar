# Kironyx rebrand — infrastructure cutover runbook

The July 2026 rebrand renamed the product from **RivalScan** to **Kironyx** everywhere in the
codebase, including the CDK stack prefix (`Kironyx-${stage}-*`) and the Secrets Manager path
(`kironyx/api-keys`). Deploying this code creates a **fresh, empty set of stacks** — the old
`RivalScan-dev-*` stacks and their data are not migrated (fresh start approved pre-soft-launch).

Execute these steps **in order**. Steps 1–2 must be complete before `cdk deploy` or every
Lambda that reads secrets will fail at runtime.

## 1. Domain + email (prerequisites)

1. Purchase `kironyx.com` (verify availability first — it had no DNS record as of 2026-07-08).
2. SES (us-east-1): verify the `kironyx.com` domain identity (or at minimum
   `noreply@kironyx.com`) and stay/re-apply for production access if the account's SES
   production access was scoped to the old identity.
3. Set up receiving/forwarding for the addresses referenced in user-facing copy:
   `support@`, `legal@`, `privacy@`, `dpo@`, `abuse@`, `security@` @kironyx.com
   (legal pages, deletion emails, security.txt all reference these).

## 2. Secrets Manager

Copy the existing secret to the new path (values unchanged):

```bash
aws secretsmanager get-secret-value --secret-id rivalscan/api-keys --query SecretString --output text > /tmp/keys.json
aws secretsmanager create-secret --name kironyx/api-keys --secret-string file:///tmp/keys.json
rm /tmp/keys.json
```

The path literal lives in `src/shared/services/secrets.ts` (`API_SECRETS_PATH`) and is
mirrored in `api.stack.ts` / `pipeline.stack.ts`.

## 3. Backend deploy

1. Update `Backend/.env`: `FROM_EMAIL=noreply@kironyx.com`, `FRONTEND_URL` (unchanged Amplify
   URL until the custom domain moves), and set `ALERT_EMAIL` (also enables the AWS budget).
2. `cd Backend && set -a && source .env && set +a`
3. `npx cdk synth` — confirm stack names are `Kironyx-${stage}-*` and no `RivalScan` remains
   in the templates.
4. `npx cdk deploy --all` — creates the new stacks from scratch.

## 4. Frontend (Amplify)

1. Update app-level env vars: `NEXT_PUBLIC_API_URL` → the **new** API Gateway endpoint from
   the `Kironyx-*-Api` stack output, `NEXT_PUBLIC_APP_NAME=Kironyx`, `NEXT_PUBLIC_APP_URL`.
2. Confirm the backend's `FRONTEND_URL` matches the Amplify URL exactly (CORS), redeploy the
   Api stack if it changed.
3. Trigger a rebuild: `aws amplify start-job --app-id d1zrq9gf129s9u --branch-name main --job-type RELEASE`
   (env vars are inlined at build time).

## 5. Re-seed and validate

1. Sign up fresh (new Cognito pool = no existing accounts), complete onboarding.
2. Re-seed demo/brand data if needed: `Backend/scripts/seed-demo-data.ts`,
   `seed-brand-data.ts`, `seed-battlecards.sh` (their usage headers now reference
   `Kironyx-dev-*` resource names).
3. Validate: sign-in, research run, weekly-digest dry run, battlecard PDF (should read
   "KIRONYX BATTLECARD"), status page title, alert email branding.

## 6. Decommission the old stacks (only after validation)

1. `cdk destroy` is not directly possible from this branch (the app no longer declares the
   old stack names) — delete the `RivalScan-dev-*` CloudFormation stacks from the console or
   `aws cloudformation delete-stack`, in reverse dependency order
   (StatusPage → Monitoring → Api → Pipeline → Email → Auth → Storage → Database).
2. The DynamoDB table and S3 snapshot bucket have `RETAIN` policies — after the stacks are
   gone, delete them manually once you're certain nothing in them is needed.
3. Delete the old secret: `aws secretsmanager delete-secret --secret-id rivalscan/api-keys --recovery-window-in-days 7`

## 7. Later / optional

- Custom domains: `app.kironyx.com` (Amplify), `status.kironyx.com` (StatusPage CloudFront) —
  see [soft-launch-domain-setup.md](soft-launch-domain-setup.md).
- Rename the GitHub repo (currently `RivalRadar`) and reconnect Amplify if you do.
- Paddle: update the seller/product display names so checkout says Kironyx.
