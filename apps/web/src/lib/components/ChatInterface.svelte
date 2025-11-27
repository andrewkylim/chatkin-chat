<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { PUBLIC_WORKER_URL } from '$env/static/public';
	import { createTask, updateTask, deleteTask } from '$lib/db/tasks';
	import { createNote, updateNote, deleteNote } from '$lib/db/notes';
	import { createProject, updateProject, deleteProject } from '$lib/db/projects';
	import { getOrCreateConversation, getRecentMessages, addMessage } from '$lib/db/conversations';
	import { loadWorkspaceContext, formatWorkspaceContextForAI } from '$lib/db/context';
	import type { Conversation } from '@chatkin/types';
	import { notificationCounts } from '$lib/stores/notifications';
	import type {
		Message,
		Operation
	} from '$lib/types/chat';
	import { logger } from '$lib/utils/logger';

	// MobileChatLayout interface (minimal type safety for the component ref)
	interface MobileChatLayoutRef {
		scrollToBottom?: () => void;
	}

	// Props
	export let scope: 'global' | 'tasks' | 'notes' | 'project' = 'global';
	export let projectId: string | undefined = undefined;
	export let desktopMessagesContainer: HTMLDivElement | undefined = undefined;
	export let mobileChatLayout: MobileChatLayoutRef | undefined = undefined;

	// State
	export let messages: Message[] = [];
	export let inputMessage = '';
	let isStreaming = false;
	let conversation: Conversation | null = null;
	let workspaceContextString = '';
	let messagesReady = false;

	async function scrollToBottom() {
		await tick();
		if (desktopMessagesContainer) {
			desktopMessagesContainer.scrollTop = desktopMessagesContainer.scrollHeight;
		}
		if (mobileChatLayout && mobileChatLayout.scrollToBottom) {
			mobileChatLayout.scrollToBottom();
		}
	}

	export async function sendMessage(message?: string) {
		const userMessage = message || inputMessage.trim();
		if (!userMessage || isStreaming || !conversation) return;

		inputMessage = '';

		// Save user message to database
		try {
			await addMessage(conversation.id, 'user', userMessage);
		} catch (error) {
			logger.error('Error saving user message', error);
		}

		// Add user message to UI
		messages = [...messages, { role: 'user', content: userMessage }];
		scrollToBottom();

		// Add placeholder for AI response
		const aiMessageIndex = messages.length;
		messages = [...messages, { role: 'ai', content: '', isTyping: true }];
		isStreaming = true;
		scrollToBottom();

		try {
			// Build conversation history
			const allMessages = messages.filter(m => m.content && m.content.trim() && !m.isTyping);
			const recentMessages = allMessages.slice(-50);
			const historyWithoutCurrent = recentMessages.slice(0, -1);

			const conversationHistory = historyWithoutCurrent.map(m => ({
				role: m.role,
				content: m.content
			}));

			const response = await fetch(`${PUBLIC_WORKER_URL}/api/ai/chat`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					message: userMessage,
					conversationHistory: conversationHistory,
					conversationSummary: conversation.conversation_summary,
					workspaceContext: workspaceContextString,
					context: {
						scope,
						projectId
					}
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			// Handle operations format
			if (data.type === 'actions' && Array.isArray(data.actions)) {
				const isOperationsFormat = data.actions.some((a: Record<string, unknown>) => a.operation !== undefined);

				if (isOperationsFormat) {
					const operations = data.actions as Operation[];
					const createCount = operations.filter(op => op.operation === 'create').length;
					const updateCount = operations.filter(op => op.operation === 'update').length;
					const deleteCount = operations.filter(op => op.operation === 'delete').length;

					const parts = [];
					if (createCount > 0) parts.push(`create ${createCount} item${createCount > 1 ? 's' : ''}`);
					if (updateCount > 0) parts.push(`update ${updateCount} item${updateCount > 1 ? 's' : ''}`);
					if (deleteCount > 0) parts.push(`delete ${deleteCount} item${deleteCount > 1 ? 's' : ''}`);

					const previewMessage = `I'll ${parts.join(', ')} for you. Please review:`;

					try {
						await addMessage(conversation!.id, 'assistant', previewMessage, { operations });
					} catch (error) {
						logger.error('Error saving AI message', error);
					}

					messages[aiMessageIndex] = {
						role: 'ai',
						content: previewMessage,
						operations,
						awaitingResponse: true,
						selectedOperations: operations
					};
					messages = messages;
					scrollToBottom();
				}
			} else if (data.type === 'questions' && Array.isArray(data.questions)) {
				const questionsMessage = "I need some information to help you:";

				try {
					await addMessage(conversation!.id, 'assistant', questionsMessage, { questions: data.questions });
				} catch (error) {
					logger.error('Error saving AI message', error);
				}

				messages[aiMessageIndex] = {
					role: 'ai',
					content: questionsMessage,
					questions: data.questions,
					awaitingResponse: true
				};
				messages = messages;
			} else if (data.type === 'message') {
				try {
					await addMessage(conversation!.id, 'assistant', data.message);
				} catch (error) {
					logger.error('Error saving AI message', error);
				}

				messages[aiMessageIndex] = {
					role: 'ai',
					content: data.message
				};
				messages = messages;
			}
		} catch (error) {
			logger.error('Error sending message', error);
			messages[aiMessageIndex] = {
				role: 'ai',
				content: 'Sorry, I encountered an error processing your request. Please try again.'
			};
			messages = messages;
		} finally {
			isStreaming = false;
			scrollToBottom();
		}
	}

	async function executeOperations(operations: Operation[], messageIndex: number) {
		messages[messageIndex] = {
			...messages[messageIndex],
			content: 'Executing operations...',
			awaitingResponse: false,
			operations: undefined,
			selectedOperations: undefined,
			isTyping: true
		};
		messages = messages;

		let successCount = 0;
		let errorCount = 0;
		const results: string[] = [];

		for (const op of operations) {
			try {
				if (op.operation === 'create') {
					if (op.type === 'task') {
						await createTask({ ...op.data, project_id: op.data.project_id || projectId || null });
						notificationCounts.incrementCount('tasks');
						results.push(`✓ Created task: ${op.data.title}`);
					} else if (op.type === 'note') {
						await createNote({ ...op.data, project_id: op.data.project_id || projectId || null });
						notificationCounts.incrementCount('notes');
						results.push(`✓ Created note: ${op.data.title}`);
					} else if (op.type === 'project') {
						await createProject(op.data);
						notificationCounts.incrementCount('projects');
						results.push(`✓ Created project: ${op.data.name}`);
					}
					successCount++;
				} else if (op.operation === 'update') {
					if (!op.id) throw new Error('Missing ID for update operation');

					if (op.type === 'task') {
						await updateTask(op.id, op.changes);
						results.push(`✓ Updated task`);
					} else if (op.type === 'note') {
						const { content, ...validChanges } = op.changes;
						if (content) {
							logger.warn('Ignoring content field in note update');
						}
						await updateNote(op.id, validChanges);
						results.push(`✓ Updated note`);
					} else if (op.type === 'project') {
						await updateProject(op.id, op.changes);
						results.push(`✓ Updated project`);
					}
					successCount++;
				} else if (op.operation === 'delete') {
					if (!op.id) throw new Error('Missing ID for delete operation');

					if (op.type === 'task') {
						await deleteTask(op.id);
						notificationCounts.decrementCount('tasks');
						results.push(`✓ Deleted task`);
					} else if (op.type === 'note') {
						await deleteNote(op.id);
						notificationCounts.decrementCount('notes');
						results.push(`✓ Deleted note`);
					} else if (op.type === 'project') {
						await deleteProject(op.id);
						notificationCounts.decrementCount('projects');
						results.push(`✓ Deleted project`);
					}
					successCount++;
				}
			} catch (error) {
				logger.error(`Error executing ${op.operation} on ${op.type}`, error);
				results.push(`✗ Failed to ${op.operation} ${op.type}`);
				errorCount++;
			}
		}

		// Reload workspace context
		try {
			const context = await loadWorkspaceContext();
			workspaceContextString = formatWorkspaceContextForAI(context);
		} catch (error) {
			logger.error('Error reloading workspace context', error);
		}

		// Update status message
		const successMsg = successCount > 0 ? `${successCount} operation${successCount > 1 ? 's' : ''} completed` : '';
		const errorMsg = errorCount > 0 ? `${errorCount} failed` : '';
		const parts = [successMsg, errorMsg].filter(Boolean);

		messages[messageIndex] = {
			role: 'ai',
			content: parts.join(', ') || 'All operations completed!',
			isTyping: false
		};
		messages = messages;
		scrollToBottom();
	}

	async function handleAnswers(answers: Record<string, string>, messageIndex: number) {
		const message = messages[messageIndex];
		if (!message.questions) return;

		messages[messageIndex] = {
			...message,
			awaitingResponse: false,
			userResponse: answers
		};
		messages = messages;

		const answersText = Object.entries(answers).map(([q, a]) => `${q}: ${a}`).join('\n');
		await sendMessage(`Here are my answers:\n${answersText}`);
	}

	function toggleOperationSelection(messageIndex: number, operationIndex: number) {
		const message = messages[messageIndex];
		if (!message.operations || !message.selectedOperations) return;

		const operation = message.operations[operationIndex];
		const isSelected = message.selectedOperations.includes(operation);

		if (isSelected) {
			message.selectedOperations = message.selectedOperations.filter(op => op !== operation);
		} else {
			message.selectedOperations = [...message.selectedOperations, operation];
		}

		messages[messageIndex] = { ...message };
		messages = messages;
	}

	function cancelOperations(messageIndex: number) {
		messages[messageIndex] = {
			...messages[messageIndex],
			content: 'Okay, I won\'t make those changes.',
			awaitingResponse: false,
			operations: undefined,
			selectedOperations: undefined
		};
		messages = messages;
	}

	// Initialize on mount
	onMount(async () => {
		try {
			conversation = await getOrCreateConversation(scope, projectId);
			const recentMessages = await getRecentMessages(conversation.id, 50);

			messages = recentMessages.map(m => ({
				role: m.role === 'assistant' ? 'ai' : 'user',
				content: m.content,
				questions: m.metadata?.questions,
				operations: m.metadata?.operations,
				proposedActions: m.metadata?.proposedActions
			}));

			if (messages.length === 0) {
				const welcomeMessages = {
					global: "Hi! I'm your AI assistant. I can help you create tasks, notes, and projects. What would you like to do?",
					tasks: "Hi! I'm your Tasks AI. I can help you create, organize, and manage your tasks. What would you like to do?",
					notes: "Hi! I'm your Notes AI. I can help you create and organize your notes. What would you like to work on?",
					project: "Hi! I'm your Project AI. I can help you manage tasks and notes for this project. What would you like to do?"
				};
				messages = [{ role: 'ai', content: welcomeMessages[scope] }];
			}

			const workspaceContext = await loadWorkspaceContext();
			workspaceContextString = formatWorkspaceContextForAI(workspaceContext);

			messagesReady = true;
			await scrollToBottom();
		} catch (error) {
			logger.error('Error loading conversation', error);
			messages = [{
				role: 'ai',
				content: 'Hi! I\'m your AI assistant. How can I help you today?'
			}];
			messagesReady = true;
		}
	});

	// Export functions that parent components might need
	export { executeOperations, handleAnswers, toggleOperationSelection, cancelOperations };
</script>

<!-- Slot for the parent to provide custom rendering -->
<slot {messages} {inputMessage} {isStreaming} {messagesReady} {sendMessage} {executeOperations} {handleAnswers} {toggleOperationSelection} {cancelOperations} />
