# StockSense AI One-Page Security Brief

## What The Pilot Does

StockSense AI uses product master, lot-level inventory, customer, order, and inbound shipment exports to produce expiration-aware recommendations. It does not replace ERP/WMS and does not write orders, inventory movements, or customer records back to source systems.

## Data Used

Required pilot files:

- Products: SKU, name, category, case size, shelf life
- Inventory lots: lot ID, SKU, warehouse, quantity, received date, expiration date, unit cost
- Customers: customer ID, name, region, channel
- Orders: order ID, customer ID, order date, SKU, quantity
- Inbound shipments: shipment ID, SKU, quantity, ETA, origin, status

Avoid uploading personal contact details, payment data, tax IDs, HR data, or confidential supplier pricing beyond the unit-cost fields needed for ROI analysis.

## Storage And Access

- Frontend: static Next.js app on Cloudflare Pages.
- Hosted backend: AWS Lambda Function URL.
- Raw imports: private S3 bucket with lifecycle retention.
- Operational records and materialized views: DynamoDB on-demand tables partitioned by tenant ID.
- Secrets: SSM Parameter Store SecureString parameters, not source code.
- Login: pilot JWT auth with configurable users and roles.
- SSO-ready option: Cognito Hosted UI plus API Gateway JWT authorization.
- Approval control: planner actions require approver/admin role to approve.

## AI Boundary

Natural-language questions use safe predefined operational views. The model never receives database credentials and does not generate SQL. If OpenAI is configured, the backend sends a row-limited JSON context for explanation only. If the model call fails or no key is configured, the app falls back to deterministic rule-based answers.

## Audit And Monitoring

The hosted pilot records audit and monitoring events for logins, imports, action approvals, API errors, import failures, slow requests/jobs, and failed AI calls. The Status page exposes a 24-hour monitoring summary for pilot operators. Optional SNS alerts can notify an owner when failures occur.

## Retention And SIEM

- Raw uploads default to 365-day S3 lifecycle retention.
- Import status defaults to 90-day retention.
- App audit events default to 180-day retention.
- Immutable audit export is available through S3 Object Lock, defaulting to 2,555 days when enabled.
- SIEM ingestion should use the immutable S3 archive or a buyer-approved HTTP forwarder after endpoint auth and schema are reviewed.

## Edge Protection

The static frontend includes security headers for MIME sniffing, clickjacking, referrer policy, permissions policy, HSTS, and CSP review. The hosted Cognito auth path can add AWS WAF with managed common rules and IP rate limiting. API-request WAF requires CloudFront or REST API Gateway.

## Current Limitations

This MVP is appropriate for a controlled low-traffic pilot. Before enterprise rollout, finalize buyer-specific DPA terms, production tenant provisioning, SIEM forwarding, custom-domain review, formal security questionnaire signoff, and ERP writeback review if writeback is requested.
