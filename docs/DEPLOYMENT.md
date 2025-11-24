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

## Notes

- The types package may show false positive TypeScript errors when running root-level typecheck due to SvelteKit path aliases. Always verify individual app typechecks pass.
- Web app build warnings for accessibility (a11y) are informational and don't block deployment.
- Both projects are deployed independently and can be deployed separately as needed.
