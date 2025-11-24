# AI On-Demand Query Tools

**Status**: Proposed (Not Implemented)
**Date**: November 23, 2024
**Priority**: Medium

## Problem Statement

The AI assistant currently has limited visibility into user data, which causes issues with bulk operations:

- **Current Limitation**: AI can only see first 10 todo tasks, 5 in-progress tasks, and a count of completed tasks
- **User Impact**: When user asks "delete all my tasks" with 50 tasks, AI can only delete the first 10 it sees
- **Root Cause**: Workspace context is pre-loaded and limited to avoid overwhelming the AI with tokens

## Current Architecture

### Workspace Context Snapshot

The system currently uses a **pre-loaded snapshot** approach:

1. On chat page load (`onMount`), workspace context is loaded once from `/apps/web/src/lib/db/context.ts`
2. This snapshot is sent with EVERY message in the system prompt
3. AI sees the same limited view for entire conversation until page refresh
4. Hardcoded limits in `loadTasksSummary()`:
   - First 10 todo tasks
   - First 5 in-progress tasks
   - Count of completed tasks (no individual items)
   - First 15 notes
   - All projects with stats

**Trade-offs:**
- ✅ Simple implementation
- ✅ Single query per chat session
- ✅ Always included in context
- ❌ Limited visibility
- ❌ Stale data (until refresh)
- ❌ Wasteful tokens (sent with every message)

## Proposed Solution

### Hybrid Approach: Snapshot + On-Demand Tools

Keep the existing workspace snapshot for general context, but add query tools for when AI needs complete data:

**Tools to Add:**

1. **`query_tasks`**
   - Fetch all tasks with optional filters
   - Parameters: `status` (todo/in_progress/completed), `project_id`, `limit`
   - Returns: Complete list of tasks with all fields

2. **`query_notes`**
   - Fetch all notes with optional filters
   - Parameters: `project_id`, `search_term`, `limit`
   - Returns: Complete list of notes with content

3. **`query_projects`**
   - Fetch all projects with stats
   - Parameters: `include_stats` (task counts, note counts)
   - Returns: Complete list of projects

### When AI Uses Each Approach

**Use Workspace Snapshot:**
- General conversation context
- Creating a few tasks/notes
- Quick lookups
- Showing what's available

**Use Query Tools:**
- Bulk operations ("delete all tasks")
- Searching ("find all tasks about X")
- Complete listings ("show me all my notes")
- When snapshot limit is insufficient

## Implementation Plan

### Step 1: Add Supabase Client to Worker

```typescript
// /apps/worker/src/index.ts
import { createClient } from '@supabase/supabase-js'

// In fetch handler:
const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    global: {
      headers: {
        Authorization: `Bearer ${userAuthToken}`
      }
    }
  }
)
```

**Dependencies:**
```bash
cd apps/worker
pnpm add @supabase/supabase-js
```

### Step 2: Pass Auth Token from Frontend

**Current request format:**
```typescript
{
  message: string,
  conversationHistory: ChatMessage[],
  conversationSummary?: string,
  workspaceContext: string,
  context: { scope: 'tasks' | 'notes' | ... }
}
```

**Updated request format:**
```typescript
{
  message: string,
  conversationHistory: ChatMessage[],
  conversationSummary?: string,
  workspaceContext: string,
  context: { scope: 'tasks' | 'notes' | ... },
  authToken: string  // NEW: User's session token
}
```

**Frontend changes** (all chat pages):
```typescript
const { data: { session } } = await supabase.auth.getSession();

const response = await fetch(`${PUBLIC_WORKER_URL}/api/ai/chat`, {
  method: 'POST',
  body: JSON.stringify({
    message: userMessage,
    // ... other fields
    authToken: session?.access_token
  })
});
```

### Step 3: Add Query Tool Definitions

