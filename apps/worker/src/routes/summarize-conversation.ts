/**
 * Conversation summarization endpoint
 * Generates a summary of old messages to keep context window manageable
 */

import type { Env, CorsHeaders } from '../types';
import { createAnthropicClient } from '../ai/client';
import { requireAuth } from '../middleware/auth';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';

interface SummarizeRequest {
	conversationId: string;
	messages: Array<{
		role: 'user' | 'assistant';
		content: string;
	}>;
	existingSummary?: string | null;
}

export async function handleSummarizeConversation(
	request: Request,
	env: Env,
	corsHeaders: CorsHeaders
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	try {
		const user = await requireAuth(request, env);
		logger.debug('Summarizing conversation', { userId: user.userId });

		const body = (await request.json()) as SummarizeRequest;
		const { messages, existingSummary } = body;

		if (!messages || messages.length === 0) {
			throw new WorkerError('No messages provided', 400);
		}

		const client = createAnthropicClient(env.ANTHROPIC_API_KEY);

		// Build prompt for summarization
		const messagesText = messages
			.map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
			.join('\n\n');

		const prompt = existingSummary
			? `You are summarizing a conversation to preserve context while reducing token usage.

EXISTING SUMMARY (from earlier in the conversation):
${existingSummary}

NEW MESSAGES TO ADD:
${messagesText}

Create an updated summary that:
1. Preserves key information from the existing summary
2. Adds important new information from the new messages
3. Maintains chronological flow
4. Keeps track of:
   - Key decisions made
   - Tasks/notes created or modified
   - Important insights or patterns discussed
   - User goals and concerns expressed
   - Action items or next steps

Keep the summary concise but comprehensive (300-500 words).`
			: `You are summarizing a conversation to preserve context while reducing token usage.

CONVERSATION TO SUMMARIZE:
${messagesText}

Create a summary that captures:
1. Key topics discussed
2. Tasks/notes created or modified
3. Important insights or patterns discussed
4. User goals and concerns expressed
5. Action items or next steps

Keep the summary concise but comprehensive (300-500 words).`;

		const response = await client.messages.create({
			model: 'claude-3-5-haiku-20241022',
			max_tokens: 1000,
			temperature: 0.3,
			messages: [{ role: 'user', content: prompt }]
		});

		const summary = response.content[0].text;

		logger.info('Conversation summarized successfully', {
			userId: user.userId,
			messageCount: messages.length,
			summaryLength: summary.length
		});

		return new Response(
			JSON.stringify({
				success: true,
				summary
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		return handleError(error, 'summarize-conversation', corsHeaders);
	}
}
