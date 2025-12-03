import { supabase } from '$lib/supabase';
import type { Conversation, Message } from '@chatkin/types';

type ConversationInsert = Omit<Conversation, 'id' | 'created_at' | 'updated_at'>;
type MessageInsert = Omit<Message, 'id' | 'created_at'>;

/**
 * Get or create a conversation for a given scope
 * @param scope - 'global', 'tasks', 'notes', or 'project'
 * @param domainOrProjectId - Domain name for project-scoped conversations (e.g., 'Body', 'Mind')
 */
export async function getOrCreateConversation(
	scope: 'global' | 'tasks' | 'notes' | 'project',
	domainOrProjectId?: string
) {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	// Try to find existing conversation
	let query = supabase
		.from('conversations')
		.select('*')
		.eq('user_id', user.id)
		.eq('scope', scope);

	if (scope === 'project' && domainOrProjectId) {
		query = query.eq('domain', domainOrProjectId);
	} else if (scope !== 'project') {
		// For non-project scopes, we need to match by scope only
		// Domain is still required in DB, so we'll use 'Mind' as default
	}

	const { data: existing } = await query.maybeSingle();

	if (existing) {
		return existing as Conversation;
	}

	// Create new conversation
	const newConv: ConversationInsert = {
		user_id: user.id,
		scope,
		project_id: null,
		domain: domainOrProjectId || 'Mind', // Use provided domain or default to 'Mind'
		title: scope === 'global' ? 'General Chat' : scope === 'project' ? 'Project Chat' : `${scope.charAt(0).toUpperCase() + scope.slice(1)} Chat`,
		mode: 'chat', // Default to chat mode
		conversation_summary: null,
		message_count: 0,
		last_summarized_at: null
	};

	const { data, error } = await supabase
		.from('conversations')
		.insert(newConv)
		.select()
		.single();

	if (error) throw error;
	return data as Conversation;
}

/**
 * Get recent messages from a conversation (last N messages)
 * @param conversationId - Conversation ID
 * @param limit - Number of recent messages to fetch (default: 50)
 */
export async function getRecentMessages(conversationId: string, limit: number = 50) {
	const { data, error } = await supabase
		.from('messages')
		.select('*')
		.eq('conversation_id', conversationId)
		.order('created_at', { ascending: false })
		.limit(limit);

	if (error) throw error;

	// Reverse to get chronological order
	return (data as Message[]).reverse();
}

/**
 * Add a message to a conversation
 * @param conversationId - Conversation ID
 * @param role - 'user' or 'assistant'
 * @param content - Message content
 * @param metadata - Optional metadata (e.g., proposed actions)
 */
export async function addMessage(
	conversationId: string,
	role: 'user' | 'assistant',
	content: string,
	metadata?: Record<string, unknown>
) {
	const newMessage: MessageInsert = {
		conversation_id: conversationId,
		role,
		content,
		metadata: metadata || null
	};

	const { data, error } = await supabase
		.from('messages')
		.insert(newMessage)
		.select()
		.single();

	if (error) throw error;

	// Update conversation updated_at (message_count is auto-incremented by trigger)
	await supabase
		.from('conversations')
		.update({
			updated_at: new Date().toISOString()
		})
		.eq('id', conversationId);

	return data as Message;
}

/**
 * Update metadata for a specific message
 * @param messageId - Message ID
 * @param metadata - Updated metadata object
 */
export async function updateMessageMetadata(
	messageId: string,
	metadata: Record<string, unknown>
) {
	const { error } = await supabase
		.from('messages')
		.update({ metadata })
		.eq('id', messageId);

	if (error) throw error;
}

/**
 * Generate and save a summary of old messages for a conversation
 * This should be called when message_count exceeds a threshold (e.g., 60 messages)
 * @param conversationId - Conversation ID
 * @param summary - AI-generated summary text
 */
export async function updateConversationSummary(
	conversationId: string,
	summary: string
) {
	const { error } = await supabase
		.from('conversations')
		.update({
			conversation_summary: summary,
			last_summarized_at: new Date().toISOString()
		})
		.eq('id', conversationId);

	if (error) throw error;
}

/**
 * Get all messages older than the last N messages (for summarization)
 * @param conversationId - Conversation ID
 * @param skipLast - Number of recent messages to skip (default: 50)
 */
export async function getOldMessagesForSummary(conversationId: string, skipLast: number = 50) {
	// Get total message count first
	const { data: conv } = await supabase
		.from('conversations')
		.select('message_count')
		.eq('id', conversationId)
		.single();

	if (!conv || conv.message_count <= skipLast) {
		return []; // Not enough messages to summarize
	}

	// Get all messages except the last N
	const { data, error } = await supabase
		.from('messages')
		.select('*')
		.eq('conversation_id', conversationId)
		.order('created_at', { ascending: true })
		.limit(conv.message_count - skipLast);

	if (error) throw error;
	return data as Message[];
}

/**
 * Delete old messages that have been summarized
 * WARNING: Only call this AFTER successfully generating and saving a summary
 * @param conversationId - Conversation ID
 * @param keepLast - Number of recent messages to keep (default: 50)
 */
export async function pruneOldMessages(conversationId: string, keepLast: number = 50) {
	// Get the timestamp of the Nth most recent message
	const { data: messages } = await supabase
		.from('messages')
		.select('created_at')
		.eq('conversation_id', conversationId)
		.order('created_at', { ascending: false })
		.limit(keepLast);

	if (!messages || messages.length < keepLast) {
		return; // Not enough messages to prune
	}

	const cutoffTimestamp = messages[messages.length - 1].created_at;

	// Delete all messages older than the cutoff
	const { error } = await supabase
		.from('messages')
		.delete()
		.eq('conversation_id', conversationId)
		.lt('created_at', cutoffTimestamp);

	if (error) throw error;
}

/**
 * Update the mode for a conversation
 * @param conversationId - Conversation ID
 * @param mode - 'chat' or 'action'
 */
export async function updateConversationMode(
	conversationId: string,
	mode: 'chat' | 'action'
) {
	const { error } = await supabase
		.from('conversations')
		.update({ mode })
		.eq('id', conversationId);

	if (error) throw error;
}
