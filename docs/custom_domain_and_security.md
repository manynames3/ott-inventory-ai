# Custom Domain And Pilot Security

This document describes the buyer-facing access story for the low-idle StockSense AI MVP. It keeps the pilot inexpensive while making the product feel evaluable by an operations or supply chain team.

## Current Hosted Shape

- Frontend: Cloudflare Pages static deployment.
- Backend API: AWS Lambda Function URL.
- Raw upload storage: private Amazon S3 bucket.
- Query and dashboard store: DynamoDB on-demand tables.
- Secrets: AWS SSM Parameter Store.
- Authentication: pilot username/password exchanged for a signed bearer token.

This is intentionally not an enterprise identity platform yet. It is enough for a controlled low-traffic pilot where named users test uploaded exports and recommendations before any ERP integration is approved.

## Custom Domain Plan

Recommended pilot hostname:

```text
stocksense.<company-domain>
```

For example, a buyer-safe demo could use:

```text
stocksense.example.com
```

Cloudflare Pages supports custom domains from the Pages project. The Pages flow is:

1. Open Cloudflare dashboard.
2. Go to Workers & Pages.
3. Select the StockSense AI Pages project.
4. Open Custom domains.
5. Set up the domain.
6. If the domain is managed in Cloudflare DNS, Cloudflare can create the needed record. If DNS is external, create the CNAME record requested by Cloudflare.

Reference: Cloudflare Pages custom domain docs: https://developers.cloudflare.com/pages/configuration/custom-domains/

After the frontend custom domain is live, add it to the backend CORS allowlist in Terraform:

```hcl
cors_origins = [
  "https://stocksense.pages.dev",
  "https://stocksense.example.com"
]
```

Then apply:

```bash
cd infra/terraform
terraform plan
terraform apply
```

Cloudflare Pages environment variables do not need to change for a frontend-only custom domain. Keep:

```text
NEXT_PUBLIC_API_BASE_URL=https://<lambda-function-url>
NEXT_PUBLIC_DEMO_MODE=false
```

Only change `NEXT_PUBLIC_API_BASE_URL` if the API itself later receives a custom domain.

## Login And Session Story

For the MVP:

- The login form posts credentials directly to the Lambda API.
- The API compares credentials with values stored in SSM Parameter Store.
- The API returns a signed token with a 12-hour TTL.
- The frontend stores the token in browser local storage.
- Every protected API request sends `Authorization: Bearer <token>`.
- The API rejects missing, expired, or invalid tokens.

Why this is acceptable for a pilot:

- There are no hardcoded credentials in the repository or frontend build.
- The backend is the only component that can read SSM secrets.
- The public Cloudflare Pages site cannot fetch live operational data without a valid token.
- Raw uploads land in a private S3 bucket and are processed into normalized query tables.
- Login, upload URL creation, import preview, import commit, and query actions are written to the audit trail.
- The MVP has no ERP writeback path, so it cannot create purchase orders, shipments, or financial transactions.

## Security Hardening Before A Paid Pilot

Before inviting buyer users beyond a narrow demo group, do these:

1. Rotate the pilot password and token secret in SSM.
2. Restrict CORS to the production Pages custom domain and remove temporary localhost origins.
3. Add Cloudflare Access in front of the custom domain for email allowlisting or buyer SSO.
4. Add per-user audit metadata to imports and query requests.
5. Enable S3 object encryption and lifecycle rules for uploaded files.
6. Add a raw-file retention policy agreed with the buyer.
7. Add explicit terms in the pilot agreement that uploaded exports are used only for recommendation evaluation.

Cloudflare Access can protect a self-hosted web application with identity provider policies and application tokens. Reference: https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/

Cloudflare Pages preview deployments can also be gated with Access policies for internal review links. Reference: https://developers.cloudflare.com/pages/configuration/preview-deployments/

Note: add the Pages custom domain before layering access policies. Cloudflare documents known issues when attempting to add some custom domains after Access policies are already enabled. Reference: https://developers.cloudflare.com/pages/platform/known-issues/

## Production Security Path

For a larger paid rollout, replace the pilot login with one of these:

- Cloudflare Access in front of the whole app for low-cost SSO/email allowlisting.
- Amazon Cognito for app-native user pools and per-user claims.
- Buyer SSO through OIDC/SAML once procurement/security review starts.

Recommended path:

1. Keep the current SSM-backed pilot login for the first controlled demo.
2. Add Cloudflare Access for buyer-facing pilot users because it can gate the Pages custom domain without adding always-on compute.
3. Move to buyer SSO or Cognito only when multiple customer accounts, roles, and audit requirements appear.

## Buyer Explanation

Use this concise explanation in sales or onboarding:

> StockSense AI is a read-only decision layer for pilot evaluation. Users upload ERP/WMS exports, the system validates them, stores raw files privately, and turns the data into FEFO, waste-risk, stockout, reorder, and customer-cadence recommendations. The MVP does not write back to SAP or Oracle. Access is limited by login today and can be upgraded to Cloudflare Access or buyer SSO before a paid rollout.
