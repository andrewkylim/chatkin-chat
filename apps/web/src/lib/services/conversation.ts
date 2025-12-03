/**
 * Conversation Service
 * Handles conversation summarization and management
 */

import { supabase } from '$lib/supabase';
import {
	updateConversationSummary,
	getOldMessagesForSummary,
	pruneOldMessages
} from '$lib/db/conversations';
import { handleError } from '$lib/utils/error-handler';
import { logger } from '$lib/utils/logger';
import { PUBLIC_WORKER_URL } from '$env/static/public';

const SUMMARIZATION_THRESHOLD = 60; // Messages before triggering summarization
const KEEP_RECENT_MESSAGES = 50; // Number of recent messages to keep after pruning

interface Message {
	role: 'user' | 'assistant';
	content: string;
}

/**
 * Check if conversation needs summarization and trigger if needed
 * Call this after adding messages to a conversation
 */
export async function checkAndSummarizeIfNeeded(
	conversationId: string,
	messageCount: number
): Promise<void> {
	// Only summarize if we've crossed the threshold and it's a round number
	// This prevents summarizing on every single message after threshold
	if (messageCount < SUMMARIZATION_THRESHOLD || messageCount % 10 !== 0) {
		return;
	}

	logger.info('Triggering conversation summarization', { conversationId, messageCount });

	try {
		// Get the conversation to check existing summary
		const { data: conversation } = await supabase
			.from('conversations')
			.select('conversation_summary')
			.eq('id', conversationId)
			.single();

		if (!conversation) {
			logger.error('Conversation not found', { conversationId });
			return;
		}

		// Get old messages to summarize (all except the last 50)
		const oldMessages = await getOldMessagesForSummary(conversationId, KEEP_RECENT_MESSAGES);

		if (oldMessages.length === 0) {
			logger.debug('No messages to summarize', { conversationId });
			return;
		}

		// Format messages for AI
		const formattedMessages: Message[] = oldMessages.map((msg) => ({
			role: msg.role,
			content: msg.content
		}));

		// Call worker to generate summary
		const summary = await generateSummary(
			conversationId,
			formattedMessages,
			conversation.conversation_summary
		);

		// Save summary to database
		await updateConversationSummary(conversationId, summary);

		// Prune old messages (keep only last 50)
		await pruneOldMessages(conversationId, KEEP_RECENT_MESSAGES);

		logger.info('Conversation summarized successfully', {
			conversationId,
			oldMessageCount: oldMessages.length,
			summaryLength: summary.length
		});
	} catch (error) {
		// Don't throw - summarization failures shouldn't break the chat
		handleError(error, {
			operation: 'Check and summarize conversation',
			component: 'ConversationService'
		});
	}
}

/**
 * Generate a summary using the worker API
 */
async function generateSummary(
	conversationId: string,
	messages: Message[],
	existingSummary: string | null
): Promise<string> {
	const workerUrl = import.meta.env.DEV ? 'http://localhost:8787' : PUBLIC_WORKER_URL;

	const { data: { session } } = await supabase.auth.getSession();
	const accessToken = session?.access_token;

	const response = await fetch(`${workerUrl}/api/summarize-conversation`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
		},
		body: JSON.stringify({
			conversationId,
			messages,
			existingSummary
		})
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.error || `Failed to generate summary: ${response.status}`);
	}

	const result = await response.json();
	return result.summary;
}
