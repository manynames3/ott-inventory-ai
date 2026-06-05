# StockSense AI Pilot Package

This package is the handoff kit for a controlled Ottogi USA-style pilot. It is designed for a supply chain or operations buyer who wants to evaluate the product with realistic food/CPG data before connecting ERP exports.

## Included Materials

- Customer-specific demo dataset: [`sample_data/ottogi_demo/`](../../sample_data/ottogi_demo)
- Demo runbook: [`demo_runbook.md`](demo_runbook.md)
- Data request checklist: [`data_request_checklist.md`](data_request_checklist.md)
- One-page security brief: [`security_brief.md`](security_brief.md)
- Security questionnaire: [`security_questionnaire.md`](security_questionnaire.md)
- DPA/procurement checklist: [`dpa_checklist.md`](dpa_checklist.md)
- Retention and SIEM plan: [`retention_siem_plan.md`](retention_siem_plan.md)
- Buyer data validation protocol: [`buyer_data_validation_protocol.md`](buyer_data_validation_protocol.md)
- Weekly ROI report template: [`weekly_roi_report_template.md`](weekly_roi_report_template.md)

## Pilot Flow

1. Load the five operating files: products, inventory lots, customers, orders, and inbound shipments.
2. Confirm Data Setup shows all five datasets as complete.
3. Review Dashboard KPIs for expiry exposure, stockout exposure, reorder value, and recoverable waste.
4. Open Actions and approve or dismiss planner recommendations.
5. Open Reports to generate the weekly ROI readout from approved/dismissed actions.
6. Open Validation to backtest forecast accuracy against the latest order holdout window.
7. Use Query for common planning questions over the refreshed views.
8. Send the weekly ROI report and validation summary to the pilot sponsor.

## Sample Dataset

The bundled dataset uses Ottogi-inspired product records with public distributor item codes or UPC-backed identifiers where verified. `OTK-DEMO-*` rows are demo-specific stand-ins because private ERP item master data is not public. See [`../public_sku_sources.md`](../public_sku_sources.md) for source notes.

- 110 products
- 555 inventory lots
- 50 customers
- 4,625 historical orders across 2 years
- 25 inbound shipments

The dataset is intentionally not real Ottogi business data. It is shaped to resemble the operating problems a food importer or CPG distributor would evaluate: long ocean freight lead times, lot-level expiration risk, reorder timing, customer allocation, slow movers, promotional spikes, delayed inbound shipments, expired lots, and low-confidence forecasts.

Pilot credentials are created outside the repository and should be shared through a password manager or secure one-time handoff only. Do not add usernames, passwords, API keys, or buyer files to git.

## Pilot Success Criteria

- Planners can identify the top waste-risk lots without spreadsheet work.
- Planners can identify stockout-risk SKUs before replenishment arrives.
- Approvers can approve planner actions with attribution.
- The team can export a reviewed action queue after a weekly meeting.
- The buyer can quantify recoverable waste value and fill-rate protection from the app.
