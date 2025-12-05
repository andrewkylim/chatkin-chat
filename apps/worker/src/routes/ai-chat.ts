/**
 * AI chat endpoint handler
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { createSupabaseAdmin } from '../utils/supabase-admin';

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
      mode: mode,
      messageLength: message.length,
      hasHistory: !!conversationHistory?.length,
      hasFiles: !!files,
      filesCount: files?.length || 0,
      files: files?.map(f => ({ name: f.name, type: f.type, url: f.url }))
    });

    // Build base system prompt
    let systemPrompt = buildSystemPrompt(context, workspaceContext, mode);

    // Add conversation stage hint for chat mode
    if (mode === 'chat') {
      const messageCount = conversationHistory?.length || 0;
      if (messageCount === 0) {
        systemPrompt += '\n\n**Conversation Stage**: This is the start of a new conversation. The user is opening with their first message.';
      } else if (messageCount < 4) {
        systemPrompt += '\n\n**Conversation Stage**: Early in this conversation (few exchanges so far).';
      }
    }

    logger.info('System prompt built', {
      mode,
      promptLength: systemPrompt.length,
      promptStart: systemPrompt.substring(0, 300)
    });

    // Load unsurfaced coach observations (if in chat mode and early in conversation)
    if (mode === 'chat' && conversationHistory && conversationHistory.length <= 4) {
      const supabase = createSupabaseAdmin(env);
      const observationsContext = await loadObservationsContext(supabase, user.userId);
      if (observationsContext) {
        systemPrompt += '\n\n' + observationsContext;
      }
    }

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

/**
 * Load unsurfaced coach observations and format for AI context
 */
async function loadObservationsContext(
  supabase: any,
  userId: string
): Promise<string | null> {
  const { data: observations, error } = await supabase
    .from('coach_observations')
    .select('id, observation_type, content, data_summary, priority')
    .eq('user_id', userId)
    .is('surfaced_at', null)
    .eq('dismissed', false)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(3); // Max 3 observations at a time

  if (error || !observations || observations.length === 0) {
    return null;
  }

  // Format observations for AI context
  const observationsText = observations
    .map(
      (obs: any, i: number) => `
${i + 1}. [${obs.observation_type}] ${obs.content}
   Data: ${JSON.stringify(obs.data_summary)}
   Priority: ${obs.priority}`
    )
    .join('\n');

  return `
## Coach Observations Available

You have ${observations.length} pattern observation${observations.length > 1 ? 's' : ''} you can surface during this conversation:

${observationsText}

**How to use these:**
- Choose the MOST relevant one based on what the user is talking about
- Surface it naturally in your opening or when contextually appropriate:
  - "I've been watching your patterns. Want to hear what I'm seeing?"
  - "Can I name something I noticed before we get into today?"
  - "Something shifted this week. Want to talk about it?"
- Don't dump all observations at once
- Pick one, explore it, then mark it as surfaced (observation will be auto-marked after this conversation)

These observations come from daily pattern analysis of their tasks, domains, and behavior.`;
}
