/**
 * AI chat endpoint handler
 */

import type { ChatRequest } from '@chatkin/types/api';
import type { Env, CorsHeaders } from '../types';
import { createAnthropicClient } from '../ai/client';
import { buildSystemPrompt } from '../ai/prompts';
import { getToolsForMode } from '../ai/tools';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/auth';
import { createAIOrchestrator } from '../services/ai-orchestrator';
import { createMessageFormatter } from '../services/message-formatter';

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
    // Require authentication for ALL chat requests
    const user = await requireAuth(request, env);
    logger.debug('Authenticated AI chat request', { userId: user.userId });

    const body = await request.json() as ChatRequest;
    const { message, files, conversationHistory, conversationSummary, workspaceContext, context, authToken, mode = 'chat' } = body;

    if (!message) {
      throw new WorkerError('Message is required', 400);
    }

    // Use the auth token from body for database queries (it should match the request auth)

    logger.debug('Processing AI chat request', {
      scope: context?.scope,
      mode: mode,
      messageLength: message.length,
      hasHistory: !!conversationHistory?.length,
      hasFiles: !!files,
      filesCount: files?.length || 0,
      files: files?.map(f => ({ name: f.name, type: f.type, url: f.url }))
    });

    // Build system prompt based on scope and mode
    const systemPrompt = buildSystemPrompt(context, workspaceContext, mode);

    // Get tool definitions based on mode
    const tools = getToolsForMode(mode);

    // Set model parameters based on mode
    const modelParams = mode === 'chat'
      ? { temperature: 0.7, max_tokens: 2048 }  // Chat mode: more creative, shorter responses
      : { temperature: 0.3, max_tokens: 4096 }; // Action mode: more precise, longer responses

    // Create Anthropic client
    const anthropic = createAnthropicClient(env.ANTHROPIC_API_KEY);

    // Format messages using message formatter service
    const formatter = createMessageFormatter(env);
    const apiMessages = await formatter.formatMessages({
      currentMessage: message,
      currentFiles: files,
      conversationHistory,
      conversationSummary,
    });

    // Create AI orchestrator with parallel tool execution
    const orchestrator = createAIOrchestrator(
      anthropic,
      {
        model: 'claude-3-5-haiku-20241022',
        maxTokens: modelParams.max_tokens,
        temperature: modelParams.temperature,
        systemPrompt,
        tools,
      },
      {
        authToken,
        env,
      }
    );

    // Execute tool loop
    const aiResponse = await orchestrator.executeToolLoop(apiMessages);

    // Return response
    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return handleError(error, 'AI chat request failed', corsHeaders);
  }
}
