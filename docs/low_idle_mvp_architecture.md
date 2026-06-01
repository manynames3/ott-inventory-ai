# Low-Idle-Cost MVP Architecture

Target: keep idle infrastructure cost near zero and ideally under $10/month while still letting a buyer upload Excel files and ask fast natural-language inventory questions.

This document supersedes the earlier hosted-backend recommendation for the MVP. Always-on services such as ECS Fargate, App Runner, RDS, Aurora, ALB, and NAT Gateway are deferred until a paid pilot justifies them.

## MVP Cost Principle

Use services that charge primarily by request, storage, or invocation. Avoid anything with a meaningful hourly minimum.

The public demo and first buyer evaluation should assume intermittent traffic:

- A few users.
- Occasional Excel/CSV uploads.
- Small to medium operational datasets.
- Bursty dashboard and natural-language query usage.
- No need for always-on containers or relational database instances.

## Recommended Low-Idle Stack

| Need | MVP Service | Why |
| --- | --- | --- |
| Public frontend | Cloudflare Pages static export | Static asset hosting with no backend server to idle. |
| API endpoint | AWS Lambda Function URL | No additional endpoint charge beyond Lambda invocation and duration; simpler than API Gateway for an MVP. |
| Raw Excel/CSV storage | Amazon S3 | Durable object storage for uploaded source files and audit trail. |
| Fast query store | Amazon DynamoDB on-demand | Pay-per-request database with no provisioned idle throughput. |
| Materialized insights | DynamoDB items or S3 JSON snapshots | Precomputed dashboard, FEFO, waste-risk, stockout, and reorder views make natural-language answers fast. |
| Background jobs | S3 event -> Lambda, plus optional EventBridge Scheduler | Import and forecast jobs run only when files arrive or schedules fire. |
| Auth | MVP bearer-token login or Cloudflare Access | Avoid a paid identity rollout until a real pilot requires SSO/Cognito. |
| Secrets | Lambda environment variables, SSM Parameter Store, or Secrets Manager | Keep secrets out of code; choose the lowest operational overhead for the pilot. |

## Infrastructure As Code

Use Terraform for the MVP infrastructure, not CloudFormation.

The Terraform entry point is [../infra/terraform/README.md](../infra/terraform/README.md). It provisions the low-idle AWS skeleton:

- S3 raw upload bucket.
- DynamoDB on-demand tables.
- Lambda Function URL API.
- S3-triggered import Lambda.
- Optional EventBridge Scheduler refresh.
- Optional AWS Budget alerts.

The Terraform-managed Lambda handlers implement the hosted pilot flow without always-on services. The API Lambda handles login, templates, presigned uploads, dashboard reads, detail views, and safe natural-language query routing. The S3-triggered import Lambda parses CSV/XLSX files, validates required columns, stores canonical records in DynamoDB, and materializes the FEFO, waste-risk, stockout, reorder, dashboard, and query views needed for fast reads.

## Upload And Query Flow

```text
Buyer opens Cloudflare Pages frontend
        |
        v
Login against Lambda API
        |
        v
Request upload URL
        |
        v
Upload Excel/CSV directly to private S3 bucket
        |
        v
S3 event invokes import Lambda
        |
        v
Lambda validates file and normalizes rows
        |
        +--> Store original file in S3 raw zone
        |
        +--> Store canonical rows in DynamoDB
        |
        v
Import Lambda refreshes materialized recommendation/query views
        |
        v
Natural-language query Lambda maps user question to a safe view read
        |
        v
Return table + plain-English recommendation
```

## Why Not RDS/PostgreSQL For The First Hosted MVP

PostgreSQL is still the cleanest relational model and remains useful for local development, tests, and later paid pilots. It is not the cheapest idle hosted option on AWS.

For a <$10/month target, avoid:

- RDS or Aurora because they introduce instance/capacity/storage costs even before buyer usage proves value.
- ECS Fargate or App Runner because an always-on API container creates baseline compute cost.
- Application Load Balancer because it has an hourly baseline.
- NAT Gateway because it can quietly dominate a small AWS bill.

The MVP should keep data small, canonical, and materialized. DynamoDB on-demand is a better hosted fit for that constraint.

## DynamoDB Data Shape

Use a single-table or small-table design that matches the questions the app must answer.

Suggested tables for the MVP:

| Table | Purpose |
| --- | --- |
| `inventory_ai_records` | Canonical products, lots, customers, orders, and inbound shipments. |
| `inventory_ai_views` | Materialized FEFO, waste-risk, stockout, reorder, customer-cadence, and dashboard KPI outputs. |
| `inventory_ai_imports` | Import job status, validation errors, S3 object keys, and row counts. |

Example access patterns:

- Get dashboard snapshot for tenant.
- Get FEFO recommendations by SKU and warehouse.
- Get lots expiring in the next 30/60/90 days.
- Get reorder recommendations due this week.
- Get customers that frequently buy a SKU.
- Get import errors for the latest upload.

The natural-language layer should not generate arbitrary database queries. It should map supported questions to these materialized views.

## Estimated Monthly Idle Cost

This should be near zero when there is no usage:

- Cloudflare Pages static frontend: no app server.
- Lambda Function URL: no endpoint charge; Lambda charges when invoked.
- S3: storage and request costs only.
- DynamoDB on-demand: storage and actual reads/writes; no provisioned throughput.
- EventBridge Scheduler: free-tier-friendly for tiny schedules.

Small pilot usage should typically fit under $10/month, but that is not a guarantee. Costs depend on upload size, request volume, region, logs, data transfer, and accidental public traffic. Put an AWS Budget alert at $5 and $10 before sending the link to a buyer.

## MVP Implementation Plan

1. Keep Cloudflare Pages for the frontend.
2. Use Lambda Function URL for the live API instead of a hosted FastAPI/App Runner target.
3. Upload Excel/CSV directly to S3 with presigned URLs so large files do not pass through the frontend host.
4. Parse Excel/CSV in an import Lambda and report status/errors through DynamoDB.
5. Write canonical rows and materialized recommendation views to DynamoDB on-demand.
6. Keep the current PostgreSQL/FastAPI path for local development and richer paid-pilot deployments.
7. Add a feature flag so the frontend can point to either:
   - local FastAPI/PostgreSQL for development, or
   - Lambda/DynamoDB for the low-idle hosted MVP.

## When To Upgrade

Upgrade to PostgreSQL, App Runner, ECS, or RDS only when one of these becomes true:

- A buyer is paying for a pilot and expects larger datasets.
- Query patterns become too relational for materialized DynamoDB views.
- Multi-tenant access control and audit requirements outgrow the MVP model.
- Forecast jobs exceed Lambda runtime or package constraints.
- The app needs write-back workflows into SAP, Oracle, WMS, or EDI systems.

## Official Pricing References

Always re-check these before deployment:

- Cloudflare Pages pricing: https://developers.cloudflare.com/pages/functions/pricing/
- AWS Lambda pricing: https://aws.amazon.com/lambda/pricing/
- Lambda Function URL cost model: https://docs.aws.amazon.com/lambda/latest/dg/furls-http-invoke-decision.html
- Amazon S3 pricing: https://aws.amazon.com/s3/pricing/
- DynamoDB on-demand pricing: https://aws.amazon.com/dynamodb/pricing/on-demand/
- DynamoDB on-demand capacity mode: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode.html
- Amazon EventBridge pricing: https://aws.amazon.com/eventbridge/pricing/
