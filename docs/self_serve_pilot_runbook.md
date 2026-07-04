# Self-Serve Pilot Runbook

This runbook is the operator checklist for launching a low-traffic buyer pilot without console-by-console handholding.

## 1. Provision Infrastructure

1. Create or confirm the Terraform S3 backend from [terraform_state_and_apply.md](terraform_state_and_apply.md).
2. Set `tenant_id`, `allowed_origins`, Cognito callback/logout URLs, and optional alert/archive settings in `terraform.tfvars`.
3. Run:

```bash
cd infra/terraform
terraform init -backend-config=backend.hcl
terraform plan -out=tfplan
terraform apply tfplan
```

4. Save these outputs for the frontend:

- `api_gateway_url`
- `cognito_domain`
- `cognito_user_pool_client_id`

## 2. Configure Frontend Deployment

Set GitHub repository variables:

```text
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_AUTH_MODE=cognito
NEXT_PUBLIC_API_BASE_URL=<api_gateway_url>
NEXT_PUBLIC_COGNITO_DOMAIN=<cognito_domain>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<cognito_user_pool_client_id>
NEXT_PUBLIC_COGNITO_REDIRECT_URI=https://otokistocksense.pages.dev/login
NEXT_PUBLIC_COGNITO_LOGOUT_URI=https://otokistocksense.pages.dev/login
```

Use the raw `api_gateway_url` output. Do not append `/prod`; this HTTP API uses the `$default` stage.

Set GitHub repository secrets for automated Cloudflare Pages deploys:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Pushes to `main` that touch `frontend/**` run the Pages deployment workflow. Manual deploys use the same workflow with `workflow_dispatch`.

## 3. Create The First Admin

Create the initial admin from AWS CLI once:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <cognito_user_pool_id> \
  --region us-west-2 \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true

aws cognito-idp admin-add-user-to-group \
  --user-pool-id <cognito_user_pool_id> \
  --region us-west-2 \
  --username admin@example.com \
  --group-name admin
```

After that, admins can manage pilot users from `/users` in the app.

For the hosted demo environment, the active admin login is:

- Username: `admin@otokistocksense.demo`
- Password source: SSM SecureString `/inventory-ai/mvp/auth/password`

Retrieve or rotate the password through AWS/SSM or a password manager only. Do not paste it into source control, tickets, or chat.

The public demo login is intentionally different from the admin account. The `/login` screen pre-fills a planner-only user:

- Username: `demo@otokistocksense.demo`
- Password source: public frontend fallback or `NEXT_PUBLIC_DEMO_LOGIN_PASSWORD`
- Cognito group: `planner`

Keep this user non-admin. Rotate or disable it before any buyer-specific environment that should not allow anonymous evaluation.

To rotate the managed demo admin password:

```bash
NEW_PASSWORD="$(python3 - <<'PY'
import secrets
import string

alphabet = string.ascii_letters + string.digits
while True:
    value = "".join(secrets.choice(alphabet) for _ in range(24))
    if any(c.islower() for c in value) and any(c.isupper() for c in value) and any(c.isdigit() for c in value):
        print(value)
        break
PY
)"

aws ssm put-parameter \
  --name /inventory-ai/mvp/auth/password \
  --type SecureString \
  --value "$NEW_PASSWORD" \
  --overwrite \
  --region us-west-2

aws cognito-idp admin-set-user-password \
  --user-pool-id <cognito_user_pool_id> \
  --region us-west-2 \
  --username admin@otokistocksense.demo \
  --password "$NEW_PASSWORD" \
  --permanent
```

## 4. Invite Pilot Users

1. Sign in as an admin.
2. Open `/admin`.
3. Set tenant profile, lifecycle stage, billing status, and enterprise SSO status.
4. Open `/users`.
5. Invite buyer users with the lowest needed role:
   - `viewer`: read-only dashboards and reports
   - `planner`: notes and dismiss/reopen
   - `approver`: approve actions
   - `admin`: user management and all approval controls

## 5. Enterprise SSO

The live pilot uses Cognito Hosted UI. For buyer SAML, set these Terraform variables and apply:

```hcl
cognito_saml_provider_name = "BuyerSAML"
cognito_saml_metadata_url  = "https://idp.example.com/metadata"
```

Then set `/admin` SSO status to `saml_configured`.

## 6. Load Buyer Data

1. Open `/onboarding` to confirm required files.
2. Open `/imports`.
3. Upload products, inventory lots, customers, orders, and inbound shipments.
4. Use preview mapping before committing each file.
5. Confirm `/status` shows import storage, query store, auth, and monitoring online.

## 7. Verify The Deployment

Run local checks:

```bash
make verify
```

Run the live smoke test with a real Cognito user:

```bash
API_BASE_URL=<api_gateway_url> \
COGNITO_CLIENT_ID=<cognito_user_pool_client_id> \
COGNITO_USERNAME=<admin_email> \
COGNITO_PASSWORD=<password> \
scripts/live_smoke_test.sh
```

Verify the live frontend bundle:

```bash
FRONTEND_URL=https://otokistocksense.pages.dev \
EXPECTED_API_BASE_URL=<api_gateway_url> \
EXPECTED_AUTH_MODE=cognito \
node scripts/verify_live_frontend.mjs
```

The current live UAT record is [user_acceptance_test_results_2026-07-04.md](user_acceptance_test_results_2026-07-04.md).
