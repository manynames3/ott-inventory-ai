# ADR 0004: Start With Explainable Forecasting And Reorder Logic

## Status

Accepted

## Context

Inventory planners need to trust recommendations before acting on them. The MVP should make clear why a lot should ship first, why a SKU is a stockout risk, or why a reorder is recommended.

## Decision

Use DataFrame-based business logic with moving average, exponential smoothing, FEFO expiration sorting, safety stock, lead-time demand, inbound shipments, usable inventory, and expiration risk. Keep trend and seasonality as explicit placeholders for later model upgrades.

## Consequences

- Recommendations are explainable and covered by focused unit tests.
- The forecasting baseline works with limited historical data.
- The model layer can later add promotion, holiday, customer-level, or SKU-level features without changing the UI contract.
- The MVP will not capture every demand driver until richer features are added.
