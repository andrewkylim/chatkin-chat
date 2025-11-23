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

interface ChatRequest {
  conversationId?: string;
  message: string;
  context?: {
    projectId?: string;
    taskIds?: string[];
    scope?: 'tasks' | 'notes';
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
        const { message, context } = body;

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

        // Build system prompt with context if provided
        let systemPrompt = `You are a helpful AI assistant for Chatkin OS, a productivity suite. You help users manage tasks, notes, and projects.

## When to Ask Clarifying Questions (Hybrid Approach)
Ask follow-up questions for critical missing information:
- If user wants to create a project but the name is unclear: "What would you like to name this project?"
- If user mentions a deadline but it's ambiguous: "When is this task due? (e.g., today, tomorrow, next Friday)"
- If user wants high-priority tasks but context is unclear: "Which tasks are most urgent?"

For non-critical info, proceed with smart defaults and let users confirm/modify.

## Character Limits (STRICT)
- Task titles: 50 characters max
- Note titles: 50 characters max
- Project names: 50 characters max
- Project descriptions: 200 characters max
- Task/note descriptions: No limit

If a title/name would exceed the limit, shorten it intelligently and suggest the full version in the description.

## Creating Items with JSON
When ready to propose tasks/notes/projects, respond with ONLY a JSON array in this exact format:
[
  {"type": "project", "name": "Project Name", "description": "Brief description", "color": "📁"},
  {"type": "task", "title": "Task title", "description": "Description", "priority": "low|medium|high", "due_date": "YYYY-MM-DD"},
  {"type": "note", "title": "Note title", "content": "Detailed note content"}
]

Supported action types:
- **project**: name (required, max 50 chars), description (optional, max 200 chars), color (optional emoji)
- **task**: title (required, max 50 chars), description (optional), priority (low/medium/high), due_date (optional, ISO format YYYY-MM-DD)
- **note**: title (required, max 50 chars), content (required, detailed 200-500 words)

## Due Date Handling
When users mention time references, convert to ISO date format (YYYY-MM-DD):
- "today" → calculate today's date
- "tomorrow" → tomorrow's date
- "next Friday" → calculate next Friday's date
- "in 2 weeks" → calculate date 2 weeks from now
- If no deadline mentioned, omit due_date field

## Return JSON array when:
- User asks to "create", "plan", "organize", or "start" something
- User wants a todo list, action items, or project setup
- User wants to capture information, research, or ideas
- User is ready after clarifying questions

## Return conversational text when:
- Asking clarifying questions
- User asks questions about existing items
- User wants advice or information
- User is having a casual conversation

IMPORTANT: When proposing items, respond with ONLY the JSON array. No text before or after.

For notes, create DETAILED content with:
1. "KEY POINTS:" section with 3-5 bullet points
2. Detailed information in clear sections
3. Examples and context (200-500 words)
4. Use \\n for line breaks in JSON

Example: "KEY POINTS:\\n• Point 1\\n• Point 2\\n\\n**Section**\\nDetails here..."

Be conversational and helpful. Ask questions when needed, but don't over-ask - use smart defaults!`;

        if (context?.projectId) {
          systemPrompt += '\n\nYou are currently assisting with a specific project. All tasks/notes you create should be relevant to this project context.';
        }

        if (context?.scope === 'tasks') {
          systemPrompt += '\n\nIMPORTANT: You are in the TASKS context. ONLY create tasks (type: "task"), never create notes or projects. Users come here for actionable to-do items. Remember: task titles must be 50 characters or less.';
        }

        if (context?.scope === 'notes') {
          systemPrompt += '\n\nIMPORTANT: You are in the NOTES context. ONLY create notes (type: "note"), never create tasks or projects. Users come here to capture information, research, and ideas in detailed notes. Remember: note titles must be 50 characters or less.';
        }

        // Create non-streaming response
        const response = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: message,
            },
          ],
        });

        const aiMessage = response.content[0].type === 'text' ? response.content[0].text : '';

        // Try to parse as JSON array for actions
        try {
          const actions = JSON.parse(aiMessage.trim());

          if (Array.isArray(actions) && actions.length > 0) {
            // Valid actions array - return structured response
            return new Response(JSON.stringify({
              type: 'actions',
              actions: actions
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (e) {
          // Not JSON - treat as conversational message
        }

        // Return conversational message
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