```typescript
// /apps/worker/src/index.ts - add to tools array
{
  name: 'query_tasks',
  description: 'Query all user tasks with optional filters. Use when you need to see complete task list beyond workspace snapshot.',
  input_schema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['todo', 'in_progress', 'completed', 'all'],
        description: 'Filter by task status. Use "all" to see everything.'
      },
      project_id: {
        type: 'string',
        description: 'Filter by project ID (optional)'
      },
      limit: {
        type: 'number',
        description: 'Max results (default 100, max 500)'
      }
    }
  }
},
{
  name: 'query_notes',
  description: 'Query all user notes with optional filters.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'string',
        description: 'Filter by project ID (optional)'
      },
      search_term: {
        type: 'string',
        description: 'Search in title and content (optional)'
      },
      limit: {
        type: 'number',
        description: 'Max results (default 50, max 200)'
      }
    }
  }
},
{
  name: 'query_projects',
  description: 'Query all user projects.',
  input_schema: {
    type: 'object',
    properties: {
      include_stats: {
        type: 'boolean',
        description: 'Include task/note counts (default true)'
      }
    }
  }
}
```

### Step 4: Implement Tool Use Loop

**Current flow:**
```
User message → AI response → Check if tool_use → Return to frontend
```

**New flow with tool use loop:**
```
User message → AI response → Check if tool_use
  ↓
  If query tool: Execute query → Format results → Send back to AI → AI continues
  ↓
  If action tool: Return to frontend for confirmation
```

**Implementation:**
```typescript
// Simplified pseudo-code
let messages = [...conversationHistory, { role: 'user', content: message }];
let continueLoop = true;

while (continueLoop) {
  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    messages: messages,
    tools: tools
  });

  if (response.stop_reason === 'tool_use') {
    const toolUse = response.content.find(b => b.type === 'tool_use');

    if (['query_tasks', 'query_notes', 'query_projects'].includes(toolUse.name)) {
      // Execute query tool
      const results = await executeQueryTool(toolUse.name, toolUse.input, supabase);

      // Add AI message + tool result to conversation
      messages.push({
        role: 'assistant',
        content: response.content
      });
      messages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(results)
        }]
      });

      // Continue loop - AI will process results
      continue;
    }

    if (['propose_operations', 'ask_questions'].includes(toolUse.name)) {
      // Action tools - return to frontend
      return formatResponseForFrontend(toolUse);
    }
  }

  // No tool use - return conversational message
  continueLoop = false;
  return { type: 'message', message: response.content[0].text };
}
```

### Step 5: Update System Prompt

Add documentation about when to use tools:

```typescript
systemPrompt += `

## Query Tools (Use Sparingly)

You have access to query tools to fetch complete lists when needed:

- **query_tasks**: Use when user asks for bulk operations on all tasks, or when workspace snapshot is insufficient
- **query_notes**: Use when user needs to search across all notes or see complete list
- **query_projects**: Use when user needs complete project details

⚠️ Only use query tools when necessary. The workspace snapshot is sufficient for most operations.

Examples:
- "Create 3 tasks" → Use snapshot (no query needed)
- "Delete all my tasks" → Use query_tasks to see complete list
- "Find notes about meeting" → Use query_notes with search
`;
```

## Security Consideration: RLS

### The Problem

**Current setup:**
- Worker has `SUPABASE_ANON_KEY` only
- No user authentication context in worker
- If we query Supabase with anon key, RLS blocks access (no authenticated user)

### Solution Options

#### Option 1: Pass Auth Token (Recommended) ✅

**Approach:**
1. Frontend sends user's session token with each chat request
2. Worker creates authenticated Supabase client using that token
3. RLS policies work normally - user can only see their own data

**Pros:**
- ✅ Secure - RLS policies enforced
- ✅ Standard authentication pattern
- ✅ User can only access their data

**Cons:**
- ❌ Token passed through worker (acceptable, HTTPS encrypted)
- ❌ Need to handle token expiry

**Implementation:** See Step 2 above

#### Option 2: Service Role Key ❌

