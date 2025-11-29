<script lang="ts">
	import FileUpload from '$lib/components/FileUpload.svelte';
	import VoiceInput from '$lib/components/VoiceInput.svelte';
	import MobileChatLayout from '$lib/components/MobileChatLayout.svelte';
	import { onMount, onDestroy, tick } from 'svelte';
	import { PUBLIC_WORKER_URL } from '$env/static/public';
	import { createTask, updateTask, deleteTask } from '$lib/db/tasks';
	import { createNote, updateNote, deleteNote } from '$lib/db/notes';
	import { createProject, updateProject, deleteProject } from '$lib/db/projects';
	import { getOrCreateConversation, getRecentMessages, addMessage, updateMessageMetadata } from '$lib/db/conversations';
	import { createFile } from '$lib/db/files';
	import { loadWorkspaceContext, formatWorkspaceContextForAI } from '$lib/db/context';
	import type { Conversation } from '@chatkin/types';
	import { notificationCounts } from '$lib/stores/notifications';
	import { logger } from '$lib/utils/logger';
	import { supabase } from '$lib/supabase';

	// Props for customization
	export let scope: 'global' | 'tasks' | 'notes' | 'project' = 'global';
	export let projectId: string | undefined = undefined;
	export let pageTitle: string = 'Chat';
	export let pageIcon: string | undefined = undefined;
	export let pageSubtitle: string | undefined = undefined;
	export let welcomeMessage: string = "Hi! I'm your AI assistant. What would you like to do?";
	export let isEmbedded: boolean = false;

	// Optional callbacks for parent components
	export let onOperationsComplete: ((operations: Operation[]) => Promise<void>) | undefined = undefined;
	export let onDataChange: (() => Promise<void>) | undefined = undefined;

	interface Message {
		id?: string; // Database message ID for updating metadata
		role: 'user' | 'ai';
		content: string;
		files?: Array<{ name: string; url: string; type: string; temporary?: boolean; saving?: boolean; saved?: boolean }>;
		proposedActions?: AIAction[];
		awaitingConfirmation?: boolean;
		isTyping?: boolean;
		questions?: AIQuestion[];
		operations?: Operation[];
		awaitingResponse?: boolean;
		userResponse?: Record<string, string>;
		selectedOperations?: Operation[];
	}

	interface AIAction {
		type: 'task' | 'note' | 'project';
		title?: string;  // for tasks/notes
		name?: string;   // for projects
		description?: string;
		content?: string;
		priority?: 'low' | 'medium' | 'high';
		due_date?: string;
		color?: string;
	}

	interface Operation {
		operation: 'create' | 'update' | 'delete';
		type: 'task' | 'note' | 'project';
		id?: string;
		data?: Record<string, unknown>;
		changes?: Record<string, unknown>;
		reason?: string;
	}

	interface AIQuestion {
		question: string;
		options: string[];
	}

	let messages: Message[] = [];
	let inputMessage = '';
	let isStreaming = false;
	let desktopMessagesContainer: HTMLDivElement;
	let mobileChatLayout: MobileChatLayout;
	let talkModeActive = false;
	let isPlayingAudio = false;
	let audioUnlocked = false;
	let currentAudio: HTMLAudioElement | null = null;
	let lastActivityTime = Date.now();
	let inactivityTimer: number | undefined;
	let autoListenTimeout: number | undefined;
	let waitingForAutoListen = false;
	let voiceInputRef: any;
	let conversation: Conversation | null = null;
	let workspaceContextString = '';
	let session: any = null;
	let messagesReady = false;
	let uploadedFiles: Array<{ name: string; url: string; type: string; size: number; temporary?: boolean; addedToLibrary?: boolean; saving?: boolean }> = [];
	let uploadStatus: string = '';

	async function scrollToBottom() {
		// Wait for DOM to update, then scroll immediately (for new messages during session)
		await tick();
		if (desktopMessagesContainer) {
			desktopMessagesContainer.scrollTop = desktopMessagesContainer.scrollHeight;
		}
		if (mobileChatLayout) {
			mobileChatLayout.scrollToBottom();
		}
	}

	async function sendMessage(message?: string) {
		const userMessage = message || inputMessage.trim();
		if (!userMessage || isStreaming || !conversation) return;

		// Capture files to send
		const filesToSend = [...uploadedFiles];

		inputMessage = '';
		uploadedFiles = [];

		// Save user message to database (with files in metadata)
		try {
			await addMessage(conversation.id, 'user', userMessage, {
				files: filesToSend.length > 0 ? filesToSend : undefined
			});
		} catch (error) {
			logger.error('Error saving user message', error);
		}

		// Add user message to UI (with files)
		messages = [...messages, {
			role: 'user',
			content: userMessage,
			files: filesToSend.length > 0 ? filesToSend : undefined
		}];
		scrollToBottom();

		// Add placeholder for AI response
		const aiMessageIndex = messages.length;
		messages = [...messages, { role: 'ai', content: '' }];
		isStreaming = true;

		// Show loading message
		messages = messages.map((msg, idx) =>
			idx === aiMessageIndex ? {
				role: 'ai',
					content: '',
				isTyping: true
			} : msg
		);
		scrollToBottom();

		try {
			// Build conversation history for context (filter out empty messages)
			// Only send last 50 messages, BUT exclude the current message since we're sending it separately
			const allMessages = messages.filter(m => m.content && m.content.trim() && !m.isTyping);
			const recentMessages = allMessages.slice(-50);
			// Remove the last message (current user message) to avoid duplicates
			const historyWithoutCurrent = recentMessages.slice(0, -1);

			const conversationHistory = historyWithoutCurrent.map(m => ({
				role: m.role,
				content: m.content,
				files: m.files
			}));

			// Get auth token for database queries
			const { data: { session } } = await supabase.auth.getSession();

			const requestBody = {
				message: userMessage,
				files: filesToSend.length > 0 ? filesToSend : undefined,
				conversationHistory: conversationHistory,
				conversationSummary: conversation.conversation_summary,
				workspaceContext: workspaceContextString,
				context: {
					scope,
					projectId
				},
				authToken: session?.access_token
			};

			// Use local worker URL in development
			const workerUrl = import.meta.env.DEV ? 'http://localhost:8787' : PUBLIC_WORKER_URL;

			const response = await fetch(`${workerUrl}/api/ai/chat`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${session?.access_token}`
				},
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			// Handle structured response from worker
			if (data.type === 'actions' && Array.isArray(data.actions)) {
				// Check if this is the new operations format
				const isOperationsFormat = data.actions.some((a: Record<string, unknown>) => a.operation !== undefined);

				if (isOperationsFormat) {
					// New operations format with create/update/delete
					const operations = data.actions as Operation[];

					// Count operations by type
					const createCount = operations.filter(op => op.operation === 'create').length;
					const updateCount = operations.filter(op => op.operation === 'update').length;
					const deleteCount = operations.filter(op => op.operation === 'delete').length;

					// Build preview message
					const parts = [];
					if (createCount > 0) parts.push(`create ${createCount} item${createCount > 1 ? 's' : ''}`);
					if (updateCount > 0) parts.push(`update ${updateCount} item${updateCount > 1 ? 's' : ''}`);
					if (deleteCount > 0) parts.push(`delete ${deleteCount} item${deleteCount > 1 ? 's' : ''}`);

					const previewMessage = `I'll ${parts.join(', ')} for you. Please review:`;

					// Save AI response
					try {
						await addMessage(conversation!.id, 'assistant', previewMessage, { operations });
					} catch (error) {
						logger.error('Error saving AI message', error);
					}

					// Send AI proposal notification
					try {
						const workerUrl = import.meta.env.DEV ? 'http://localhost:8787' : PUBLIC_WORKER_URL;
						const { data: { session } } = await supabase.auth.getSession();

						if (session?.access_token) {
							fetch(`${workerUrl}/api/send-notification`, {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									'Authorization': `Bearer ${session.access_token}`
								},
								body: JSON.stringify({
									notification_type: 'ai_proposal',
									channels: ['email', 'browser'],
									title: 'AI Proposal',
									body: data.summary || previewMessage,
									action_url: window.location.href,
									operation_count: operations.length
								})
							}).catch(err => logger.error('Failed to send notification', err));
						}
					} catch (error) {
						logger.error('Error sending AI proposal notification', error);
					}

					// Show operations inline
					messages = messages.map((msg, idx) =>
						idx === aiMessageIndex ? {
							role: 'ai',
						content: previewMessage,
							operations,
							awaitingResponse: true,
							selectedOperations: operations // All selected by default
						} : msg
					);
					scrollToBottom();
				} else {
					// Old actions format (backward compatibility)
					// Count proposed items
					const projectCount = data.actions.filter((a: AIAction) => a.type === 'project').length;
					const taskCount = data.actions.filter((a: AIAction) => a.type === 'task').length;
					const noteCount = data.actions.filter((a: AIAction) => a.type === 'note').length;

					// Build preview message
					const parts = [];
					if (projectCount > 0) parts.push(`${projectCount} project${projectCount > 1 ? 's' : ''}`);
					if (taskCount > 0) parts.push(`${taskCount} task${taskCount > 1 ? 's' : ''}`);
					if (noteCount > 0) parts.push(`${noteCount} note${noteCount > 1 ? 's' : ''}`);

					const previewMessage = `I'll create ${parts.join(', ')} for you:`;

					// Save AI response with proposed actions
					try {
						await addMessage(conversation!.id, 'assistant', previewMessage, { proposedActions: data.actions });
					} catch (error) {
						logger.error('Error saving AI message', error);
					}

					// Show proposed actions with confirmation buttons
					messages = messages.map((msg, idx) =>
						idx === aiMessageIndex ? {
							role: 'ai',
						content: previewMessage,
							proposedActions: data.actions,
							awaitingConfirmation: true
						} : msg
					);
					scrollToBottom();
				}
			} else if (data.type === 'questions' && Array.isArray(data.questions)) {
				// AI is asking structured questions - display inline
				const questionsMessage = "I need some information to help you:";

				// Save AI response
				try {
					await addMessage(conversation!.id, 'assistant', questionsMessage, { questions: data.questions });
				} catch (error) {
					logger.error('Error saving AI message', error);
				}

				// Show questions inline
				messages = messages.map((msg, idx) =>
					idx === aiMessageIndex ? {
						role: 'ai',
						content: questionsMessage,
						questions: data.questions,
						awaitingResponse: true
					} : msg
				);
			} else if (data.type === 'message') {
				// Save conversational AI response
				try {
					await addMessage(conversation!.id, 'assistant', data.message);
				} catch (error) {
					logger.error('Error saving AI message', error);
				}

				// Check if this message contains insights (heuristic detection)
				const messageText = data.message || '';
				const isInsight = messageText.length > 100 &&
					/\b(insight|notice|found that|discovered|analyzed|pattern|trend|recommend|suggest)\b/i.test(messageText);

				// Send AI insight notification if detected
				if (isInsight) {
					try {
						const workerUrl = import.meta.env.DEV ? 'http://localhost:8787' : PUBLIC_WORKER_URL;
						const { data: { session } } = await supabase.auth.getSession();

						if (session?.access_token) {
							fetch(`${workerUrl}/api/send-notification`, {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									'Authorization': `Bearer ${session.access_token}`
								},
								body: JSON.stringify({
									notification_type: 'ai_insight',
									channels: ['email', 'browser'],
									title: 'AI Insight',
									body: messageText.substring(0, 200) + (messageText.length > 200 ? '...' : ''),
									action_url: window.location.href
								})
							}).catch(err => logger.error('Failed to send notification', err));
						}
					} catch (error) {
						logger.error('Error sending AI insight notification', error);
					}
				}

				// Conversational response
				messages = messages.map((msg, idx) =>
					idx === aiMessageIndex ? {
						role: 'ai',
						content: data.message
					} : msg
				);


			// Scroll into view immediately after message appears
			await tick();
			await scrollToBottom();
			setTimeout(() => scrollToBottom(), 100);
				// Play TTS if Talk Mode is active
				if (talkModeActive && data.message) {
					await playTTS(data.message);
				}
			}
		} catch (error) {
			logger.error('Error sending message', error);
			messages = messages.map((msg, idx) =>
				idx === aiMessageIndex ? {
					role: 'ai',
					content: 'Sorry, I encountered an error processing your request. Please try again.'
				} : msg
			);
		} finally {
			isStreaming = false;
			// Wait for DOM to fully update and render markdown before scrolling
			await tick();
			await scrollToBottom();
			// Scroll again after a short delay to catch any delayed rendering
			setTimeout(() => scrollToBottom(), 100);
		}
	}

	async function confirmActions(messageIndex: number) {
		const message = messages[messageIndex];
		if (!message.proposedActions || !message.awaitingConfirmation) return;

		// Update message to show creating status
		messages = messages.map((msg, idx) =>
			idx === messageIndex ? {
	...message,
	content: 'Creating items...',
	awaitingConfirmation: false
			} : msg
		);

		// Create all proposed items
		let projectCount = 0, taskCount = 0, noteCount = 0;

		for (const action of message.proposedActions) {
			try {
				if (action.type === 'project') {
					await createProject({
						name: action.name || 'Untitled Project',
						description: action.description || null,
						color: action.color || '📁'
					});
					projectCount++;
					notificationCounts.incrementCount('projects');
				} else if (action.type === 'task') {
					await createTask({
						title: action.title || 'Untitled Task',
						description: action.description || null,
						priority: action.priority || 'medium',
						status: 'todo',
						project_id: null,
						due_date: action.due_date || null
					});
					taskCount++;
					notificationCounts.incrementCount('tasks');
				} else if (action.type === 'note') {
					await createNote({
						title: action.title || 'Untitled Note',
						content: action.content || '',
						project_id: null
					});
					noteCount++;
					notificationCounts.incrementCount('notes');
				}
			} catch (error) {
				logger.error(`Error creating ${action.type}`, error);
			}
		}

		// Show success message
		const parts = [];
		if (projectCount > 0) parts.push(`${projectCount} project${projectCount > 1 ? 's' : ''}`);
		if (taskCount > 0) parts.push(`${taskCount} task${taskCount > 1 ? 's' : ''}`);
		if (noteCount > 0) parts.push(`${noteCount} note${noteCount > 1 ? 's' : ''}`);

		messages = messages.map((msg, idx) =>
			idx === messageIndex ? {
	...message,
	content: `Created ${parts.join(', ')} for you!`,
	awaitingConfirmation: false,
	proposedActions: undefined
			} : msg
		);
	}

	function cancelActions(messageIndex: number) {
		const message = messages[messageIndex];
		if (!message.awaitingConfirmation) return;

		// Update message to show cancellation
		messages = messages.map((msg, idx) =>
			idx === messageIndex ? {
	...message,
	content: 'Okay, I won\'t create those items.',
	awaitingConfirmation: false,
	proposedActions: undefined
			} : msg
		);
	}

	async function executeOperations(operations: Operation[], messageIndex: number) {
		// Update message to show executing status
		messages = messages.map((msg, idx) =>
			idx === messageIndex ? {
	...messages[messageIndex],
	content: 'Executing operations...',
	awaitingResponse: false,
	operations: undefined,
	selectedOperations: undefined,
	isTyping: true
			} : msg
		);
		const statusIndex = messageIndex;

		let successCount = 0;
		let errorCount = 0;
		const results: string[] = [];
		let lastCreatedProjectId: string | null = null;

		for (const op of operations) {
			try {
				if (op.operation === 'create') {
					if (!op.data) throw new Error('Missing data for create operation');

					if (op.type === 'task') {
						const taskData = op.data as TaskData;
						// Smart project assignment: use explicit project_id, or context projectId, or the one we just created
						const targetProjectId = taskData.project_id || lastCreatedProjectId || projectId || null;
						
						// Sanitize task data to ensure only valid fields are sent to DB
						const { title, description, priority, status, due_date } = taskData;
						
						await createTask({
							title,
							description: description || null,
							priority: priority || 'medium',
							status: status || 'todo',
							due_date: due_date || null,
							project_id: targetProjectId,
							is_recurring: false,
							recurrence_pattern: null,
							parent_task_id: null,
							recurrence_end_date: null
						});
						notificationCounts.incrementCount('tasks');
						results.push(`✓ Created task: ${taskData.title}`);
					} else if (op.type === 'note') {
						const noteData = op.data as NoteData;
						// Smart project assignment
						const targetProjectId = noteData.project_id || lastCreatedProjectId || projectId || null;
						
						// Sanitize note data
						const { title: noteTitle, content } = noteData;
						
						await createNote({ 
							title: noteTitle,
							content: content || '',
							project_id: targetProjectId 
						});
						notificationCounts.incrementCount('notes');
						results.push(`✓ Created note: ${noteData.title}`);
					} else if (op.type === 'project') {
						const projectData = op.data as ProjectData;
						const newProject = await createProject({ ...projectData, description: projectData.description || null });
						// Capture the new project ID for subsequent items in this batch
						if (newProject && newProject.id) {
							lastCreatedProjectId = newProject.id;
							logger.debug('Captured new project ID for smart assignment', { id: lastCreatedProjectId });
						}
						notificationCounts.incrementCount('projects');
						results.push(`✓ Created project: ${projectData.name}`);
					}
					successCount++;
				} else if (op.operation === 'update') {
					if (!op.id) throw new Error('Missing ID for update operation');

					if (op.type === 'task') {
						await updateTask(op.id, op.changes);
						results.push(`✓ Updated task`);
					} else if (op.type === 'note') {
						// Filter out 'content' field - notes use block-based architecture
						const { content, ...validChanges } = op.changes;
						if (content) {
							logger.warn('Ignoring content field in note update - use note_blocks instead');
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
						results.push(`✓ Deleted task`);
					} else if (op.type === 'note') {
						await deleteNote(op.id);
						results.push(`✓ Deleted note`);
					} else if (op.type === 'project') {
						await deleteProject(op.id);
						results.push(`✓ Deleted project`);
					}
					successCount++;
				}
			} catch (error) {
				logger.error(`Error executing ${op.operation} ${op.type}`, error);
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

		// Trigger parent callbacks after operations complete
		if (successCount > 0) {
			try {
				// Call operation-specific callback
				if (onOperationsComplete) {
					await onOperationsComplete(operations);
				}

				// Call general data refresh callback
				if (onDataChange) {
					await onDataChange();
				}
			} catch (callbackError) {
				logger.error('Parent callback failed', callbackError);
				// Don't fail the entire operation if parent callback fails
			}
		}

		// Update status message with results
		const successMsg = successCount > 0 ? `${successCount} operation${successCount > 1 ? 's' : ''} completed` : '';
		const errorMsg = errorCount > 0 ? `${errorCount} failed` : '';
		const parts = [successMsg, errorMsg].filter(Boolean);

		messages = messages.map((msg, idx) =>
			idx === statusIndex ? {
				role: 'ai',
content: `${parts.join(', ')}!\n\n${results.join('\n')}`
			} : msg
		);
		scrollToBottom();
	}

	function handleInlineOperationConfirm(messageIndex: number) {
		const message = messages[messageIndex];
		if (!message.selectedOperations || message.selectedOperations.length === 0) return;

		executeOperations(message.selectedOperations, messageIndex);
	}

	function handleInlineOperationCancel(messageIndex: number) {
		// Update message to show cancellation
		messages = messages.map((msg, idx) =>
			idx === messageIndex ? {
	...messages[messageIndex],
	content: 'Okay, I won\'t make those changes.',
	awaitingResponse: false,
	operations: undefined,
	selectedOperations: undefined
			} : msg
		);
	}

	function toggleOperationSelection(messageIndex: number, opIndex: number) {
		const message = messages[messageIndex];
		if (!message.operations || !message.selectedOperations) return;

		const operation = message.operations[opIndex];
		const isSelected = message.selectedOperations.some(op =>
			op.operation === operation.operation &&
			op.type === operation.type &&
			op.id === operation.id &&
			JSON.stringify(op.data) === JSON.stringify(operation.data)
		);

		if (isSelected) {
			// Remove from selection
			messages[messageIndex].selectedOperations = message.selectedOperations.filter(op =>
				!(op.operation === operation.operation &&
				  op.type === operation.type &&
				  op.id === operation.id &&
				  JSON.stringify(op.data) === JSON.stringify(operation.data))
			);
		} else {
			// Add to selection
			messages[messageIndex].selectedOperations = [...message.selectedOperations, operation];
		}
		messages = messages;
	}

	async function handleInlineQuestionSubmit(messageIndex: number, answers: Record<string, string>) {
		const message = messages[messageIndex];
		if (!message.questions) return;

		// Format answers as a message
		const answersText = Object.entries(answers)
			.map(([question, answer]) => `${question}\n→ ${answer}`)
			.join('\n\n');

		// Update message to show user's responses
		messages = messages.map((msg, idx) =>
			idx === messageIndex ? {
	...message,
	awaitingResponse: false,
	userResponse: answers
			} : msg
		);

		// Send answers back to AI
		await sendMessage(answersText);
	}

	function handleInlineQuestionCancel(messageIndex: number) {
		// Update message to show cancellation
		messages = messages.map((msg, idx) =>
			idx === messageIndex ? {
	...messages[messageIndex],
	content: 'No problem! Let me know if you need anything else.',
	awaitingResponse: false,
	questions: undefined
			} : msg
		);
	}

	async function saveFileToLibrary(file: { name: string; url: string; type: string; size: number; temporary?: boolean }, index: number) {
		// Check if this is being called for uploadedFiles (input area) or message files
		// If index is out of bounds for uploadedFiles, it's a message file
		if (index >= uploadedFiles.length) {
			// This is a message file, use the message-specific function
			return saveMessageFileToLibrary(file);
		}

		// Set saving state for uploadedFiles
		uploadedFiles[index] = {
			...uploadedFiles[index],
			saving: true
		};
		uploadedFiles = uploadedFiles;

		try {
			// Use local worker URL in development
			const workerUrl = import.meta.env.DEV ? 'http://localhost:8787' : PUBLIC_WORKER_URL;

			// Get auth token
			const { data: { session } } = await supabase.auth.getSession();

			// Call backend to move file from temp to permanent and generate metadata
			const response = await fetch(`${workerUrl}/api/save-to-library`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${session?.access_token}`
				},
				body: JSON.stringify({
					tempUrl: file.url,
					originalName: file.name,
					mimeType: file.type,
					sizeBytes: file.size
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to save file to library');
			}

			const result = await response.json();

			if (result.success && result.file) {
				// Create DB entry for permanent file
				await createFile({
					filename: result.file.originalName,
					r2_key: result.file.name,
					r2_url: result.file.url,
					mime_type: result.file.type,
					size_bytes: result.file.size,
					note_id: null,
					conversation_id: conversation?.id || null,
					message_id: null,
					is_hidden_from_library: false,
					title: result.file.title || null,
					description: result.file.description || null,
					ai_generated_metadata: result.file.ai_generated_metadata || false
				});

				// Update uploadedFiles to mark as added to library
				uploadedFiles[index] = {
					...uploadedFiles[index],
					temporary: false,
					addedToLibrary: true,
					saving: false,
					url: result.file.url
				};
				uploadedFiles = uploadedFiles; // Trigger reactivity

				logger.debug('File saved to library', { filename: file.name });
			}
		} catch (error) {
			logger.error('Failed to save file to library', error);
			alert('Failed to save file to library. Please try again.');
			// Clear saving state on error
			uploadedFiles[index] = {
				...uploadedFiles[index],
				saving: false
			};
			uploadedFiles = uploadedFiles;
		}
	}

	async function saveMessageFileToLibrary(file: { name: string; url: string; type: string; size: number; temporary?: boolean }) {
		try {
			// Use local worker URL in development
			const workerUrl = import.meta.env.DEV ? 'http://localhost:8787' : PUBLIC_WORKER_URL;

			// Call backend to move file from temp to permanent and generate metadata
			const response = await fetch(`${workerUrl}/api/save-to-library`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${session?.access_token}`
				},
				body: JSON.stringify({
					tempUrl: file.url,
					originalName: file.name,
					mimeType: file.type,
					sizeBytes: file.size
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to save file to library');
			}

			const result = await response.json();

			if (result.success && result.file) {
				// Create DB entry for permanent file
				await createFile({
					filename: result.file.originalName,
					r2_key: result.file.name,
					r2_url: result.file.url,
					mime_type: result.file.type,
					size_bytes: result.file.size,
					note_id: null,
					conversation_id: conversation?.id || null,
					message_id: null,
					is_hidden_from_library: false,
					title: result.file.title || null,
					description: result.file.description || null,
					ai_generated_metadata: result.file.ai_generated_metadata || false
				});

				logger.debug('File saved to library', { filename: file.name });
			}
		} catch (error) {
			logger.error('Failed to save file to library', error);
			throw error;
		}
	}

	// Talk Mode functions
	async function unlockAudio() {
		if (audioUnlocked) return;

		try {
			// Create a silent audio to unlock audio playback
			// This is required due to browser autoplay policies
			const silentAudio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
			await silentAudio.play();
			audioUnlocked = true;
			logger.debug('Audio playback unlocked');
		} catch (error) {
			logger.error('Failed to unlock audio', error);
		}
	}

	async function toggleTalkMode() {
		talkModeActive = !talkModeActive;
		logger.debug('Talk Mode toggled', { talkModeActive });

		if (talkModeActive) {
			// Unlock audio playback first (required for autoplay)
			await unlockAudio();

			lastActivityTime = Date.now();
			startInactivityTimer();
			// Immediately start listening when Talk Mode is turned ON
			if (voiceInputRef) {
				voiceInputRef.startListening();
			}
		} else {
			stopInactivityTimer();
			stopAutoListen();  // Cancel auto-listen when Talk Mode is turned off

			// Stop any playing audio
			if (currentAudio) {
				currentAudio.pause();
				currentAudio = null;
				isPlayingAudio = false;
			}

			// Stop recording if active
			if (voiceInputRef) {
				voiceInputRef.stopListening();
			}
		}
	}

	function startInactivityTimer() {
		stopInactivityTimer(); // Clear any existing timer

		inactivityTimer = window.setInterval(() => {
			const now = Date.now();
			const timeSinceActivity = now - lastActivityTime;

			// Auto-pause after 2 minutes (120000ms) of inactivity
			if (timeSinceActivity > 120000 && talkModeActive) {
				talkModeActive = false;
				stopInactivityTimer();
				logger.debug('Talk Mode auto-paused due to inactivity');
			}
		}, 5000); // Check every 5 seconds
	}

	function stopInactivityTimer() {
		if (inactivityTimer) {
			clearInterval(inactivityTimer);
			inactivityTimer = undefined;
		}
	}

	function resetActivityTimer() {
		lastActivityTime = Date.now();
		if (talkModeActive) {
			startInactivityTimer();
		}
	}

	async function playTTS(text: string) {
		try {
			isPlayingAudio = true;

			// Call Amazon Polly API endpoint
			const response = await fetch('/api/tts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text })
			});

			if (!response.ok) {
				throw new Error('TTS request failed');
			}

			const audioBlob = await response.blob();
			const audioUrl = URL.createObjectURL(audioBlob);
			const audio = new Audio(audioUrl);
		currentAudio = audio;

			// Play the audio
			await audio.play();

			// Wait for audio to finish
			await new Promise<void>((resolve) => {
				audio.onended = () => {
					URL.revokeObjectURL(audioUrl);
					resolve();
				currentAudio = null;
				};
			});

			resetActivityTimer();

			// After TTS finishes, start auto-listen if Talk Mode is active
			if (talkModeActive && waitingForAutoListen) {
				triggerAutoListen();
			}
		} catch (error) {
			logger.error('Failed to play TTS audio', error);
			// Still trigger auto-listen even if TTS fails
			if (talkModeActive && waitingForAutoListen) {
				triggerAutoListen();
			}
		} finally {
			isPlayingAudio = false;
		}
	}

	// Auto-listen functions for Talk Mode
	function startAutoListenAfterResponse() {
		waitingForAutoListen = true;
	}

	function triggerAutoListen() {
		if (!talkModeActive || !voiceInputRef) return;

		// Start listening programmatically
		voiceInputRef.startListening();
		logger.debug('Auto-listen started - will auto-stop after 2 seconds of silence');

		// Don't set a hard timeout - let the VoiceInput silence detection handle when to stop
		// The user has unlimited time to start speaking, and recording will stop 2 seconds after they finish
		waitingForAutoListen = false; // Clear the waiting flag now that we've started
	}

	function stopAutoListen() {
		if (autoListenTimeout) {
			clearTimeout(autoListenTimeout);
			autoListenTimeout = undefined;
		}
		waitingForAutoListen = false;
		logger.debug('Auto-listen stopped');
	}

	onMount(async () => {
		// Get session for file uploads
		const { data: { session: userSession } } = await supabase.auth.getSession();
		session = userSession;

		// Lock viewport to prevent elastic scroll on mobile
		if (typeof document !== 'undefined') {
			document.documentElement.style.overflow = 'hidden';
			document.body.style.overflow = 'hidden';
			document.documentElement.style.overscrollBehavior = 'none';
			document.body.style.overscrollBehavior = 'none';
		}

		// Set current section to null (global chat is not a specific section)
		notificationCounts.setCurrentSection(null);

		// Load conversation and context
		try {
			// Get or create conversation for global scope
			conversation = await getOrCreateConversation(scope, projectId);

			// Load recent messages from database
			const dbMessages = await getRecentMessages(conversation.id, 50);

			// Convert DB messages to UI messages
			if (dbMessages.length > 0) {
				messages = dbMessages.map(msg => ({
					id: msg.id, // Preserve message ID for updating metadata
					role: msg.role === 'assistant' ? 'ai' : 'user',
					content: msg.content,
					proposedActions: msg.metadata?.proposedActions,
					files: msg.metadata?.files
				}));
			} else {
				// Show welcome message if no history
				messages = [{
					role: 'ai',
					content: welcomeMessage
				}];
			}

			// Load workspace context
			const workspaceContext = await loadWorkspaceContext();
			workspaceContextString = formatWorkspaceContextForAI(workspaceContext);

			await scrollToBottom();
			messagesReady = true;
		} catch (error) {
			logger.error('Error loading conversation', error);
			// Show welcome message as fallback
			messages = [{
				role: 'ai',
				content: welcomeMessage
			}];
			await scrollToBottom();
			messagesReady = true;
		}
	});

	onDestroy(() => {
		// Restore default overflow behavior
		if (typeof document !== 'undefined') {
			document.documentElement.style.overflow = '';
			document.body.style.overflow = '';
			document.documentElement.style.overscrollBehavior = '';
			document.body.style.overscrollBehavior = '';
		}

		// Clean up Talk Mode timers
		stopInactivityTimer();
		stopAutoListen();
	});
</script>

<div class="chat-page">
	<!-- Desktop: Full-screen chat -->
	<div class="desktop-chat {isEmbedded ? 'embedded' : 'standalone'}">
		<header class="chat-header">
			<div class="header-content">
				{#if pageIcon && pageSubtitle}
					<!-- Embedded mode: icon + title + subtitle -->
					<div class="chat-title">
						<img src={pageIcon} alt={pageTitle} class="ai-icon" />
						<div>
							<h2>{pageTitle}</h2>
							<p class="ai-subtitle">{pageSubtitle}</p>
						</div>
					</div>
				{:else}
					<!-- Standalone mode: just title -->
					<h1>{pageTitle}</h1>
				{/if}
				{#if !isEmbedded}
				<!-- Talk Mode Toggle -->
				<div class="header-actions">
					<button
						class="talk-mode-btn {talkModeActive ? 'active' : ''}"
						title={talkModeActive ? 'Turn off Talk Mode' : 'Turn on Talk Mode'}
						onclick={toggleTalkMode}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
						<line x1="4" y1="14" x2="4" y2="10"/>
						<line x1="8" y1="16" x2="8" y2="8"/>
						<line x1="12" y1="18" x2="12" y2="6"/>
						<line x1="16" y1="16" x2="16" y2="8"/>
						<line x1="20" y1="14" x2="20" y2="10"/>
						</svg>
						<span class="talk-mode-label">
							{#if isPlayingAudio}
								Speaking...
							{:else if talkModeActive}
								Talk Mode
							{:else}
								Talk Mode
							{/if}
						</span>
					</button>
				</div>
			{/if}
			</div>
		</header>

		{#if !messagesReady}
			<div class="chat-loading-overlay">
				<div class="spinner"></div>
				<p>Loading conversation...</p>
			</div>
		{/if}

		<div class="messages" bind:this={desktopMessagesContainer} style:opacity={messagesReady ? '1' : '0'}>
			{#each messages as message, index (index)}
				<div class="message {message.role}">
					<div class="message-bubble">
						{#if message.isTyping}
							<div class="typing-indicator">
								<span></span>
								<span></span>
								<span></span>
							</div>
						{:else}
							<p>{message.content}</p>

							{#if message.files && message.files.length > 0}
								<!-- Inline files display -->
								<div class="message-files">
									{#each message.files as file, fileIndex}
										{#if file && file.type && file.type.startsWith('image/')}
											<!-- Inline image -->
											<div class="message-image">
												<img src={file.url} alt={file.name} />
												{#if file.temporary || file.saved}
													<button
														type="button"
														class="message-save-btn"
														class:saving={file.saving}
														class:saved={file.saved}
														disabled={file.saving || file.saved}
														onclick={async () => {
															// Set saving state
															if (message.files && message.files[fileIndex]) {
																message.files[fileIndex] = {
																	...message.files[fileIndex],
																	saving: true
																};
																messages = messages;
															}

															try {
																await saveMessageFileToLibrary(file);

																// Update the file to saved state
																if (message.files && message.files[fileIndex]) {
																	message.files[fileIndex] = {
																		...message.files[fileIndex],
																		saving: false,
																		saved: true,
																		temporary: false
																	};
																	messages = messages;

																	// Persist saved state to database
																	if (message.id && message.files) {
																		const updatedFiles = [...message.files];
																		await updateMessageMetadata(message.id, {
																			files: updatedFiles
																		});
																	}
																}
															} catch (error) {
																console.error('Failed to save file:', error);
																// Reset saving state on error
																if (message.files && message.files[fileIndex]) {
																	message.files[fileIndex] = {
																		...message.files[fileIndex],
																		saving: false
																	};
																	messages = messages;
																}
															}
														}}
														title="Save to library"
													>
														{#if file.saving}
															<span class="spinner-small"></span>
															Saving...
														{:else if file.saved}
															✓ Saved!
														{:else}
															Save
														{/if}
													</button>
												{/if}
											</div>
										{:else}
											<!-- File attachment chip -->
											<div class="message-file-chip">
												<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
													<path d="M6 2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
													<path d="M14 2v6h6"/>
												</svg>
												<span>{file.name}</span>
											</div>
										{/if}
									{/each}
								</div>
							{/if}

							{#if message.proposedActions && message.awaitingConfirmation}
								<!-- Action Preview List (OLD format for backward compatibility) -->
								<div class="actions-preview">
									{#each message.proposedActions as action}
										<div class="action-item">
											{#if action.type === 'project'}
												<span class="action-icon">📁</span>
												<div class="action-details">
													<strong>{action.name}</strong>
													{#if action.description}
														<span class="action-desc">{action.description}</span>
													{/if}
												</div>
											{:else if action.type === 'task'}
												<span class="action-icon">✓</span>
												<div class="action-details">
													<strong>{action.title}</strong>
													{#if action.description}
														<span class="action-desc">{action.description}</span>
													{/if}
													{#if action.due_date}
														<span class="action-meta">Due: {action.due_date}</span>
													{/if}
													{#if action.priority}
														<span class="action-meta priority-{action.priority}">{action.priority}</span>
													{/if}
												</div>
											{:else if action.type === 'note'}
												<span class="action-icon">📝</span>
												<div class="action-details">
													<strong>{action.title}</strong>
													{#if action.content}
														<span class="action-desc">{action.content.substring(0, 100)}{action.content.length > 100 ? '...' : ''}</span>
													{/if}
												</div>
											{/if}
										</div>
									{/each}
								</div>

								<!-- Confirmation Buttons -->
								<div class="confirmation-buttons">
									<button class="confirm-btn" onclick={() => confirmActions(index)}>
										Confirm
									</button>
									<button class="cancel-btn" onclick={() => cancelActions(index)}>
										Cancel
									</button>
								</div>
							{/if}

							{#if message.operations && message.awaitingResponse}
								<!-- Inline Operations Preview -->
								<div class="inline-operations">
									{#each message.operations as operation, opIndex}
										{@const isSelected = message.selectedOperations?.some(op =>
											op.operation === operation.operation &&
											op.type === operation.type &&
											op.id === operation.id &&
											JSON.stringify(op.data) === JSON.stringify(operation.data)
										)}
										<label class="operation-item {operation.operation}">
											<input
												type="checkbox"
												checked={isSelected}
												onchange={() => toggleOperationSelection(index, opIndex)}
											/>
											<div class="operation-content">
												<div class="operation-header">
													{#if operation.operation === 'create'}
														<span class="operation-icon create">✓</span>
														<strong>Create {operation.type}</strong>
													{:else if operation.operation === 'update'}
														<span class="operation-icon update">✎</span>
														<strong>Update {operation.type}</strong>
													{:else if operation.operation === 'delete'}
														<span class="operation-icon delete">✗</span>
														<strong>Delete {operation.type}</strong>
													{/if}
												</div>
												{#if operation.data}
													<div class="operation-details">
														{#if operation.data.title || operation.data.name}
															<span class="operation-title">{operation.data.title || operation.data.name}</span>
														{/if}
														{#if operation.data.description}
															<span class="operation-desc">{operation.data.description}</span>
														{/if}
													</div>
												{/if}
												{#if operation.reason}
													<div class="operation-reason">{operation.reason}</div>
												{/if}
											</div>
										</label>
									{/each}
								</div>

								<!-- Confirmation Buttons -->
								<div class="confirmation-buttons">
									<button class="confirm-btn" onclick={() => handleInlineOperationConfirm(index)} disabled={!message.selectedOperations || message.selectedOperations.length === 0}>
										Confirm
									</button>
									<button class="cancel-btn" onclick={() => handleInlineOperationCancel(index)}>
										Cancel
									</button>
								</div>
							{/if}

							{#if message.questions && message.awaitingResponse}
								<!-- Inline Questions Form -->
								<div class="inline-questions">
									{#each message.questions as question, qIndex}
										{@const questionId = `q${index}_${qIndex}`}
										<div class="question-block">
											<label class="question-label">{question.question}</label>
											<div class="question-options">
												{#each question.options.filter(opt => opt.toLowerCase() !== 'other') as option, optIndex}
													<label class="option-label">
														<input
															type="radio"
															name={questionId}
															value={option}
															id={`${questionId}_${optIndex}`}
														/>
														<span>{option}</span>
													</label>
												{/each}
												<label class="option-label other-option">
													<input
														type="radio"
														name={questionId}
														value="__other__"
														id={`${questionId}_other`}
													/>
													<span>Other:</span>
													<input
														type="text"
														class="other-input"
														placeholder="Enter your answer"
														id={`${questionId}_other_text`}
														onfocus={(e) => {
															const radio = e.currentTarget.parentElement?.querySelector('input[type="radio"]') as HTMLInputElement;
															if (radio) radio.checked = true;
														}}
														onclick={(e) => {
															const radio = e.currentTarget.parentElement?.querySelector('input[type="radio"]') as HTMLInputElement;
															if (radio) radio.checked = true;
														}}
													/>
												</label>
											</div>
										</div>
									{/each}
								</div>

								<!-- Submit/Cancel Buttons -->
								<div class="confirmation-buttons">
									<button class="confirm-btn" type="button" onclick={() => {
										const answers = {};
										message.questions.forEach((q, qIdx) => {
											const questionId = `q${index}_${qIdx}`;
											const selected = document.querySelector(`input[name="${questionId}"]:checked`) as HTMLInputElement;
											if (selected) {
												if (selected.value === '__other__') {
													const otherInput = document.getElementById(`${questionId}_other_text`) as HTMLInputElement;
													answers[q.question] = otherInput?.value || '';
												} else {
													answers[q.question] = selected.value;
												}
											}
										});
										if (Object.keys(answers).length === 0) {
											alert('Please select an answer for each question');
											return;
										}
										handleInlineQuestionSubmit(index, answers);
									}}>
										Submit
									</button>
									<button class="cancel-btn" type="button" onclick={() => {
										handleInlineQuestionCancel(index);
									}}>
										Cancel
									</button>
								</div>
							{/if}

							{#if message.userResponse}
								<!-- Show user's responses after submission -->
								<div class="user-responses">
									{#each Object.entries(message.userResponse) as [question, answer]}
										<div class="response-item">
											<strong>{question}</strong>
											<span>→ {answer}</span>
										</div>
									{/each}
								</div>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<form class="input-container" class:global-scope={scope === 'global' && !isEmbedded} onsubmit={(e) => { e.preventDefault(); sendMessage(); }}>
			<!-- Character counter -->
			{#if inputMessage.length > 8000}
				<div class="char-counter-container">
					<div class="char-counter" class:warning={inputMessage.length > 9500}>
						{inputMessage.length} / 10,000 characters
					</div>
				</div>
			{/if}

			{#if uploadedFiles.length > 0}
				<div class="uploaded-files-preview">
					{#each uploadedFiles as file, index}
						{#if file && file.type && file.type.startsWith('image/')}
							<!-- Compact image preview for images -->
							<div class="image-preview-compact">
								<img src={file.url} alt={file.name} class="preview-thumbnail" />
								<div class="preview-info">
									<span class="preview-name">{file.name}</span>
									<span class="preview-size">{(file.size / 1024).toFixed(1)} KB</span>
								</div>
								<div class="preview-actions-compact">
									{#if file.temporary || file.addedToLibrary}
										<button
											type="button"
											class="add-to-library-btn"
											class:added={file.addedToLibrary}
											class:saving={file.saving}
											disabled={file.addedToLibrary || file.saving}
											onclick={async () => {
												await saveFileToLibrary(file, index);
											}}
										>
											{#if file.saving}
												<span class="spinner-small"></span>
												Saving...
											{:else if file.addedToLibrary}
												Added
											{:else}
												Add to library
											{/if}
										</button>
									{/if}
									<button
										type="button"
										class="action-icon-btn remove"
										onclick={() => {
											uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
										}}
										aria-label="Remove file"
									>
										<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M15 5L5 15M5 5l10 10"/>
										</svg>
									</button>
								</div>
							</div>
						{:else}
							<!-- File chip for documents -->
							<div class="file-chip">
								<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M6 2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
									<path d="M14 2v6h6"/>
								</svg>
								<span class="file-name">{file.name}</span>
								{#if file.temporary}
									<button
										type="button"
										class="save-chip-btn"
										onclick={async () => {
											await saveFileToLibrary(file, index);
										}}
										title="Save to library"
									>
										<svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M5 3v16l7-5 7 5V3a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/>
										</svg>
									</button>
								{/if}
								<button
									type="button"
									class="remove-file-btn"
									onclick={() => {
										uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
									}}
									aria-label="Remove file"
								>
									<svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M15 5L5 15M5 5l10 10"/>
									</svg>
								</button>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
			<FileUpload
				accept="image/*,application/pdf,.doc,.docx,.txt"
				maxSizeMB={10}
				permanent={false}
				conversationId={conversation?.id || null}
				{session}
				bind:uploadStatus
				onUploadComplete={(file) => {
				uploadedFiles = [...uploadedFiles, {
					name: file.originalName,
					url: file.url,
					type: file.type,
					size: file.size,
					temporary: file.temporary
				}];
				}}
			/>
			<div class="input-wrapper">
				<input
					type="text"
					bind:value={inputMessage}
					maxlength="10000"
					placeholder={uploadStatus || "Ask me anything..."}
					class="message-input"
					disabled={isStreaming}
				/>
				<VoiceInput
					bind:this={voiceInputRef}
					autoSendEnabled={talkModeActive}
					talkModeActive={talkModeActive}
					onTranscriptUpdate={(transcript) => {
						inputMessage = transcript;
						resetActivityTimer();
					}}
					onTranscriptComplete={(transcript) => {
						inputMessage = transcript;
						resetActivityTimer();
					}}
					onAutoSend={async (transcript) => {
						// Set flag BEFORE sending message so TTS knows to auto-listen
						if (talkModeActive) {
							startAutoListenAfterResponse();
						}

						await sendMessage(transcript);
						resetActivityTimer();
					}}
				/>
			</div>
			<button type="submit" class="send-btn" disabled={isStreaming || !inputMessage.trim()}>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M5 15L15 5"/>
					<path d="M9 5h6v6"/>
				</svg>
			</button>
		</form>
	</div>

	<!-- Mobile: Header + full-screen chat -->
	<MobileChatLayout
		bind:this={mobileChatLayout}
		bind:messages
		bind:inputMessage
		bind:uploadedFiles
		{isStreaming}
		{messagesReady}
		onSubmit={() => sendMessage()}
		onQuestionSubmit={handleInlineQuestionSubmit}
		onQuestionCancel={handleInlineQuestionCancel}
		onOperationConfirm={handleInlineOperationConfirm}
		onOperationCancel={handleInlineOperationCancel}
		onSaveFileToLibrary={saveFileToLibrary}
		{updateMessageMetadata}
		title={pageTitle}
		subtitle={pageSubtitle}
		backUrl={scope === 'tasks' ? '/tasks' : scope === 'notes' ? '/notes' : scope === 'project' && projectId ? `/projects/${projectId}/chat` : null}
		{talkModeActive}
		{isPlayingAudio}
		{toggleTalkMode}
	/>
</div>

<style>

	.chat-page {
		min-height: 100vh;
		background: var(--bg-primary);
	}

	/* Desktop: Full-screen chat */
	.desktop-chat.standalone {
		position: absolute;
		top: 0;
		left: 240px;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--bg-primary);
	}

	/* Desktop: Embedded chat (for tasks/notes pages) */
	.desktop-chat.embedded {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--bg-primary);
		height: 100%;
	}

	/* Mobile: Full-screen chat */
	.mobile-content {
		display: none;
	}

	@media (max-width: 1023px) {
		.desktop-chat.standalone,
		.desktop-chat.embedded {
			display: none;
		}

		.chat-page {
			padding-bottom: 0;
		}
	}

	/* Header */
	.chat-header {
		flex-shrink: 0;
		padding: 16px 20px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
	}

	/* Align standalone chat header with sidebar header */
	.desktop-chat.standalone .chat-header {
		height: 64px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
	}

	.header-content {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.chat-header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.chat-title {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.ai-icon {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
	}

	.chat-title h2 {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 2px 0;
	}

	.ai-subtitle {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.talk-mode-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: var(--bg-tertiary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.talk-mode-btn:hover {
		background: var(--bg-primary);
		transform: translateY(-1px);
		border-color: var(--accent-primary);
	}

	.talk-mode-btn:active {
		transform: translateY(0);
	}

	.talk-mode-btn.active {
		background: var(--accent-primary);
		border-color: var(--accent-primary);
		color: white;
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.2);
	}

	.talk-mode-btn.active:hover {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
	}

	.talk-mode-label {
		white-space: nowrap;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 0.2;
		}
		50% {
			opacity: 0.4;
		}
	}

	.pulse-ring {
		animation: pulse 2s ease-in-out infinite;
	}

	/* Messages */
	.messages {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.chat-loading-overlay {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		background: var(--bg-primary);
		padding-top: 120px;
	}

	.chat-loading-overlay p {
		color: var(--text-secondary);
		font-size: 0.9375rem;
		margin: 0;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--border-color);
		border-top-color: var(--accent-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.message {
		display: flex;
	}

	.message.user {
		justify-content: flex-end;
	}

	.message.ai {
		justify-content: flex-start;
	}

	.message-bubble {
		max-width: 85%;
		padding: 12px 16px;
		border-radius: 12px;
		font-size: 0.9375rem;
		line-height: 1.5;
	}

	.message-bubble p {
		margin: 0;
	}

	.message.user .message-bubble {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		text-align: left;
	}

	.message.ai .message-bubble {
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		text-align: left;
		max-width: 95%;
	}

	/* Message Files Display */
	.message-files {
		margin-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.message-image {
		position: relative;
		max-width: 400px;
		border-radius: var(--radius-md);
		overflow: hidden;
		border: 1px solid var(--border-color);
	}

	.message-image img {
		width: 100%;
		height: auto;
		display: block;
	}

	.message-save-btn {
		position: absolute;
		bottom: 8px;
		right: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 6px 12px;
		background: rgba(199, 124, 92, 0.6);
		backdrop-filter: blur(8px);
		border: none;
		border-radius: var(--radius-md);
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		font-size: 0.6875rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.message-save-btn:hover {
		background: rgba(199, 124, 92, 0.85);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.message-save-btn.saving {
		cursor: wait;
		background: rgba(199, 124, 92, 0.6);
	}

	.message-save-btn.saved {
		background: rgba(76, 175, 80, 0.85);
		cursor: default;
	}

	.message-save-btn.saved:hover {
		background: rgba(76, 175, 80, 0.85);
		transform: none;
	}

	.message-file-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		color: var(--text-primary);
		width: fit-content;
	}

	.message-file-chip svg {
		flex-shrink: 0;
	}

	/* Actions Preview */
	.actions-preview {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.action-item {
		display: flex;
		gap: 10px;
		padding: 8px;
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
	}

	.action-icon {
		font-size: 18px;
		flex-shrink: 0;
	}

	.action-details {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.action-details strong {
		font-size: 0.9375rem;
		color: var(--text-primary);
	}

	.action-desc {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.action-meta {
		font-size: 0.75rem;
		color: var(--text-muted);
		padding: 2px 6px;
		background: var(--bg-tertiary);
		border-radius: 4px;
		display: inline-block;
		width: fit-content;
		margin-right: 6px;
	}

	.action-meta.priority-high {
		background: rgba(211, 47, 47, 0.1);
		color: var(--danger);
	}

	.action-meta.priority-medium {
		background: rgba(199, 124, 92, 0.1);
		color: var(--accent-primary);
	}

	.action-meta.priority-low {
		background: rgba(115, 115, 115, 0.1);
		color: var(--text-secondary);
	}

	/* Confirmation Buttons */
	.confirmation-buttons {
		display: flex;
		gap: 8px;
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border-color);
	}

	.confirm-btn, .cancel-btn {
		flex: 1;
		padding: 10px 16px;
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
	}

	.confirm-btn {
		background: var(--accent-primary);
		color: white;
	}

	.confirm-btn:hover {
		background: var(--accent-hover);
	}

	.cancel-btn {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.cancel-btn:hover {
		background: var(--bg-secondary);
	}

	/* Typing Indicator */
	.typing-indicator {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 8px 4px;
	}

	.typing-indicator span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--text-secondary);
		animation: typing 1.2s ease-in-out infinite;
	}

	.typing-indicator span:nth-child(1) {
		animation-delay: 0s;
	}

	.typing-indicator span:nth-child(2) {
		animation-delay: 0.15s;
	}

	.typing-indicator span:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes typing {
		0%, 80%, 100% {
			transform: scale(1);
			opacity: 0.5;
		}
		40% {
			transform: scale(1.3);
			opacity: 1;
		}
	}

	/* Input Container */
	.input-container {
		position: relative;
		flex-shrink: 0;
		padding: 16px;
		padding-bottom: max(16px, env(safe-area-inset-bottom));
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		min-height: calc(76px + env(safe-area-inset-bottom));
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		box-sizing: border-box;
		transform: translate3d(0, 0, 0);
		-webkit-transform: translate3d(0, 0, 0);
	}

	/* Match sidebar footer height on desktop for global chat */
	@media (min-width: 1024px) {
		.input-container.global-scope {
			height: 76px;
			min-height: 76px;
			max-height: 76px;
			overflow-y: visible;
		}
	}

	.input-wrapper {
		position: relative;
		flex: 1;
		display: flex;
		align-items: center;
	}

	.message-input {
		flex: 1;
		width: 100%;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 12px 48px 12px 16px;
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
	}

	.message-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	.input-wrapper :global(.voice-input) {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
	}

	.input-wrapper :global(.mic-btn) {
		width: 32px;
		height: 32px;
		background: transparent;
		border: none;
		padding: 0;
	}

	/* Character counter */
	.char-counter-container {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 16px;
		right: 16px;
		z-index: 10;
	}

	.char-counter {
		display: inline-block;
		font-size: 0.75rem;
		color: var(--text-secondary);
		background: var(--bg-secondary);
		padding: 4px 10px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	}

	.char-counter.warning {
		color: #ef4444;
		background: #fef2f2;
		border-color: #fecaca;
		font-weight: 600;
	}

	.send-btn {
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-primary);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.send-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.send-btn:active {
		transform: translateY(0);
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.message-input:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	/* Uploaded Files Preview */
	.uploaded-files-preview {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 16px;
		right: 16px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 12px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
		z-index: 10;
	}

	.file-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.file-chip .file-name {
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.remove-file-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		padding: 0;
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.remove-file-btn:hover {
		color: var(--danger);
	}

	/* Compact Image Preview */
	.image-preview-compact {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		width: 100%;
	}

	.preview-thumbnail {
		width: 48px;
		height: 48px;
		flex-shrink: 0;
		border-radius: var(--radius-sm);
		object-fit: cover;
		background: var(--bg-secondary);
	}

	.preview-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.preview-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-size {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.preview-actions-compact {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.action-icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-icon-btn:hover {
		background: var(--bg-secondary);
		color: var(--accent-primary);
		border-color: var(--accent-primary);
	}

	.action-icon-btn.remove:hover {
		color: var(--danger);
		border-color: var(--danger);
	}

	.add-to-library-btn {
		padding: 6px 12px;
		background: var(--accent-primary);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.add-to-library-btn:hover:not(:disabled) {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.add-to-library-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.add-to-library-btn.added {
		background: #4caf50;
		cursor: default;
	}

	.add-to-library-btn.saving {
		cursor: wait;
	}

	.add-to-library-btn:disabled {
		opacity: 1;
	}

	.spinner-small {
		width: 12px;
		height: 12px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.save-chip-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.save-chip-btn:hover {
		color: var(--accent-primary);
		transform: scale(1.1);
	}

	/* Inline Operations */
	.inline-operations {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 400px;
		overflow-y: auto;
	}

	.operation-item {
		display: flex;
		gap: 10px;
		padding: 10px;
		background: var(--bg-tertiary);
		border-radius: var(--radius-md);
		border: 2px solid var(--border-color);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.operation-item:hover {
		background: var(--bg-secondary);
	}

	.operation-item input[type="checkbox"] {
		margin-top: 2px;
		cursor: pointer;
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.operation-item.create {
		border-color: rgba(76, 175, 80, 0.3);
	}

	.operation-item.update {
		border-color: rgba(33, 150, 243, 0.3);
	}

	.operation-item.delete {
		border-color: rgba(211, 47, 47, 0.3);
	}

	.operation-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.operation-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.operation-icon {
		font-size: 16px;
		font-weight: bold;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
	}

	.operation-icon.create {
		background: rgba(76, 175, 80, 0.15);
		color: #4caf50;
	}

	.operation-icon.update {
		background: rgba(33, 150, 243, 0.15);
		color: #2196f3;
	}

	.operation-icon.delete {
		background: rgba(211, 47, 47, 0.15);
		color: #d32f2f;
	}

	.operation-details {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 4px;
	}

	.operation-title {
		font-size: 0.9375rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.operation-desc {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.operation-reason {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-style: italic;
		margin-top: 4px;
	}

	/* Inline Questions */
	.inline-questions {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.question-block {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.question-label {
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--text-primary);
	}

	.question-options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.option-label {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--bg-tertiary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.9375rem;
	}

	.option-label:hover {
		background: var(--bg-secondary);
		border-color: var(--accent-primary);
	}

	.option-label input[type="radio"] {
		cursor: pointer;
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.option-label span {
		flex: 1;
	}

	.other-option {
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
	}

	.other-option input[type="radio"] {
		align-self: flex-start;
	}

	.other-input {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
		margin-top: 4px;
	}

	.other-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	/* User Responses Display */
	.user-responses {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.response-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px;
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
	}

	.response-item strong {
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.response-item span {
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	/* Awaiting Response Indicator */
	.message.ai .message-bubble:has(.inline-operations[data-awaiting="true"]),
	.message.ai .message-bubble:has(.inline-questions[data-awaiting="true"]) {
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	/* Disabled button state */
	.confirm-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.confirm-btn:disabled:hover {
		transform: none;
	}

</style>
