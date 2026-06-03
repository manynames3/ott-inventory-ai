# Pilot Demo Runbook

Use this for a controlled StockSense AI walkthrough with a food/CPG operations buyer.

## Hosted Demo

- Frontend: `https://otokistocksense.pages.dev`
- Backend: configured through `NEXT_PUBLIC_API_BASE_URL`
- Data: [`sample_data/ottogi_demo/`](../../sample_data/ottogi_demo)
- Credentials: stored outside git; share through a password manager or one-time secure handoff.

## Roles To Show

- Planner: can review actions, add notes, dismiss, and reopen.
- Approver: can approve planner-reviewed actions.
- Admin: reserved for setup and troubleshooting.

## Demo Flow

1. Log in as planner and open Dashboard.
2. Point to waste dollars, projected stockouts, reorder value, and the priority action queue.
3. Open Data Setup and confirm all five pilot files are loaded.
4. Open Imports and show template/download support plus validation errors.
5. Open Actions and add a planner note to a stockout or waste-risk row.
6. Attempt approval as planner to show role controls.
7. Log in as approver and approve the same action.
8. Ask: `Which SKUs will stock out in the next 30 days?`
9. Ask: `Which inventory expires soon?`
10. Open a SKU detail page and connect the recommendation to lots, inbound ETAs, forecast, and explanation.
11. Export reviewed actions or the executive report for the weekly pilot meeting.

## Trust Points

- StockSense AI is read-only for the MVP; it does not write purchase orders or ERP transactions.
- Every recommendation has a business explanation tied to inventory, lead time, demand, inbound supply, and expiration risk.
- The AI layer is constrained to materialized operational views and falls back to deterministic rules when AI is unavailable.
- The pilot dataset contains explicit edge cases: slow movers, promo spikes, delayed inbound, expired lots, and low-confidence forecasts.

## Stop Conditions

Pause the demo and switch to the static screenshots or sample CSVs if:

- The hosted backend health check fails.
- Login succeeds but dashboard views are empty.
- Imports show failed validation for all five sample files.
- The buyer asks for security, data retention, or ERP-writeback commitments beyond the current pilot scope.
