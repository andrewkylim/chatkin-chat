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
    const { message, conversationHistory, conversationSummary, workspaceContext, context } = body;

    if (!message) {
      throw new WorkerError('Message is required', 400);
    }

    logger.debug('Processing AI chat request', {
      scope: context?.scope,
      messageLength: message.length,
      hasHistory: !!conversationHistory?.length
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
