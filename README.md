# StockSense AI

StockSense AI is an expiration-aware inventory optimization MVP for food and CPG operators. I built it as a full-stack pilot application that turns product, lot, order, customer, and inbound-shipment exports into FEFO pick priorities, waste-risk alerts, demand forecasts, reorder recommendations, executive ROI metrics, and safe natural-language answers.

Live demo: [https://otokistocksense.pages.dev](https://otokistocksense.pages.dev)

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
- Hosted low-idle backend: AWS Lambda Function URL, S3, DynamoDB on-demand, SSM Parameter Store
- Data/forecasting: Pandas, NumPy, moving average, exponential smoothing
- Imports: CSV/XLSX validation, column mapping preview, raw-file retention path
- AI/query layer: safe rule-based query routing with optional OpenAI explanation augmentation
- Infrastructure: Terraform, Docker Compose for local development
- Tests: Python unit tests for FEFO, forecasting, reorder logic, auth/templates, and AI fallback

## Engineering Highlights

- Built a working full-stack inventory SaaS MVP with dashboard, imports, SKU detail, customer detail, priority actions, login, and natural-language query pages.
- Implemented FEFO logic that ranks lots by expiration date and explains why one lot should ship before another.
- Built reorder recommendations from average demand, demand variability, lead time, inbound shipments, usable inventory, safety stock, and expiration risk.
- Kept forecasting modular with a `ForecastModel` interface and baseline moving-average/exponential-smoothing models.
- Added safe natural-language query handling that maps user questions to predefined operational views instead of allowing arbitrary SQL generation.
- Added optional OpenAI augmentation for planner-ready explanations while preserving deterministic fallback when no model key is configured.
- Designed a low-idle deployment path using Cloudflare Pages, Lambda Function URLs, S3, DynamoDB on-demand, and event-triggered workers instead of always-on containers.
- Added Terraform infrastructure for the hosted MVP path and kept secrets in environment variables or SSM, not source code.

## Architecture

Architecture documentation:

- [docs/architecture.md](docs/architecture.md): overview, C4-style container diagram, runtime flow, deployment shape, constraints
- [docs/adrs/README.md](docs/adrs/README.md): architecture decision records
- [docs/low_idle_mvp_architecture.md](docs/low_idle_mvp_architecture.md): low-idle AWS MVP rationale
- [docs/architecture_decisions.md](docs/architecture_decisions.md): earlier implementation rationale and tradeoffs
- [docs/pilot_readiness.md](docs/pilot_readiness.md): Phase 1-5 sellable-pilot hardening summary
- [docs/pilot_package/README.md](docs/pilot_package/README.md): guided pilot kit with sample data, security brief, and weekly ROI report template

At a high level, the public demo uses a static Next.js frontend on Cloudflare Pages. The low-idle hosted backend uses AWS Lambda for API/import/refresh work, S3 for raw Excel/CSV files, DynamoDB for canonical records and materialized recommendation/query views, and SSM Parameter Store for secrets. The local/reference development path uses FastAPI and PostgreSQL.

## Core Features

- Dashboard KPIs for inventory value, expiration risk, projected stockouts, recommended reorder value, and recoverable waste opportunity.
- FEFO pick priority and waste-risk actions for near-expiring lots.
- Demand forecasting for 30, 60, and 90 day horizons.
- Reorder decisions with business explanations and confidence notes.
- CSV/XLSX upload flow with required-column validation, template downloads, import history, and validation errors.
- Natural-language query page for common planning questions.
- SKU detail and customer detail pages.
- Data Setup, Status, and Security pages for first-run activation, operational visibility, and buyer trust.
- Planner review queue with server-backed approved/dismissed state, notes, browser fallback, and reviewed CSV export.
- Pilot RBAC for planner notes/dismissals and approver/admin action approvals.
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
- Live API environment variable: `NEXT_PUBLIC_API_BASE_URL=https://<your-api-host>`
- Offline/static fallback only: `NEXT_PUBLIC_DEMO_MODE=true`

Detailed deployment steps are in [docs/cloudflare_pages_deploy.md](docs/cloudflare_pages_deploy.md). Custom domain and pilot security hardening steps are documented in [docs/custom_domain_and_security.md](docs/custom_domain_and_security.md).

## Low-Idle Hosted Backend

The hosted MVP target avoids services with meaningful idle cost. Terraform in [infra/terraform](infra/terraform) provisions:

- AWS Lambda Function URL API
- S3 raw upload bucket
- DynamoDB on-demand records, views, and import-status tables
- S3-triggered import worker Lambda
- Optional EventBridge Scheduler refresh worker
- Optional AWS Budget alerts
- SSM-backed secrets for login and optional OpenAI access

The API Lambda handles login, templates, upload URLs, dashboard reads, detail views, safe natural-language query routing, and optional AI-generated explanations. The import Lambda parses uploaded CSV/XLSX files, validates required columns, writes canonical rows, and refreshes materialized FEFO, waste-risk, stockout, reorder, dashboard, and query views.

The MVP intentionally avoids ECS Fargate, App Runner, RDS, Aurora, Application Load Balancers, and NAT Gateway until a paid pilot justifies their baseline cost.

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

The guided pilot package is in [docs/pilot_package](docs/pilot_package), including a one-page security brief and weekly ROI report template for sponsor reviews.

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

Planner roles can add notes and dismiss actions. Approver/admin roles can approve actions and clear review history. The Status page includes monitoring for API errors, import failures, slow requests/jobs, and failed AI calls.

## Tests

Run backend unit tests:

```bash
backend/.venv/bin/python -m unittest discover -s backend/tests/unit -p 'test_*.py'
```

Run frontend checks:

```bash
cd frontend
npm run typecheck
npm run build
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
- `CORS_ORIGINS`
- `AUTH_ENABLED`
- `AUTH_USERNAME`
- `AUTH_PASSWORD`
- `AUTH_SECRET_KEY`
- `AUTH_TOKEN_TTL_MINUTES`
- `SUPPLIER_LEAD_TIME_DAYS`
- `FORECAST_INTERVAL_SECONDS`
- `IMPORT_QUEUE_DIR`
- `AWS_REGION`
- `AWS_S3_RAW_IMPORT_BUCKET`
- `AWS_S3_IMPORT_PREFIX`
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
- Production pilots should add stronger identity, tenant provisioning, role-based approvals, observability, retry/dead-letter handling, and formal data retention controls.
