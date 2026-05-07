#!/usr/bin/env bash
#
# Phase 10a — SOC 2 evidence-snapshot script.
#
# Collects AWS configuration state for the audit-readiness kit. Run before
# audits or quarterly during access review. Outputs a timestamped folder
# with JSON snapshots of IAM, CloudTrail, S3, DynamoDB, WAF, API Gateway,
# SES, and Secrets Manager state.
#
# Folder name pattern: evidence-YYYYMMDD-HHMMSS/. Gitignored — never commit.
#
# Required AWS CLI permissions (read-only):
#   sts:GetCallerIdentity
#   iam:Get/ListAccountSummary, iam:ListUsers, iam:ListAccountAliases,
#     iam:GenerateCredentialReport, iam:GetCredentialReport,
#     iam:GetAccountPasswordPolicy
#   cloudtrail:DescribeTrails, cloudtrail:GetTrailStatus
#   s3:ListAllMyBuckets, s3:GetBucketPublicAccessBlock,
#     s3:GetEncryptionConfiguration
#   wafv2:ListWebACLs
#   apigatewayv2:GetApis
#   dynamodb:ListTables, dynamodb:DescribeTable,
#     dynamodb:DescribeContinuousBackups
#   ses:GetSendStatistics
#   secretsmanager:ListSecrets
#
# The owner's existing AWS credentials cover all of these. If a future ops
# contractor runs this, give them a dedicated read-only IAM user.

set -euo pipefail

# Some environments set AWS_DEFAULT_OUTPUT to an invalid value (e.g. uppercase
# JSON, which AWS CLI rejects). Force the canonical lowercase + disable the
# pager so every command behaves consistently in non-interactive shells.
export AWS_DEFAULT_OUTPUT=json
export AWS_PAGER=""

STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="evidence-${STAMP}"
mkdir -p "$OUT"

echo "Collecting evidence to $OUT/ ..."

# ─── Account identity ────────────────────────────────────────────────────
aws sts get-caller-identity > "$OUT/account-identity.json"

# ─── IAM posture ─────────────────────────────────────────────────────────
aws iam get-account-summary > "$OUT/iam-account-summary.json"
aws iam list-users > "$OUT/iam-users.json"
aws iam list-account-aliases > "$OUT/iam-account-aliases.json"
aws iam get-account-password-policy > "$OUT/iam-password-policy.json" 2>/dev/null \
  || echo '{"note":"no custom password policy"}' > "$OUT/iam-password-policy.json"

# Credential report — requires generation pass first if not already cached.
aws iam generate-credential-report > /dev/null 2>&1 || true
aws iam get-credential-report --query Content --output text \
  | base64 -d > "$OUT/iam-credential-report.csv" 2>/dev/null \
  || echo "(credential report not yet ready — re-run script)" > "$OUT/iam-credential-report.csv"

# ─── CloudTrail (Phase 9b multi-region trail) ────────────────────────────
aws cloudtrail describe-trails > "$OUT/cloudtrail-trails.json"
TRAIL_NAME=$(aws cloudtrail describe-trails \
  --query 'trailList[?IsMultiRegionTrail==`true`].Name | [0]' \
  --output text 2>/dev/null || echo "")
if [[ -n "$TRAIL_NAME" && "$TRAIL_NAME" != "None" ]]; then
  aws cloudtrail get-trail-status --name "$TRAIL_NAME" \
    > "$OUT/cloudtrail-status.json"
else
  echo '{"note":"no multi-region trail found"}' > "$OUT/cloudtrail-status.json"
fi

# ─── S3 bucket configurations ────────────────────────────────────────────
mkdir -p "$OUT/s3"
for BUCKET in $(aws s3api list-buckets --query 'Buckets[].Name' --output text); do
  BUCKET_OUT="$OUT/s3/${BUCKET}.json"
  echo "{" > "$BUCKET_OUT"
  echo "  \"bucket\": \"$BUCKET\"," >> "$BUCKET_OUT"
  echo "  \"publicAccessBlock\":" >> "$BUCKET_OUT"
  aws s3api get-public-access-block --bucket "$BUCKET" \
    >> "$BUCKET_OUT" 2>/dev/null \
    || echo '    null' >> "$BUCKET_OUT"
  echo "  ," >> "$BUCKET_OUT"
  echo "  \"encryption\":" >> "$BUCKET_OUT"
  aws s3api get-bucket-encryption --bucket "$BUCKET" \
    >> "$BUCKET_OUT" 2>/dev/null \
    || echo '    null' >> "$BUCKET_OUT"
  echo "}" >> "$BUCKET_OUT"
done

# ─── WAF + API Gateway (Phase 9a) ────────────────────────────────────────
aws wafv2 list-web-acls --scope REGIONAL > "$OUT/waf-web-acls-regional.json" 2>/dev/null \
  || echo '{"note":"failed or no WAF"}' > "$OUT/waf-web-acls-regional.json"
aws apigatewayv2 get-apis > "$OUT/apigateway-apis.json"

# ─── DynamoDB tables (encryption + PITR) ─────────────────────────────────
mkdir -p "$OUT/dynamodb"
for TABLE in $(aws dynamodb list-tables --query 'TableNames[]' --output text); do
  aws dynamodb describe-table --table-name "$TABLE" \
    --query 'Table.{Name:TableName,SSE:SSEDescription,Stream:StreamSpecification,BillingMode:BillingModeSummary}' \
    > "$OUT/dynamodb/${TABLE}-config.json"
  aws dynamodb describe-continuous-backups --table-name "$TABLE" \
    > "$OUT/dynamodb/${TABLE}-pitr.json" 2>/dev/null \
    || echo '{"note":"PITR query failed"}' > "$OUT/dynamodb/${TABLE}-pitr.json"
done

# ─── SES sending stats + bounce/complaint rates ──────────────────────────
aws ses get-send-statistics > "$OUT/ses-send-stats.json" 2>/dev/null \
  || echo '{"note":"SES stats query failed (region might not have SES enabled)"}' \
  > "$OUT/ses-send-stats.json"

# ─── Secrets Manager — names + last-rotated only, NEVER values ───────────
aws secretsmanager list-secrets \
  --query 'SecretList[].{Name:Name,ARN:ARN,LastRotated:LastRotatedDate,LastChanged:LastChangedDate}' \
  > "$OUT/secrets-inventory.json"

echo ""
echo "✓ Evidence collected in: $OUT/"
echo "  Files: $(find "$OUT" -type f | wc -l | tr -d ' ')"
echo ""
echo "NEXT STEPS:"
echo "  1. Add this folder to your private audit document repository."
echo "  2. DO NOT commit to git — the .gitignore covers 'evidence-*/' but"
echo "     double-check before any 'git add -A'."
echo "  3. Update ACCESS_REVIEW_RUNBOOK.md audit log with the snapshot date."
