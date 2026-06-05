# StockSense AI Pilot Security Questionnaire

## Product Scope

StockSense AI is a decision-support pilot for expiration-aware inventory, reorder, FEFO, and natural-language operations questions. It does not write back to ERP, WMS, EDI, finance, HR, or payment systems.

## Data Classification

- Expected data: product master, lot-level inventory, customer/account names, historical orders, inbound shipment status, unit cost for ROI.
- Do not upload: consumer PII, payment data, tax IDs, HR records, bank data, credentials, or confidential supplier contracts.
- Customer names are account-level business records, not individual consumer records.

## Authentication And Authorization

- Local/dev mode supports password-based pilot login via environment variables or SSM parameters.
- Hosted pilot can use Cognito Hosted UI with planner, approver, and admin groups.
- Planner role can review, note, and dismiss actions.
- Approver/admin roles can approve recommendations.
- Admin role can clear planner review history.

## Infrastructure

- Frontend: static Next.js app on Cloudflare Pages.
- Low-idle backend: AWS Lambda, DynamoDB on-demand, S3 private raw imports.
- Optional SSO path: Cognito User Pool plus API Gateway JWT authorizer.
- Optional WAF path: AWS WAF on Cognito Hosted UI/auth with managed common rules and IP rate limiting. API-request WAF requires CloudFront or REST API Gateway.
- Optional immutable audit path: S3 Object Lock audit archive.
- Optional managed SFTP: AWS Transfer Family, disabled by default because it has fixed idle cost.

## AI Boundary

- Natural-language queries route to safe materialized views.
- The LLM is not given database credentials and does not generate or execute SQL.
- AI responses include source citations naming the backing materialized view and columns.
- If the LLM fails or no key is configured, deterministic rule-based answers remain available.

## Logging And Monitoring

- Audit events: login, import preview/commit, exports, query, action review, approval, failed auth, and clear actions.
- Monitoring events: API errors, import failures, slow requests/jobs, and failed AI calls.
- Alerting: optional SNS email for operational failures.
- SIEM: immutable S3 audit archive is the default integration path. Direct SIEM HTTP forwarding requires a customer-approved endpoint and secret.

## Retention Defaults

- Raw uploads: 365 days.
- App audit events: 180 days.
- Import status/validation history: 90 days.
- Immutable audit archive: 2,555 days when enabled.

## Current Pilot Limitations

- No production DPA is included in the repo.
- No customer production data has been validated unless the buyer imports it.
- No native ERP writeback is implemented.
- No formal SIEM connector is enabled without buyer configuration.
- No custom domain is configured by default.
