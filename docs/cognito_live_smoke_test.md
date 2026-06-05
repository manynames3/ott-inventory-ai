# Cognito Live Smoke Test

Use this after Terraform applies the Cognito/API Gateway path.

## Preconditions

- `enable_cognito_auth=true`
- Cloudflare Pages is configured with:
  - `NEXT_PUBLIC_AUTH_MODE=cognito`
  - `NEXT_PUBLIC_API_BASE_URL=<api_gateway_url>`
  - `NEXT_PUBLIC_COGNITO_DOMAIN=<cognito_domain>`
  - `NEXT_PUBLIC_COGNITO_CLIENT_ID=<cognito_user_pool_client_id>`
  - `NEXT_PUBLIC_COGNITO_REDIRECT_URI=https://otokistocksense.pages.dev/login`
  - `NEXT_PUBLIC_COGNITO_LOGOUT_URI=https://otokistocksense.pages.dev/login`
- Cognito users exist for planner, approver, and optionally admin.

## Test Users

Use buyer-safe pilot identities such as:

- `planner@otokistocksense.demo` in group `planner`
- `ops-manager@otokistocksense.demo` in group `approver`
- `admin@otokistocksense.demo` in group `admin`

Share passwords only through a password manager or one-time secure handoff. Do not commit pilot credentials.

## CLI Smoke Test

Get Terraform outputs:

```bash
cd infra/terraform
USER_POOL_ID="$(terraform output -raw cognito_user_pool_id)"
CLIENT_ID="$(terraform output -raw cognito_user_pool_client_id)"
API_URL="$(terraform output -raw api_gateway_url)"
```

Fetch an access token:

```bash
TOKEN="$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$CLIENT_ID" \
  --auth-parameters USERNAME=planner@otokistocksense.demo,PASSWORD="$PLANNER_PASSWORD" \
  --query 'AuthenticationResult.IdToken' \
  --output text)"
```

Confirm identity:

```bash
curl -sS -H "Authorization: Bearer $TOKEN" "$API_URL/api/auth/me"
```

Expected planner result:

```json
{"user":{"username":"planner@otokistocksense.demo","tenant_id":"default","role":"planner","can_approve_actions":false}}
```

Confirm approver authorization by repeating the token step with `ops-manager@otokistocksense.demo` and checking `can_approve_actions: true`.

## Browser Smoke Test

1. Open `https://otokistocksense.pages.dev/login`.
2. Choose Cognito sign-in.
3. Sign in as planner.
4. Confirm Dashboard, Query, Imports, Actions, Validation, Reports, Audit, Status, and Security load without `Backend API is not reachable`.
5. Attempt to approve an action as planner; it should be blocked.
6. Sign out and sign in as approver.
7. Approve an action and confirm the Weekly ROI Report reflects it.

## Common Failures

- `401` from API Gateway: token audience or issuer does not match Terraform outputs.
- CORS error: Pages origin is missing from `allowed_origins`.
- Token exchange failure: Cognito callback/logout URLs do not include the Pages login URL.
- Planner can approve: user is in `approver` or `admin` group, or group claim mapping is wrong.
