# Deploying Chatkin to Cloudflare

## Architecture

- **Cloudflare Pages**: Serves static frontend (HTML/CSS/JS) via global CDN
- **Cloudflare Workers**: API-only backend, routes WebSocket connections
- **Durable Objects**: One per chat room - handles WebSockets, AI logic, and persistent storage
- **Edge deployment**: Runs globally, <100ms latency worldwide

## Prerequisites

1. Cloudflare account (free tier works)
2. Wrangler CLI installed: `npm install -g wrangler`
3. Logged in: `wrangler login`

## Setup Steps

### 1. Deploy the Worker (API backend)

First, set your Anthropic API key:

```bash
wrangler secret put ANTHROPIC_API_KEY
```

When prompted, paste your API key: `sk-ant-api03-...`

Then deploy the Worker:

```bash
npm run cf:deploy
```

This will build and deploy the Worker to: `https://chatkin.YOUR_SUBDOMAIN.workers.dev`

**Important**: Note the Worker URL - you'll need it for the Pages deployment.

### 2. Deploy to Pages (Frontend)

In the Cloudflare dashboard:

1. Go to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. Select your repository
3. Configure build settings:
   - **Build command**: (leave empty)
   - **Build output directory**: `public`
4. Add environment variable:
   - **Variable name**: `CHATKIN_API_URL`
   - **Value**: Your Worker URL (e.g., `https://chatkin.YOUR_SUBDOMAIN.workers.dev`)
5. Click **Save and Deploy**

Your app will be live at: `https://chatkin.pages.dev`

### 3. Test locally

To test the Worker locally:

```bash
npm run cf:dev
```

This starts the Worker at http://localhost:8787

For the frontend, you can use any static file server. For example:

```bash
cd public
npx serve
```

Then update `public/app.js` to point to `http://localhost:8787` for local testing.

## Commands

**Worker:**
- `npm run build` - Build Worker bundle
- `npm run cf:dev` - Run Worker locally with Wrangler
- `npm run cf:deploy` - Build and deploy Worker to Cloudflare
- `wrangler tail` - Stream production Worker logs
- `wrangler dev --remote` - Test against production Durable Objects

**Pages:**
- Deploy via Cloudflare dashboard (Git integration)
- Or use: `wrangler pages deploy public` for direct deployment

## Cost Estimate

**Free tier:**
- Pages: Unlimited requests, unlimited bandwidth
- Workers: 100,000 requests/day
- Durable Objects: First 1M requests free

**Paid ($5/month minimum):**
- Pages: Always free (no usage charges)
- Workers: $0.50 per million requests
- Durable Objects: $0.15 per million requests
- Storage: $0.20 per GB

**Typical usage:**
- 1000 active users/day ≈ $5-10/month
- Scales automatically to millions
- Frontend (Pages) is free at any scale

## Custom Domain (Optional)

**For Pages (frontend):**
1. Go to your Pages project in the dashboard
2. Click **Custom domains** → **Set up a custom domain**
3. Enter your domain (e.g., `chatkin.yourdomain.com`)

**For Worker (API):**
1. Add a route in the dashboard: Workers & Pages → chatkin → Settings → Triggers
2. Add route: `api.chatkin.yourdomain.com/*`
3. Update `CHATKIN_API_URL` in Pages environment variables

## Troubleshooting

**WebSocket errors:**
- Check Durable Objects are enabled in your Cloudflare dashboard
- Verify API key is set: `wrangler secret list`

**Build errors:**
- Run `npm run build` separately to see detailed errors
- Check `dist/` folder was created

**Can't connect locally:**
- Make sure no other server is running on port 8787
- Try `wrangler dev --local` for fully local testing

## Monitoring

View logs in real-time:
```bash
wrangler tail
```

View in dashboard:
https://dash.cloudflare.com → Workers & Pages → chatkin → Logs

## Rolling Back

```bash
wrangler rollback
```

## File Structure

```
chatkin/
├── src/
│   ├── worker.js          # Worker API entry (WebSocket routing only)
│   ├── chatroom.js        # Durable Object class
│   └── personas.js        # AI persona configs
├── public/
│   ├── index.html         # Frontend HTML (deployed to Pages)
│   ├── style.css          # Frontend CSS (deployed to Pages)
│   ├── app.js             # Frontend JS with native WebSockets (deployed to Pages)
│   └── _routes.json       # Pages routing config
├── dist/                  # Built Worker files (gitignored)
├── wrangler.toml          # Worker config
└── build.js               # Build script (copies Worker files to dist/)
```

## Architecture Flow

```
User Browser
    ↓
Cloudflare Pages (serves index.html, style.css, app.js)
    ↓
app.js connects via WebSocket to Worker API
    ↓
Cloudflare Worker (/api/ws endpoint)
    ↓
Durable Object (per room - handles chat logic)
```
