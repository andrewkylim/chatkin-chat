# Chatkin OS

AI-powered productivity suite - Personal task management, notes, and intelligent chat assistance.

## Architecture

**Frontend:** SvelteKit + TypeScript
**Backend:** Supabase (PostgreSQL + Auth) + Cloudflare Workers (AI)
**Storage:** Cloudflare R2
**Hosting:** Cloudflare Pages + Workers

## Project Structure

```
chatkin-os/
├── apps/
│   ├── web/              # SvelteKit frontend app
│   └── worker/           # Cloudflare Worker (AI API)
├── packages/
│   ├── types/            # Shared TypeScript types
│   └── database/         # Supabase migrations
├── docs/
│   └── chatkin-os/       # Planning documentation
└── README.md
```

## Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Supabase account** (free tier available)
- **Cloudflare account** (free tier available)
- **Anthropic API key** (for Claude AI)

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd chatkin-os
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings → API
3. Copy your project URL and anon key
4. Run the database migration:

```bash
# In Supabase SQL Editor, run:
packages/database/migrations/001_initial_schema.sql
```

### 4. Set Up Cloudflare

1. Create a Cloudflare account
2. Install Wrangler CLI (if not installed):
   ```bash
   npm install -g wrangler
   ```
3. Login to Cloudflare:
   ```bash
   wrangler login
   ```
4. Create an R2 bucket:
   ```bash
   wrangler r2 bucket create chatkin-files
   wrangler r2 bucket create chatkin-files-dev
   ```

### 5. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:
```env
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

For the Worker, set secrets using Wrangler:
```bash
cd apps/worker
wrangler secret put ANTHROPIC_API_KEY
# Paste your API key when prompted
```

### 6. Run Development Servers

In separate terminals:

**Terminal 1 - Frontend (SvelteKit):**
```bash
pnpm dev:web
# Runs on http://localhost:5173
```

**Terminal 2 - Worker (AI API):**
```bash
pnpm dev:worker
# Runs on http://localhost:8787
```

## Development Workflow

### Running Tests
```bash
pnpm test
```

### Type Checking
```bash
pnpm typecheck
```

### Linting & Formatting
```bash
pnpm lint
pnpm format
```

### Building for Production

**Build frontend:**
```bash
pnpm build:web
```

**Build worker:**
```bash
pnpm build:worker
```

## Deployment

### Deploy Frontend (Cloudflare Pages)

```bash
pnpm deploy:web
```

Or connect your repo to Cloudflare Pages for automatic deployments.

### Deploy Worker

```bash
pnpm deploy:worker
```

## Database Migrations

Migrations are located in `packages/database/migrations/`.

To apply migrations:
1. Go to your Supabase project dashboard
2. Open the SQL Editor
3. Run the migration SQL files in order

## Tech Stack Details

- **SvelteKit** - Frontend framework
- **TypeScript** - Type safety across the codebase
- **Supabase** - PostgreSQL database, authentication, and real-time subscriptions
- **Cloudflare Workers** - Serverless AI API endpoints
- **Cloudflare R2** - File storage (zero egress fees)
- **Cloudflare Pages** - Frontend hosting
- **Anthropic Claude** - AI chat and generation (Haiku model for v1)

## Documentation

See `docs/chatkin-os/` for:
- `DRAFT-NOTES.md` - Complete planning and architecture decisions
- `prototype.html` - Initial UI prototype
- `prototype-v2.html` - Updated UI with finalized features

## License

Private project - All rights reserved
