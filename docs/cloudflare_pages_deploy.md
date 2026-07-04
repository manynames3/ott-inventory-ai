# Cloudflare Pages Deployment

The frontend is configured as a static Next.js export so Cloudflare Pages can build it from GitHub without Docker.

Cloudflare references:

- Next.js static export guide: https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/
- Pages build configuration: https://developers.cloudflare.com/pages/configuration/build-configuration/
- Git integration guide: https://developers.cloudflare.com/pages/get-started/git-integration/

## GitHub

Create a GitHub repository and push this project:

```bash
git init
git add .
git commit -m "Build StockSense AI MVP"
git branch -M main
git remote add origin https://github.com/<GH_USERNAME>/<REPOSITORY_NAME>.git
git push -u origin main
```

The included GitHub Actions workflow runs frontend type checking and a static build on pushes and pull requests that touch `frontend/`.

## Primary Deployment: GitHub Actions To Cloudflare Pages

The active production path is `.github/workflows/cloudflare-pages-deploy.yml`. Pushes to `main` that touch `frontend/**` build the static export, deploy with Wrangler, and verify the live bundle.

Configure these GitHub repository secrets:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Token with Cloudflare Pages write access. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID. |

Manual deploys use the same workflow through `workflow_dispatch`. Manual runs fail fast when Cloudflare secrets are missing; push runs still build and typecheck, but skip deployment with a warning.

Current deployment:

- GitHub: https://github.com/manynames3/ott-inventory-ai
- Cloudflare Pages: https://otokistocksense.pages.dev

Optional repository variables:

| Variable | Default |
| --- | --- |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://3eorxcthij.execute-api.us-west-2.amazonaws.com` |
| `NEXT_PUBLIC_AUTH_MODE` | `cognito` |
| `NEXT_PUBLIC_COGNITO_DOMAIN` | `https://ott-inventory-ai-mvp-636305658578.auth.us-west-2.amazoncognito.com` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | `hfnqc87er9c4suqd4qgf0ppuq` |
| `NEXT_PUBLIC_COGNITO_REDIRECT_URI` | `https://otokistocksense.pages.dev/login` |
| `NEXT_PUBLIC_COGNITO_LOGOUT_URI` | `https://otokistocksense.pages.dev/login` |

The workflow creates a Pages project named `otokistocksense` if it does not already exist, then deploys the static output to the `main` branch deployment.

## Local Deployment Fallback

Use this only when GitHub Actions is unavailable:

```bash
cd frontend
npm ci
NEXT_PUBLIC_DEMO_MODE=false \
NEXT_PUBLIC_AUTH_MODE=cognito \
NEXT_PUBLIC_API_BASE_URL=<api_gateway_url> \
NEXT_PUBLIC_COGNITO_DOMAIN=<cognito_domain> \
NEXT_PUBLIC_COGNITO_CLIENT_ID=<cognito_user_pool_client_id> \
NEXT_PUBLIC_COGNITO_REDIRECT_URI=https://otokistocksense.pages.dev/login \
NEXT_PUBLIC_COGNITO_LOGOUT_URI=https://otokistocksense.pages.dev/login \
npm run build
CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<account_id> npm run deploy:cloudflare
```

## Cloudflare Pages Settings

In Cloudflare:

1. Go to Workers & Pages.
2. Create a Pages application.
3. Import the GitHub repository.
4. Use these build settings:

| Setting | Value |
| --- | --- |
| Framework preset | `Next.js (Static HTML Export)` |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `out` |
| Production branch | `main` |

## Environment Variables

For the hosted pilot, use the live backend:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| `NEXT_PUBLIC_AUTH_MODE` | `cognito` |
| `NEXT_PUBLIC_API_BASE_URL` | `<api_gateway_url>` |
| `NEXT_PUBLIC_COGNITO_DOMAIN` | `<cognito_domain>` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | `<cognito_user_pool_client_id>` |
| `NEXT_PUBLIC_COGNITO_REDIRECT_URI` | `https://otokistocksense.pages.dev/login` |
| `NEXT_PUBLIC_COGNITO_LOGOUT_URI` | `https://otokistocksense.pages.dev/login` |

For the current live pilot, those values are:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_AUTH_MODE` | `cognito` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://3eorxcthij.execute-api.us-west-2.amazonaws.com` |
| `NEXT_PUBLIC_COGNITO_DOMAIN` | `https://ott-inventory-ai-mvp-636305658578.auth.us-west-2.amazoncognito.com` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | `hfnqc87er9c4suqd4qgf0ppuq` |
| `NEXT_PUBLIC_COGNITO_REDIRECT_URI` | `https://otokistocksense.pages.dev/login` |
| `NEXT_PUBLIC_COGNITO_LOGOUT_URI` | `https://otokistocksense.pages.dev/login` |

Use demo mode only for offline/static fallback builds:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.example.com` |

Also update the backend `CORS_ORIGINS` value to include the Cloudflare Pages domain, such as `https://otokistocksense.pages.dev`.

For the low-idle AWS pilot backend with Cognito enabled, use the Terraform output `api_gateway_url`. The frontend strips a trailing slash automatically, so the raw output value can be pasted as-is. Do not append `/prod`; the current HTTP API uses the `$default` stage.

## Deployment Verification

After deploy:

```bash
FRONTEND_URL=https://otokistocksense.pages.dev \
EXPECTED_API_BASE_URL=<api_gateway_url> \
EXPECTED_AUTH_MODE=cognito \
node scripts/verify_live_frontend.mjs
```

Then run the live backend smoke test from the repo root:

```bash
API_BASE_URL=<api_gateway_url> \
COGNITO_CLIENT_ID=<cognito_user_pool_client_id> \
COGNITO_USERNAME=<admin_email> \
COGNITO_PASSWORD=<password> \
scripts/live_smoke_test.sh
```

## Backend Hosting Note

Cloudflare Pages hosts the frontend. For the low-idle hosted MVP with Cognito enabled, point `NEXT_PUBLIC_API_BASE_URL` at the API Gateway URL created by Terraform in [../infra/terraform](../infra/terraform). The FastAPI + PostgreSQL backend remains useful for local development and richer paid-pilot deployments, but it is not the default <$10/month hosting path.
