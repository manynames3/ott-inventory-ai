# Terraform: Low-Idle AWS MVP

This directory provisions the low-idle-cost hosted MVP infrastructure with Terraform. It intentionally does not use CloudFormation.

Target monthly profile: near-zero idle cost and ideally under $10/month for light MVP usage.

## What It Creates

- Private S3 bucket for raw Excel/CSV uploads.
- DynamoDB on-demand tables for canonical records, materialized query views, and import status.
- Lambda Function URL API for low-idle HTTP access.
- Optional Cognito User Pool + HTTP API Gateway JWT authorizer for SSO-ready pilot access.
- S3-triggered Lambda import worker.
- Optional scheduled S3 landing-prefix import scanner for ERP exports or SFTP-bridged drops.
- Optional AWS Transfer Family managed SFTP server, disabled by default because it has fixed idle cost.
- Optional immutable S3 audit archive with Object Lock.
- Optional SNS email alerts for API/import/AI/slow-job failures.
- Optional EventBridge Scheduler refresh worker.
- Optional AWS Budget at the configured monthly threshold.
- IAM roles and least-privilege policies for the above.

The included Lambda handlers are intentionally lightweight and stdlib-first. They now cover the hosted MVP flow:

- Login through SSM-backed credentials, or Cognito Hosted UI when `enable_cognito_auth=true`.
- CSV and Excel template downloads.
- Authenticated presigned S3 uploads.
- S3-triggered and scheduled CSV/XLSX validation and import.
- DynamoDB-backed dashboard, product, customer, SKU detail, FEFO, waste-risk, reorder, and natural-language query reads.
- Import status polling so validation errors are visible after direct-to-S3 upload.
- Query answers with source citations that point back to the safe materialized view and sample row identifiers.
- Forecast validation backtest endpoint for buyer data accuracy checks.
- Action-review-backed weekly ROI report data.

The Lambda Function URL is public by design because application auth happens inside the API handler. For stronger buyer pilots, enable Cognito auth and use the `api_gateway_url` output as `NEXT_PUBLIC_API_BASE_URL`; API Gateway validates Cognito JWTs before the Lambda runs.

## Why Terraform

Terraform gives this project explicit, reviewable infrastructure without locking the app into CloudFormation templates. It also keeps the cost posture visible in code: no ECS Fargate, App Runner, RDS, Aurora, ALB, or NAT Gateway for the first hosted MVP.

## Setup

Install Terraform and configure AWS credentials with permission to create S3, DynamoDB, Lambda, IAM, EventBridge Scheduler, and Budgets resources.

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

- Set `budget_email`.
- Confirm `allowed_origins`.
- Optionally set a globally unique `raw_import_bucket_name`.
- Keep real auth secret values out of Terraform variables.

Do not commit `terraform.tfvars`. It is ignored by git.

## Auth Parameters

Create the SSM parameters before sharing the frontend with a pilot user:

```bash
aws ssm put-parameter \
  --name /inventory-ai/mvp/auth/username \
  --type String \
  --value "pilot@stocksense.local" \
  --overwrite

aws ssm put-parameter \
  --name /inventory-ai/mvp/auth/password \
  --type SecureString \
  --value "<generate-a-strong-password>" \
  --overwrite

aws ssm put-parameter \
  --name /inventory-ai/mvp/auth/secret-key \
  --type SecureString \
  --value "$(openssl rand -hex 32)" \
  --overwrite
```

Only the parameter names belong in Terraform variables. The secret values should stay in SSM.

To enable the OpenAI-backed AI query layer, store the OpenAI key in SSM as a SecureString:

```bash
aws ssm put-parameter \
  --name /inventory-ai/mvp/openai/api-key \
  --type SecureString \
  --value "<openai-api-key>" \
  --overwrite
```

The API Lambda automatically falls back to safe rule-based query responses when this parameter is missing, disabled, or unavailable.

## Plan And Apply

```bash
terraform init -backend-config=backend.hcl
terraform fmt -recursive
terraform validate
terraform plan
terraform apply
```

Use [backend.hcl.example](backend.hcl.example) as the remote-state template. See [../../docs/terraform_state_and_apply.md](../../docs/terraform_state_and_apply.md) before applying to an existing live stack.

After apply, copy these outputs into Cloudflare Pages:

