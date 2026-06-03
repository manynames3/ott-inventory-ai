# Pilot Readiness Pass

This document summarizes the Phase 1-5 hardening pass that moves StockSense AI closer to a paid, low-traffic pilot without adding enterprise-scale complexity.

## Phase 1: Demo-Worthy

Goal: a buyer should understand the product value inside the app without a guided walkthrough.

Implemented:

- Dashboard copy frames the product around converting expiring stock into revenue.
- Demo-mode API fallbacks cover health, auth, AI status, and import requirements.
- The public demo can show realistic import readiness and system status even when the live API is unavailable.

Success criteria:

- A buyer can see inventory value, expiry risk, stockout risk, reorder value, and priority actions quickly.
- The demo does not fail into an unexplained backend error for common status/onboarding surfaces.

## Phase 2: Usable By Strangers

Goal: a non-technical planner should know what to do first.

Implemented:

- Added the Data Setup page with dataset readiness, required fields, pilot workflow, and next action links.
- Added navigation entries for Data Setup and Status.
- Kept import requirements explicit for products, inventory lots, customers, orders, and inbound shipments.

Success criteria:

- A new user can identify missing files and reach the import flow without external instructions.
- Required columns are visible before a user prepares ERP or spreadsheet exports.

## Phase 3: Chargeable

Goal: a buyer should see enough trust, controls, and evidence to consider a paid pilot.

Implemented:

- Added Security And Data Handling page describing secrets, private uploads, audit events, AI boundaries, and no ERP writeback.
- Added System Status page for frontend mode, backend health, auth, AI mode, raw upload storage, and query store.
- Added CI coverage for backend, frontend, and Terraform validation.

Success criteria:

- A VP of Operations, supply chain lead, or technical reviewer can understand where files go and what the AI can and cannot do.
- The deployment path has automated checks for the main app and infrastructure code.

## Phase 4: Retainable

Goal: the app should support an actual recurring planner workflow, not just a dashboard screenshot.

Implemented:

- Added a Planner Review Queue on the Actions page.
- Planners can add notes and dismiss or reopen recommendations.
- Approver/admin roles can approve recommendations with attribution.
- Planner notes persist to the live backend when available, with browser-local fallback and copy that makes the fallback explicit.
- Reviewed actions can be exported as CSV for follow-up outside the app.

Success criteria:

- A planner can use StockSense AI during a weekly review and leave with an action list.
- Action explanations remain readable without horizontal scrolling.

## Phase 5: Scalable And Defensible

Goal: keep the MVP low-cost while avoiding hardcoded pilot assumptions that block the next customer.

Implemented:

- Added configurable `TENANT_ID` for FastAPI and hosted Lambda.
- Lambda data partitioning now uses `tenant#{TENANT_ID}` instead of a hardcoded default partition.
- Auth tokens and `/api/auth/me` expose tenant context, and token verification rejects mismatched tenant claims.
- Pilot auth supports configurable planner, approver, and admin roles without storing credentials in source code.
- Status monitoring summarizes API errors, import failures, slow requests/jobs, and failed AI calls.
- Terraform includes a `tenant_id` variable and passes it into Lambda environment variables.
- The guided pilot package includes customer-specific sample data, a security brief, and weekly ROI report template.

Success criteria:

- Future pilot tenants can be separated by configuration instead of source-code edits.
- Pilot reviewers can see approval controls and monitoring signals without opening cloud consoles.
- The architecture still stays within the low-idle serverless model.

## Still Not Production Enterprise

Remaining work before a serious enterprise rollout:

- SSO/SAML or OAuth and admin user management.
- Formal tenant provisioning, retention policy controls, audit export, and monitoring alert delivery.
- ERP adapter implementation for SAP/Oracle extracts or scheduled secure file transfer.
- A signed security questionnaire, DPA, and incident-response/runbook materials.
