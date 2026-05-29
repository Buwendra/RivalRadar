# Testing Guide — Verify Email Delivery

This guide walks through confirming the deployed backend can send emails end-to-end. Two approaches:

1. **Quick SES smoke test** — proves SES config works (2 minutes)
2. **Full pipeline test** — sign up a user, add a competitor, trigger a scrape, receive an email (10-20 minutes)

---

## Prerequisites

Set these variables in your terminal (values from your deployment):

```bash
export API_URL=https://6xjghxskzd.execute-api.us-east-1.amazonaws.com
export USER_POOL_ID=us-east-1_LdLjHQBTC
export USER_POOL_CLIENT_ID=3cg8fosqfqts8aq244fevotikh
export FROM_EMAIL=buwendra.s@gmail.com
export TEST_EMAIL=buwendra.s@gmail.com   # use same as FROM_EMAIL while in SES sandbox
export AWS_REGION=us-east-1
```

### SES Sandbox Note

By default your AWS account is in the **SES sandbox** — you can only send emails to **verified addresses**. Easiest path: use the **same email for both `FROM_EMAIL` and `TEST_EMAIL`** (already verified). If you want to send to another address, verify it first in the SES console or request production access.

---

## Step 1 — Verify SES is configured

```bash
aws ses get-identity-verification-attributes \
  --identities $FROM_EMAIL \
  --region $AWS_REGION
```

Expected output:
```json
{
  "VerificationAttributes": {
    "buwendra.s@gmail.com": { "VerificationStatus": "Success" }
  }
}
```

If status is `Pending`, check your inbox for the SES verification email and click the link.

---

## Step 2 — Quick SES Smoke Test

Send a test email directly via SES to confirm permissions and config:

```bash
aws sesv2 send-email \
  --from-email-address $FROM_EMAIL \
  --destination "ToAddresses=$TEST_EMAIL" \
  --content '{
    "Simple": {
      "Subject": {"Data": "RivalScan SES Test"},
      "Body": {"Text": {"Data": "SES is working. If you received this, email config is good."}}
    }
  }' \
  --region $AWS_REGION
```

**Check your inbox** — you should receive this within 10 seconds. If it works, SES is healthy. If it fails, see the Troubleshooting section at the bottom.

---

## Step 3 — Full End-to-End Pipeline Test

This tests the entire flow: signup → add competitor → scrape → AI analysis → email alert.

### 3.1 Sign up a user

```bash
aws cognito-idp sign-up \
  --client-id $USER_POOL_CLIENT_ID \
  --username $TEST_EMAIL \
  --password 'TestPass123!' \
  --user-attributes Name=email,Value=$TEST_EMAIL Name=name,Value="Test User" \
  --region $AWS_REGION
```

You'll receive a verification code via email. Copy it from your inbox.

### 3.2 Confirm the signup

```bash
# Replace 123456 with the code from your email
aws cognito-idp confirm-sign-up \
  --client-id $USER_POOL_CLIENT_ID \
  --username $TEST_EMAIL \
  --confirmation-code 123456 \
  --region $AWS_REGION
```

### 3.3 Sign in to get a JWT

```bash
aws cognito-idp initiate-auth \
  --client-id $USER_POOL_CLIENT_ID \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=$TEST_EMAIL,PASSWORD='TestPass123!' \
  --region $AWS_REGION
```

Copy the `IdToken` from the output:

```bash
export JWT="eyJraWQi...your-id-token-here..."
```

### 3.4 Onboard the user + add a competitor

The onboard endpoint creates the user profile, adds an initial competitor, and **triggers an initial scrape automatically**:

```bash
curl -X POST "$API_URL/users/onboard" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Company",
    "industry": "saas",
    "competitors": [
      {
        "name": "Stripe",
        "url": "https://stripe.com",
        "pagesToTrack": ["pricing", "features", "homepage"]
      }
    ]
  }'
```

