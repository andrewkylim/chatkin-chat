# Chatkin OS - Planning Notes

> **⚠️ DRAFT DOCUMENT - NOT FINAL SPECIFICATION**
>
> These are working notes from our planning discussion. This is NOT the final technical specification.
> Many decisions are still open for discussion. Use this to capture our thinking and guide future decisions.

**Last Updated:** 2025-11-22
**Status:** ✅ DECISIONS FINALIZED - Ready for Technical Specification

---

## Table of Contents

1. [Vision & Core Concept](#vision--core-concept)
2. [What We're Building](#what-were-building)
3. [Tech Stack Decisions](#tech-stack-decisions)
4. [Frontend Framework Analysis](#frontend-framework-analysis)
5. [Backend Architecture](#backend-architecture)
6. [Mobile Chat UI Pattern](#mobile-chat-ui-pattern)
7. [What to Keep from MVP](#what-to-keep-from-mvp)
8. [Open Questions - User Flows](#open-questions---user-flows)
9. [Next Steps](#next-steps)

---

## Vision & Core Concept

### Product Vision
**AI-First Productivity Suite** - A personal productivity tool where you chat with AI to manage everything. The AI creates projects, populates tasks, generates notes, and handles research automatically.

### Key Differentiators from MVP
- **Personal-first** (not team collaboration focus)
- **AI creates the structure** (not just participates in chat)
- **Persistent user data** (not temporary rooms)
- **Proper authentication** (user accounts required)
- **Long-term storage** (projects from months ago still there)

### Core User Journey (Hypothesis)
```
User: "I'm planning my wedding in June 2026"
AI: "I'll create a wedding planning project for you!"
→ AI generates:
   • Project: Wedding Planning
   • 12 tasks with due dates
   • Initial notes with vendor research
   • Checklist tracking
→ User sees everything populated in UI
→ Can check off tasks, add notes, ask AI for more help
```

---

## What We're Building

### Scope: v1 Features (1-2 month timeline)

**Essential Features:**
- ✅ **Tasks/To-dos** - Task management with due dates, assignments, priorities, projects
- ✅ **Notes/Docs** - Rich text notes, documents, knowledge base
- ✅ **Chat/Messaging** - Real-time chat with AI (smart assistant)
- ✅ **Authentication** - Proper user accounts (email/password or magic links)

**AI Capabilities:**
- ✅ **Smart Assistant** - One AI that helps you be productive
- ✅ **Natural Language Interface** - Control everything via chat ("schedule meeting Friday", "create task list for project X")
- ✅ **Background Intelligence** - Auto-categorizes, suggests due dates, finds connections
- ✅ **Auto-Creation** - AI creates projects and populates tasks/notes/research

**Collaboration Model:**
- Personal-first (primarily for individual use)
- Sharing is secondary feature (can add later)
- No team workspaces in v1

**NOT in v1:**
- ❌ Calendar/Scheduling (v2)
- ❌ Team collaboration features
- ❌ AI personas (keep it simple, add later)
- ❌ File uploads (maybe - TBD)

---

## Tech Stack Decisions

### ✅ DECIDED: Core Stack

```
Frontend:  SvelteKit + TypeScript
Backend:   Supabase (PostgreSQL + Auth + Realtime)
AI Layer:  Cloudflare Workers → Anthropic Claude API
Storage:   Cloudflare R2
Hosting:   Cloudflare Pages
```

### Why This Stack?

**SvelteKit:**
- Faster development (less boilerplate than React)
- Smaller bundles (better mobile performance)
- Built-in routing, SSR, API routes
- Works perfectly with our mobile chat UI pattern
- 1-2 month timeline = need efficiency

**Supabase:**
- PostgreSQL (robust, supports complex queries)
- Built-in Auth (email/password, magic links, OAuth ready)
- Row Level Security (automatic data isolation per user)
- Realtime subscriptions (multi-device sync if needed)
- Better than rolling our own DB + auth

**Cloudflare Workers:**
- AI API calls (Claude integration)
- Streaming responses
- File upload handling
- Edge deployment (low latency)

**Cloudflare R2:**
- Cheaper than alternatives ($0.015/GB vs $0.021/GB)
- **$0 egress fees** (huge cost savings)
- Already have it available

### ❌ NOT Using (Initially)

**Durable Objects:**
- Not needed for v1
- Adds complexity
- Supabase handles persistence better
- Could add later for chat optimization if needed

**Rationale:** Current MVP uses DOs for ephemeral collaborative rooms. New app needs persistent personal data → Database is better fit.

---

## Frontend Framework Analysis

### Why NOT React?
- More boilerplate
- Larger bundles
- We're building solo (ecosystem size less critical)
- Can migrate later if needed

### Why SvelteKit Over Vanilla JS?
- Need routing, state management, build tooling anyway
- TypeScript for type safety
- Component model = code reuse
- Still keeps our mobile chat UI pattern

### Mobile Chat UI Requirements
**Critical:** Must preserve the working viewport pattern from MVP that solved our mobile keyboard issues.

---

## Mobile Chat UI Pattern

### What Works (From MVP)

**The Problem We Solved:**
- Mobile keyboard covering input
- Viewport scrolling issues
- Input area not staying visible

**The Solution (WhatsApp's approach):**

#### 1. Viewport Meta Tag
```html
<meta name="viewport"
      content="width=device-width,
               initial-scale=1.0,
               maximum-scale=1.0,
               user-scalable=no,
               viewport-fit=cover,
               interactive-widget=resizes-content">
```

**Key:** `interactive-widget=resizes-content` tells mobile browsers to resize viewport when keyboard appears.

#### 2. Full-Height Flexbox Container
```css
html, body {
    height: 100%;
    overflow: hidden;
}

#chat-app {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    flex-direction: column;
}
```

#### 3. Flex Layout Structure
```
┌─────────────────────┐
│ Header              │ ← flex-shrink: 0 (fixed)
│ (flex-shrink: 0)    │
├─────────────────────┤
│                     │
│ Messages            │ ← flex: 1 (grows)
│ (flex: 1)           │   overflow-y: auto
│ overflow-y: auto    │   (scrolls independently)
│                     │
├─────────────────────┤
│ Input Area          │ ← flex-shrink: 0 (fixed)
│ (flex-shrink: 0)    │
└─────────────────────┘
```

#### 4. Touch Scrolling
```css
.messages {
    -webkit-overflow-scrolling: touch;
    overflow-y: auto;
}
```

### ✅ CONFIRMED: This Pattern Works with SvelteKit

The CSS pattern is framework-agnostic. Svelte implementation:

```svelte
<div class="chat-app">
  <header class="chat-header">...</header>
  <div bind:this={messagesEl} class="messages">
    {#each messages as msg}
      <Message {msg} />
    {/each}
  </div>
  <form class="input-container">...</form>
</div>

<style>
  /* Exact CSS from working MVP */
</style>
```

---

## Backend Architecture

### ✅ DECIDED: Supabase-First Architecture

```
┌─────────────┐
│ SvelteKit   │
│   App       │
└──────┬──────┘
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────┐  ┌─────────────┐  ┌──────────────┐
│  Supabase    │  │ Cloudflare  │  │ Cloudflare   │
│              │  │ Workers     │  │ R2           │
│ • Auth       │  │             │  │              │
│ • PostgreSQL │  │ • AI APIs   │  │ • Files      │
│ • Realtime   │  │ • Uploads   │  │ • Exports    │
└──────────────┘  └─────────────┘  └──────────────┘
```

### Component Responsibilities

**Supabase:**
- ✅ Authentication (JWT tokens, session management)
- ✅ Database (users, projects, tasks, notes, AI conversations)
- ✅ Realtime subscriptions (optional for multi-device sync)
- ✅ Row Level Security (users only see their own data)

**Cloudflare Workers:**
- ✅ AI API calls (Claude API for chat, generation, analysis)
- ✅ Streaming responses (AI typing effect)
- ✅ File uploads (to R2)
- ✅ Heavy computation

**Cloudflare R2:**
- ✅ File storage (uploads, exports, attachments)
- ✅ Cheaper than Supabase Storage
- ✅ Zero egress fees

**SvelteKit:**
- ✅ Frontend rendering
- ✅ API routes (proxy to Cloudflare for AI, direct to Supabase for data)
- ✅ Auth session management

### Why NOT Durable Objects?

**Current MVP uses DOs because:**
- Ephemeral collaborative rooms
- Real-time multi-user chat
- Temporary data (ok to lose when room ends)

**New app needs:**
- Persistent user data (long-term storage)
- Complex queries (filter tasks, search notes)
- Multi-device access (any device can query DB)
- No data loss (user's task from 6 months ago must exist)

**Database (PostgreSQL) is better for:**
- Long-term persistence
- Complex querying and relationships
- Full-text search
- Data integrity

**Could add DOs later for:**
- Active AI chat sessions (ultra-low latency)
- Real-time collaboration (if we add it)
- But NOT needed for v1

### Database Schema (Draft)

```sql
-- Users (handled by Supabase Auth)

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo', -- todo, in_progress, done
  priority TEXT, -- low, medium, high
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT,
  content TEXT, -- or JSONB for rich text
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT, -- Auto-generated summary
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations ON DELETE CASCADE,
  role TEXT NOT NULL, -- user, assistant
  content TEXT NOT NULL,
  metadata JSONB, -- Store tool calls, structured outputs
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can access own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access own tasks" ON tasks
  FOR ALL USING (auth.uid() = user_id);

-- etc...
```

### API Routes (Draft)

```typescript
// Cloudflare Workers Endpoints

// Main AI Chat
POST /api/ai/chat
Body: {
  conversationId?: string,
  message: string,
  context?: {
    projectId?: string,
    taskIds?: string[]
  }
}
Response: Streaming AI response

// Structured Generation
POST /api/ai/generate
Body: {
  type: 'project' | 'tasks' | 'notes',
  prompt: string
}
Response: {
  structured: { ... },
  explanation: string
}

// Analysis/Suggestions
POST /api/ai/analyze
Body: {
  type: 'tasks' | 'notes' | 'project',
  data: { ... }
}
Response: {
  suggestions: [...],
  insights: string
}

// File Upload
POST /api/upload
Body: FormData with file
Response: {
  url: string,
  r2_key: string
}
```

### Cost Estimate

**Supabase Free Tier:**
- 500MB database
- Unlimited API requests
- Cost: $0/month

**Cloudflare Free Tier:**
- 100,000 Worker requests/day
- 10GB R2 storage
- Unlimited egress
- Cost: $0/month

**When exceeding free tier:**
- Supabase Pro: $25/month (8GB DB, much more)
- Cloudflare Workers: $5/month for 10M requests
- R2 storage: ~$1.50/month for 100GB

**Total: ~$30/month at significant scale**

---

## What to Keep from MVP

### ✅ Keep (From Current Chatkin MVP)

**Design System:**
- ✅ Entire CSS color palette
- ✅ Typography (Inter font, weights, letter spacing)
- ✅ Component styles (buttons, inputs, cards, messages)
- ✅ Border radius values (6px, 8px, 12px)
- ✅ Spacing system
- ✅ Dark mode color scheme
- ✅ Mobile-first responsive patterns

**Mobile Chat UI:**
- ✅ Viewport meta tag configuration
- ✅ Flexbox layout structure (header, messages, input)
- ✅ Touch scrolling CSS
- ✅ Message bubble styles
- ✅ Input container design

**AI Personas (Maybe Later):**
- ✅ Persona system prompts (can adapt)
- ✅ Brainstormer, Organiser, Peacekeeper, Champion, etc.
- Note: Not in v1, but can add later

**Design Assets:**
- ✅ Logo (logo.webp)
- ✅ Icons (chat.png, tasks.png, etc.)
- ✅ Favicon set

### ❌ Rebuild from Scratch

**Architecture:**
- 🔄 From Durable Objects → Supabase database
- 🔄 From inline HTML/CSS/JS → SvelteKit components
- 🔄 From WebSocket rooms → REST API + optional Realtime
- 🔄 From sessionStorage → Proper auth + persistent storage

**Code:**
- 🔄 From vanilla JS → TypeScript
- 🔄 From manual DOM manipulation → Svelte reactivity
- 🔄 From inline styles → CSS modules/scoped styles
- 🔄 From copy-paste code → Reusable components

**Features:**
- 🔄 From temporary rooms → Persistent projects
- 🔄 From no auth → User accounts
- 🔄 From collaborative chat → Personal AI assistant
- 🔄 From room-based tasks → User's task database

---

## Open Questions - User Flows

> **🚨 CRITICAL:** Need to finalize these before locking architecture

### 1. Onboarding & First Experience

**Question:** When a new user arrives, what happens?

**Options:**
- **A) Immediate AI Chat:** Sign up → Straight to chat → AI asks "What would you like to work on?"
- **B) Traditional Setup:** Sign up → Dashboard → "Create Project" button
- **C) Guided Setup:** Sign up → Onboarding wizard → AI generates initial workspace

**Decision:** TBD

---

### 2. Primary Interface

**Question:** What's the main screen users see every day?

**Options:**

**A) Chat-Centric:**
```
┌─────────────────────────────────────┐
│  Chat with AI (always visible)      │
│  "What do you need help with?"      │
├─────────────────────────────────────┤
│  Below: Your Projects, Tasks, Notes │
└─────────────────────────────────────┘
```

**B) Dashboard + Floating Chat:**
```
┌──────────────────┬──────────────────┐
│  Sidebar         │  Dashboard       │
│  • Projects      │  • Today's Tasks │
│  • Tasks         │  • Recent Notes  │
│  • Notes         │  • AI Insights   │
└──────────────────┴──────────────────┘
                    [Chat Button] →
```

**C) Unified Workspace (Notion-like):**
```
┌─────────────────────────────────────┐
│  Wedding Planning                   │
├─────────────────────────────────────┤
│  Chat │ Tasks │ Notes │ Files       │
├─────────────────────────────────────┤
│  [Tab Content]                      │
└─────────────────────────────────────┘
```

**Decision:** TBD

**Architecture Impact:**
- Routing structure (`/` vs `/chat` vs `/projects/:id`)
- State management (global vs per-project)
- Loading strategy (eager vs lazy)

---

### 3. How AI Creates Things

**Question:** When user says "Plan my wedding", what happens?

**Options:**

**A) Immediate Creation:**
```
User: "Plan my wedding"
↓
AI: "I've created a wedding planning project with 12 tasks!"
↓
[Project appears immediately in UI]
```

**B) Preview & Confirm:**
```
User: "Plan my wedding"
↓
AI: "I suggest:
     • Project: Wedding Planning
     • 12 tasks (book venue, invitations, etc.)
     Create this?"
↓
User: "Yes" or "Modify XYZ"
↓
[Created after confirmation]
```

**C) Conversational Building:**
```
User: "Plan my wedding"
AI: "When's the wedding?"
User: "June 2026"
AI: "How many guests?"
User: "150"
AI: "Here's your plan..." [creates]
```

**Decision:** TBD

**Architecture Impact:**
- AI response format (streaming vs structured)
- Database writes (immediate vs deferred)
- UI update pattern (optimistic vs confirmed)

---

### 4. Navigation Between Features

**Question:** User has multiple projects. How do they navigate?

**Options:**

**A) Project-Centric:**
```
Projects List → Wedding Planning → Tasks, Notes, Chat
                                    (all scoped to this project)
```

**B) Feature-Centric:**
```
All Tasks (across all projects)
All Notes (across all projects)
Chat (global, knows about everything)
```

