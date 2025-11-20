# Chatkin

AI-mediated chat app where people can have conversations with an AI participant joining the discussion.

## Features

- **Shareable chat rooms**: Google Meet-style room links
- **5 AI personas**: Choose from Peacekeeper, Champion, Challenger, Listener, or Gossip
- **Intelligent AI**: Decides when to respond naturally (not every message)
- **Real-time**: WebSocket-based instant messaging
- **Global scale**: Deployed on Cloudflare's edge network
- **Minimalist design**: Clean, approachable interface

## Quick Start

### Local Development (Node.js)

```bash
npm install
npm run dev
```

Open http://localhost:5555

### Cloudflare Deployment

See [CLOUDFLARE-DEPLOY.md](CLOUDFLARE-DEPLOY.md) for full deployment instructions.

**TL;DR:**
1. Deploy Worker: `npm run cf:deploy`
2. Deploy Pages: Via dashboard or `npm run pages:deploy`

## Architecture

Chatkin uses a **Pages + Workers** architecture:

- **Pages**: Serves frontend (HTML/CSS/JS) via global CDN
- **Workers**: API backend for WebSocket routing
- **Durable Objects**: Per-room state management with AI logic

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

## Project Structure

```
chatkin/
├── public/           # Frontend files (deployed to Pages)
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── _routes.json
├── src/              # Backend files (deployed to Workers)
│   ├── worker.js
│   ├── chatroom.js
│   └── personas.js
├── server.js         # Local Node.js server (dev only)
└── build.js          # Build script for Workers
```

## AI Personas

1. **The Peacekeeper (Alex)**: Mediates conflicts and finds common ground
2. **The Champion (Jordan)**: Motivates and encourages participants
3. **The Challenger (Taylor)**: Questions assumptions and provokes thought
4. **The Listener (Morgan)**: Provides empathetic support
5. **The Gossip (Sienna)**: Stirs conversation and surfaces tensions

## Tech Stack

- **Frontend**: Vanilla JavaScript, WebSocket API
- **Backend**: Cloudflare Workers, Durable Objects
- **AI**: Anthropic Claude (Haiku model)
- **Local dev**: Node.js, Express, Socket.io

## Cost

**Free tier:**
- Pages: Unlimited (always free)
- Workers: 100,000 requests/day
- Durable Objects: 1M requests free

**Typical usage:** $5-10/month for 1000 active users/day

## License

ISC
