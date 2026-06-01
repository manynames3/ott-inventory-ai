# Terraform: Low-Idle AWS MVP

This directory provisions the low-idle-cost hosted MVP infrastructure with Terraform. It intentionally does not use CloudFormation.

Target monthly profile: near-zero idle cost and ideally under $10/month for light MVP usage.

## What It Creates

- Private S3 bucket for raw Excel/CSV uploads.
- DynamoDB on-demand tables for canonical records, materialized query views, and import status.
- Lambda Function URL API for low-idle HTTP access.
- S3-triggered Lambda import worker.
- Optional EventBridge Scheduler refresh worker.
- Optional AWS Budget at the configured monthly threshold.
- IAM roles and least-privilege policies for the above.

The included Lambda handlers are placeholders. They prove the deploy shape and expose basic routes such as `/health`, `/api/import/requirements`, `/api/templates/{entity}.csv`, and `/api/uploads/presign`. The next implementation step is to port the existing FastAPI/Pandas import and recommendation logic into Lambda-friendly handlers or a shared Python package.

Do not share the Lambda Function URL with a buyer until the real auth path is wired into the Lambda API. The Terraform endpoint is public by design because application auth is expected to happen inside the API handler.

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

## Plan And Apply

```bash
terraform init
terraform fmt -recursive
terraform validate
terraform plan
terraform apply
```

After apply, copy the output `api_function_url` into Cloudflare Pages:

```text
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_API_BASE_URL=<api_function_url>
```

## Cost Controls

The defaults are intentionally conservative:

- DynamoDB uses `PAY_PER_REQUEST`.
- Lambda functions use reserved concurrency caps.
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
