# Architecture Decisions

Inventory AI is designed as a pragmatic MVP: prove the business workflow first, keep integrations replaceable, and avoid infrastructure choices that make early pilots slow or risky.

## Architecture Goals

- Deliver a public buyer-facing frontend quickly.
- Keep operational logic in a backend that can run forecasting and import logic without creating high idle cost.
- Support Excel/CSV first while leaving room for ERP adapters.
- Make recommendations explainable enough for planner review.
- Avoid hardcoded credentials and keep deployment environment-specific.
- Keep hosted MVP idle cost ideally under $10/month.
- Keep forecasting and reorder logic modular so more advanced models can replace the first-pass algorithms.

## Current Local / Reference Deployment Shape

```text
Buyer / planner browser
        |
        v
Cloudflare Pages static frontend
        |
        v
FastAPI backend
        |
        +--> Optional Amazon S3 raw Excel/CSV storage
        |
        v
PostgreSQL operational schema
        |
        v
Python worker for imports and recommendation refreshes
```

The Cloudflare Pages deployment currently runs the frontend in demo mode. The local/reference backend uses FastAPI and PostgreSQL because that is straightforward for development and relational logic.

## Low-Idle Hosted MVP Deployment Shape

```text
Buyer / planner browser
        |
        v
Cloudflare Pages static frontend
        |
        v
AWS Lambda Function URL API
        |
        +--> Amazon S3 raw Excel/CSV storage
        |
        +--> DynamoDB on-demand canonical records
        |
        v
DynamoDB materialized recommendation/query views
        |
        v
S3 event / EventBridge Scheduler triggered Lambda jobs
```

The first hosted MVP should avoid ECS Fargate, App Runner, RDS, Aurora, Application Load Balancer, and NAT Gateway. Those services can be useful later, but they create baseline cost before buyer usage proves value.

Infrastructure for this path is managed with Terraform in [../infra/terraform](../infra/terraform), not CloudFormation.

## Frontend: Next.js Static Export

Decision: use Next.js with TypeScript and static export for the frontend.

Reasoning:

- Cloudflare Pages can host the buyer-facing UI without Docker.
- A static frontend is inexpensive, simple, and fast to deploy.
- The frontend can show demo data when the backend is unavailable.
- The same UI can switch to live API mode with environment variables.

Tradeoff:

- Static export does not host server-side Next.js API routes. That is acceptable because the backend is FastAPI.

## Backend: FastAPI

Decision: use FastAPI for local/reference business APIs, imports, natural-language query routing, and recommendation endpoints. For the low-idle hosted MVP, expose equivalent endpoints with AWS Lambda Function URLs.

Reasoning:

- Python is a good fit for Pandas, NumPy, forecasting, and data-validation workflows.
- FastAPI exposes OpenAPI docs for pilot and integration discussions.
- Backend logic remains independent of Cloudflare Pages hosting.

Tradeoff:

- FastAPI needs a Python-capable host if deployed directly. The low-idle hosted path should avoid always-on Python containers until a paid pilot justifies them.

## Data Store: PostgreSQL Locally, DynamoDB Hosted

Decision: use PostgreSQL as the local/reference model for products, lots, customers, orders, inbound shipments, recommendations, and alerts. Use DynamoDB on-demand plus materialized views for the low-idle hosted MVP.

Reasoning:

- The data is relational and operational.
- SQL is the right fit for joining SKUs, lots, customers, orders, and shipments.
- PostgreSQL is familiar to enterprise teams and easy to map from ERP exports.
- DynamoDB on-demand is a better hosted MVP fit when the goal is near-zero idle cost.
- Materialized recommendation views keep natural-language responses fast without arbitrary queries.

Tradeoff:

- PostgreSQL is more natural for ad-hoc joins, but hosted RDS/Aurora introduces baseline cost.
- DynamoDB requires designing access patterns and precomputing the specific views the app needs.

## Worker: Python Background Process

Decision: keep import and forecasting refresh work separate from user-facing requests. Locally this is a Python worker; in the low-idle hosted MVP it should be S3 event or EventBridge Scheduler triggered Lambda jobs.

Reasoning:

- CSV imports and recommendation refreshes can be slow or scheduled.
- Keeping jobs outside request/response paths makes the API more predictable.
- The same job logic can later move to a queue runner, cron job, or managed worker service.

