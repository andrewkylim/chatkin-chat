# Deployment Guide

## Project Names

**Cloudflare Pages (Web App):**
- Project Name: `chatkin-os`
- Domain: `chatkin-os.pages.dev` + 2 other domains
- Deploy Command: `pnpm run deploy:web` or `pnpm --filter web deploy`

**Cloudflare Workers (AI Worker):**
- Project Name: `chatkin-os-worker`
- No production routes configured
- Deploy Command: `pnpm run deploy:worker` or `pnpm --filter worker deploy`

## Deployment Commands

### Web App (Cloudflare Pages)
```bash
# Build and deploy
pnpm run deploy:web

# Or from web directory
cd apps/web
pnpm run deploy
```

### Worker (Cloudflare Workers)
```bash
# Build and deploy
pnpm run deploy:worker

# Or from worker directory
cd apps/worker
pnpm run deploy
```

### Deploy Both
```bash
# From root directory
pnpm run deploy:web && pnpm run deploy:worker
```

## Pre-Deployment Checklist

1. **Run TypeScript checks:**
   ```bash
   pnpm run typecheck
   ```

2. **Build web app:**
   ```bash
   pnpm run build:web
   ```

3. **Build worker:**
   ```bash
   pnpm run build:worker
   ```

4. **Commit changes:**
   ```bash
   git add .
   git commit -m "Your commit message"
   ```

5. **Deploy:**
   ```bash
   pnpm run deploy:web
   pnpm run deploy:worker
   ```

## Environment Variables

### Web App
Set in Cloudflare Pages dashboard:
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_WORKER_URL`

### Worker
Set in Cloudflare Workers dashboard or via wrangler:
- `ANTHROPIC_API_KEY`

## CI/CD with GitHub Actions

### Overview

The project includes two GitHub Actions workflows for automated testing and deployment:

1. **CI Workflow** (`.github/workflows/ci.yml`) - Runs on all PRs and pushes
2. **Deploy Workflow** (`.github/workflows/deploy.yml`) - Runs on pushes to main

### GitHub Secrets Setup

Configure these secrets in: Repository Settings → Secrets and variables → Actions

#### Required Secrets

1. **CLOUDFLARE_API_TOKEN**
   - Create at [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - Use "Edit Cloudflare Workers" template
   - Add "Cloudflare Pages" permissions (edit)

2. **CLOUDFLARE_ACCOUNT_ID**
   - Find in Cloudflare Dashboard (right sidebar)

3. **PUBLIC_SUPABASE_URL**
   - Your Supabase project URL

4. **PUBLIC_SUPABASE_ANON_KEY**
   - From Supabase Dashboard → Settings → API

5. **PUBLIC_SENTRY_DSN** (Optional)
   - Your Sentry DSN for the web app

### Cloudflare Worker Secrets

Set worker runtime secrets using Wrangler CLI:

```bash
cd apps/worker

# Required secrets
echo "your-key" | pnpm wrangler secret put ANTHROPIC_API_KEY
echo "your-url" | pnpm wrangler secret put SUPABASE_URL
echo "your-key" | pnpm wrangler secret put SUPABASE_ANON_KEY

# Optional: Sentry error tracking
echo "your-dsn" | pnpm wrangler secret put SENTRY_DSN
```

### Automated Deployment Flow

1. Push code to feature branch
2. Open Pull Request → CI runs automatically
3. Merge to `main` → Deploy workflow runs
4. Both apps deployed to production

### Manual Deployment Trigger

1. Go to GitHub Actions tab
2. Select "Deploy" workflow
3. Click "Run workflow" → Select `main` → Run

### Health Checks

After deployment:
- Worker: `https://chatkin.ai/api/health`
- Web: `https://chatkin.ai`
- Sentry: Check dashboard for errors

### Troubleshooting

**CI Fails:**
```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build:web && pnpm build:worker
```

**Deployment Fails:**
- Verify GitHub secrets are set
- Check Cloudflare API token permissions
- Review GitHub Actions logs

**Worker Secrets:**
```bash
cd apps/worker
pnpm wrangler secret list  # View secrets
echo "value" | pnpm wrangler secret put NAME  # Update
```

### Rollback

```bash
git checkout <previous-commit>
pnpm --filter worker deploy
pnpm --filter web deploy
```

## Notes

- The types package may show false positive TypeScript errors when running root-level typecheck due to SvelteKit path aliases. Always verify individual app typechecks pass.
- Web app build warnings for accessibility (a11y) are informational and don't block deployment.
- Both projects are deployed independently and can be deployed separately as needed.
- CI workflow generates coverage reports available in GitHub Actions artifacts.
