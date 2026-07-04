# User Acceptance Test

Use this checklist before sending a pilot link to an external buyer.

## Roles

- Viewer can sign in and view dashboard, status, reports, SKU/customer details, and query answers.
- Planner can add notes and dismiss/reopen recommendations.
- Approver can approve recommendations and export reviewed actions.
- Admin can invite users, change roles, disable access, and clear review history.

## Data Setup

- A new user can open Data Setup and see all required files and fields.
- Template downloads work for products, inventory lots, customers, orders, and inbound shipments.
- CSV/XLSX preview shows mapped columns before commit.
- Import history shows success and validation errors.

## Planner Workflow

- Dashboard loads KPIs and priority actions.
- Actions page shows P1/P2 recommendations with business reasons.
- Planner note persists after refresh.
- Approver action updates audit trail and report exports.

## Query And Evidence

- Query page answers known safe questions without arbitrary SQL.
- Query answer includes source citations.
- Weekly ROI report reflects reviewed action state.
- Audit page shows login, import, query, export, and review events.

## Operational Checks

- Status page shows frontend, backend, auth, import storage, query store, and monitoring state.
- Invalid or expired login redirects to `/login`.
- API Gateway preflight returns HTTP 204 for protected routes.
- `scripts/live_smoke_test.sh` passes with a real Cognito user.
- `node scripts/verify_live_frontend.mjs` passes against the production frontend.

## Exit Criteria

The pilot is ready for an external user when every item above passes, the Cloudflare deployment workflow has completed successfully, and the buyer has at least one admin plus one non-admin role assigned.
