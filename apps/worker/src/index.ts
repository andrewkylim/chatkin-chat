/**
 * Chatkin OS Worker
 * Handles AI API calls, file uploads, and other serverless functions
 */

import Anthropic from '@anthropic-ai/sdk';

export interface Env {
  ANTHROPIC_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  CHATKIN_BUCKET: R2Bucket;
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

When the user wants to create tasks or notes, respond with ONLY a JSON array in this exact format (no extra text):
[
  {"type": "task", "title": "Task title", "description": "Description of the task", "priority": "low|medium|high"},
  {"type": "note", "title": "Note title", "content": "Note content here"}
]

Return JSON array when:
- User says "help me plan", "create tasks for", "I need to", "remind me to"
- User wants to organize, plan, or track something
- User asks for a todo list or action items
- User wants to capture information, research, or ideas

Use tasks for actionable items (things to do).
Use notes for information, research, ideas, or reference material.

Return plain conversational text when:
- User asks questions about existing tasks/notes
- User wants advice or information
- User is having a casual conversation

IMPORTANT: When creating tasks/notes, respond with ONLY the JSON array. Do not add ANY text before or after it. Just the array.

Priority levels for tasks: "low", "medium", or "high"
Always include helpful descriptions for tasks.

For notes, create DETAILED and COMPREHENSIVE content with this structure:
1. Start with "KEY POINTS:" section with 3-5 bullet points summarizing the main ideas
2. Follow with detailed information organized in clear sections
3. Include relevant examples, explanations, or context
4. Make notes substantial (200-500 words minimum)
5. Use \\n for line breaks (this is JSON, so escape newlines properly)

IMPORTANT: Use \\n for newlines in JSON content, NOT literal line breaks.

Example note content format:
"KEY POINTS:\\n• First key takeaway\\n• Second key takeaway\\n• Third key takeaway\\n\\n**Section Title**\\nDetailed explanation of the topic with relevant information...\\n\\n**Another Section**\\nMore detailed content with examples and context..."

If unsure, prefer JSON - users love seeing tasks/notes created automatically!`;

        if (context?.projectId) {
          systemPrompt += '\n\nYou are currently assisting with a specific project. All tasks/notes you create should be relevant to this project context.';
        }

        if (context?.scope === 'tasks') {
          systemPrompt += '\n\nIMPORTANT: You are in the TASKS context. ONLY create tasks (type: "task"), never create notes. Users come here for actionable to-do items.';
        }

        if (context?.scope === 'notes') {
          systemPrompt += '\n\nIMPORTANT: You are in the NOTES context. ONLY create notes (type: "note"), never create tasks. Users come here to capture information, research, and ideas in detailed notes.';
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
