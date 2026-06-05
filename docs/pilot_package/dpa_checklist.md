# DPA And Procurement Checklist

This is not legal advice or a signed DPA. It is the checklist StockSense AI should use with a buyer before loading real operating data.

## Parties And Scope

- Confirm pilot sponsor, technical owner, and data owner.
- Confirm whether StockSense AI acts as processor/service provider for uploaded operating exports.
- Confirm pilot term, renewal rules, and deletion date.
- Confirm data categories and explicitly exclude consumer PII, payment data, HR data, and credentials.

## Data Handling

- Define approved file sources: ERP exports, WMS exports, order history, inbound shipment files.
- Define approved upload paths: web import, S3 landing, scheduled S3 scan, or optional managed SFTP.
- Confirm retention windows for raw files, audit events, import history, and immutable archive.
- Confirm whether raw uploads should be deleted at pilot end or retained for model validation.

## Access And Roles

- Confirm named users and role assignment:
  - Planner: review, note, dismiss.
  - Approver: approve actions.
  - Admin: manage pilot state.
- Confirm SSO requirement: Cognito Hosted UI pilot path, enterprise SAML/OIDC later if required.
- Confirm offboarding process and maximum token/session duration.

## Subprocessors And Services

- Cloudflare Pages for frontend hosting.
- AWS services for backend, storage, auth, monitoring, and optional WAF/SFTP.
- OpenAI only when LLM augmentation is configured; deterministic fallback remains available.

## Security Review

- Validate security headers and custom-domain plan.
- Decide whether AWS WAF is required for the pilot.
- Decide whether immutable audit archive is required.
- Decide whether SIEM ingestion should use S3 archive pull, S3 event forwarding, or a customer HTTP endpoint.
- Confirm incident contact and alert email.

## Pilot Exit

- Export approved/dismissed action ledger.
- Export weekly ROI report.
- Export or delete uploaded files per buyer instruction.
- Disable users and rotate/revoke secrets.
- Document forecast validation results and known data-quality gaps.
