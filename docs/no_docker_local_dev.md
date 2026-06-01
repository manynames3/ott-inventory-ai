# No-Docker Local Development

Docker is optional. Inventory AI can run against any PostgreSQL database reachable from your laptop, including a local Postgres install or a managed development database.

## Backend

1. Create and activate a Python virtual environment:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Set environment variables from the repo root `.env.example`.

For a local PostgreSQL instance, `DATABASE_URL` should look like:

```bash
export DATABASE_URL="postgresql+psycopg://inventory_ai_local:your_password@localhost:5432/inventory_ai"
export CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
export SUPPLIER_LEAD_TIME_DAYS=30
export FORECAST_INTERVAL_SECONDS=3600
export IMPORT_QUEUE_DIR="../import_queue"
```

For a managed PostgreSQL database, use that provider's SQLAlchemy-compatible connection URL.

3. Apply migrations and seed data:

```bash
python -m app.migrate
python -m app.seed
```

4. Start the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

5. Start the background worker in a second terminal:

```bash
python -m app.tasks.worker
```

## Frontend

If Node/npm is installed locally:

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

If Node/npm is not installed locally, Cloudflare Pages can build the frontend from GitHub. Set `NEXT_PUBLIC_DEMO_MODE=true` until the backend API has a public URL.