**C) Hybrid:**
```
Sidebar:
  ├─ All Tasks
  ├─ All Notes
  ├─ Projects
  │   ├─ Wedding
  │   │   ├─ Tasks
  │   │   └─ Notes
  │   └─ House Reno
```

**Decision:** TBD

**Architecture Impact:**
- Routing structure
- Data fetching strategy
- Chat context awareness

---

### 5. Chat Context & Memory

**Question:** User is working on Wedding, then switches to House Renovation. How does chat context work?

**Options:**

**A) Single Continuous Chat:**
```
User: "Help plan my wedding"
[creates wedding project]
...later...
User: "I need to renovate my house"
[creates house project, remembers wedding]
User: "What's my next task?"
AI: "For wedding or house?" (or assumes based on recency)
```

**B) Chat Per Project:**
```
Wedding Planning → Has its own chat (knows wedding context)
House Renovation → Separate chat (knows house context)
Global Chat → For general questions
```

**C) Single Chat + Explicit Context:**
```
[UI shows: Currently: Wedding Planning]
User: "Switch to house"
AI: "Now focused on House Renovation"
User: "What's next?"
AI: [answers about house]
```

**Decision:** TBD

**Architecture Impact:**
- Conversation storage (per-user vs per-project)
- Message retrieval (how much history to load)
- Context window management

