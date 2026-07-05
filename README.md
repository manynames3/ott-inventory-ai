# StockSense AI

StockSense AI is an expiration-aware inventory optimization MVP for food and CPG operators. I built it as a full-stack, low-idle pilot application that turns product, lot, order, customer, and inbound-shipment exports into FEFO pick priorities, waste-risk alerts, demand forecasts, reorder recommendations, buyer-ready ROI reporting, role-based approvals, audit evidence, and safe natural-language answers.

Live demo: [https://otokistocksense.pages.dev](https://otokistocksense.pages.dev)

Hosted pilot status: the public frontend is deployed on Cloudflare Pages and can run against the Cognito-protected AWS API Gateway/Lambda backend. The sign-in screen pre-fills a planner-only public demo account for quick evaluation; admin and buyer-specific credentials are managed outside source control through Cognito/SSM.

## About

The app is designed for inventory planners and operations teams managing imported grocery or CPG products with long replenishment lead times and lot-level shelf-life risk. It helps answer questions such as:

- Which lots should ship first?
- Which inventory expires in the next 30, 60, or 90 days?
- Which SKUs are likely to stock out before replenishment arrives?
- What should be reordered this week, and why?
- Which customers usually buy a constrained SKU?

The MVP is framed around a realistic Ottogi-style food distribution pilot, using fictional operating data and Korean food/CPG-style SKUs.

## Tech Stack

- Frontend: Next.js, React, TypeScript, static export, Cloudflare Pages
- Backend: FastAPI, Python, SQLAlchemy, PostgreSQL for local/reference development
- Hosted low-idle backend: AWS API Gateway, AWS Lambda, optional Lambda Function URL mode, S3, DynamoDB on-demand, SSM Parameter Store
- Data/forecasting: Pandas, NumPy, moving average, exponential smoothing
- Imports: CSV/XLSX validation, column mapping preview, raw-file retention path
- AI/query layer: safe rule-based query routing with optional OpenAI explanation augmentation
- Identity and controls: Cognito Hosted UI, planner/approver/admin roles, audit trail, optional immutable S3 audit archive, optional SNS alerts
- Infrastructure: Terraform, Docker Compose for local development, Cloudflare Pages deployment workflow
- Tests: Python unit tests for FEFO, forecasting, reorder logic, auth/templates, and AI fallback

## Engineering Highlights

- Built a working full-stack inventory SaaS MVP with dashboard, imports, SKU detail, customer detail, priority actions, login, and natural-language query pages.
- Implemented FEFO logic that ranks lots by expiration date and explains why one lot should ship before another.
- Built reorder recommendations from average demand, demand variability, lead time, inbound shipments, usable inventory, safety stock, and expiration risk.
- Kept forecasting modular with a `ForecastModel` interface and baseline moving-average/exponential-smoothing models.
- Added safe natural-language query handling that maps user questions to predefined operational views instead of allowing arbitrary SQL generation.
- Added optional OpenAI augmentation for planner-ready explanations while preserving deterministic fallback when no model key is configured.
- Designed a low-idle deployment path using Cloudflare Pages, API Gateway/Lambda Function URL options, S3, DynamoDB on-demand, and event-triggered workers instead of always-on containers.
- Added Terraform infrastructure for the hosted MVP path and kept secrets in environment variables or SSM, not source code.
- Added buyer-evidence surfaces: forecast backtesting against a holdout window and weekly ROI reporting from approved/dismissed planner actions.
- Live-tested the stronger pilot path with Cognito groups, API Gateway JWT authorization, planner versus approver permissions, dashboard/query/import/status endpoints, and action approval blocking.
- Added low-cost scheduled S3 landing-prefix imports for ERP exports and SFTP-bridged drops, with managed AWS Transfer Family SFTP kept optional because of idle cost.
- Added immutable audit export, alerting hooks, retention/SIEM documentation, and source-backed citations for AI query answers.

## Architecture

Architecture documentation:

- [docs/architecture.md](docs/architecture.md): overview, C4-style container diagram, runtime flow, deployment shape, constraints
- [docs/adrs/README.md](docs/adrs/README.md): architecture decision records
- [docs/low_idle_mvp_architecture.md](docs/low_idle_mvp_architecture.md): low-idle AWS MVP rationale
- [docs/architecture_decisions.md](docs/architecture_decisions.md): earlier implementation rationale and tradeoffs
- [docs/pilot_readiness.md](docs/pilot_readiness.md): Phase 1-5 sellable-pilot hardening summary
- [docs/self_serve_pilot_runbook.md](docs/self_serve_pilot_runbook.md): self-serve launch checklist for infrastructure, users, data, and verification
- [docs/internal_tool_readiness.md](docs/internal_tool_readiness.md): named-user internal deployment checklist
- [docs/terraform_state_and_apply.md](docs/terraform_state_and_apply.md): remote Terraform state and live-stack apply runbook
- [docs/user_acceptance_test.md](docs/user_acceptance_test.md): external-user acceptance checklist
- [docs/user_acceptance_test_results_2026-07-04.md](docs/user_acceptance_test_results_2026-07-04.md): completed live UAT results
- [docs/cognito_live_smoke_test.md](docs/cognito_live_smoke_test.md): Cognito users/groups and API Gateway smoke-test steps
- [docs/pilot_package/README.md](docs/pilot_package/README.md): guided pilot kit with sample data, security brief, and weekly ROI report template

At a high level, the public demo uses a static Next.js frontend on Cloudflare Pages. The hardened hosted pilot path uses Cognito Hosted UI, API Gateway JWT authorization, AWS Lambda for API/import/refresh work, S3 for raw Excel/CSV files, DynamoDB for canonical records and materialized recommendation/query views, SSM Parameter Store for secrets, and optional SNS/Object Lock controls. The local/reference development path uses FastAPI and PostgreSQL.

## Core Features

- Dashboard KPIs for inventory value, expiration risk, projected stockouts, recommended reorder value, and recoverable waste opportunity.
- FEFO pick priority and waste-risk actions for near-expiring lots.
- Demand forecasting for 30, 60, and 90 day horizons.
- Reorder decisions with business explanations and confidence notes.
- CSV/XLSX upload flow with required-column validation, template downloads, import history, and validation errors.
- Natural-language query page for common planning questions.
- SKU detail and customer detail pages.
- Data Setup, Status, Security, and Audit pages for first-run activation, operational visibility, and buyer trust.
- Planner review queue with server-backed approved/dismissed state, notes, browser fallback, and reviewed CSV export.
- Forecast Validation page that compares recent actual order demand against forecasted demand by SKU.
- Weekly ROI Report page generated from actual approved/dismissed planner actions.
- Pilot RBAC for planner notes/dismissals and approver/admin action approvals.
- Admin tenant settings for lifecycle stage, billing posture, user onboarding, and enterprise SSO readiness.
- Audit trail for login, import, query, export, and planner-review activity with CSV export.
- Optional Cognito Hosted UI + API Gateway JWT authorizer for SSO-ready buyer pilots.
- Scheduled S3 landing-prefix imports for ERP exports or SFTP-bridged file drops.
- Optional native AWS Transfer Family SFTP for buyers who require managed SFTP, disabled by default for cost control.
- Optional immutable S3 Object Lock audit archive and SNS operational alerts.
- Source-backed citations on natural-language query answers.
- Status-page monitoring summary for API errors, import failures, slow jobs, and failed AI calls.
- Executive ROI report download.
- SAP and Oracle adapter placeholders with documented expected ERP fields.

## Business Context

StockSense AI does not replace SAP or Oracle. Those systems remain the system of record for transactions, purchasing, financial controls, inventory movements, and formal planning workflows.

StockSense AI sits above ERP/WMS exports as an expiration-aware decision layer. It helps planners decide what to ship, transfer, promote, discount, or reorder this week, with explanations that connect lot expiration, demand, inbound supply, lead time, customer buying cadence, and inventory value.

See [docs/erp_positioning.md](docs/erp_positioning.md), [docs/buyer_value.md](docs/buyer_value.md), and [docs/ottogi_pilot_demo_script.md](docs/ottogi_pilot_demo_script.md) for buyer-facing framing.

## Quick Start With Docker

1. Create a local environment file:

```bash
cp .env.example .env
```

Edit `.env` and replace the example PostgreSQL password.

2. Start the app:

```bash
docker compose up --build
```

3. Seed sample data:

```bash
docker compose exec backend python -m app.seed
```

4. Open:

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs

## No-Docker Development

Docker is optional. Use any reachable PostgreSQL database, then run the Python backend directly:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.migrate
python -m app.seed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Detailed no-Docker steps are in [docs/no_docker_local_dev.md](docs/no_docker_local_dev.md).

## Cloudflare Pages Frontend

Live deployment:

- GitHub: [https://github.com/manynames3/ott-inventory-ai](https://github.com/manynames3/ott-inventory-ai)
- Cloudflare Pages: [https://otokistocksense.pages.dev](https://otokistocksense.pages.dev)

The frontend is configured for static export and deploys from GitHub to Cloudflare Pages.

- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `out`
- Hosted pilot environment variable: `NEXT_PUBLIC_DEMO_MODE=false`
- Hosted pilot auth mode: `NEXT_PUBLIC_AUTH_MODE=cognito`
- Live API environment variable: `NEXT_PUBLIC_API_BASE_URL=<api_gateway_url>`
- Offline/static fallback only: `NEXT_PUBLIC_DEMO_MODE=true`

Detailed deployment steps are in [docs/cloudflare_pages_deploy.md](docs/cloudflare_pages_deploy.md). Custom domain and pilot security hardening steps are documented in [docs/custom_domain_and_security.md](docs/custom_domain_and_security.md).

## Low-Idle Hosted Backend

The hosted MVP target avoids services with meaningful idle cost. Terraform in [infra/terraform](infra/terraform) provisions:

- AWS Lambda Function URL API
- Optional Cognito-protected API Gateway API for stronger pilot auth
- S3 raw upload bucket
- DynamoDB on-demand records, views, and import-status tables
- S3-triggered import worker Lambda
- Optional Cognito/API Gateway auth path
- Optional immutable audit archive, SNS alerts, scheduled S3 scans, and managed SFTP
- Optional EventBridge Scheduler refresh worker
- Optional AWS Budget alerts
- SSM-backed secrets for login and optional OpenAI access

The API Lambda handles login, Cognito user context, templates, upload URLs, dashboard reads, detail views, planner reviews, audit export, monitoring summaries, safe natural-language query routing, and optional AI-generated explanations. The import Lambda parses uploaded CSV/XLSX files, validates required columns, writes canonical rows, refreshes materialized FEFO, waste-risk, stockout, reorder, dashboard, and query views, and records import/audit events.

The MVP intentionally avoids ECS Fargate, App Runner, RDS, Aurora, Application Load Balancers, and NAT Gateway until a paid pilot justifies their baseline cost.

For the lowest-cost file automation path, use scheduled S3 landing prefixes. Native AWS Transfer Family SFTP is available through Terraform but remains disabled by default because it has fixed hourly cost.

## File Imports

The import page accepts `.csv`, `.xlsx`, and `.xlsm` files for:

- `products`: `sku`, `name`, `category`, `case_size`, `shelf_life_days`
- `inventory_lots`: `lot_id`, `sku`, `warehouse`, `quantity_on_hand`, `received_date`, `expiration_date`, `unit_cost`
- `customers`: `customer_id`, `name`, `region`, `channel`
- `orders`: `order_id`, `customer_id`, `order_date`, `sku`, `quantity`
- `inbound_shipments`: `shipment_id`, `sku`, `quantity`, `eta_date`, `origin`, `status`

Template files are available from the import page and from `/api/templates/{entity}.csv` or `/api/templates/{entity}.xlsx`. Validation errors include missing or invalid columns.

For a controlled Ottogi-style pilot demo, use the generated files in `sample_data/ottogi_demo/`:

```bash
PYTHONPATH=backend backend/.venv/bin/python -m app.export_ottogi_demo_csvs
```

The exported set includes 110 Ottogi-inspired SKUs, 555 inventory lots, 50 customers, two years of historical orders, and 25 inbound shipments. Public distributor item codes and UPC-backed identifiers are used where verified; remaining `OTK-DEMO-*` codes are clearly marked demo records because private ERP item master data is not public. See [public SKU source notes](docs/public_sku_sources.md).

The guided pilot package is in [docs/pilot_package](docs/pilot_package), including a one-page security brief, security questionnaire, DPA checklist, buyer data validation protocol, retention/SIEM plan, and weekly ROI report template for sponsor reviews.

## Natural-Language Query And AI Layer

The query page uses safe predefined templates and materialized views rather than arbitrary SQL execution. Supported examples include:

- "Who needs another order right now?"
- "Which SKUs will stock out in the next 30 days?"
- "Which inventory expires soon?"
- "Which customers usually buy SKU 08252K every month?"
- "What should we reorder this week?"

When `OPENAI_API_KEY_PARAMETER_NAME` points to a valid SSM SecureString, the backend augments the matched safe view with model-generated explanations, action bullets, confidence notes, and planner review notes. If the key is missing or the model call fails, the endpoint falls back to deterministic rule-based explanations. The model never generates SQL and only receives row-limited, matched view context.

## Pilot Auth, Approvals, And Monitoring

The MVP supports pilot RBAC without hardcoding users in source code. For simple demos, set `AUTH_USERNAME`, `AUTH_PASSWORD`, and `AUTH_ROLE`. For a pilot with separate planner and approver accounts, set `AUTH_USERS_JSON` locally or point `auth_users_json_parameter_name` to an SSM SecureString containing:

```json
{
  "planner@example.com": { "password": "replace-me", "role": "planner" },
  "ops-manager@example.com": { "password": "replace-me", "role": "approver" }
}
```

Planner roles can add notes and dismiss actions. Approver/admin roles can approve actions and clear review history. The Audit page shows login, import, query, export, and review activity, and the Status page includes monitoring for API errors, import failures, slow requests/jobs, and failed AI calls.

Cognito mode can be enabled with Terraform for a stronger buyer pilot. Cognito groups map to `planner`, `approver`, and `admin`; API Gateway validates JWTs before invoking Lambda. The live smoke-test document covers the tested planner/approver/admin flows without storing passwords in source code.

## Tests

Run backend unit tests:

```bash
backend/.venv/bin/python -m unittest discover -s backend/tests/unit -p 'test_*.py'
```

Run frontend checks:

```bash
cd frontend
npm audit --audit-level=high
npm run typecheck
npm run build
```

Run the full local verification suite:

```bash
make verify
```

Docker test fallback:

```bash
docker compose exec backend pytest
```

## Migrations

The initial PostgreSQL schema is in [backend/migrations/001_init.sql](backend/migrations/001_init.sql). Docker Compose mounts this into Postgres initialization, so it runs automatically when the database volume is first created.

If you need to rerun from scratch:

```bash
docker compose down -v
docker compose up --build
docker compose exec backend python -m app.seed
```

## Environment Variables

Secrets and database credentials are read from `.env`. Do not commit `.env`.

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `TENANT_ID`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_DEMO_MODE`
- `NEXT_PUBLIC_AUTH_MODE`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_REDIRECT_URI`
- `NEXT_PUBLIC_COGNITO_LOGOUT_URI`
- `CORS_ORIGINS`
- `AUTH_ENABLED`
- `AUTH_USERNAME`
- `AUTH_PASSWORD`
- `AUTH_ROLE`
- `AUTH_USERS_JSON`
- `AUTH_SECRET_KEY`
- `AUTH_TOKEN_TTL_MINUTES`
- `SUPPLIER_LEAD_TIME_DAYS`
- `FORECAST_INTERVAL_SECONDS`
- `IMPORT_QUEUE_DIR`
- `AWS_REGION`
- `AWS_S3_RAW_IMPORT_BUCKET`
- `AWS_S3_IMPORT_PREFIX`
- `SCHEDULED_IMPORT_PREFIXES`
- `AWS_S3_AUDIT_ARCHIVE_BUCKET`
- `RAW_FILE_RETENTION_DAYS`
- `AUDIT_EVENT_RETENTION_DAYS`
- `IMPORT_STATUS_RETENTION_DAYS`
- `AUDIT_ARCHIVE_RETENTION_DAYS`
- `SIEM_HTTP_ENDPOINT`
- `ALERT_SNS_TOPIC_ARN`
- `AWS_DYNAMODB_RECORDS_TABLE`
- `AWS_DYNAMODB_VIEWS_TABLE`
- `AWS_DYNAMODB_IMPORTS_TABLE`
- `OPENAI_API_KEY`
- `OPENAI_API_KEY_PARAMETER_NAME`
- `OPENAI_MODEL`
- `AI_QUERY_ENABLED`
- `ALLOW_DEMO_SEED`

## Project Structure

```text
backend/            FastAPI app, import adapters, recommendation services, migrations, tests
frontend/           Next.js static frontend, dashboard/query/import pages, demo data
infra/terraform/    Low-idle AWS infrastructure and Lambda handlers
docs/               Architecture, ADRs, deployment, ERP, buyer, and pilot documentation
sample_data/        Generated Ottogi-style demo import files
docker-compose.yml  Local Postgres + backend + frontend development stack
```

## Limitations And Next Steps

- The MVP uses CSV/XLSX import first; SAP and Oracle adapters are placeholders.
- The local/reference backend uses PostgreSQL, while the low-idle hosted MVP uses DynamoDB materialized views.
- Forecasting is intentionally simple and explainable; promotion, holiday, and customer-level ML features are future work.
- Native AWS Transfer Family SFTP is available but disabled by default because scheduled S3 landing-prefix scans are the low-idle path.
- Cognito, RBAC, tenant admin, user lifecycle, audit export, alerting hooks, and retention/SIEM documentation are pilot-ready, but enterprise rollout should still finalize buyer-specific IdP federation, DPA/security questionnaire signoff, customer-specific SIEM forwarding, and production billing/payment integration.
- Forecast and reorder accuracy still need validation against real buyer data before production decisions or ERP writeback.
