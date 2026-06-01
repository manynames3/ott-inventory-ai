# Inventory AI

Inventory AI is an expiration-aware inventory optimization and natural-language query tool for imported food and CPG distributors. It is framed for operators who manage long replenishment lead times, lot-level expiration dates, retailer fill-rate expectations, and margin loss from slow-moving inventory.

The MVP is intentionally built around a buyer problem: planners know which SKUs are in stock, but not always which lots should move first, which customers should receive constrained inventory, which inbound shipments arrive too late, or how much cash is tied up in stock that may expire before it sells.

## Buyer Pain Points

Inventory AI addresses common operating problems for Korean food and CPG import/distribution teams:

- Near-expiring lots are discovered too late, forcing write-offs or heavy discounts.
- FEFO discipline depends on manual spreadsheet checks across warehouses.
- Ocean freight and import lead times make stockout risk visible only after it is expensive to fix.
- Reorder decisions miss the combined impact of demand variability, inbound shipments, current inventory, and expiration risk.
- Sales, operations, and finance teams lack a shared answer to "what should we ship, transfer, promote, or reorder this week?"
- ERP/WMS exports contain the data, but it is difficult to turn those exports into explainable daily actions.

## Business Value

The product is designed to prove ROI quickly in a pilot:

- Reduce waste by identifying lots expiring in 30, 60, and 90 days and recommending discount, promotion, transfer, or priority allocation.
- Prevent missed sales by projecting SKU-level stockouts against lead-time demand and inbound shipment ETAs.
- Improve margin by shipping older lots first instead of discounting them after they become urgent.
- Improve planner speed by replacing manual spreadsheet reconciliation with explainable recommendations.
- Align customer allocation with buying cadence so high-velocity customers receive constrained inventory first.
- Create a clean path from CSV exports to ERP-ready adapters without requiring live SAP or Oracle access on day one.

## ERP Positioning

Inventory AI does not replace SAP or Oracle. Those systems remain the system of record for transactions, master data, purchasing, financial controls, inventory movements, and formal planning workflows.

Inventory AI sits above ERP/WMS data as an expiration-aware decision layer. It helps planners answer "what should we ship, transfer, promote, discount, or reorder this week, and why?" using plain-language explanations that connect lot expiration, demand, inbound supply, lead time, customer buying cadence, and inventory value.

See [docs/erp_positioning.md](docs/erp_positioning.md) for the buyer-facing comparison.

## Pilot Framing

For a target account such as Ottogi USA / Ottogi America, the pilot should be scoped around one warehouse or a focused set of imported SKUs:

- Load product, lot, order, customer, and inbound shipment CSV exports.
- Measure inventory value at expiration risk, projected stockouts, reorder value, and recoverable waste opportunity.
- Review FEFO pick lists and reorder recommendations with operations.
- Validate whether recommendations match planner judgment and quantify preventable write-off or stockout exposure.
- Expand only after the team trusts the explanations and the CSV field contract.

See [docs/buyer_value.md](docs/buyer_value.md) for the buyer-facing narrative, [docs/erp_positioning.md](docs/erp_positioning.md) for SAP/Oracle positioning, [docs/ottogi_pilot_demo_script.md](docs/ottogi_pilot_demo_script.md) for the guided buyer demo, and [docs/architecture_decisions.md](docs/architecture_decisions.md) for implementation rationale.

## Stack

- Frontend: Next.js + TypeScript
- Backend: FastAPI
- Local/reference database: PostgreSQL
- Low-idle hosted MVP store: S3 + DynamoDB on-demand materialized views
- Forecasting: Pandas + NumPy
- Worker: Python background process for recommendation refresh jobs
- Local development: Docker Compose

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

3. Seed realistic sample data:

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

- GitHub: https://github.com/manynames3/ott-inventory-ai
- Cloudflare Pages: https://ott-inventory-ai.pages.dev

The frontend is configured for static export and deploys from GitHub to Cloudflare Pages. Use:

- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `out`
- Environment variable for demo-only deployment: `NEXT_PUBLIC_DEMO_MODE=true`
- Environment variable for the live API: `NEXT_PUBLIC_API_BASE_URL=https://<your-api-host>`

Detailed deployment steps are in [docs/cloudflare_pages_deploy.md](docs/cloudflare_pages_deploy.md).

Custom domain and pilot security hardening steps are documented in [docs/custom_domain_and_security.md](docs/custom_domain_and_security.md).

The included Cloudflare Pages workflow is a manual fallback, not the primary push deploy path. Cloudflare's Git integration deploys pushes to `main`; the manual workflow requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets before it can be run.

## Low-Idle Hosted Backend, Login, And AWS File Intake

The repo now includes the next pilot layer:

- Login endpoints backed by environment variables and bearer tokens.
- Downloadable CSV and Excel templates for every import entity.
- First-run import checklist with upload history and validation errors.
- Downloadable executive ROI report from the dashboard.
- Column mapping preview and approval before files change live recommendations.
- Per-user audit trail for login, upload, preview, commit, import, and query actions.
- Excel/CSV upload support through the same validated import path.
- Optional Amazon S3 raw-file storage for uploaded Excel/CSV files.
- Fast natural-language insights from normalized operational records and materialized recommendation views.
- A resettable Ottogi-style demo seed script for controlled backend demos.
- Exported Ottogi-style pilot CSVs in `sample_data/ottogi_demo/` for direct hosted uploads.

