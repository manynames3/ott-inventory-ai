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

## 4. Invite Pilot Users

1. Sign in as an admin.
2. Open `/users`.
3. Invite buyer users with the lowest needed role:
   - `viewer`: read-only dashboards and reports
   - `planner`: notes and dismiss/reopen
   - `approver`: approve actions
   - `admin`: user management and all approval controls

## 5. Load Buyer Data

1. Open `/onboarding` to confirm required files.
2. Open `/imports`.
3. Upload products, inventory lots, customers, orders, and inbound shipments.
4. Use preview mapping before committing each file.
5. Confirm `/status` shows import storage, query store, auth, and monitoring online.

## 6. Verify The Deployment

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
