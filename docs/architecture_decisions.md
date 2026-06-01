# Architecture Decisions

Inventory AI is designed as a pragmatic MVP: prove the business workflow first, keep integrations replaceable, and avoid infrastructure choices that make early pilots slow or risky.

## Architecture Goals

- Deliver a public buyer-facing frontend quickly.
- Keep operational logic in a backend that can run close to PostgreSQL and Python forecasting libraries.
- Support CSV first while leaving room for ERP adapters.
- Make recommendations explainable enough for planner review.
- Avoid hardcoded credentials and keep deployment environment-specific.
- Keep forecasting and reorder logic modular so more advanced models can replace the first-pass algorithms.

## Current Deployment Shape

```text
Buyer / planner browser
        |
        v
Cloudflare Pages static frontend
        |
        v
FastAPI backend
        |
        v
PostgreSQL operational schema
        |
        v
Python worker for imports and recommendation refreshes
```

The Cloudflare Pages deployment currently runs the frontend in demo mode. A production pilot should add a hosted FastAPI backend and managed PostgreSQL database, then set `NEXT_PUBLIC_DEMO_MODE=false` and `NEXT_PUBLIC_API_BASE_URL` to the backend URL.

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

Decision: use FastAPI for business APIs, imports, natural-language query routing, and recommendation endpoints.

Reasoning:

- Python is a good fit for Pandas, NumPy, forecasting, and data-validation workflows.
- FastAPI exposes OpenAPI docs for pilot and integration discussions.
- Backend logic remains independent of Cloudflare Pages hosting.

Tradeoff:

- FastAPI needs a Python-capable host. Cloudflare Pages handles only the frontend in this MVP.

## Database: PostgreSQL

Decision: use PostgreSQL as the system of record for products, lots, customers, orders, inbound shipments, recommendations, and alerts.

Reasoning:

- The data is relational and operational.
- SQL is the right fit for joining SKUs, lots, customers, orders, and shipments.
- PostgreSQL is familiar to enterprise teams and easy to map from ERP exports.

Tradeoff:

- Local setup needs either Docker or a reachable Postgres instance. The repo includes no-Docker instructions for managed development databases.

## Worker: Python Background Process

Decision: keep import and forecasting refresh work in a separate Python worker.

Reasoning:

- CSV imports and recommendation refreshes can be slow or scheduled.
- Keeping jobs outside request/response paths makes the API more predictable.
- The same job logic can later move to a queue runner, cron job, or managed worker service.

Tradeoff:

- The MVP worker is simple. A production pilot should add job status, retries, and observability.

## Adapter Pattern: CSV First, ERP Later

Decision: implement CSV as the first adapter and add SAP/Oracle placeholders.

Reasoning:

- Pilots should not depend on live ERP credentials or lengthy IT approvals.
- CSV exports are enough to validate decision quality.
- A shared field contract keeps future SAP, Oracle, EDI, or WMS adapters from changing downstream logic.

Tradeoff:

- CSV is batch-oriented. Live integration will be needed for daily or intra-day operations.

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

Production pilot additions:

- Authentication and role-based access.
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

1. Host FastAPI and PostgreSQL.
2. Add login, tenant isolation, and role-based access.
3. Add downloadable CSV templates and import validation reports.
4. Add job status, retries, and worker observability.
5. Add pilot reporting for waste avoided, stockouts flagged, and reorder dollars recommended.
6. Add ERP/WMS adapter implementations after the CSV pilot validates the workflow.
