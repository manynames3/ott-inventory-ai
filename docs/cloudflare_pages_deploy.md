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
git commit -m "Build Inventory AI MVP"
git branch -M main
git remote add origin https://github.com/<GH_USERNAME>/<REPOSITORY_NAME>.git
git push -u origin main
```

The included GitHub Actions workflow runs frontend type checking and a static build on pushes and pull requests that touch `frontend/`.

## Primary Deployment: Cloudflare Git Integration

The active production path is Cloudflare Pages connected directly to this GitHub repository. Pushes to `main` that touch the frontend trigger a Cloudflare `github:push` deployment without needing GitHub Actions secrets.

This keeps future pushes from depending on a developer laptop or a GitHub-hosted Wrangler login.

## Manual GitHub Actions Deployment Option

The repo also includes `.github/workflows/cloudflare-pages-deploy.yml` as a manual fallback. It does not run on every push because the Cloudflare Git integration already handles production deploys, and GitHub Actions needs Cloudflare credentials that should not be hardcoded.

Current deployment:

- GitHub: https://github.com/manynames3/ott-inventory-ai
- Cloudflare Pages: https://ott-inventory-ai.pages.dev

To use the manual fallback, add these GitHub repository secrets and run the workflow with `workflow_dispatch`:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Token with Cloudflare Pages write access. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID. |

Optional repository variables:

| Variable | Default |
| --- | --- |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.example.com` |

The workflow creates a Pages project named `ott-inventory-ai` if it does not already exist, then deploys the static output to the `main` branch deployment.

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

Use demo mode before a live backend has a public URL:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.example.com` |

When the backend is hosted publicly, update:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://<your-api-host>` |

Also update the backend `CORS_ORIGINS` value to include the Cloudflare Pages domain, such as `https://ott-inventory-ai.pages.dev`.

For the low-idle AWS pilot backend, use the Terraform output `api_function_url`. The frontend strips a trailing slash automatically, so the raw output value can be pasted as-is.

## Backend Hosting Note

Cloudflare Pages hosts the frontend. For the low-idle hosted MVP, point `NEXT_PUBLIC_API_BASE_URL` at the Lambda Function URL created by Terraform in [../infra/terraform](../infra/terraform). The FastAPI + PostgreSQL backend remains useful for local development and richer paid-pilot deployments, but it is not the default <$10/month hosting path.