---

### 6. Mobile vs Desktop UX

**Question:** Should mobile and desktop have different flows?

**Mobile:**
- Bottom navigation: [Chat] [Projects] [Tasks] [Notes]
- Or: Hamburger menu + FAB for chat

**Desktop:**
- Sidebar always visible
- Multi-column layout possible
- Chat in main area or side panel?

**Decision:** TBD

**Architecture Impact:**
- Responsive breakpoints
- Component visibility logic
- Navigation patterns

---

### 7. Task Management

**Question:** How does user check off a task?

**Options:**

**A) Direct from List:**
```
Task List → Tap checkbox → Done
AI might comment: "Great! Next: Send invitations"
```

**B) Chat-Driven:**
```
User: "Mark book venue as done"
AI: "✓ Marked complete! Next task?"
[Task updates in background]
```

**C) Both:**
```
Can check in UI OR tell AI
Both update same data
AI celebrates/suggests next
```

**Decision:** TBD

**Architecture Impact:**
- Task update API
- Real-time sync needs
- AI notification patterns

---

### 8. Real-Time Requirements

**Question:** Does AI auto-update UI when it creates things, or does user manually refresh?

**Options:**

**A) Optimistic Updates:**
```
User asks AI to create project
→ AI response streams in
→ UI shows project immediately (before DB confirms)
→ If DB write fails, rollback + show error
```