Low-idle MVP hosting target:

- Cloudflare Pages for the static frontend.
- AWS Lambda Function URL for the live API instead of an always-on container.
- Amazon S3 for raw Excel/CSV upload retention.
- Amazon DynamoDB on-demand for canonical records and materialized recommendation/query views.
- S3 events and/or EventBridge Scheduler to run import and forecast jobs only when needed.
- SSM Parameter Store, Secrets Manager, or Lambda environment variables for secrets.

The MVP should avoid ECS Fargate, App Runner, RDS, Aurora, Application Load Balancers, and NAT Gateway until a paid pilot justifies their idle cost. Details are in [docs/low_idle_mvp_architecture.md](docs/low_idle_mvp_architecture.md) and [docs/aws_backend_and_data_lake.md](docs/aws_backend_and_data_lake.md).

Terraform for the low-idle AWS MVP lives in [infra/terraform](infra/terraform). The repo does not use CloudFormation for this path.

## File Imports

The import page accepts `.csv`, `.xlsx`, and `.xlsm` files for:

- `products`: `sku`, `name`, `category`, `case_size`, `shelf_life_days`
- `inventory_lots`: `lot_id`, `sku`, `warehouse`, `quantity_on_hand`, `received_date`, `expiration_date`, `unit_cost`
- `customers`: `customer_id`, `name`, `region`, `channel`
- `orders`: `order_id`, `customer_id`, `order_date`, `sku`, `quantity`
- `inbound_shipments`: `shipment_id`, `sku`, `quantity`, `eta_date`, `origin`, `status`

Validation errors are returned by the backend with missing or invalid columns. Template files are available from the import page and from `/api/templates/{entity}.csv` or `/api/templates/{entity}.xlsx`.

The hosted MVP also exposes `/api/import-history`, which powers the first-run checklist, import audit table, and validation error view in the frontend. The upload flow stages files for preview first, suggests a source-to-target column mapping, validates sample rows, and only commits the import after the user approves the mapping.

When `AWS_S3_RAW_IMPORT_BUCKET` is configured, the backend stores the original uploaded file in S3. The local/reference backend imports normalized rows into PostgreSQL. The low-idle hosted MVP uses presigned S3 upload URLs, imports canonical rows into DynamoDB, and refreshes materialized insight views so dashboards and natural-language questions stay fast without an always-on database.

For a controlled Ottogi-style pilot demo, use the generated files in `sample_data/ottogi_demo/`:

```bash
PYTHONPATH=backend backend/.venv/bin/python -m app.export_ottogi_demo_csvs
```

The exported set includes 110 Ottogi-inspired SKUs, 555 inventory lots, 50 customers, two years of historical orders, and 25 inbound shipments. The product catalog is grounded in Ottogi's public global sales catalog and product/category pages for ramen, curry, sauces, oils, vinegar, rice, retort meals, soup, frozen, tea, tuna, and seaweed items; SKU codes and operating data are demo-specific.

The worker also supports a file-drop import queue. Place a CSV in `import_queue/` using a filename that starts with the entity, such as `products__june.csv` or `orders__week_22.csv`. The worker validates and imports it, then moves it to `import_queue/processed/` or `import_queue/failed/`.

## Recommendations

The MVP prioritizes explanations that connect actions to ROI:

- FEFO: ships the earliest-expiring lot first and explains the expiration gap between lots.
- Waste risk: flags lots expiring in 30, 60, and 90 day buckets with discount, transfer, promotion, or priority-allocation actions.
- Forecasting: blends simple moving average and exponential smoothing, with trend and seasonality placeholders for later ML models.
- Reorder: uses average daily demand, demand variability, lead time, inbound shipments, current inventory, safety stock, and expiration risk.

Recommendation statuses are `stockout risk`, `reorder now`, `wait`, and `overstocked`.

## Natural-Language Query

The query page uses safe rule-based templates rather than arbitrary SQL execution. Supported examples:

- "Who needs another order right now?"
- "Which SKUs will stock out in the next 30 days?"
- "Which inventory expires soon?"
- "Which customers usually buy SKU OTG-RAM-001 every month?"
- "What should we reorder this week?"

## ERP Integration

CSV is the first adapter. SAP and Oracle placeholders are included without live connections or credentials. The expected ERP field contract is documented in [docs/erp_integration.md](docs/erp_integration.md), and the positioning against SAP/Oracle is documented in [docs/erp_positioning.md](docs/erp_positioning.md).

## Tests

Run backend unit tests locally:

```bash
python3 -m unittest discover -s backend/tests/unit -p 'test_*.py'
```

Or inside Docker:

```bash
docker compose exec backend pytest
```

Current unit coverage focuses on FEFO picking, demand forecasting, and reorder recommendations.

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
- `ALLOW_DEMO_SEED`
