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

Use demo mode before the FastAPI backend has a public URL:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.example.com` |

When the backend is hosted publicly, update:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://<your-api-host>` |

Also update the backend `CORS_ORIGINS` value to include the Cloudflare Pages domain, such as `https://inventory-ai.pages.dev`.

## Backend Hosting Note

Cloudflare Pages hosts the frontend. The MVP backend remains FastAPI + PostgreSQL and should be hosted separately on a Python-capable platform or exposed temporarily with a secure tunnel for demos. The static frontend will still render demo data when the API is unavailable.
