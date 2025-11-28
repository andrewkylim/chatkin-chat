/**
 * AI chat endpoint handler
 */

import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import type { ChatRequest } from '@chatkin/types/api';
import type { Env, CorsHeaders } from '../types';
import { createAnthropicClient } from '../ai/client';
import { buildSystemPrompt } from '../ai/prompts';
import { getTools } from '../ai/tools';
import { parseAIResponse } from '../ai/response-handler';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';

/**
 * Helper function to fetch image from R2 and convert to base64
 */
async function fetchImageAsBase64(url: string, env: Env): Promise<{ data: string; mediaType: string }> {
  // Extract filename from URL (format: /api/files/{filename})
  const filename = url.split('/').pop();
  if (!filename) {
    throw new WorkerError('Invalid file URL', 400);
  }

  // Fetch from R2
  const object = await env.CHATKIN_BUCKET.get(filename);
  if (!object) {
    throw new WorkerError('File not found in storage', 404);
  }

  // Convert to base64 using chunking to avoid call stack overflow with large files
  const arrayBuffer = await object.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const base64 = btoa(binary);

  // Get media type from object metadata or Content-Type header
  const mediaType = object.httpMetadata?.contentType || 'image/jpeg';

  return { data: base64, mediaType };
}

export async function handleAIChat(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json() as ChatRequest;
    const { message, files, conversationHistory, conversationSummary, workspaceContext, context } = body;

    if (!message) {
      throw new WorkerError('Message is required', 400);
    }

    logger.debug('Processing AI chat request', {
      scope: context?.scope,
      messageLength: message.length,
      hasHistory: !!conversationHistory?.length,
      hasFiles: !!files,
      filesCount: files?.length || 0,
      files: files?.map(f => ({ name: f.name, type: f.type, url: f.url }))
    });

    // Build system prompt based on scope
    const systemPrompt = buildSystemPrompt(context, workspaceContext);

    // Get tool definitions
    const tools = getTools();

    // Create Anthropic client
    const anthropic = createAnthropicClient(env.ANTHROPIC_API_KEY);

    // Build messages array from conversation history
    const apiMessages: MessageParam[] = [];

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

        // Handle messages with files (images)
        if (msg.files && msg.files.length > 0) {
          const imageContents = await Promise.all(
            msg.files
              .filter(f => f.type.startsWith('image/'))
              .map(async (file) => {
                const { data, mediaType } = await fetchImageAsBase64(file.url, env);
                return {
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: mediaType,
                    data: data
                  }
                };
              })
          );

          apiMessages.push({
            role: msg.role === 'ai' ? 'assistant' : 'user',
            content: [
              { type: "text" as const, text: msg.content },
              ...imageContents
            ]
          });
        } else {
          apiMessages.push({
            role: msg.role === 'ai' ? 'assistant' : 'user',
            content: msg.content
          });
        }
      }
    }

    // Add the new user message with files if present
    if (files && files.length > 0) {
      logger.debug('Processing files for current message', {
        fileCount: files.length,
        imageCount: files.filter(f => f.type.startsWith('image/')).length
      });

      const imageContents = await Promise.all(
        files
          .filter(f => f.type.startsWith('image/'))
          .map(async (file) => {
            logger.debug('Fetching image as base64', { url: file.url, type: file.type });
            const { data, mediaType } = await fetchImageAsBase64(file.url, env);
            logger.debug('Image converted to base64', {
              mediaType,
              dataLength: data.length
            });
            return {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: mediaType,
                data: data
              }
            };
          })
      );

      apiMessages.push({
        role: 'user',
        content: [
          { type: "text" as const, text: message },
          ...imageContents
        ]
      });

      logger.debug('Built message with images', {
        contentBlocks: 1 + imageContents.length
      });
    } else {
      apiMessages.push({
        role: 'user',
        content: message
      });
    }

    logger.debug('Final message array before API call', {
      messageCount: apiMessages.length,
      lastMessageType: typeof apiMessages[apiMessages.length - 1]?.content,
      lastMessageIsArray: Array.isArray(apiMessages[apiMessages.length - 1]?.content)
    });

    // Create non-streaming response with tools
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      system: systemPrompt,
      messages: apiMessages,
      tools: tools,
    });

    logger.debug('AI response generated', {
      stopReason: response.stop_reason,
      contentBlocks: response.content.length
    });

    // Parse and format response
    const parsedResponse = parseAIResponse(response);

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return handleError(error, 'AI chat request failed', corsHeaders);
  }
}
