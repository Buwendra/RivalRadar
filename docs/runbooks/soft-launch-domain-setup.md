# Runbook — Soft-Launch Domain Setup

How to buy a custom domain and wire it to the Kironyx stack (Amplify frontend,
API Gateway + CDK backend, Cognito, SES) for the gated soft launch.

**Stack context:** everything lives in **`us-east-1`**. Amplify app ID
`d1zrq9gf129s9u`, root dir `Frontend/`. Frontend env vars are inlined at build
time; `FRONTEND_URL` (backend/CDK) drives CORS and must match the site origin exactly.

> **Scope:** this is the *soft launch* (invite-only, gated intake). Public-GA
> hardening (WAF/CloudFront in front of the API, Net-30 invoicing, higher Anthropic
> tiers) is out of scope here — see the launch/hardening roadmap.

---

## TL;DR recommended path

Register the domain in **Route 53** → it auto-creates the DNS hosted zone →
connect it to Amplify (auto TLS cert + DNS records) → verify it in SES for email →
update the app's URL/env config and redeploy.

**Cost:** ~$15/yr for a `.com` + ~$0.50/mo for the Route 53 hosted zone. TLS
certificates are free (ACM).

---

## Step 1 — Pick the name

- **Prefer `.com`** — most trusted and the default customers type. `.io` / `.ai` /
  `.co` are acceptable fallbacks only.
- **Brandable, no hyphens, easy to say aloud.** Target `kironyx.com`; keep 2–3
  backups ready in case it's taken.
- **5-minute trademark sanity check** (USPTO TESS / local registry) before
  committing — matters once you're taking real money.

## Step 2 — Buy it (Route 53 recommended)

Register directly in **Route 53** (Console → Route 53 → *Registered domains* →
*Register domains*). Why, for this stack specifically:

- Auto-creates the **hosted zone** — no nameserver-delegation step.
- **Amplify can auto-create the DNS records** when you add the custom domain.
- **ACM certs auto-validate** via DNS in the same account.
- **SES email records** (DKIM/SPF/DMARC) go in the same hosted zone.
- **Free WHOIS privacy** included.

Notes:
- Cost: `.com` ≈ $14–15/yr at Route 53. (Cloudflare Registrar is ~$10/yr at-cost if
  you want the cheapest option, but DNS then lives at Cloudflare — for a solo soft
  launch the Route 53 convenience is worth the ~$4/yr premium.)
- **Turn on auto-renew immediately** so the domain can't lapse mid-launch.

## Step 3 — Get it launch-ready (the wiring)

Three surfaces to connect.

### A. Frontend → Amplify custom domain (app `d1zrq9gf129s9u`)

- Amplify Console → app → **Hosting → Custom domains → Add domain**.
- Map **root** (`kironyx.com`) and **`www`**; pick one canonical (redirect the
  other to it).
- Because the domain is in Route 53, Amplify **provisions the ACM cert and writes
  the DNS records automatically**. ~15–30 min to go green.

### B. Email → SES domain identity

- SES Console → **Verified identities → Create identity → Domain** → `kironyx.com`.
- Enable **Easy DKIM** (adds 3 CNAMEs); add **SPF** and a **DMARC** record.
- Set a **custom MAIL FROM** subdomain (e.g. `mail.kironyx.com`) for deliverability.
- Sending address e.g. `noreply@kironyx.com` → point `FROM_EMAIL` at it.
- **Request SES production access** — a verified domain still can't email real
  customers while the account is in the SES sandbox.
- Ensure **Cognito verification emails send via SES** (not Cognito's default email,
  which is capped at ~50/day).

### C. Backend API → custom subdomain (optional for soft launch)

- **Simplest:** keep the default `execute-api` URL — works fine, one less thing to set up.
- **Cleaner long-term:** add `api.kironyx.com` via API Gateway *Custom domain
  names* + an ACM cert (in `us-east-1`) + a Route 53 alias record. Doing it now
  avoids a URL migration later. Not a blocker.

### D. Update app config (mind these gotchas)

- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME` are **inlined
  at Amplify build time** — after changing them, trigger a rebuild:
  ```bash
  aws amplify start-job --app-id d1zrq9gf129s9u --branch-name main --job-type RELEASE
  ```
- `FRONTEND_URL` (backend/CDK, CORS) must **exactly match** `https://kironyx.com`
  or the browser is CORS-blocked. Redeploy the API stack after changing it.
- **Cognito**: update the app client's **callback / sign-out URLs** (and Hosted UI
  app URL if used) to the new domain, or auth redirects break.
- Keep everything in **`us-east-1`** (already the case) so the Amplify/CloudFront
  cert and any API custom-domain cert are in-region — no cross-region cert dance.
- On Git Bash (Windows), prefix `aws` calls that pass leading-slash paths with
  `MSYS_NO_PATHCONV=1`.

---

## Go-live checklist

- [ ] Domain registered in Route 53, **auto-renew ON**, WHOIS privacy on
- [ ] Amplify custom domain live (root + www), cert green, HTTPS loads
- [ ] `NEXT_PUBLIC_*` env vars updated **and Amplify rebuilt**
- [ ] `FRONTEND_URL` updated + API stack redeployed (CORS verified from new domain)
- [ ] Cognito callback / logout URLs updated to the new domain
- [ ] SES: domain verified (DKIM/SPF/DMARC), custom MAIL FROM set, `FROM_EMAIL`
      updated, **production access requested**
- [ ] Sent a test verification email + a test digest from the new domain; confirmed
      inbox delivery (not spam)
- [ ] (Optional) `api.kironyx.com` custom domain configured

---

## What can be codified vs. done in the console

- **Console/manual (your AWS account):** domain purchase, Amplify custom-domain add,
  SES production-access request, Cognito URL updates.
- **Codifiable in CDK (reproducible, not hand-clicked):** the `api.<domain>` custom
  domain + Route 53 records, and the SES domain identity (DKIM/SPF/DMARC + MAIL FROM)
  in the Email stack. Env-var / CORS / Cognito URL references can also be updated in
  code.

---

*Related: SES production-access and account-limit notes belong with the broader
soft-launch readiness checklist (rate limits, Cognito threat protection, API stage
throttling).*
