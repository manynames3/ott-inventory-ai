# Buyer Value Narrative

StockSense AI is positioned for imported food and CPG distributors that carry lot-tracked inventory with meaningful shelf-life constraints. The target buyer is usually a supply chain, operations, or inventory planning leader who owns fill rate, waste, working capital, and planner productivity.

## Buyer Problems

Imported food distributors face a specific inventory problem: they need enough inventory to survive long replenishment cycles, but too much inventory can expire before demand catches up.

The pain is operational and financial:

- Expiration risk is hidden inside lot-level data spread across ERP, WMS, and spreadsheets.
- Older lots may sit behind newer lots unless FEFO is enforced at the recommendation level.
- Replenishment decisions are hard because demand, safety stock, inbound containers, and expiration risk interact.
- Planners often learn about stockout exposure after the reorder window has already passed.
- Sales teams need to know which customers can absorb at-risk lots without damaging service levels.
- Finance needs a credible estimate of value at risk, not just unit counts.

## Value Proposition

StockSense AI turns existing operational exports into daily actions:

- "Ship this lot first because it expires 45 days before the next available lot."
- "Reorder now because lead-time demand exceeds effective inventory after excluding lots expiring before replenishment."
- "Transfer this lot to a faster-moving region before it enters the 30-day expiration bucket."
- "Prioritize these recurring monthly customers for constrained SKU allocation."
- "Delay reorder because inbound shipments cover demand and current inventory is already overstocked."

The product is not pitched as abstract AI. It is pitched as a planner workflow that protects margin and service levels.

## Relationship To SAP And Oracle

StockSense AI is not a replacement for SAP, Oracle, or a WMS. It is a decision layer over systems that already contain valuable operational data.

The buyer-safe positioning is:

> SAP and Oracle remain the system of record. StockSense AI turns ERP/WMS exports into expiration-aware actions, plain-language answers, and ROI explanations for planners.

That distinction matters because SAP and Oracle can already support lot tracking, shelf-life data, batch controls, replenishment planning, and inventory exceptions when configured. StockSense AI's wedge is not "ERP cannot do this." The wedge is "operators need a faster way to decide what to do with the data."

The app is useful when a planner needs to quickly answer:

- Which lots should ship first, and what is the business reason?
- Which inventory is about to become a margin problem?
- Which SKUs will stock out before inbound supply arrives?
- Which recurring customers can absorb at-risk inventory?
- What should be reordered this week, and what should wait?

See [erp_positioning.md](erp_positioning.md) for the detailed SAP/Oracle comparison.

## ROI Levers

StockSense AI supports five measurable ROI levers:

| Lever | How StockSense AI Helps | Pilot Metric |
| --- | --- | --- |
| Waste reduction | Flags at-risk lots and recommends FEFO, transfer, discount, promotion, or priority allocation. | Dollar value moved out of 30/60/90-day risk buckets. |
| Stockout prevention | Compares lead-time demand against current inventory and inbound shipments. | Number of stockout-risk SKUs identified before reorder cutoff. |
| Working capital control | Separates true reorder needs from overstocked positions. | Reorder dollars deferred or avoided without service loss. |
| Planner productivity | Replaces manual spreadsheet joins with explainable recommendations. | Hours saved per weekly inventory review. |
| Customer allocation | Identifies recurring buyers for specific SKUs. | Constrained inventory allocated to higher-probability buyers. |

## Target Account Framing

For Ottogi USA / Ottogi America or a similar imported Korean food distributor, the story should stay close to their operating reality:

- Imported shelf-stable and date-sensitive products.
- Regional warehouses and customer channels.
- Long ocean freight or supplier lead times.
- Retail and distributor fill-rate pressure.
- Promotion, transfer, and discount decisions before inventory becomes distressed.

The strongest first demo is not a broad dashboard. It is a concrete weekly planning sequence:

1. Which lots are about to become margin problems?
2. Which SKUs will stock out before replenishment arrives?
3. Which customers usually buy these SKUs and can absorb at-risk inventory?
4. What should be reordered this week, and what should wait?
5. What is the recoverable dollar value if the team acts now?

## Pilot Scope

A low-risk pilot should avoid ERP integration complexity at the start:

- One warehouse or region.
- 25-100 active SKUs.
- 12-24 months of historical orders.
- Current inventory lots with expiration dates.
- Inbound shipments with ETA and status.
- Weekly recommendation review with a planner or operations manager.

CSV is enough to prove value. SAP, Oracle, or WMS adapters should come after the team validates the decision logic.

## Sales Proof Points Needed

Before a paid pilot, the product should be able to show:

- A hosted demo with realistic imported CPG sample data.
- Downloadable CSV templates and validation errors.
- A simple security and data-handling statement.
- A one-page ROI calculator using waste, stockout, and planner-time assumptions.
- A pilot report template that compares recommendations against actual planner action.

## Buying Criteria

The buyer is likely to evaluate the product on:

- Does it reduce waste without creating service-level risk?
- Are recommendations explainable enough for planners to trust?
- Can it work from exports before deeper ERP integration?
- Does it fit the weekly planning cadence?
- Can the vendor keep data secure and avoid operational disruption?

The MVP is designed to answer those questions with a small operational dataset before asking for a larger integration.