**B) Confirmed Updates:**
```
User asks AI to create project
→ AI response streams in
→ Wait for DB write to complete
→ Then show project in UI
```

**C) Hybrid:**
```
Show AI response immediately
Show loading state for project
Update when DB confirms
```

**Decision:** TBD

**Architecture Impact:**
- Supabase Realtime subscriptions (needed or not)
- Optimistic UI patterns
- Error handling strategy

---

## Open Technical Questions

### Data & State

1. **Initial data loading:** Load everything upfront or lazy load per project?
2. **Chat history:** Load all conversations or just recent N messages?
3. **Offline support:** Should app work offline? (v1 vs v2)
4. **Multi-device sync:** Automatic via Realtime or manual refresh?

### AI Integration

5. **AI confirmation flow:** Auto-create or preview first?
6. **Tool calling:** Should AI be able to call functions (create_project, add_task)?
7. **Streaming:** Stream full response or just show after complete?
8. **Model choice:** Sonnet for everything or Haiku for simple tasks?

### File Storage

9. **File uploads in v1?** Yes or no?
10. **File types:** If yes, what types? (PDFs, images, documents)
11. **Access control:** Signed URLs or proxy through Worker?

---

## Design System Extraction (From MVP)

### Color Palette

**Light Mode:**
```css
--bg-primary: #F7F5F3;      /* Warm beige background */
--bg-secondary: #FFFFFF;     /* White cards/containers */
--bg-tertiary: #FBF9F7;      /* Subtle background */
--text-primary: #2A2A2A;     /* Dark gray text */
--text-secondary: #737373;   /* Medium gray */
--text-muted: #A3A3A3;       /* Light gray */
--border-color: #E0DDD9;     /* Subtle tan border */
--accent-primary: #C77C5C;   /* Terracotta/rust */
--accent-hover: #B86C4C;     /* Darker terracotta */
--accent-success: #5D9B76;   /* Sage green */
--danger: #D32F2F;           /* Red */
```