```text
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_AUTH_MODE=cognito
NEXT_PUBLIC_API_BASE_URL=<api_gateway_url>
NEXT_PUBLIC_COGNITO_DOMAIN=<cognito_domain>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<cognito_user_pool_client_id>
NEXT_PUBLIC_COGNITO_REDIRECT_URI=https://otokistocksense.pages.dev/login
NEXT_PUBLIC_COGNITO_LOGOUT_URI=https://otokistocksense.pages.dev/login
```

Do not append `/prod` to `api_gateway_url`; the HTTP API uses the `$default` stage.

Add users in Cognito and assign them to one of the groups Terraform creates: `viewer`, `planner`, `approver`, or `admin`.

For API smoke tests without going through the browser Hosted UI, the Cognito app client also permits `USER_PASSWORD_AUTH`. Use this only for controlled pilot testing and rotate test passwords after the demo.

Then upload the demo CSV files from `sample_data/ottogi_demo/` in this order: products, customers, orders, inventory lots, inbound shipments. Each upload writes the raw file to S3, imports normalized rows into DynamoDB, and refreshes materialized insight views.

## Scheduled S3/SFTP Imports

The low-cost path is scheduled S3 scanning, not AWS Transfer Family. Native AWS Transfer Family SFTP has a meaningful fixed monthly cost, so it is intentionally not created by default.

Use one of these patterns:

- ERP/SAP/Oracle scheduled export writes directly to S3 under `inventory-ai/raw-imports/scheduled/<entity>/`.
- A buyer-owned SFTP server, SFTP gateway, or lightweight bridge lands files into S3 under `inventory-ai/raw-imports/sftp/<entity>/`.
- Direct app uploads continue to use the existing presigned S3 upload flow.

When `enable_scheduled_import_scan=true`, EventBridge invokes the import worker on `scheduled_import_schedule_expression`. The worker scans `scheduled_import_prefixes`, imports supported `.csv`, `.xlsx`, and `.xlsm` files, skips already imported keys, records import history, refreshes materialized views, and writes audit events.

Set `enable_managed_sftp=true` only when a buyer explicitly needs native SFTP. Terraform then creates an AWS Transfer Family server and service-managed user scoped to the `inventory-ai/raw-imports/sftp/` S3 prefix.

## Retention And SIEM

This Terraform stack no longer creates AWS WAF resources. Legacy WAF input variables are retained only so older tfvars files continue to parse while existing managed WAF resources are destroyed by the next apply. If a buyer later requires WAF in front of API requests, add CloudFront in front of the HTTP API or switch this path to REST API Gateway.

Runtime retention metadata is exposed through `/api/import/requirements`:

- Raw uploads: `raw_file_retention_days`
- Import status: 90 days
- App audit events: 180 days
- Immutable archive: `audit_archive_retention_days`

The default SIEM path is immutable S3 audit export. Direct HTTP forwarding is intentionally not enabled without a buyer-approved endpoint, auth method, retry policy, and payload schema.

## Immutable Audit And Alerts

Set `enable_immutable_audit_archive=true` to create a separate S3 bucket with Object Lock default retention. API and worker audit events are still written to DynamoDB for the app UI, and are also mirrored as append-only JSON into the archive bucket.

Set `alert_email` to create an SNS topic and email subscription for operational alerts. The API and worker publish alerts for API errors, import failures, slow requests/jobs, and failed AI calls. The recipient must confirm the SNS subscription email before alerts are delivered.

## Cost Controls

The defaults are intentionally conservative:

- DynamoDB uses `PAY_PER_REQUEST`.
- Lambda functions can use reserved concurrency caps when the AWS account quota supports them. The default is `-1` because small/new accounts may reject reservations that reduce unreserved concurrency below AWS's minimum.
- Scheduled refresh is disabled by default.
- Raw file lifecycle expiration defaults to 365 days.
- AWS Budget is enabled when `budget_email` is provided.

Set AWS Budget alerts before sharing the app with a buyer.

## Secrets

Terraform state can expose values stored in variables. Do not place real passwords or signing keys in `terraform.tfvars`.

Preferred MVP path:

1. Store auth values in SSM Parameter Store or set them manually on Lambda after deployment.
2. Pass only SSM parameter names through Terraform.
3. Let Lambda read the parameters at runtime.

## Cleanup

```bash
terraform destroy
```

If the raw import bucket contains files, empty the bucket before destroying.