**Approach:**
- Add `SUPABASE_SERVICE_ROLE_KEY` to worker env
- Bypass RLS entirely
- Worker has full database access

**Pros:**
- ✅ Simple implementation
- ✅ No token passing needed

**Cons:**
- ❌ Security risk - any bug could expose all user data
- ❌ No RLS protection
- ❌ Not recommended for production

#### Option 3: Frontend Queries

**Approach:**
- Add query tools that tell frontend to execute query
- Frontend queries Supabase (already authenticated)
- Frontend sends results back to worker
- Worker continues conversation

**Pros:**
- ✅ Auth stays in frontend
- ✅ RLS enforced
- ✅ No token passing

**Cons:**
- ❌ Much more complex flow
- ❌ Multiple round-trips frontend ↔ worker ↔ frontend
- ❌ Harder to maintain

### Recommendation

**Use Option 1: Pass Auth Token**
- Standard pattern used by most AI applications
- Secure with proper token handling
- Clean implementation

## Example User Flows

### Example 1: Delete All Tasks

**User:** "Delete all my tasks"

**Flow:**
1. AI receives message with workspace snapshot (shows 10 tasks)
2. AI uses `query_tasks` tool with `status: 'all'`
3. Worker queries Supabase, returns all 50 tasks
4. AI receives complete list in tool result
5. AI uses `propose_operations` tool with 50 delete operations
6. Frontend shows confirmation modal with all 50 tasks
7. User confirms → Frontend executes deletions

### Example 2: Search Notes

**User:** "Find all my notes about the marketing campaign"

**Flow:**
1. AI uses `query_notes` tool with `search_term: 'marketing campaign'`
2. Worker queries Supabase with LIKE search
3. Returns matching notes
4. AI formats results as conversational message
5. Frontend displays message to user

### Example 3: Create Tasks (No Query Needed)

**User:** "Create 3 tasks for my workout plan"

**Flow:**
1. AI sees workspace snapshot (sufficient context)
2. AI uses `propose_operations` tool directly
3. No query tools needed - snapshot is enough

## Benefits

**For Users:**
- ✅ Bulk operations work correctly
- ✅ Can search across all data
- ✅ AI sees complete context when needed
- ✅ No more "I can only see X items" limitations

**For System:**
- ✅ More efficient token usage (only query when needed)
- ✅ Always up-to-date data (no stale snapshot)
- ✅ Scalable (can handle unlimited data)
- ✅ Maintains existing behavior for common cases

## Trade-offs

**Pros:**
- Complete visibility into user data when needed
- Token-efficient (only loads what's needed)
- Always up-to-date
- Maintains simple snapshot for common cases

**Cons:**
- More complex implementation
- Multiple API round-trips for tool use
- Auth token must be passed through worker
- Slower for query operations (vs snapshot)

## Open Questions

1. **Token expiry handling**: How to handle expired auth tokens in worker?
2. **Query limits**: What are reasonable defaults and maximums for each tool?
3. **Caching**: Should query results be cached during conversation?
4. **Error handling**: How should worker handle query failures?
5. **Rate limiting**: Do we need rate limits on query tools?

## Related Files

- `/apps/worker/src/index.ts` - Worker AI endpoint
- `/apps/web/src/lib/db/context.ts` - Workspace context loading
- `/apps/web/src/routes/tasks/+page.svelte` - Tasks chat
- `/apps/web/src/routes/notes/+page.svelte` - Notes chat
- `/apps/web/src/routes/chat/+page.svelte` - Global chat
- `/apps/web/src/routes/projects/[id]/chat/+page.svelte` - Project chat

## Future Enhancements

1. **Aggregation tools**: `count_tasks`, `summarize_notes`
2. **Advanced filters**: Date ranges, complex queries
3. **Batch queries**: Query multiple entities in one call
4. **Streaming results**: For very large datasets
5. **Query optimization**: Cache frequently accessed data
