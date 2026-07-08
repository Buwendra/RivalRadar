#!/usr/bin/env bash
# Generate battlecards for ChatGPT + Claude by invoking the
# CompetitorBattlecard Lambda directly with a synthetic API Gateway v2 event
# carrying the user's Cognito email claim.
#
# Run AFTER the research pipeline has refreshed both competitors so the
# battlecard uses fresh research findings.

set -e

REGION=us-east-1
FN_NAME=Kironyx-dev-Api-CompetitorBattlecard
EMAIL=buwendra.s@gmail.com

# ChatGPT + Claude competitor IDs for buwendra.s@gmail.com
declare -a COMPS=(
  "01KPWYDHP8770M9KXDGZ0WBP81:ChatGPT"
  "01KPWYDHRNFAT1KY8H7S46VKWS:Claude"
)

mkdir -p ./.rs-battlecards

for entry in "${COMPS[@]}"; do
  ID="${entry%%:*}"
  NAME="${entry##*:}"

  EVENT=$(cat <<EOF
{
  "version": "2.0",
  "routeKey": "POST /competitors/{id}/battlecard",
  "rawPath": "/competitors/$ID/battlecard",
  "headers": { "content-type": "application/json", "user-agent": "seed-battlecards" },
  "requestContext": {
    "http": { "method": "POST", "path": "/competitors/$ID/battlecard", "sourceIp": "127.0.0.1", "userAgent": "seed-battlecards" },
    "authorizer": { "jwt": { "claims": { "email": "$EMAIL", "sub": "14a8d488-3031-7067-dd5b-fd12d01fdf9e" } } }
  },
  "pathParameters": { "id": "$ID" },
  "isBase64Encoded": false
}
EOF
)

  PAYLOAD_FILE="./.rs-battlecards/$NAME.event.json"
  OUT_FILE="./.rs-battlecards/$NAME.out.json"
  echo "$EVENT" > "$PAYLOAD_FILE"

  echo "── Invoking battlecard for $NAME ($ID) ──"
  aws lambda invoke \
    --function-name "$FN_NAME" \
    --region "$REGION" \
    --cli-binary-format raw-in-base64-out \
    --payload "file://$PAYLOAD_FILE" \
    "$OUT_FILE" \
    --output json

  echo "── Response for $NAME ──"
  cat "$OUT_FILE"
  echo
done
