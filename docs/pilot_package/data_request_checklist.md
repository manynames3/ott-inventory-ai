# Pilot Data Request Checklist

Ask the buyer for read-only exports. Do not request live ERP credentials for the MVP pilot.

## Product Master

Required:

- SKU or item number
- Product name
- Category
- Case size / case pack
- Shelf life in days

Useful if available:

- UPC, EAN, GTIN, or customer-facing item code
- Brand / sub-brand
- Temperature class
- Unit cost or landed cost
- ERP/WMS cross-reference fields

## Inventory Lots

Required:

- Lot ID
- SKU
- Warehouse
- Quantity on hand
- Received date
- Expiration date
- Unit cost

Useful if available:

- Hold/quarantine status
- Available-to-promise quantity
- Bin/location
- Country of origin
- QA release date

## Orders

Required:

- Order ID
- Customer ID
- Order date
- SKU
- Quantity

Useful if available:

- Ship date
- Cancelled/shorted quantity
- Warehouse fulfilled from
- Promotion or deal code
- Net sales or gross margin

## Customers

Required:

- Customer ID
- Customer name
- Region
- Channel

Useful if available:

- Buying group / banner
- Customer priority tier
- Sales owner
- Normal order cadence

## Inbound Shipments

Required:

- Shipment ID
- SKU
- Quantity
- ETA date
- Origin
- Status

Useful if available:

- Container number
- Port
- Supplier
- Purchase order number
- Original ETA and revised ETA

## Pilot Constraints

- CSV, XLSX, or XLSM exports are acceptable.
- Remove personal contact details and payment information before upload.
- Use one to two warehouses and 50-150 SKUs for the first pilot unless the buyer already has clean exports.
- Two years of order history is preferred; one year is workable for initial review.
- Replace demo identifiers with the buyer's own ERP item master before judging recommendations.