Tradeoff:

- The MVP worker is simple. A production pilot should add job status, retries, dead-letter queues, and observability.

## File Intake: Excel/CSV First, ERP Later

Decision: implement Excel/CSV uploads as the first adapter path and add SAP/Oracle placeholders.

Reasoning:

- Pilots should not depend on live ERP credentials or lengthy IT approvals.
- Excel and CSV exports are enough to validate decision quality.
- S3 can retain the raw uploaded file while DynamoDB materialized views serve fast hosted MVP queries.
- PostgreSQL remains available for local/reference workflows and richer paid-pilot deployments.
- A shared field contract keeps future SAP, Oracle, EDI, or WMS adapters from changing downstream logic.

Tradeoff:

- Excel/CSV is batch-oriented. Live integration will be needed for daily or intra-day operations.

## Forecasting: Simple, Explainable Baseline

Decision: start with moving average and exponential smoothing.

Reasoning:

- Planners can understand the baseline.
- It works with limited historical data.
- It creates a modular interface for future ML models.
- Trend and seasonality placeholders make the upgrade path explicit.

Tradeoff:

- The baseline will not capture every promotion, holiday, or customer-level demand signal. Those should become model features after a pilot confirms value.

## Reorder Logic: Explainability Over Black Box

Decision: calculate reorder status from average demand, demand variability, lead time, inbound supply, current inventory, safety stock, and expiration risk.

Reasoning:

- The buyer needs to understand why a recommendation exists.
- Long lead times make "effective inventory" more useful than raw on-hand quantity.
- Lots expiring before replenishment should not be counted as reliable coverage.

Tradeoff:

- The MVP uses configurable lead-time assumptions. Production should use supplier, lane, and SKU-specific lead times.

## Natural-Language Query: Rule-Based Before Text-to-SQL

Decision: implement a safe rule-based query layer instead of arbitrary text-to-SQL.

Reasoning:

- It avoids unsafe or expensive SQL generation.
- It supports the highest-value buyer questions immediately.
- It keeps returned tables explainable and predictable.

Tradeoff:

- It handles a curated set of questions. A future version can add permissioned text-to-SQL with query review, row limits, and audit logging.

## Security And Secrets

Decision: environment variables only; no hardcoded credentials.

Reasoning:

- The same repo can run locally, in demo mode, and in production.
- Secrets can live in Cloudflare, backend host settings, or CI secrets.
- The repo can stay public without exposing credentials.

Current MVP additions:

- Environment-backed login with signed bearer tokens for controlled demos.
- Template downloads for every import entity.
- Optional S3 raw-file storage for uploaded Excel/CSV files.
- Low-idle hosted target using Lambda Function URL, S3, DynamoDB on-demand, and event-driven jobs.

Production pilot additions:

- Cognito, SSO, or another identity provider for production authentication.
- Tenant isolation and role-based access.
- Audit logs for imports, exports, and accepted recommendations.
- Data retention and deletion controls.
- Separate demo, staging, and production environments.

## Why Not Put Everything On Cloudflare?

Cloudflare Pages is a good fit for the frontend. The backend currently depends on Python, Pandas, NumPy, and PostgreSQL. Keeping FastAPI separate avoids forcing the forecasting and data-processing layer into an edge runtime before the business workflow is proven.

Possible future Cloudflare additions:

- Cloudflare Pages for frontend hosting.
- Cloudflare Access for protected demos.
- Cloudflare Workers as a lightweight API gateway.
- Cloudflare Queues for async import jobs.
- Hyperdrive or another connection layer if the backend moves closer to Cloudflare infrastructure.

## Production Readiness Path

1. Host the low-idle MVP with Cloudflare Pages, Lambda Function URL, S3, DynamoDB on-demand, and event-driven Lambda jobs.
2. Configure login secrets, private S3 upload storage, and AWS Budget alerts at $5 and $10.
3. Add tenant isolation, role-based access, and audit logs.
4. Add job status, retries, dead-letter queues, and observability.
5. Add pilot reporting for waste avoided, stockouts flagged, and reorder dollars recommended.
6. Add ERP/WMS adapter implementations after the CSV pilot validates the workflow.
7. Upgrade to PostgreSQL/RDS/App Runner/ECS only after paid usage justifies the baseline cost.
