# Ottogi USA-Style Pilot Dataset

This folder contains demo files for a StockSense AI pilot. The files are shaped around Korean food/CPG distribution use cases but do not contain real Ottogi business data.

Public distributor item codes and UPC-backed identifiers are used where they could be verified from public listings. Rows with `OTK-DEMO-*` SKU values are demo-specific stand-ins because private ERP item master data is not public.

Load these files in this order:

1. `products.csv`
2. `inventory_lots.csv`
3. `customers.csv`
4. `orders.csv`
5. `inbound_shipments.csv`

Expected row counts:

- Products: 110
- Inventory lots: 555
- Customers: 50
- Orders: 4,625
- Inbound shipments: 25

Pilot story:

- Lot-level shelf-life risk drives FEFO recommendations.
- Long replenishment lead times drive reorder and stockout-risk decisions.
- Customer buying history supports allocation and reorder-cadence queries.
- Unit cost fields support waste-dollar and ROI calculations.

Scenario coverage:

- 37 product rows use public distributor item codes or UPC/EAN-backed identifiers.
- Slow movers carry inventory but have sparse order history, creating overstock and low-confidence review cases.
- Key accounts show higher order cadence, larger case quantities, and promotional spikes in late summer and holiday months.
- Several inbound shipments are held or delayed beyond the normal lead-time window.
- Four active lots are already expired so FEFO and waste-risk views show quarantine/write-off edge cases.
- Newer/spotty SKUs create lower-confidence forecast explanations rather than false precision.
