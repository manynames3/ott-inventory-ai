# User Acceptance Test Results - 2026-07-04

Environment:

- Frontend: `https://otokistocksense.pages.dev`
- Backend: `https://3eorxcthij.execute-api.us-west-2.amazonaws.com`
- Auth: Cognito Hosted UI, user pool `us-west-2_6wXXYb4iW`
- Browser viewport checks: desktop and 390px mobile width

## Results

| Area | Result | Evidence |
| --- | --- | --- |
| Public frontend deployment | Pass | Cloudflare production deployment `e6d19300-444c-4934-9e1e-0ccbf0452605` serves `/`, `/users/`, and `/admin/` from the production Pages URL with HTTP 200 responses. |
| Frontend bundle verification | Pass | `scripts/verify_live_frontend.mjs` passed with expected API Gateway URL and `cognito` auth mode. |
| Backend smoke test | Pass | `scripts/live_smoke_test.sh` passed with Cognito token, CORS preflight, `/api/auth/me`, and `/api/dashboard`. |
| Cognito sign-in | Pass | Browser UAT redirected to Cognito, accepted the admin test user, and returned to the dashboard. |
| Dashboard render | Pass | KPI dashboard loaded with inventory value, waste exposure, stockout, reorder, and planner action content. |
| Admin user lifecycle | Pass | `/users` loaded 4 Cognito users. A disposable viewer user was created with invitation email suppressed, appeared in the table, and was deleted from Cognito after the test. |
| Admin tenant lifecycle | Pass | `/admin` loaded tenant profile, lifecycle, billing, and enterprise SSO fields. The browser UI save path showed `Account settings saved.` and the API write path was verified. |
| Mobile dashboard | Pass | 390px viewport rendered without page-level horizontal overflow after responsive CSS fix. |
| Mobile admin and users pages | Pass | 390px viewport rendered `/admin` and `/users` without page-level horizontal overflow. |
| Console health | Pass | Browser UAT reported no console warnings or errors during admin and users checks. |
| Terraform state | Pass | Existing live AWS stack imported into the S3 backend; post-apply `terraform plan -var-file=live.auto.tfvars.example` returned no changes. |

## Screenshots

Screenshots were captured locally during UAT:

- `/tmp/stocksense-dashboard-uat-fixed.png`
- `/tmp/stocksense-users-uat-fixed.png`
- `/tmp/stocksense-mobile-dashboard-uat-fixed.png`
- `/tmp/stocksense-mobile-users-uat-fixed.png`
- `/tmp/stocksense-admin-desktop-uat.png`
- `/tmp/stocksense-users-desktop-uat.png`
- `/tmp/stocksense-admin-mobile-uat.png`
- `/tmp/stocksense-users-mobile-uat.png`

## Cleanup

The disposable UAT users were deleted from Cognito after testing. The user pool returned to 4 users.
