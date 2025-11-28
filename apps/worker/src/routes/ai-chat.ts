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
import { executeQueryTool } from '../ai/query-handlers';

/**
 * Helper function to fetch image from R2 and convert to base64
 */
async function fetchImageAsBase64(
  url: string,
  env: Env
): Promise<{ data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }> {
  // Extract filename from URL (format: /api/files/{filename} or /api/temp-files/{filename})
  const filename = url.split('/').pop();
  if (!filename) {
    throw new WorkerError('Invalid file URL', 400);
  }

  // Determine which bucket to use based on URL path
  const isTemporary = url.includes('/api/temp-files/');
  const bucket = isTemporary ? env.CHATKIN_TEMP_BUCKET : env.CHATKIN_BUCKET;

  // Fetch from R2
  const object = await bucket.get(filename);
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
  const contentType = object.httpMetadata?.contentType || 'image/jpeg';
  // Ensure it's a valid image media type
  const mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' =
    contentType === 'image/png' || contentType === 'image/gif' || contentType === 'image/webp'
      ? contentType
      : 'image/jpeg';

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
    const { message, files, conversationHistory, conversationSummary, workspaceContext, context, authToken } = body;

    if (!message) {
      throw new WorkerError('Message is required', 400);
    }

    // Auth token required for query tools (but optional for non-query use)
    const hasAuth = !!authToken;

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
        role: 'user',
        content: [
          { type: "text" as const, text: message },
          ...imageContents
        ]
      });
    } else {
      apiMessages.push({
        role: 'user',
        content: message
      });
    }

    // Tool use loop - handle query tools
    const MAX_ITERATIONS = 5;
    let iterations = 0;
    let currentMessages = [...apiMessages];

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      logger.debug('Tool use loop iteration', { iteration: iterations });

      // Create non-streaming response with tools
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        system: systemPrompt,
        messages: currentMessages,
        tools: tools,
      });

      logger.debug('AI response generated', {
        stopReason: response.stop_reason,
        contentBlocks: response.content.length,
        iteration: iterations
      });

      // If AI is done (no tool calls), return response
      if (response.stop_reason === 'end_turn') {
        const parsedResponse = parseAIResponse(response);
        return new Response(JSON.stringify(parsedResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If AI wants to use tools
      if (response.stop_reason === 'tool_use') {
        // Add assistant's response to messages
        currentMessages.push({
          role: 'assistant',
          content: response.content
        });

        // Execute all tool calls
        const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }> = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const { id, name, input } = block;

            logger.debug('Executing tool', { toolName: name, toolId: id });

            try {
              let result: string;

              // Check if it's a query tool
              if (['query_tasks', 'query_notes', 'query_projects', 'query_files'].includes(name)) {
                // Require auth for query tools
                if (!hasAuth) {
                  result = JSON.stringify({
                    error: true,
                    message: 'Authentication required to query database. Please ensure you are logged in.'
                  });
                } else {
                  result = await executeQueryTool(name, input as { filters?: Record<string, unknown>; limit?: number }, authToken!, env);
                }
              } else {
                // Non-query tools (ask_questions, propose_operations) handled normally
                // The parseAIResponse function will handle these in the final response
                result = JSON.stringify({
                  error: false,
                  message: 'Non-query tool will be handled in final response'
                });
              }

              toolResults.push({
                type: 'tool_result',
                tool_use_id: id,
                content: result
              });
            } catch (error) {
              // Enhanced error handling
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              logger.error('Tool execution error', { toolName: name, error: errorMessage });

              toolResults.push({
                type: 'tool_result',
                tool_use_id: id,
                content: JSON.stringify({
                  error: true,
                  message: `I encountered an error while processing your request: ${errorMessage}. Please try again.`
                }),
                is_error: true
              });
            }
          }
        }

        // Add tool results to messages
        currentMessages.push({
          role: 'user',
          content: toolResults
        });

        // Continue loop - AI will process results
        continue;
      }

      // Unexpected stop reason
      logger.error('Unexpected stop reason', { stopReason: response.stop_reason });
      return new Response(
        JSON.stringify({ error: `Unexpected stop reason: ${response.stop_reason}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Max iterations reached
    logger.warn('Max tool use iterations reached', { iterations: MAX_ITERATIONS });
    return new Response(
      JSON.stringify({
        error: 'The AI made too many tool calls. Please try rephrasing your request or breaking it into smaller questions.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return handleError(error, 'AI chat request failed', corsHeaders);
  }
}
