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
- Orders: 4,907
- Inbound shipments: 25

Pilot story:

- Lot-level shelf-life risk drives FEFO recommendations.
- Long replenishment lead times drive reorder and stockout-risk decisions.
- Customer buying history supports allocation and reorder-cadence queries.
- Unit cost fields support waste-dollar and ROI calculations.
