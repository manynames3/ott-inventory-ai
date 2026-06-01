# Inventory AI

Inventory AI is an MVP for expiration-aware inventory optimization in food and CPG operations. It combines CSV ingestion, FEFO picking, demand forecasting, reorder recommendations, waste-risk alerts, and a safe natural-language query layer.

## Stack

- Frontend: Next.js + TypeScript
- Backend: FastAPI
- Database: PostgreSQL
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

For a GitHub Actions deployment instead of Cloudflare's dashboard Git integration, add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub repository secrets. The included workflow builds `frontend/out` and deploys it to a Pages project named `ott-inventory-ai`.

## CSV Imports

The import page accepts CSVs for:

- `products`: `sku`, `name`, `category`, `case_size`, `shelf_life_days`
- `inventory_lots`: `lot_id`, `sku`, `warehouse`, `quantity_on_hand`, `received_date`, `expiration_date`, `unit_cost`
- `customers`: `customer_id`, `name`, `region`, `channel`
- `orders`: `order_id`, `customer_id`, `order_date`, `sku`, `quantity`
- `inbound_shipments`: `shipment_id`, `sku`, `quantity`, `eta_date`, `origin`, `status`

Validation errors are returned by the backend with missing or invalid columns.

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
- "Which customers usually buy SKU OTG-001 every month?"
- "What should we reorder this week?"

## ERP Integration

CSV is the first adapter. SAP and Oracle placeholders are included without live connections or credentials. The expected ERP field contract is documented in [docs/erp_integration.md](docs/erp_integration.md).

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
- `SUPPLIER_LEAD_TIME_DAYS`
- `FORECAST_INTERVAL_SECONDS`
- `IMPORT_QUEUE_DIR`