This kicks off the daily pipeline Step Function for the new competitor.

### 3.5 Watch the Step Function execute

```bash
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:076561717141:stateMachine:RivalScan-dev-Pipeline-DailyPipeline \
  --max-items 5 \
  --region $AWS_REGION
```

Pipeline stages:
1. `GetCompetitors` → 2. `ScrapePages` (Firecrawl) → 3. `StoreSnapshots` (S3) → 4. `DetectDiffs` → 5. `AnalyzeChange` (Claude Haiku) → 6. `StoreChange` → 7. `SendAlert`

Runtime: ~30-90 seconds for a single competitor with 3 pages.

### 3.6 Check for the alert email

**Important:** Alert emails only send when a change has **significance ≥ 7**. On a first scrape with no previous snapshot, the diff engine may skip alerting (nothing to diff against).

**If you don't receive an email after the first scrape**, trigger a second scrape to generate a real diff:

```bash
# Get your competitor ID first
curl "$API_URL/competitors" -H "Authorization: Bearer $JWT"

# Then trigger a re-scrape (replace COMPETITOR_ID)
curl -X POST "$API_URL/competitors/COMPETITOR_ID/scrape" \
  -H "Authorization: Bearer $JWT"
```

Wait 1-2 minutes, then check your inbox for a change alert email.

---

## Step 4 — Guaranteed Email Test (Manual Weekly Digest)

If you want a guaranteed email without waiting for a high-significance change, manually invoke the **Weekly Digest** Step Function. It emails every active subscriber with their aggregated changes from the past 7 days.

```bash
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:us-east-1:076561717141:stateMachine:RivalScan-dev-Pipeline-WeeklyDigest \
  --region $AWS_REGION
```

Watch it progress:

```bash
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:076561717141:stateMachine:RivalScan-dev-Pipeline-WeeklyDigest \
  --max-items 1 \
  --region $AWS_REGION
```

After it completes (~15-30 seconds), check your inbox for the weekly digest email.

> **Note:** This works as long as you have at least one user in the system. If no changes exist in the past 7 days, the digest will still send but with an empty/short summary.

---

## Troubleshooting

### No email received

1. **Check CloudWatch logs** for the specific Lambda:
   ```bash
   aws logs tail /aws/lambda/RivalScan-dev-Pipeline-SendAlert --follow --region $AWS_REGION
   aws logs tail /aws/lambda/RivalScan-dev-Pipeline-RenderSendEmail --follow --region $AWS_REGION
   ```

2. **Check SES sending statistics**:
   ```bash
   aws ses get-send-statistics --region $AWS_REGION
   ```

3. **Check spam folder** — first emails from a new SES identity often land there.

### `MessageRejected: Email address is not verified` error

Your account is in SES sandbox and the recipient isn't verified. Either:
- Use `FROM_EMAIL` as the recipient (it's verified)
- Verify the recipient in SES console
- Request production access

### Step Function fails at `ScrapePages`

Firecrawl API key in Secrets Manager may be wrong. Check:
```bash
aws secretsmanager get-secret-value \
  --secret-id rivalscan/api-keys \
  --query SecretString --output text --region $AWS_REGION | jq .FIRECRAWL_API_KEY
```

### Step Function fails at `AnalyzeChange`

Anthropic API key issue. Same check:
```bash
aws secretsmanager get-secret-value \
  --secret-id rivalscan/api-keys \
  --query SecretString --output text --region $AWS_REGION | jq .ANTHROPIC_API_KEY
```

### Cognito `UserNotConfirmedException`

You signed up but didn't confirm yet. Check email for the 6-digit code and run Step 3.2.

### Cognito `NotAuthorizedException`

Wrong password or user doesn't exist. Verify with:
```bash
aws cognito-idp admin-get-user \
  --user-pool-id $USER_POOL_ID \
  --username $TEST_EMAIL \
  --region $AWS_REGION
```
