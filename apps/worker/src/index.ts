/**
 * Chatkin OS Worker
 * Handles AI API calls, file uploads, and other serverless functions
 */

import Anthropic from '@anthropic-ai/sdk';

export interface Env {
  ANTHROPIC_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  CHATKIN_BUCKET: any; // R2Bucket type from Cloudflare Workers
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

interface ChatRequest {
  conversationId?: string;
  message: string;
  conversationHistory?: ChatMessage[];
  conversationSummary?: string; // AI-generated summary of older messages
  workspaceContext?: string; // Formatted workspace context (projects, tasks, notes)
  context?: {
    projectId?: string;
    taskIds?: string[];
    scope?: 'global' | 'tasks' | 'notes' | 'project';
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route requests
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // AI Chat endpoint
    if (url.pathname === '/api/ai/chat') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const body = await request.json() as ChatRequest;
        const { message, conversationHistory, conversationSummary, workspaceContext, context } = body;

        if (!message) {
          return new Response(JSON.stringify({ error: 'Message is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Initialize Anthropic client
        const anthropic = new Anthropic({
          apiKey: env.ANTHROPIC_API_KEY,
        });

        // Define tools for structured operations
        // NOTE: ask_questions is listed FIRST because it must be used before propose_operations
        const tools = [
          {
            name: 'ask_questions',
            description: 'REQUIRED FIRST STEP for all create operations. When a user asks to create a task/note/project, you MUST call this tool immediately - do NOT respond with text. This tool shows a modal with multiple choice questions. Only after receiving answers should you use propose_operations.',
            input_schema: {
              type: 'object' as const,
              properties: {
                questions: {
                  type: 'array' as const,
                  items: {
                    type: 'object' as const,
                    properties: {
                      question: {
                        type: 'string' as const,
                        description: 'The question to ask'
                      },
                      options: {
                        type: 'array' as const,
                        items: { type: 'string' as const },
                        description: 'Multiple choice options (user can also select "Other" to provide custom answer)'
                      }
                    },
                    required: ['question', 'options']
                  }
                }
              },
              required: ['questions']
            }
          },
          {
            name: 'propose_operations',
            description: 'Propose create/update/delete operations to user for confirmation. Use this ONLY AFTER you have gathered complete information via ask_questions tool. This is Step 2 in the creation workflow - information gathering (ask_questions) comes first.',
            input_schema: {
              type: 'object' as const,
              properties: {
                summary: {
                  type: 'string' as const,
                  description: 'Brief summary of what you will do (e.g., "I\'ll create 3 tasks for your workout plan")'
                },
                operations: {
                  type: 'array' as const,
                  items: {
                    type: 'object' as const,
                    properties: {
                      operation: {
                        type: 'string' as const,
                        enum: ['create', 'update', 'delete'],
                        description: 'The type of operation'
                      },
                      type: {
                        type: 'string' as const,
                        enum: ['task', 'note', 'project'],
                        description: 'The type of item'
                      },
                      id: {
                        type: 'string' as const,
                        description: 'Item ID (required for update/delete, from workspace context)'
                      },
                      data: {
                        type: 'object' as const,
                        description: 'Item data (for create operations)'
                      },
                      changes: {
                        type: 'object' as const,
                        description: 'Fields to update (for update operations)'
                      },
                      reason: {
                        type: 'string' as const,
                        description: 'Reason for deletion (for delete operations)'
                      }
                    },
                    required: ['operation', 'type']
                  }
                }
              },
              required: ['summary', 'operations']
            }
          }
        ];

        // Build system prompt with context if provided
        let systemPrompt = `You are a helpful AI assistant for Chatkin OS, a productivity suite. You help users manage tasks, notes, and projects.

${workspaceContext || ''}

## CRITICAL RULE - MANDATORY FOR ALL CREATE OPERATIONS

When a user asks to create a task, note, or project:
1. NEVER respond with conversational text asking what they want
2. ALWAYS use the ask_questions tool immediately to gather required information
3. ONLY after receiving answers, use propose_operations tool
4. NEVER go back to conversational mode mid-workflow

This is NON-NEGOTIABLE. Do NOT ask conversationally - use the ask_questions tool.

**Required Questions by Type:**

FOR TASKS - You MUST ask ALL 3 questions using the ask_questions tool:
- Question 1: "What's the task?" - Options: Provide 3-4 common task suggestions based on context (e.g., "Buy groceries", "Schedule appointment", "Pay bills"), user will select or type their own
- Question 2: "When should this be done?" - Options: ["Today", "Tomorrow", "This week", "Next week", "No specific deadline"]
- Question 3: "How important is this?" - Options: ["High priority (urgent)", "Medium priority", "Low priority"]

Ask ALL THREE questions in a SINGLE ask_questions tool call. Do NOT split into multiple calls or use conversational text.

FOR NOTES - Ask these specific questions:
- Question 1: "What topic is this note about?" - Options: [suggest relevant topics based on context]
- Question 2: "How detailed should it be?" - Options: ["Brief summary", "Standard notes", "Comprehensive guide"]

FOR PROJECTS - Ask these specific questions:
- Question 1: "What's this project for?" - Options: [let user type in "Other"]
- Question 2: "What's the timeline?" - Options: ["1-2 weeks", "1-3 months", "3+ months", "Ongoing/No deadline"]

## Tools Available

You have access to two tools:

### 1. propose_operations
Use this tool ONLY AFTER gathering complete information via ask_questions. This is Step 2 of the creation workflow:
- You propose operations with a summary (after Step 1 information gathering)
- User reviews and confirms
- System executes the operations

For create operations, you MUST use ask_questions FIRST to gather required details (priority, due date for tasks; purpose for projects; detail level for notes).

### 2. ask_questions
PREFER using this tool whenever you need information from the user. Provide helpful multiple choice options with sensible defaults - users can always select "Other" to provide custom input. This creates a better UX than conversational back-and-forth.

Use this tool when:
- User request is ambiguous or lacks details (e.g., "create a note" without specifying content)
- You need to gather specific information (title, priority, category, etc.)
- Multiple options would help the user decide (common categories, priorities, date options)
- Clarification would improve the quality of what you create

Always provide 2-4 helpful options that represent common choices. Make options specific and actionable.

IMPORTANT: Do NOT include "Other" in your options array - the system automatically adds it to every question.

## Character Limits (STRICT)
- Task titles: 50 characters max
- Note titles: 50 characters max
- Project names: 50 characters max
- Project descriptions: 200 characters max
- Task/note descriptions: No limit

If a title/name would exceed the limit, shorten it intelligently and suggest the full version in the description.

## Quality-Focused Creation Workflow

CRITICAL: Follow this workflow for ALL create operations to ensure high-quality output:

**Step 1: INFORMATION GATHERING (use ask_questions tool)**
Before proposing any create operation, check if you have COMPLETE information:

For TASKS, you need:
- ✓ Title (under 50 chars)
- ✓ Priority (low/medium/high) - ALWAYS ask unless user explicitly specified
- ✓ Due date - ALWAYS ask "when should this be done?" unless user said "no deadline" or "sometime"
  - Offer options like: Today, Tomorrow, This week, Next week, No specific deadline

For NOTES, you need:
- ✓ Title (under 50 chars)
- ✓ Topic/content understanding - what should the note contain?
- ✓ Detail level - brief summary vs comprehensive guide

For PROJECTS, you need:
- ✓ Name (under 50 chars)
- ✓ Purpose/goal - what is this project for?
- ✓ Timeline - when should this be completed? Or is it ongoing?

If ANY of these are missing or vague, use ask_questions tool to gather them FIRST.

**Step 2: OPERATION PROPOSAL (use propose_operations tool)**
ONLY use propose_operations AFTER you have complete information from Step 1:
- Propose operations with a clear summary
- System shows user a preview modal
- User confirms or cancels
- System executes approved operations

**Example - Good Workflow:**
User: "create a task to buy groceries"
→ AI recognizes missing priority and due_date
→ AI uses ask_questions: "When should this be done?" [Today, Tomorrow, This weekend, No rush] + "How important?" [High, Medium, Low]
→ User answers
→ NOW AI uses propose_operations with complete info

**Example - Bad Workflow (DO NOT DO THIS):**
User: "create a task to buy groceries"
→ AI immediately uses propose_operations with defaults (priority="medium", due_date=null)
→ Low quality output!

## Item Types and Fields
- **project**: name (required, max 50 chars), description (should ask about purpose/goal), color (optional emoji)
- **task**: title (required, max 50 chars), description (optional), priority (low/medium/high - ALWAYS ask!), status (todo/in_progress/completed), due_date (ISO format YYYY-MM-DD - ALWAYS ask when!)
- **note**: title (required, max 50 chars), content (required for CREATE only, detailed 200-500 words with KEY POINTS section), project_id (optional)
  - IMPORTANT: Notes use a block-based content system. Content can ONLY be set during creation. Updates can ONLY modify title or project_id.

## Due Date Handling
IMPORTANT: Today's date is ${new Date().toISOString().split('T')[0]} (YYYY-MM-DD format)

Convert time references to ISO date format (YYYY-MM-DD):
- "today" → ${new Date().toISOString().split('T')[0]}
- "tomorrow" → calculate tomorrow's date from today
- "next Friday" → calculate next Friday's date from today
- "in 2 weeks" → calculate date 2 weeks from today

## Finding Items to Update/Delete
Reference items by their IDs shown in the Workspace Context (e.g., "- Task title [id: uuid-here]")

## Note Content Format (CREATE operations only)
When CREATING notes, include content which will be stored as a text block:
1. "KEY POINTS:" section with 3-5 bullet points
2. Detailed information in clear sections
3. Examples and context (200-500 words)
4. Use \\n for line breaks

Example: "KEY POINTS:\\n• Point 1\\n• Point 2\\n\\n**Section**\\nDetails here..."

IMPORTANT: Note content cannot be modified via UPDATE operations (block-based system). Only title and project_id can be updated.

Be conversational and helpful. Use smart defaults when appropriate!`;

        if (context?.projectId) {
          systemPrompt += '\n\nYou are currently assisting with a specific project. All tasks/notes you create should be relevant to this project context.';
        }

        // Scope-specific prompts for focused AIs
        if (context?.scope === 'global') {
          systemPrompt += '\n\nYou are the GLOBAL AI assistant. You help with everything - projects, tasks, notes, planning, and organizing. You can see all workspace data and create any type of item.';
        }

        if (context?.scope === 'tasks') {
          systemPrompt += '\n\nYou are the TASKS AI assistant, specializing in task management and to-dos. You excel at understanding task priorities, themes, categories, due dates, and can intelligently filter and organize tasks based on context (e.g., "workout tasks", "urgent tasks", "marketing tasks"). You can confidently perform bulk operations when requested - create multiple tasks, update multiple tasks, or delete multiple tasks that match specific criteria. You have full access to workspace data and should use your intelligence to identify which tasks match user requests.\n\nDomain boundary: You work exclusively with tasks. If a user asks you to create notes or projects, DO NOT use the propose_operations tool - instead, respond conversationally, politely declining and explaining they should use the Notes AI or Project chat instead. Only create/update/delete tasks (type: "task"), never notes or projects.\n\nRemember: task titles must be 50 characters or less.';
        }

        if (context?.scope === 'notes') {
          systemPrompt += '\n\nYou are the NOTES AI assistant, specializing in knowledge capture and documentation. You excel at understanding note topics, themes, categories, and can intelligently filter and organize notes based on context (e.g., "meeting notes", "research notes", "recipe notes"). You can confidently perform bulk operations when requested - create multiple notes, update multiple notes (title/project only), or delete multiple notes that match specific criteria. You have full access to workspace data and should use your intelligence to identify which notes match user requests.\n\nDomain boundary: You work exclusively with notes. If a user asks you to create tasks or projects, DO NOT use the propose_operations tool - instead, respond conversationally, politely declining and explaining they should use the Tasks AI or Project chat instead. Only create/update/delete notes (type: "note"), never tasks or projects.\n\nRemember: note titles must be 50 characters or less. Note content can only be set during creation (block-based system).';
        }

        if (context?.scope === 'project' && context?.projectId) {
          systemPrompt += `\n\nYou are the PROJECT AI assistant, specializing in project-specific task and note management. You excel at understanding project context and can intelligently organize, filter, and manage both tasks and notes within this project scope. You can confidently perform bulk operations - create multiple items, update multiple items, or delete multiple items that match specific criteria (e.g., "delete all completed tasks", "delete all meeting notes").\n\nProject scope: All tasks and notes you create will be automatically associated with project_id: ${context.projectId}. You can work with both tasks and notes, but they will be scoped to this project. You have full access to workspace data and should use your intelligence to identify which items match user requests.`;
        }

        // Build messages array from conversation history
        const apiMessages: any[] = [];

        // Add conversation summary if it exists (older messages)
        if (conversationSummary) {
          apiMessages.push({
            role: 'user',
            content: `[Previous conversation summary: ${conversationSummary}]`
          });
        }

        if (conversationHistory && conversationHistory.length > 0) {
          // Convert conversation history to Anthropic format (last 50 messages)
          for (const msg of conversationHistory) {
            // Skip the initial AI greeting if it's the first message
            if (apiMessages.length === 0 && msg.role === 'ai') continue;

            apiMessages.push({
              role: msg.role === 'ai' ? 'assistant' : 'user',
              content: msg.content
            });
          }
        }

        // Add the new user message
        apiMessages.push({
          role: 'user',
          content: message
        });

        // Create non-streaming response with tools
        const response = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 4096,
          system: systemPrompt,
          messages: apiMessages,
          tools: tools,
        });

        // Check if AI wants to use a tool
        if (response.stop_reason === 'tool_use') {
          const toolUseBlock = response.content.find((block: any) => block.type === 'tool_use');

          if (toolUseBlock) {
            // Get any text response that came before the tool use
            const textBlock = response.content.find((block: any) => block.type === 'text');
            const textMessage = textBlock && textBlock.type === 'text' ? textBlock.text : '';

            if (toolUseBlock.type === 'tool_use' && toolUseBlock.name === 'propose_operations') {
              // AI wants to propose operations
              const input = toolUseBlock.input as any;
              return new Response(JSON.stringify({
                type: 'actions',
                message: textMessage, // Any explanation text
                summary: input.summary,
                actions: input.operations
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }

            if (toolUseBlock.type === 'tool_use' && toolUseBlock.name === 'ask_questions') {
              // AI wants to ask questions
              const input = toolUseBlock.input as any;
              return new Response(JSON.stringify({
                type: 'questions',
                message: textMessage, // Any context text
                questions: input.questions
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        }

        // No tool use - return conversational message
        const aiMessage = response.content[0].type === 'text' ? response.content[0].text : '';
        return new Response(JSON.stringify({
          type: 'message',
          message: aiMessage
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Chat error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to process chat request',
          details: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // File upload endpoint
    if (url.pathname === '/api/upload') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const formData = await request.formData();
        const fileEntry = formData.get('file');

        if (!fileEntry || typeof fileEntry === 'string') {
          return new Response(JSON.stringify({ error: 'No file provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const file = fileEntry as File;

        // Generate unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 15);
        const fileExt = file.name.split('.').pop();
        const fileName = `${timestamp}-${randomStr}.${fileExt}`;

        // Upload to R2
        await env.CHATKIN_BUCKET.put(fileName, file.stream(), {
          httpMetadata: {
            contentType: file.type,
          },
        });

        // Return file metadata
        return new Response(JSON.stringify({
          success: true,
          file: {
            name: fileName,
            originalName: file.name,
            size: file.size,
            type: file.type,
            url: `/api/files/${fileName}`,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Upload error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to upload file',
          details: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // File retrieval endpoint
    if (url.pathname.startsWith('/api/files/')) {
      const fileName = url.pathname.replace('/api/files/', '');

      try {
        const object = await env.CHATKIN_BUCKET.get(fileName);

        if (!object) {
          return new Response(JSON.stringify({ error: 'File not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(object.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000',
          },
        });
      } catch (error) {
        console.error('File retrieval error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to retrieve file',
          details: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