**Dark Mode:**
```css
--bg-primary: #0D0D0D;
--bg-secondary: #1A1A1A;
--bg-tertiary: #242424;
--text-primary: #E8E8E8;
--text-secondary: #999999;
--text-muted: #666666;
--border-color: #2A2A2A;
```

### Typography

**Font:**
- Primary: 'Inter' (Google Fonts)
- Fallback: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif

**Weights:**
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700

**Letter Spacing:**
- Body: -0.01em
- Headings: -0.02em to -0.03em (tighter)

**Line Height:**
- Body: 1.5-1.6
- Headings: 1.2-1.4

### Spacing

**Border Radius:**
- Small: 6px
- Medium: 8px
- Large: 12px

**Padding:**
- Compact: 12px
- Standard: 16px, 20px
- Spacious: 24px

**Gaps:**
- Tight: 8px
- Standard: 12px, 16px
- Loose: 20px, 24px

### Components

**Buttons:**
```css
.primary-btn {
  background: #2A2A2A;
  color: white;
  padding: 16px;
  border-radius: 8px;
  font-weight: 600;
}
.primary-btn:hover {
  background: #3A3A3A;
  transform: translateY(-1px);
}
.primary-btn:active {
  transform: translateY(0);
}
```

**Inputs:**
```css
input {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 16px;
  background: var(--bg-secondary);
}
input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
}
```

**Message Bubbles:**
```css
.message-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  max-width: 85%;
}
.message.user .message-bubble {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
}
.message.ai .message-bubble {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
}
```

---

## Implementation Roadmap (Draft)

### Phase 1: Foundation (Week 1-2)
- [ ] SvelteKit project setup + TypeScript
- [ ] Supabase project + database schema
- [ ] Authentication flow (login/signup)
- [ ] Design system implementation (CSS)
- [ ] Basic routing structure

### Phase 2: AI Chat Core (Week 3-4)
- [ ] Chat UI (using working mobile pattern)
- [ ] Cloudflare Worker for AI endpoint
- [ ] Claude API integration
- [ ] Streaming responses
- [ ] Save conversations to Supabase

### Phase 3: Data Generation (Week 5-6)
- [ ] AI generates projects from chat
- [ ] AI generates tasks from chat
- [ ] AI generates notes from chat
- [ ] Save to Supabase
- [ ] Display in UI

### Phase 4: Core Features (Week 7-8)
- [ ] Projects list/detail views
- [ ] Tasks management (create, edit, delete, check off)
- [ ] Notes editor (basic rich text)
- [ ] Multi-device sync (Supabase Realtime)
- [ ] Polish & bug fixes

### Optional v1 Features (Time Permitting)
- [ ] File uploads (R2)
- [ ] Search (full-text)
- [ ] Export data
- [ ] Dark mode toggle
- [ ] PWA configuration

