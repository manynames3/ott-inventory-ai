# ADR 0002: Use CSV/XLSX Imports Before Live ERP Integrations

## Status

Accepted

## Context

Food and CPG companies often have inventory, lot, customer, order, and inbound shipment data in SAP, Oracle, WMS, or spreadsheet exports. Live ERP integrations require credentials, IT review, network access, data-processing agreements, and field mapping work.

## Decision

Implement CSV/XLSX import adapters first, with required-column validation and template downloads. Keep SAP and Oracle adapters as placeholders documented by an expected field contract.

## Consequences

- A buyer can evaluate the workflow with ordinary exports before approving deeper integration work.
- Raw upload storage and import history create an audit trail for pilot demos.
- The import path is batch-oriented and not yet a real-time ERP integration.
- Future SAP, Oracle, WMS, or EDI adapters can reuse the same normalized downstream model.
