# RivalScan Deployment Guide

Step-by-step guide to deploy the RivalScan backend (AWS CDK) and frontend (Vercel).

---

## 1. Prerequisites

Install these tools before proceeding:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| npm | 10+ | Bundled with Node.js |
| AWS CLI | v2 | [AWS CLI install guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| AWS CDK CLI | 2.240+ | `npm install -g aws-cdk` |
| Git | any | [git-scm.com](https://git-scm.com) |

**Accounts required:**

- **AWS** account with admin access
- **Paddle** account (payments) — [paddle.com](https://www.paddle.com)
- **Firecrawl** account (web scraping) — [firecrawl.dev](https://www.firecrawl.dev)
- **Anthropic** account (AI analysis) — [console.anthropic.com](https://console.anthropic.com)
- **Vercel** account (frontend hosting) — [vercel.com](https://vercel.com)

**Configure AWS CLI:**

```bash
aws configure
# Enter your Access Key ID, Secret Access Key, region (us-east-1), and output format (json)
```

---

## 2. External Service Setup

### 2.1 Anthropic (Claude API)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Navigate to **API Keys**
3. Create a new API key
4. Save the key — you'll add it to AWS Secrets Manager in Step 3

### 2.2 Firecrawl (Web Scraping)

1. Go to [firecrawl.dev](https://www.firecrawl.dev)
2. Sign up and select a plan (Hobby tier at $16/mo covers ~1,500 scrapes/month)
3. Copy your API key from the dashboard
4. Save the key — you'll add it to AWS Secrets Manager in Step 3

### 2.3 Paddle (Payments)

1. Sign in to [Paddle Dashboard](https://vendors.paddle.com)
2. Create three products for the pricing tiers:

   | Product | Price |
   |---------|-------|
   | Scout | $49/month |
   | Strategist | $99/month |
   | Command | $199/month |

3. For each product, create a recurring monthly price. Note the **Price ID** for each (format: `pri_xxxxxxxxxxxxxxxxxxxx`)
4. Go to **Developer > Authentication** and copy your **API Key**
5. Go to **Developer > Notifications** and create a webhook endpoint (you'll set the URL after backend deployment). Copy the **Webhook Secret**
6. Save the API key and webhook secret — you'll add them to AWS Secrets Manager in Step 3

---

## 3. AWS Secrets Manager Setup

Store all external API keys in a single secret named `rivalscan/api-keys`.

**Via AWS CLI:**

```bash
aws secretsmanager create-secret \
  --name rivalscan/api-keys \
  --region us-east-1 \
  --secret-string '{
    "PADDLE_SECRET_KEY": "your-paddle-api-key",
    "PADDLE_WEBHOOK_SECRET": "your-paddle-webhook-secret",
    "FIRECRAWL_API_KEY": "your-firecrawl-api-key",
    "ANTHROPIC_API_KEY": "your-anthropic-api-key"
  }'
```

**Via AWS Console:**

1. Open [Secrets Manager](https://console.aws.amazon.com/secretsmanager) in your target region
2. Click **Store a new secret**
3. Select **Other type of secret**
4. Add 4 key/value pairs:
   - `PADDLE_SECRET_KEY`
   - `PADDLE_WEBHOOK_SECRET`
   - `FIRECRAWL_API_KEY`
   - `ANTHROPIC_API_KEY`
5. Name the secret `rivalscan/api-keys`
6. Complete the wizard with defaults

---

## 4. AWS SES Setup

SES is used to send change alerts and weekly digest emails.

1. Open [Amazon SES Console](https://console.aws.amazon.com/ses) in your target region
2. Go to **Verified Identities** > **Create identity**
3. Choose one:
   - **Domain** (recommended for production) — verify your domain via DNS records
   - **Email address** (quick for dev) — verify a single sender email
4. The verified email/domain must match the `FROM_EMAIL` env var you'll set in Step 5

**Production access:** By default, SES is in sandbox mode (can only send to verified emails). To send to real users:

1. Go to **Account dashboard** in SES console
2. Click **Request production access**
3. Fill out the request form — approval typically takes 24 hours

---

## 5. Backend Deployment

### 5.1 Install Dependencies

```bash
cd Backend
npm install
```

### 5.2 Set Environment Variables

```bash
# Required — AWS account ID
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

# Required — AWS region
export CDK_DEFAULT_REGION=us-east-1

# Required — your frontend URL (used for CORS and email links)
# Use http://localhost:3000 for initial deploy, update later with your Vercel URL
export FRONTEND_URL=http://localhost:3000

# Required — verified SES sender email
export FROM_EMAIL=noreply@yourdomain.com

# Required — Paddle price IDs from Step 2.3
export PADDLE_PRICE_SCOUT=pri_xxxxxxxxxxxxxxxxxxxx
export PADDLE_PRICE_STRATEGIST=pri_xxxxxxxxxxxxxxxxxxxx
export PADDLE_PRICE_COMMAND=pri_xxxxxxxxxxxxxxxxxxxx
```

> **Tip:** Copy `Backend/.env.example` to `Backend/.env` and fill in your values, then `source .env` (or use [direnv](https://direnv.net/)).

### 5.3 Bootstrap CDK (First Time Only)

CDK bootstrap provisions an S3 bucket and IAM roles in your account for deployments:

```bash
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$CDK_DEFAULT_REGION
```

### 5.4 Validate Templates

```bash
npx cdk synth
```

This generates CloudFormation templates for all 7 stacks. Fix any errors before proceeding.

### 5.5 Deploy

```bash
npx cdk deploy --all --require-approval broadening
```

CDK deploys stacks in dependency order:
1. `RivalScan-dev-Database` — DynamoDB table
2. `RivalScan-dev-Storage` — S3 snapshot bucket
3. `RivalScan-dev-Auth` — Cognito User Pool
4. `RivalScan-dev-Email` — SES (placeholder)
5. `RivalScan-dev-Pipeline` — Step Functions + EventBridge schedules
6. `RivalScan-dev-Api` — API Gateway + all Lambda functions
7. `RivalScan-dev-Monitoring` — CloudWatch dashboard + alarms

### 5.6 Note the Outputs

After deployment, CDK prints stack outputs. Save these values:

```
RivalScan-dev-Api.ApiUrl = https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com
RivalScan-dev-Auth.UserPoolId = us-east-1_XXXXXXXXX
RivalScan-dev-Auth.UserPoolClientId = xxxxxxxxxxxxxxxxxxxxxxxxxx
RivalScan-dev-Database.TableName = RivalScan-dev-Database-Table
RivalScan-dev-Storage.BucketName = rivalscan-dev-storage-snapshots
```

The **ApiUrl** is needed for frontend deployment in the next step.

### 5.7 Deploy to a Different Stage

By default the stage is `dev`. To deploy `staging` or `prod`:

```bash
npx cdk deploy --all -c stage=prod
```

This creates a separate set of resources prefixed with `RivalScan-prod-*`.

---

## 6. Frontend Deployment (Vercel)

### 6.1 Install Dependencies

```bash
cd Frontend
npm install
```

### 6.2 Deploy to Vercel

**Option A — Via Vercel CLI:**

```bash
npm install -g vercel
vercel login
vercel
```

Follow the prompts to link your project. When asked about settings, accept the Next.js defaults.

**Option B — Via Vercel Dashboard:**

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Set the **Root Directory** to `Frontend`
4. Framework preset will auto-detect as **Next.js**

### 6.3 Set Environment Variables

In Vercel project settings (**Settings > Environment Variables**), add:

| Variable | Value | Example |
|----------|-------|---------|
| `NEXT_PUBLIC_API_URL` | API Gateway URL from Step 5.6 | `https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com` |
| `NEXT_PUBLIC_APP_NAME` | Your app name | `RivalScan` |
| `NEXT_PUBLIC_APP_URL` | Your production domain | `https://rivalscan.com` |

### 6.4 Redeploy After Setting Variables

```bash
vercel --prod
```

Or trigger a redeploy from the Vercel dashboard.

### 6.5 Note the Production URL

Save your Vercel production URL (e.g., `https://rivalscan.vercel.app` or your custom domain).

---

## 7. Post-Deployment Wiring

### 7.1 Update Backend CORS with Frontend URL

Now that you have your Vercel production URL, update the backend:

```bash
cd Backend
export FRONTEND_URL=https://your-vercel-url.vercel.app
npx cdk deploy RivalScan-dev-Api
```

This redeploys only the API stack with the correct CORS origin.

### 7.2 Configure Paddle Webhook

1. Go to Paddle Dashboard > **Developer > Notifications**
2. Set the webhook URL to:
   ```
   https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/webhooks/paddle
   ```
   (replace with your actual API Gateway URL from Step 5.6)
3. Subscribe to these events:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
   - `subscription.past_due`

### 7.3 Custom Domain (Optional)

**Frontend (Vercel):**
1. In Vercel project settings > **Domains**, add your domain
2. Update DNS records as instructed by Vercel

**Backend (API Gateway):**
1. In AWS Console > API Gateway > Custom Domain Names
2. Create a domain mapping (requires an ACM certificate in the API region)
3. Point your DNS subdomain (e.g., `api.rivalscan.com`) to the API Gateway domain

If you set up a custom API domain, update `NEXT_PUBLIC_API_URL` in Vercel accordingly.

---

## 8. Verification Checklist

After deployment, walk through these steps to confirm everything works:

### 8.1 Backend Health

- [ ] Open the API URL in a browser — you should get a CORS error or empty response (not a 500)
- [ ] Check CloudWatch Logs for the Lambda functions (no startup errors)
- [ ] Open the CloudWatch dashboard (`RivalScan-dev-Dashboard`) — widgets should render

### 8.2 User Flow

- [ ] Open the frontend URL in a browser
- [ ] Sign up a new user account
- [ ] Complete the onboarding wizard (add a competitor URL)
- [ ] Verify the competitor appears on the dashboard
- [ ] Trigger a manual scrape from the competitor detail page
- [ ] Wait for the scrape to complete — check for detected changes

### 8.3 Pipeline

- [ ] Check Step Functions console — verify the Daily Pipeline execution started (or manually trigger via competitor scrape)
- [ ] Check S3 bucket — snapshots should appear after a scrape
- [ ] Check DynamoDB — change records should appear after AI analysis

### 8.4 Payments

- [ ] Use Paddle's sandbox/test mode to simulate a checkout
- [ ] Verify the webhook is received (check Lambda logs for the Paddle webhook handler)
- [ ] Confirm subscription status updates in DynamoDB

### 8.5 Email

- [ ] Trigger a high-significance change (score >= 7) and verify the alert email arrives
- [ ] If in SES sandbox, the recipient email must be verified in SES first

---

## 9. Useful Commands Reference

### Backend

```bash
cd Backend

# Deploy a single stack
npx cdk deploy RivalScan-dev-Api

# Preview changes before deploying
npx cdk diff

# View recent Lambda logs (requires stack name + function logical ID)
aws logs tail /aws/lambda/RivalScan-dev-Api-AuthSignup --follow

# Type-check without deploying
npx tsc --noEmit

# Run tests
npx vitest run

# Run a single test file
npx vitest run src/path/to/file.test.ts

# Destroy all stacks (CAUTION: deletes all resources except DynamoDB table which has RETAIN policy)
npx cdk destroy --all
```

### Frontend

```bash
cd Frontend

# Local development (connects to API via NEXT_PUBLIC_API_URL)
npm run dev

# Production build (standalone output)
npm run build

# Lint
npm run lint

# Deploy to Vercel
vercel --prod
```

### Secrets Manager

```bash
# View current secret value
aws secretsmanager get-secret-value --secret-id rivalscan/api-keys --query SecretString --output text | jq .

# Update a single key
aws secretsmanager put-secret-value --secret-id rivalscan/api-keys \
  --secret-string "$(aws secretsmanager get-secret-value --secret-id rivalscan/api-keys \
  --query SecretString --output text | jq '.FIRECRAWL_API_KEY = "new-key-here"')"
```

> **Note:** Lambda functions cache secrets for 5 minutes. After updating a secret, wait up to 5 minutes or redeploy the affected Lambda functions for immediate effect.
