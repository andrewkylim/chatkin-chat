/**
 * Chat Operations Logic Hook
 *
 * Provides business logic for chat operations without UI concerns.
 * Follows the pattern established by useTasks.ts.
 */

import { workerService } from '$lib/services/worker';
import { chatOperationsService } from '$lib/services/chat-operations';
import { fileOperationsService } from '$lib/services/file-operations';
import { addMessage, updateConversationMode } from '$lib/db/conversations';
import { handleError } from '$lib/utils/error-handler';
import { logger } from '$lib/utils/logger';
import type { Operation, AIQuestion } from '$lib/types/chat';
import type { FileAttachment } from '$lib/services/worker';

export interface SendMessageOptions {
	message: string;
	files?: FileAttachment[];
	conversationHistory: Array<{
		role: string;
		content: string;
		files?: FileAttachment[];
	}>;
	conversationSummary: string | null;
	workspaceContext: string;
	scope: 'global' | 'tasks' | 'notes' | 'project';
	projectId?: string;
	mode: 'chat' | 'action';
}

export interface MessageResponse {
	type: 'message' | 'actions' | 'questions';
	content: string;
	operations?: Operation[];
	questions?: AIQuestion[];
	shouldSendNotification?: boolean;
	notificationType?: 'ai_proposal' | 'ai_insight';
	notificationBody?: string;
}

/**
 * Send a message to AI and get response
 */
export async function sendMessageToAI(options: SendMessageOptions): Promise<MessageResponse> {
	try {
		const response = await workerService.chat({
			message: options.message,
			files: options.files,
			conversationHistory: options.conversationHistory,
			conversationSummary: options.conversationSummary,
			workspaceContext: options.workspaceContext,
			context: {
				scope: options.scope,
				projectId: options.projectId
			},
			mode: options.mode
		});

		// Process response based on type
		if (response.type === 'actions' && Array.isArray(response.actions)) {
			const operations = response.actions as Operation[];
			const isOperationsFormat = operations.some((op) => op.operation !== undefined);

			if (isOperationsFormat) {
				// New operations format
				const createCount = operations.filter((op) => op.operation === 'create').length;
				const updateCount = operations.filter((op) => op.operation === 'update').length;
				const deleteCount = operations.filter((op) => op.operation === 'delete').length;

				const parts = [];
				if (createCount > 0)
					parts.push(`create ${createCount} item${createCount > 1 ? 's' : ''}`);
				if (updateCount > 0)
					parts.push(`update ${updateCount} item${updateCount > 1 ? 's' : ''}`);
				if (deleteCount > 0)
					parts.push(`delete ${deleteCount} item${deleteCount > 1 ? 's' : ''}`);

				const content = `I'll ${parts.join(', ')} for you. Please review:`;

				return {
					type: 'actions',
					content,
					operations,
					shouldSendNotification: true,
					notificationType: 'ai_proposal',
					notificationBody: response.summary || content
				};
			}
		} else if (response.type === 'questions') {
			return {
				type: 'questions',
				content: 'I need some information to help you:',
				questions: response.questions
			};
		} else if (response.type === 'message') {
			const messageText = response.message || '';
			const isInsight =
				messageText.length > 100 &&
				/\b(insight|notice|found that|discovered|analyzed|pattern|trend|recommend|suggest)\b/i.test(
					messageText
				);

			return {
				type: 'message',
				content: messageText,
				shouldSendNotification: isInsight,
				notificationType: isInsight ? 'ai_insight' : undefined,
				notificationBody: isInsight ? messageText.substring(0, 200) : undefined
			};
		}

		return {
			type: 'message',
			content: response.message || 'No response'
		};
	} catch (error) {
		handleError(error, {
			operation: 'Send message to AI',
			component: 'useChatOperations'
		});
		throw error;
	}
}

/**
 * Execute AI-proposed operations
 */
export async function executeOperationsAction(
	operations: Operation[],
	projectId?: string
): Promise<{ successCount: number; errorCount: number; results: string[] }> {
	try {
		return await chatOperationsService.executeOperations(operations, projectId);
	} catch (error) {
		handleError(error, {
			operation: 'Execute operations',
			component: 'useChatOperations'
		});
		throw error;
	}
}

/**
 * Save user message to database
 */
export async function saveUserMessage(
	conversationId: string,
	message: string,
	files?: FileAttachment[]
): Promise<void> {
	try {
		await addMessage(conversationId, 'user', message, {
			files: files && files.length > 0 ? files : undefined
		});
	} catch (error) {
		logger.error('Error saving user message', error);
		// Don't throw - message already displayed in UI
	}
}

/**
 * Save AI message to database
 */
export async function saveAIMessage(
	conversationId: string,
	content: string,
	metadata?: Record<string, unknown>
): Promise<void> {
	try {
		await addMessage(conversationId, 'assistant', content, metadata);
	} catch (error) {
		logger.error('Error saving AI message', error);
		// Don't throw - message already displayed in UI
	}
}

/**
 * Update conversation mode
 */
export async function updateModeAction(
	conversationId: string,
	mode: 'chat' | 'action'
): Promise<void> {
	try {
		await updateConversationMode(conversationId, mode);
	} catch (error) {
		logger.error('Error updating conversation mode', error);
	}
}

/**
 * Reload workspace context after changes
 */
export async function reloadContextAction(): Promise<string> {
	return await chatOperationsService.reloadWorkspaceContext();
}

/**
 * Main hook that provides all chat operation functions
 */
export function useChatOperations() {
	return {
		// Message operations
		sendMessage: sendMessageToAI,
		saveUserMessage,
		saveAIMessage,

		// Operation execution
		executeOperations: executeOperationsAction,
		reloadContext: reloadContextAction,

		// Mode management
		updateMode: updateModeAction,

		// File operations
		saveFileToLibrary: (file: {
			name: string;
			url: string;
			type: string;
			size: number;
			conversationId?: string | null;
		}) => fileOperationsService.saveToLibrary(file)
	};
}