---

## Next Steps

### Immediate Decisions Needed

1. **User Flow Decisions:**
   - [ ] What's the primary interface? (Chat-centric vs Dashboard vs Unified)
   - [ ] How does AI create things? (Immediate vs Confirm vs Conversational)
   - [ ] Navigation model? (Project-centric vs Feature-centric vs Hybrid)
   - [ ] Chat context? (Single vs Per-project vs Explicit)

2. **UX Priorities:**
   - [ ] Describe typical daily workflow
   - [ ] Mobile vs desktop differences
   - [ ] Real-time vs manual refresh

3. **Feature Scope:**
   - [ ] File uploads in v1? Yes/No
   - [ ] Rich text editor or plain text?
   - [ ] Search functionality in v1?

### After User Flow Decisions

4. **Create Final Specification:**
   - Complete technical spec document
   - Finalize database schema
   - API contract definitions
   - Component hierarchy
   - Detailed implementation plan

5. **Prototype Key Flows:**
   - Build onboarding flow prototype
   - Test AI creation pattern
   - Validate mobile chat UI in SvelteKit

---

## Notes & Thoughts

### Design Philosophy
- **Simplicity over features** - Better to do a few things well
- **Mobile-first** - Most use will be on phone
- **AI-first** - Chat should feel natural, not forced
- **Fast shipping** - 1-2 month timeline means ruthless prioritization

### Technical Philosophy
- **Boring technology** - Proven stack over cutting edge
- **Optimize for development speed** - SvelteKit, Supabase = less code
- **Can always optimize later** - Ship v1, measure, improve
- **Framework-agnostic patterns** - Mobile chat UI can move if needed

### Questions to Keep Asking
- Does this make the user's life easier?
- Can we ship without this feature?
- Is this the simplest approach?
- What's the minimal viable version?

---

## Document Status

**Last Updated:** 2025-11-22
**Contributors:** Andrew, Claude
**Status:** Active Planning
**Next Review:** After user flow decisions finalized

---

## ✅ FINALIZED DECISIONS

### User Flow & UX Decisions

**1. Onboarding:**
- **Decision:** Option A - Start with Global Chat
- User signs up → Immediately in Global Chat
- AI asks "What would you like to work on?"
- More natural, less friction than wizard

**2. How AI Creates Things:**
- **Decision:** Option A - Preview & Confirm
- AI shows what it will create
- User can confirm or modify
- Prevents mistakes, gives user control

**3. Primary Interface:**
- **Decision:** Chat Per Project (with sidebar)
- Global Chat for general questions
- Each project has its own dedicated chat
- Sidebar navigation between chats
- Bottom tabs on mobile (Chat, Projects, Tasks, Notes)

**4. Project Navigation:**
- **Decision:** Clicking project name → Goes directly to project chat (Option B)
- Simpler flow, chat-first approach
- Can add project dashboard later if needed

**5. Task Management:**
- **Decision:** Both UI + Chat (Option A)
- Can check tasks in task list UI
- Can tell AI "mark task as done" via chat
- Both methods update same data

**6. Real-time Updates:**
- **Decision:** Optimistic updates (Option A)
- AI creates project → Shows immediately in UI
- Assumes DB write will succeed
- Error handling if DB write fails

### Technical Decisions

**7. Data Models:**
- **Decision:** Flexible hierarchy (Option B)
```
✅ Tasks can be standalone OR in project
✅ Notes can be standalone OR in project
✅ "Inbox" concept for unorganized items
✅ AI can create tasks even without project
```

**8. Authentication:**
- **Decision:** Social (Google, GitHub) + Email
- Supabase Auth handles all providers
- No password management complexity
- Fast, secure, modern

**9. AI Models:**
- **Decision:** Start with Haiku
- Claude 3.5 Haiku for all requests in v1
- Cheaper, faster
- Can upgrade to Sonnet for complex tasks in v2
- ~$1 per million tokens (vs $3 for Sonnet)

**10. Routing Structure:**
- **Decision:** Chat-first with Hybrid Function Access (Option A + Hybrid)
```
/ → Global Chat (if logged in) or Landing Page
/login → Auth page
/projects → All projects list
/projects/:id/chat → Project chat (redirects here by default)
/tasks → All tasks view with Tasks AI chat
/notes → All notes view with Notes AI chat
/search → Global search
```

**11. Task Properties:**
- **Decision:** Essential fields for v1
```
✅ Title (required)
✅ Description (optional)
✅ Status (todo/in_progress/done)
✅ Due Date (optional)
✅ Priority (low/medium/high)
✅ Project ID (optional - can be standalone)
```

