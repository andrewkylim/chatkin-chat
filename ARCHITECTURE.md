# Chatkin Architecture

## Overview

Chatkin uses a **Pages + Workers** architecture on Cloudflare for maximum scalability and performance.

## Components

### 1. Cloudflare Pages (Frontend)
**Location**: `public/` directory

Serves static assets globally via CDN:
- `index.html` - Main app UI
- `style.css` - Minimalist styling
- `app.js` - Client-side logic with native WebSocket
- `_routes.json` - Routing config (excludes /api/* from Pages)

**Deployment**:
- Automatically via Git integration
- Or manual: `wrangler pages deploy public`

### 2. Cloudflare Workers (API Backend)
**Location**: `src/worker.js` → builds to `dist/worker.js`

API-only backend that:
- Handles WebSocket upgrade requests at `/api/ws`
- Routes connections to appropriate Durable Objects by room ID
- Provides health check endpoint at `/api/health`
- Returns CORS headers for Pages frontend

**Deployment**: `npm run cf:deploy`

### 3. Durable Objects (Chat Rooms)
**Location**: `src/chatroom.js` → builds to `dist/chatroom.js`

One Durable Object instance per chat room:
- Manages WebSocket sessions for all users in a room
- Handles message broadcasting
- Runs AI decision logic (when to respond)
- Calls Anthropic API for AI responses
- Stores chat history and conversation summaries
- Persists state using Durable Object storage

**AI Personas**: Defined in `src/personas.js`

## Data Flow

```
1. User visits https://chatkin.pages.dev
   └─> Cloudflare Pages serves index.html, style.css, app.js

2. User joins a room
   └─> app.js connects WebSocket to https://chatkin-api.workers.dev/api/ws?room=xxx

3. Worker receives WebSocket request
   └─> Routes to Durable Object for room "xxx"

4. Durable Object handles all chat logic
   ├─> Broadcasts messages to all connected users
   ├─> Decides when AI should respond
   ├─> Calls Anthropic API for AI messages
   └─> Persists chat history to Durable Object storage
```

## Why This Architecture?

**Pages + Workers** provides:

1. **Global CDN for frontend**: Static assets served from 300+ edge locations
2. **WebSocket at the edge**: Low-latency connections worldwide
3. **Per-room isolation**: Each room is a separate Durable Object instance
4. **Auto-scaling**: Handles 1 user or 1 million users
5. **Cost efficiency**: Frontend (Pages) is always free
6. **Separation of concerns**: Frontend and API can be updated independently

## Local Development

**Backend (Worker + Durable Objects):**
```bash
npm run cf:dev
# Runs on http://localhost:8787
```

**Frontend (Pages):**
```bash
cd public
npx serve
# Runs on http://localhost:3000
```

Update `public/app.js` to point to `http://localhost:8787` for local testing.

## Alternative: Node.js Server (Local Only)

For local development, you can also use the Node.js/Express/Socket.io server:

```bash
npm run dev
# Runs on http://localhost:5555
```

This is simpler for quick local testing but won't work with Cloudflare deployment.
