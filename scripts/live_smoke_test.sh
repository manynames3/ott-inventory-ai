#!/usr/bin/env bash
set -euo pipefail

: "${API_BASE_URL:?Set API_BASE_URL, for example https://3eorxcthij.execute-api.us-west-2.amazonaws.com}"
: "${COGNITO_CLIENT_ID:?Set COGNITO_CLIENT_ID}"
: "${COGNITO_USERNAME:?Set COGNITO_USERNAME}"
: "${COGNITO_PASSWORD:?Set COGNITO_PASSWORD}"

AWS_REGION="${AWS_REGION:-us-west-2}"
FRONTEND_URL="${FRONTEND_URL:-https://otokistocksense.pages.dev}"

TOKEN="$(
  aws cognito-idp initiate-auth \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id "$COGNITO_CLIENT_ID" \
    --region "$AWS_REGION" \
    --auth-parameters "USERNAME=$COGNITO_USERNAME,PASSWORD=$COGNITO_PASSWORD" \
    --query 'AuthenticationResult.IdToken' \
    --output text
)"

curl -fsS -X OPTIONS "$API_BASE_URL/api/dashboard" \
  -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -o /dev/null

curl -fsS "$API_BASE_URL/api/auth/me" \
  -H "Origin: $FRONTEND_URL" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool >/dev/null

curl -fsS "$API_BASE_URL/api/dashboard" \
  -H "Origin: $FRONTEND_URL" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import json, sys; payload = json.load(sys.stdin); required = ["kpis", "recommendations", "fefo", "waste_risk_alerts"]; missing = [key for key in required if key not in payload]; print("Live smoke test passed.") if not missing else sys.exit("Missing dashboard keys: " + ", ".join(missing))'
