/**
 * Type conversion utilities for transforming data between different formats
 */

import type { Message } from '@chatkin/types';

/**
 * UI message format used in chat components
 */
export interface ChatMessage {
	role: 'user' | 'ai';
	content: string;
	isTyping?: boolean;
	questions?: Array<Record<string, unknown>>;
	operations?: Array<Record<string, unknown>>;
	proposedActions?: Array<Record<string, unknown>>;
	awaitingResponse?: boolean;
}

/**
 * Convert database messages to UI chat messages
 */
export function convertDbMessagesToUIMessages(dbMessages: Message[]): ChatMessage[] {
	return dbMessages.map(msg => ({
		role: msg.role === 'assistant' ? ('ai' as const) : ('user' as const),
		content: msg.content,
		questions: msg.metadata?.questions as Array<Record<string, unknown>> | undefined,
		operations: msg.metadata?.operations as Array<Record<string, unknown>> | undefined,
		proposedActions: msg.metadata?.proposedActions as Array<Record<string, unknown>> | undefined
	}));
}
