# Ottogi-Style Pilot Demo Script

This script is for a buyer-facing StockSense AI walkthrough using the fictional Ottogi-style demo dataset. The goal is to prove the tool can turn ERP/WMS exports into a short list of actions that protect margin, service levels, and planner time.

## Buyer Persona

Primary audience:

- VP Operations
- Supply Chain Manager
- Inventory Planning Manager
- Warehouse/Distribution lead

Their likely question:

> We already have SAP or Oracle. What does this show us faster, and can we trust the recommendation?

The answer:

> StockSense AI does not replace ERP. It reads exports and turns lot expiration, demand, inbound ETAs, and customer cadence into explainable actions: ship this lot first, move or discount this at-risk inventory, reorder this SKU, or call this customer.

## Setup

Use the hosted pilot:

- Frontend: `https://otokistocksense.pages.dev`
- Login: use the current pilot credential stored outside the repo.
- Demo files: `sample_data/ottogi_demo/`
- Product catalog: 110 Ottogi-inspired SKUs based on public Ottogi product categories. 37 public distributor or UPC/EAN-backed identifiers are used where verified; `OTK-DEMO-*` IDs, lots, demand, costs, and customers are demo-specific.
- Edge cases: slow movers, promotional spikes, delayed inbound shipments, expired lots, and low-confidence forecasts.

Load these files through the Imports page:

- `products.csv`
- `inventory_lots.csv`
- `customers.csv`
- `orders.csv`
- `inbound_shipments.csv`

The first-run checklist should show all five files complete. The import history should show row counts and validation status.

## Demo Flow

1. Open the dashboard.

Talk track:

> The executive view starts with inventory value, expiration-risk value, projected stockouts, recommended reorder value, and recoverable waste opportunity. This is meant to answer, "where is money or service at risk this week?"

2. Point to the buyer narrative.

Talk track:

> The pilot is not trying to replace the planner. It is trying to compress the planner's exception review from spreadsheet reconciliation into a ranked action queue with reasons.

3. Open the executive report.

Talk track:

> This downloadable report gives the buyer a meeting artifact: low/base/high waste recovery, planner-time assumptions, current fill-rate exposure, and the specific FEFO and stockout actions driving the numbers.

4. Open Imports.

Talk track:

> Before data changes production recommendations, the file goes through preview, column mapping, sample validation, approval, and audit logging. This is important because real ERP exports rarely have perfect column names.

5. Preview a file.

Use a demo CSV or an intentionally renamed export. Map source columns into the required schema.

Talk track:

> A buyer does not need to rename every ERP export before testing. StockSense AI detects common names like item, material, lot number, warehouse, quantity, ETA, and customer account, then asks the user to confirm the mapping.

6. Show audit trail.

Talk track:

> The audit trail records login, upload URL creation, preview, import commit, and query activity. For a pilot, this gives enough traceability to know who loaded which file and when insights changed.

7. Ask a natural-language question.

Use:

```text
Which SKUs will stock out in the next 30 days?
```

Talk track:

> The query layer is intentionally safe. It routes common planner questions to materialized views instead of running arbitrary SQL against operational data.

8. Open a SKU detail page.

Talk track:

> The SKU page connects the recommendation back to the evidence: lots on hand, expiration dates, inbound shipments, historical demand, and the reorder explanation.

## Strongest Buyer Proof Points

- Waste: near-expiring lots are visible by dollar exposure and action bucket.
- Service: stockout risk accounts for lead time, inbound supply, current inventory, and demand.
- FEFO: the system explains why one lot should ship before another.
- Planner speed: the dashboard turns many rows of exports into ranked exceptions.
- ERP fit: SAP/Oracle remain systems of record; StockSense AI is the decision layer over exports.
- Data control: raw files stay private, imports are audited, and the MVP has no ERP writeback.

## Expected Objections

### "SAP already has inventory reports."

Response:

SAP has the data. StockSense AI connects lot expiration, demand, inbound lead time, safety stock, and customer cadence into an explainable weekly action list.

### "Can we trust the recommendations?"

Response:

The pilot is designed for planner review. Every recommendation includes the business reason and the source data path. The goal is to validate agreement with planner judgment before automation.

### "Our exports do not match your template."

Response:

The mapping preview handles renamed columns and makes the field contract explicit before the import is approved.

### "Will this write back into ERP?"

Response:

No. The MVP is read-only. It supports evaluation without creating purchase orders, shipments, financial postings, or inventory adjustments.

## Paid Pilot Success Criteria

A paid pilot should be judged on:

- Dollar value of inventory flagged before expiration.
- Number of stockout-risk recommendations planners agree with.
- Number of FEFO or transfer actions that prevent distressed discounting.
- Time saved in weekly exception review.
- Buyer confidence in the explanations.
- Clean import repeatability from ERP/WMS exports.

## Suggested Pilot Scope

Keep the first buyer pilot narrow:

- One or two warehouses.
- 50-150 imported SKUs.
- Two years of order history.
- Current inventory lots with expiration dates.
- Current inbound shipments and ETAs.
- Weekly review cadence for four weeks.

Expansion should happen only after planners agree that recommendations are useful and explainable.
