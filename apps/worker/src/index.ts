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
        const tools = [
          {
            name: 'propose_operations',
            description: 'Propose create/update/delete operations to user for confirmation. Use this when the user asks you to create, update, or delete tasks, notes, or projects.',
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
          },
          {
            name: 'ask_questions',
            description: 'Ask structured multiple choice questions to gather information from the user.',
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
          }
        ];

        // Build system prompt with context if provided
        let systemPrompt = `You are a helpful AI assistant for Chatkin OS, a productivity suite. You help users manage tasks, notes, and projects.

${workspaceContext || ''}

## Tools Available

You have access to two tools:

### 1. propose_operations
Use this tool when users ask you to create, update, or delete items. This implements a two-step workflow:
- You propose operations with a summary
- User reviews and confirms
- System executes the operations

### 2. ask_questions
Use this tool when you need information from the user. Ask structured multiple choice questions.

## Character Limits (STRICT)
- Task titles: 50 characters max
- Note titles: 50 characters max
- Project names: 50 characters max
- Project descriptions: 200 characters max
- Task/note descriptions: No limit

If a title/name would exceed the limit, shorten it intelligently and suggest the full version in the description.

## Two-Step Workflow
When users request operations:
1. Use the propose_operations tool with a clear summary
2. System shows user a preview modal
3. User confirms or cancels
4. System executes approved operations

## Item Types and Fields
- **project**: name (required, max 50 chars), description (optional, max 200 chars), color (optional emoji)
- **task**: title (required, max 50 chars), description (optional), priority (low/medium/high), status (todo/in_progress/completed), due_date (optional, ISO format YYYY-MM-DD)
- **note**: title (required, max 50 chars), content (required, detailed 200-500 words with KEY POINTS section)

## Due Date Handling
Convert time references to ISO date format (YYYY-MM-DD):
- "today" → calculate today's date
- "tomorrow" → tomorrow's date
- "next Friday" → calculate next Friday's date
- "in 2 weeks" → calculate date 2 weeks from now

## Finding Items to Update/Delete
Reference items by their IDs shown in the Workspace Context (e.g., "- Task title [id: uuid-here]")

## Note Content Format
Create detailed notes with:
1. "KEY POINTS:" section with 3-5 bullet points
2. Detailed information in clear sections
3. Examples and context (200-500 words)
4. Use \\n for line breaks

Example: "KEY POINTS:\\n• Point 1\\n• Point 2\\n\\n**Section**\\nDetails here..."

Be conversational and helpful. Use smart defaults when appropriate!`;

        if (context?.projectId) {
          systemPrompt += '\n\nYou are currently assisting with a specific project. All tasks/notes you create should be relevant to this project context.';
        }

        // Scope-specific prompts for focused AIs
        if (context?.scope === 'global') {
          systemPrompt += '\n\nYou are the GLOBAL AI assistant. You help with everything - projects, tasks, notes, planning, and organizing. You can see all workspace data and create any type of item.';
        }

        if (context?.scope === 'tasks') {
          systemPrompt += '\n\nYou are the TASKS AI assistant. You help manage tasks and to-dos. When users ask about tasks, ONLY create tasks (type: "task"), never notes or projects. You CAN see workspace data (projects, notes) for context, but focus on actionable to-do items. Remember: task titles must be 50 characters or less.';
        }

        if (context?.scope === 'notes') {
          systemPrompt += '\n\nYou are the NOTES AI assistant. You help capture knowledge and information. When users ask about notes, ONLY create notes (type: "note"), never tasks or projects. You CAN see workspace data (projects, tasks) for context, but focus on information capture and detailed content. Remember: note titles must be 50 characters or less.';
        }

        if (context?.scope === 'project' && context?.projectId) {
          systemPrompt += `\n\nYou are assisting with a specific PROJECT. All tasks and notes you create should be relevant to this project context (project_id: ${context.projectId}). You can create tasks and notes, but they will be scoped to this project.`;
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