**12. Notes Format:**
- **Decision:** Title + Content Blocks (Option B)
```
Title: "Vendor Research"
Blocks:
  - Text block (rich text)
  - Table block
  - File attachment block
  - Code block (future)
```
- Similar to Notion's block-based editor
- More flexible than simple rich text
- Can add block types incrementally

**13. File Uploads:**
- **Decision:** YES - Include in v1
- Stored in Cloudflare R2
- Supported types: Images, PDFs, Documents
- AI can reference uploaded files
- Attach button in chat + notes
- File metadata in Supabase, actual files in R2

**14. Search:**
- **Decision:** YES - Include in v1
- Global search across projects, tasks, notes
- PostgreSQL full-text search initially
- Search button in sidebar
- Can upgrade to vector/semantic search in v2

**15. Mobile Navigation:**
- **Decision:** Bottom tabs + Hamburger menu
- Hamburger menu for accessing sidebar
- Bottom tabs: Chat, Projects, Tasks, Notes
- Both work together for optimal mobile UX

**21. Individual Function Access (Hybrid Approach):**
- **Decision:** Dedicated pages + Quick-create buttons (Hybrid - Option C)
- Preserves original MVP concept of individual apps
- Integrates seamlessly with chat-per-project model

**Implementation:**
```
Dedicated Pages:
  /tasks → Full tasks view with Tasks AI
    - AI chat (1/3 of screen, scoped to tasks only)
    - Task list (2/3 of screen, with filters/sorting)
    - Can create standalone tasks (project_id = NULL)
    - Tasks AI only knows about tasks, optimized for task management

  /notes → Full notes view with Notes AI
    - AI chat (1/3 of screen, scoped to notes only)
    - Notes list (2/3 of screen, with search)
    - Can create standalone notes (project_id = NULL)
    - Notes AI only knows about notes, optimized for note-taking

Quick-Create Buttons:
  Global Chat Header:
    - [+ Task] button → Creates task via quick modal or navigates to /tasks
    - [+ Note] button → Creates note via quick modal or navigates to /notes
    - Provides fast access without leaving global chat

Bottom Tabs (Mobile):
  [Chat] [Projects] [Tasks] [Notes]
  - Tasks and Notes tabs go to dedicated views
  - Makes individual functions easily discoverable
```

**Benefits:**
- ✅ Preserves "individual apps" concept from original MVP
- ✅ Users can browse/manage all tasks or notes in one view
- ✅ Scoped AI provides focused assistance (Tasks AI vs Notes AI vs Project AI vs Global AI)
- ✅ Supports both standalone and project-based organization
- ✅ Quick-create buttons for power users who stay in global chat
- ✅ Dedicated views for users who want function-specific focus

**Example User Flows:**
```
Flow 1 (Function-first user):
  → Clicks "Tasks" in bottom tabs
  → Sees all tasks with Tasks AI chat
  → "Add task: buy groceries due Friday"
  → Task created (no project)
  → Can organize into project later

Flow 2 (Chat-first user):
  → In global chat, clicks [+ Task]
  → Quick modal or navigate to /tasks
  → Creates task, returns to global chat

Flow 3 (Project-focused user):
  → Working in "Wedding Planning" project chat
  → AI creates tasks within project context
  → Can later view all wedding tasks in /tasks (filtered by project)
```

### AI Context Strategy

**16. Conversation History:**
- **Decision:** Separate contexts per scope (Global, Project, Tasks, Notes)
```
Global Chat:
  - Has its own conversation history
  - AI is AWARE of everything but doesn't load it all
  - Smart context retrieval based on query

Project Chats:
  - Each project has own conversation
  - AI sees only that project's messages
  - AI has full context of that project's tasks/notes

Tasks AI (/tasks):
  - Scoped conversation focused on task management
  - Sees all user's tasks (with project context if needed)
  - Optimized prompts for task creation, prioritization, planning

Notes AI (/notes):
  - Scoped conversation focused on note-taking
  - Sees all user's notes (with project context if needed)
  - Optimized prompts for note organization, summarization, research
```

**17. Global AI Context Loading:**
- **Decision:** Intelligent context retrieval (v1 approach)

**How it works:**
```typescript
When user asks in Global Chat, AI gets:

1. ALWAYS (lightweight summary):
   - Active projects (names + task counts)
   - Tasks due today/this week
   - Recent global chat history (last 30 messages)

2. DYNAMIC (based on query):
   - If mentions specific project → Load that project's full context
   - If asks about tasks → Load filtered tasks
   - If asks about notes → Search relevant notes

3. LIMITS (to stay under token budget):
   - Max 5 project summaries
   - Max 20 tasks
   - Max 10 notes
   - Max 30 messages
```

