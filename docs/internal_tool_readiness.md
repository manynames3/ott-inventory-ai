# Internal Tool Readiness

Use this checklist when StockSense AI is deployed as a named-user internal operations tool instead of a public demo.

## 1. Company Sign-In

- Use Cognito Hosted UI, SAML, or OIDC-backed company login.
- Set `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false`.
- Do not use shared demo or admin accounts in the internal environment.
- Keep user roles in `viewer`, `planner`, `approver`, and `admin`.

## 2. Environment Separation

Use separate frontend variables per environment:

| Variable | Demo | Staging | Internal production |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_ENV` | `demo` | `staging` | `internal` |
| `NEXT_PUBLIC_WORKSPACE_NAME` | `Ottogi operations demo` | `StockSense staging` | `<Company> operations workspace` |
| `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | `true` | `false` | `false` |
| `NEXT_PUBLIC_SHOW_DEMO_BANNER` | `true` | `false` | `false` |
| `NEXT_PUBLIC_DEMO_MODE` | `false` or `true` for static fallback | `false` | `false` |

Terraform state should be remote and environment-specific. Do not apply staging or demo variables into internal production.

## 3. No-Handholding Onboarding

- A new user opens Data Setup and sees the five required datasets.
- The Imports page provides templates, mapping preview, validation, and import history.
- Starter sample CSVs are available from Data Setup for format review only.
- Internal production should load real ERP/WMS exports, not sample seed data.

## 4. Admin/User Lifecycle

Admins can manage normal access from `/users`:

- Invite users.
- Change roles.
- Disable users.
- Reset passwords.

These actions are audited by the backend.

## 5. Production Import Workflow

- Users preview mappings before commit.
- Import progress shows selected, uploading, mapping, queued, refreshing, complete, or failed.
- Import history records file, status, row counts, timestamp, message, and validation errors.
- Failed imports should be fixed and re-run before recommendations are trusted.

## 6. Trust And Explainability

- Dashboard shows data freshness and dataset readiness.
- Recommendations include action, reason, confidence, due date, financial impact, and source-derived fields.
- Query answers include safe-view sources and sample record IDs.
- Status page reports AI fallback when no model key is configured.

## 7. Operational Monitoring

Status must show frontend, backend API, named-user login, import storage, query store, and monitoring summary online.

Alerts should be configured for failed imports, API errors, slow jobs, and AI failures before broader rollout.

## 8. End-To-End Testing

Before internal release:

```bash
make verify
FRONTEND_URL=https://<internal-host> \
EXPECTED_API_BASE_URL=<api_gateway_url> \
EXPECTED_AUTH_MODE=cognito \
EXPECTED_APP_ENV=internal \
EXPECTED_DEMO_LOGIN=false \
node scripts/verify_live_frontend.mjs
API_BASE_URL=<api_gateway_url> \
COGNITO_CLIENT_ID=<client_id> \
COGNITO_USERNAME=<named_user> \
COGNITO_PASSWORD=<password> \
scripts/live_smoke_test.sh
```

Then run a user acceptance pass with a planner and approver who are not the builder.

## 9. Security Hardening

- Named users only.
- Least-privilege IAM and private S3 buckets.
- CSP and CORS restricted to known frontend/API/auth domains.
- Secrets in SSM or provider-managed configuration, not source code.
- Audit export reviewed by the internal owner.
- Retention windows approved by the data owner.

## 10. Daily-Use UX

- Avoid auth/backend jargon in user-facing text.
- Keep the dashboard focused on decisions, data freshness, and priority actions.
- Keep Data Setup and Imports usable without engineering context.
- Use `/status` for operational health and `/audit` for control evidence.

## Release Gate

The internal tool is ready when a planner can sign in, load data, review recommendations, add notes, and export a report, and an approver can approve actions, without engineering help.
