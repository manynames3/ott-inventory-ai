# ADR 0006: Use Pilot RBAC, Cognito-Ready Auth, And Low-Cost Monitoring

## Status

Accepted

## Context

The MVP needs enough control for a buyer to trust planner approvals and operational monitoring. Full enterprise SSO, admin user management, alert routing, and SIEM integration would add integration time and operational complexity before a paid pilot validates value.

The app also has a strict low-idle cost target, so monitoring should avoid always-on services or paid SaaS dependencies during the first pilot.

## Decision

Use configurable pilot roles in the app:

- `planner`: add notes, dismiss/reopen actions
- `approver`: approve planner actions and clear review history
- `admin`: approval and administrative pilot controls

Credentials and role mappings are configured through environment variables locally or SSM SecureString parameters in the hosted backend. For stronger pilots, Terraform can enable Cognito Hosted UI, planner/approver/admin groups, and API Gateway JWT validation. The backend enforces approval permissions; the frontend only reflects those permissions.

Use low-cost monitoring from existing runtime records:

- API errors and slow API calls are recorded as audit events.
- Import validation/worker failures are recorded in import status and audit events.
- Slow import/refresh jobs are recorded as audit events.
- Failed AI calls record fallback events.
- The Status page exposes a 24-hour monitoring summary.

## Consequences

This gives a controlled pilot credible approval controls and operational visibility without requiring SAML, CloudWatch alarms, or external observability tools on day one. The low-cost password mode remains useful for demos, while Cognito mode gives named-user groups and API Gateway JWT validation for buyer pilots. AWS WAF can protect the Cognito auth path; API-request WAF requires CloudFront or REST API Gateway.

It is not a replacement for enterprise identity and observability. Before broader production rollout, add buyer SSO/SAML or OIDC, admin-managed user provisioning, alert delivery, SIEM forwarding, incident runbooks, and customer-specific retention/security controls.