**SQL queries for context:**
```sql
-- Active projects summary
SELECT id, name,
  (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count
FROM projects p
WHERE user_id = $1
  AND updated_at > NOW() - INTERVAL '30 days'
ORDER BY updated_at DESC
LIMIT 5;

-- Tasks due soon
SELECT * FROM tasks
WHERE user_id = $1
  AND due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
ORDER BY due_date ASC;

-- If query mentions "wedding" → Search
SELECT * FROM projects
WHERE user_id = $1
  AND (name ILIKE '%wedding%' OR description ILIKE '%wedding%')
LIMIT 3;
```

**Future optimization (v2):**
- Add pgvector extension to PostgreSQL
- Create embeddings for projects/tasks/notes
- Semantic search instead of keyword matching
- Even smarter context retrieval

### Infrastructure Decisions

**18. Deployment:**
- **Decision:**
  - SvelteKit → Cloudflare Pages
  - API → Separate Cloudflare Worker project
  - Database → Supabase (hosted PostgreSQL)
  - Storage → Cloudflare R2 (NOT Supabase Storage)
  - Auth → Supabase Auth

**19. Project Structure:**
- **Decision:** Monorepo
```
chatkin-os/
├─ apps/
│  ├─ web/           # SvelteKit app
│  └─ worker/        # Cloudflare Worker (AI API)
├─ packages/
│  ├─ types/         # Shared TypeScript types
│  └─ database/      # Supabase migrations & types
├─ docs/
│  └─ chatkin-os/    # Planning docs & prototypes
└─ package.json      # Root package.json (workspace)
```

### Database Schema (Finalized)

**20. Core Tables:**
```sql
-- Users (Supabase Auth handles this)

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects ON DELETE SET NULL, -- NULL = standalone
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo', -- todo, in_progress, done
  priority TEXT DEFAULT 'medium', -- low, medium, high
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes (block-based)
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects ON DELETE SET NULL, -- NULL = standalone
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note Blocks
CREATE TABLE note_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID REFERENCES notes ON DELETE CASCADE,
  type TEXT NOT NULL, -- text, table, file, code
  content JSONB NOT NULL, -- Block-specific content
  position INTEGER NOT NULL, -- Order in note
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  project_id UUID REFERENCES projects ON DELETE CASCADE, -- NULL = not project-scoped
  scope TEXT NOT NULL DEFAULT 'global', -- 'global', 'project', 'tasks', 'notes'
  title TEXT, -- Auto-generated summary
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations ON DELETE CASCADE,
  role TEXT NOT NULL, -- user, assistant
  content TEXT NOT NULL,
  metadata JSONB, -- Tool calls, structured outputs, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Files (R2 storage)
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  note_id UUID REFERENCES notes ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  r2_key TEXT NOT NULL, -- Path in R2 bucket
  r2_url TEXT NOT NULL, -- Public URL or signed URL
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users access own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own tasks" ON tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own notes" ON notes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own note blocks" ON note_blocks
  FOR ALL USING (
    note_id IN (SELECT id FROM notes WHERE user_id = auth.uid())
  );

CREATE POLICY "Users access own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own messages" ON messages
  FOR ALL USING (
    conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
  );

CREATE POLICY "Users access own files" ON files
  FOR ALL USING (auth.uid() = user_id);

-- Full-text search indexes
ALTER TABLE tasks ADD COLUMN search_vector tsvector;
ALTER TABLE notes ADD COLUMN search_vector tsvector;

CREATE INDEX tasks_search_idx ON tasks USING GIN(search_vector);
CREATE INDEX notes_search_idx ON notes USING GIN(search_vector);

-- Update triggers for search vectors
CREATE OR REPLACE FUNCTION update_task_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_search_update
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_search_vector();
```

---

## Next Steps

### Immediate Actions

1. ✅ **Finalize all decisions** (DONE)
2. ✅ **Update DRAFT-NOTES.md** (IN PROGRESS)
3. **Create formal TECHNICAL-SPEC.md**
   - Full database schema
   - API contracts
   - Component hierarchy
   - Data flow diagrams
   - Deployment instructions

4. **Set up development environment**
   - Initialize monorepo
   - Set up SvelteKit project
   - Set up Cloudflare Worker project
   - Configure Supabase project
   - Connect R2 bucket

5. **Phase 1 Implementation** (Week 1-2)
   - Auth flow (Supabase Auth + social providers)
   - Database setup + migrations
   - Basic routing structure
   - Design system components

---

**Remember:** All major decisions are now finalized. Ready to create the technical specification and start building!
