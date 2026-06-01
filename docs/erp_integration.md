# ERP Integration Contract

Inventory AI uses import adapters so CSV can be replaced by SAP, Oracle, or another ERP source without changing forecasting and optimization logic.

Inventory AI should be positioned as an ERP-adjacent decision layer, not a replacement for SAP or Oracle. SAP and Oracle remain the system of record; Inventory AI consumes ERP/WMS exports or future integrations to produce expiration-aware recommendations, natural-language answers, and business explanations. See [erp_positioning.md](erp_positioning.md) for the detailed buyer-facing comparison.

## Required Entities

### products

| Field | Type | Notes |
| --- | --- | --- |
| `sku` | string | Unique product identifier. |
| `name` | string | Product display name. |
| `category` | string | Product category or family. |
| `case_size` | integer | Selling or shipping case size. |
| `shelf_life_days` | integer | Standard shelf life from receipt/manufacture. |

### inventory_lots

| Field | Type | Notes |
| --- | --- | --- |
| `lot_id` | string | Unique lot/batch identifier. |
| `sku` | string | Must match `products.sku`. |
| `warehouse` | string | Facility, DC, or inventory org. |
| `quantity_on_hand` | integer | Current sellable quantity. |
| `received_date` | date | Date received into the warehouse. |
| `expiration_date` | date | Lot expiration or best-by date. |
| `unit_cost` | numeric | Landed or inventory carrying cost per unit. |

### customers

| Field | Type | Notes |
| --- | --- | --- |
| `customer_id` | string | Unique customer identifier. |
| `name` | string | Customer name. |
| `region` | string | Sales region. |
| `channel` | string | Retail, distributor, foodservice, club, ecommerce, etc. |

### orders

| Field | Type | Notes |
| --- | --- | --- |
| `order_id` | string | Unique order identifier. |
| `customer_id` | string | Must match `customers.customer_id`. |
| `order_date` | date | Historical demand date. |
| `sku` | string | Must match `products.sku`. |
| `quantity` | integer | Ordered quantity. |

### inbound_shipments

| Field | Type | Notes |
| --- | --- | --- |
| `shipment_id` | string | Unique inbound shipment identifier. |
| `sku` | string | Must match `products.sku`. |
| `quantity` | integer | Inbound quantity. |
| `eta_date` | date | Expected arrival date. |
| `origin` | string | Supplier, country, plant, or port. |
| `status` | string | `planned`, `confirmed`, `in_transit`, `port_hold`, `received`, or `cancelled`. |

## Adapter Notes

The MVP includes `CSVImportAdapter`, `SAPAdapter`, and `OracleERPAdapter`. SAP and Oracle are placeholders that expose the same required field contract without storing credentials or making live connections. Future adapters should normalize ERP-specific fields into these canonical tables, then call the same service layer used by CSV imports.
