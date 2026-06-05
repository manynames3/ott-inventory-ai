# Buyer Data Validation Protocol

Use this process before presenting forecast or reorder accuracy as buyer-specific evidence.

## Required Files

Load the buyer's five operating exports:

1. Products
2. Inventory lots
3. Customers
4. Orders
5. Inbound shipments

The order file should cover at least 12 months. Two years is preferred because it exposes seasonality, promotions, slow movers, and customer cadence.

## Validation Steps

1. Open Data Setup and confirm all five files imported without validation errors.
2. Open Forecast Validation.
3. Review weighted forecast error and median SKU error.
4. Sort the table by error rate and inspect the highest-error SKUs.
5. Tag each high-error SKU with one of these causes:
   - promotional spike
   - customer onboarding or churn
   - stock-constrained demand
   - discontinued or replacement SKU
   - sparse demand history
   - master-data issue
6. Review reorder actions only after low-confidence SKUs are understood.
7. Track approved and dismissed recommendations in Actions.
8. Generate Weekly ROI Report after the pilot meeting.

## Pilot Acceptance Thresholds

These are starting thresholds, not contractual SLA targets:

- Weighted forecast error under 25% for stable, high-volume SKUs.
- Low-confidence SKU list is explainable by sparse demand, promotion, discontinued items, or data gaps.
- Reorder recommendations correctly separate stockout risk, reorder now, wait, and overstocked decisions.
- Waste-risk actions identify lots inside 30/60/90-day expiration windows with clear FEFO reasoning.
- Planner overrides are captured as dismissed actions with notes, not lost in email or spreadsheets.

## What This Proves

The validation page proves whether StockSense AI can use the buyer's actual order history to produce credible demand estimates. The weekly ROI report proves whether planners and approvers acted on the recommendations and what value was accepted or intentionally dismissed.
