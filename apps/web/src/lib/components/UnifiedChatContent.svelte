<script lang="ts">
	import ChatHeader from './chat/ChatHeader.svelte';
	import ChatInput from './chat/ChatInput.svelte';
	import MessageBubble from './chat/MessageBubble.svelte';
	import TalkModeIndicator from './chat/TalkModeIndicator.svelte';
	import MobileChatLayout from './MobileChatLayout.svelte';
	import { onMount, onDestroy, tick } from 'svelte';
	import { useChatOperations } from '$lib/logic/useChatOperations';
	import { talkModeService } from '$lib/services/talk-mode';
	import { workerService } from '$lib/services/worker';
	import { getOrCreateConversation, getRecentMessages, updateMessageMetadata } from '$lib/db/conversations';
	import { loadWorkspaceContext, formatWorkspaceContextForAI } from '$lib/db/context';
	import type { Conversation } from '@chatkin/types';
	import { logger } from '$lib/utils/logger';
	import type { Operation, AIQuestion } from '$lib/types/chat';

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
		id?: string;
		role: 'user' | 'ai';
		content: string;
		files?: Array<{
			name: string;
			url: string;
			type: string;
			size: number;
			temporary?: boolean;
			saving?: boolean;
			saved?: boolean;
		}>;
		isTyping?: boolean;
		questions?: AIQuestion[];
		operations?: Operation[];
		awaitingResponse?: boolean;
		userResponse?: Record<string, string>;
		selectedOperations?: Operation[];
	}

	// Initialize services
	const chatOps = useChatOperations();

	// State
	let messages: Message[] = [];
	let inputMessage = '';
	let isStreaming = false;
	let desktopMessagesContainer: HTMLDivElement;
	let mobileChatLayout: MobileChatLayout;
	let talkModeActive = false;
	let isPlayingAudio = false;
	let isListening = false;
	let lastActivityTime = Date.now();
	let inactivityTimer: number | undefined;
	let autoListenTimeout: number | undefined;
	let voiceInputRef: any;
	let conversation: Conversation | null = null;
	let workspaceContextString = '';
	let session: any = null;
	let messagesReady = false;
	let uploadedFiles: Array<{
		name: string;
		url: string;
		type: string;
		size: number;
		temporary?: boolean;
		addedToLibrary?: boolean;
		saving?: boolean;
	}> = [];
	let uploadStatus: string = '';
	let aiMode: 'chat' | 'action' = 'chat';

	async function scrollToBottom() {
		await tick();
		if (desktopMessagesContainer) {
			desktopMessagesContainer.scrollTop = desktopMessagesContainer.scrollHeight;
		}
		if (mobileChatLayout) {
			mobileChatLayout.scrollToBottom();
		}
	}

	function buildConversationHistory() {
		const allMessages = messages.filter((m) => m.content && m.content.trim() && !m.isTyping);
		const recentMessages = allMessages.slice(-50);
		const historyWithoutCurrent = recentMessages.slice(0, -1);

		return historyWithoutCurrent.map((m) => ({
			role: m.role,
			content: m.content,
			...(m.files && m.files.length > 0 ? { files: m.files } : {})
		}));
	}

	async function sendMessage(message?: string) {
		const userMessage = message || inputMessage.trim();
		if (!userMessage || !conversation) {
			return;
		}

		// If already streaming, stop it first
		if (isStreaming) {
			isStreaming = false;
			// Remove typing indicator if present
			messages = messages.filter(m => !m.isTyping);
		}

		const filesToSend = [...uploadedFiles];
		inputMessage = '';
		uploadedFiles = [];

		// Save user message
		await chatOps.saveUserMessage(conversation.id, userMessage, filesToSend);

		// Add to UI
		messages = [
			...messages,
			{
				role: 'user',
				content: userMessage,
				files: filesToSend.length > 0 ? filesToSend : undefined
			}
		];
		scrollToBottom();

		// Add AI placeholder
		const aiMessageIndex = messages.length;
		messages = [...messages, { role: 'ai', content: '', isTyping: true }];
		isStreaming = true;

		try {
			// Send to AI using service
			const response = await chatOps.sendMessage({
				message: userMessage,
				...(filesToSend.length > 0 ? { files: filesToSend } : {}),
				conversationHistory: buildConversationHistory(),
				conversationSummary: conversation.conversation_summary,
				workspaceContext: workspaceContextString,
				scope,
				projectId,
				mode: aiMode
			});

			// Save AI response
			await chatOps.saveAIMessage(conversation.id, response.content, {
				operations: response.operations,
				questions: response.questions
			});

			// Send notification if needed
			if (response.shouldSendNotification && response.notificationType) {
				workerService.sendNotification({
					notification_type: response.notificationType,
					channels: ['email', 'browser'],
					title: response.notificationType === 'ai_proposal' ? 'AI Proposal' : 'AI Insight',
					body: response.notificationBody || response.content,
					action_url: window.location.href,
					operation_count: response.operations?.length
				});
			}

			// Update UI based on response type
			messages = messages.map((msg, idx) =>
				idx === aiMessageIndex
					? {
							role: 'ai',
							content: response.content,
							operations: response.operations,
							questions: response.questions,
							awaitingResponse: response.type === 'actions' || response.type === 'questions',
							selectedOperations: response.operations
						}
					: msg
			);

			// Play TTS if Talk Mode active
			if (talkModeActive && response.type === 'message') {
				// Ensure message is fully visible before speaking
				await tick();
				await scrollToBottom();

				isPlayingAudio = true;
				try {
					await talkModeService.playTTS(response.content, {
						onComplete: () => {
							isPlayingAudio = false;
							triggerAutoListen();
						}
					});
				} catch (error) {
					isPlayingAudio = false;
					logger.error('TTS playback failed', error);
					// Still trigger auto-listen even if TTS fails
					triggerAutoListen();
				}
			} else if (talkModeActive) {
				// If no TTS (actions/questions), still trigger auto-listen
				triggerAutoListen();
			}
		} catch (err) {
			logger.error('Error sending message', err);
			messages = messages.map((msg, idx) =>
				idx === aiMessageIndex
					? {
							role: 'ai',
							content: 'Sorry, I encountered an error. Please try again.'
						}
					: msg
			);
			// Trigger auto-listen even on error if talk mode is active
			if (talkModeActive) {
				triggerAutoListen();
			}
		} finally {
			isStreaming = false;
			await tick();
			await scrollToBottom();
			setTimeout(() => scrollToBottom(), 100);
		}
	}

	async function executeOperations(operations: Operation[], messageIndex: number) {
		messages = messages.map((msg, idx) =>
			idx === messageIndex
				? {
						...messages[messageIndex],
						content: 'Executing operations...',
						awaitingResponse: false,
						operations: undefined,
						selectedOperations: undefined,
						isTyping: true
					}
				: msg
		);

		const result = await chatOps.executeOperations(operations, projectId);

		// Reload context
		workspaceContextString = await chatOps.reloadContext();

		// Call parent callbacks
		if (result.successCount > 0) {
			if (onOperationsComplete) await onOperationsComplete(operations);
			if (onDataChange) await onDataChange();
		}

		// Update status
		const successMsg =
			result.successCount > 0
				? `${result.successCount} operation${result.successCount > 1 ? 's' : ''} completed`
				: '';
		const errorMsg = result.errorCount > 0 ? `${result.errorCount} failed` : '';
		const parts = [successMsg, errorMsg].filter(Boolean);

		messages = messages.map((msg, idx) =>
			idx === messageIndex
				? {
						role: 'ai',
						content: `${parts.join(', ')}!\n\n${result.results.join('\n')}`
					}
				: msg
		);
		scrollToBottom();
	}

	function handleInlineOperationConfirm(index: number) {
		const message = messages[index];
		if (!message.selectedOperations) return;
		executeOperations(message.selectedOperations, index);
	}

	function handleInlineOperationCancel(index: number) {
		const message = messages[index];
		const operations = message.operations || [];

		// Determine what type of operations were cancelled
		const taskOps = operations.filter(op => op.type === 'task');
		const noteOps = operations.filter(op => op.type === 'note');
		const projectOps = operations.filter(op => op.type === 'project');

		// Build a descriptive cancellation message
		let cancelMessage = 'Cancelled ';
		const parts: string[] = [];

		if (taskOps.length > 0) {
			parts.push(`${taskOps.length} task${taskOps.length > 1 ? 's' : ''}`);
		}
		if (noteOps.length > 0) {
			parts.push(`${noteOps.length} note${noteOps.length > 1 ? 's' : ''}`);
		}
		if (projectOps.length > 0) {
			parts.push(`${projectOps.length} project${projectOps.length > 1 ? 's' : ''}`);
		}

		if (parts.length > 0) {
			cancelMessage += parts.join(', ') + '.';
		} else {
			cancelMessage = "Okay, I won't perform those operations.";
		}

		messages = messages.map((msg, idx) =>
			idx === index
				? {
						...msg,
						content: cancelMessage,
						awaitingResponse: false,
						operations: undefined,
						selectedOperations: undefined
					}
				: msg
		);
	}

	function toggleOperationSelection(messageIndex: number, opIndex: number) {
		const message = messages[messageIndex];
		if (!message.operations || !message.selectedOperations) return;

		const operation = message.operations[opIndex];
		const isSelected = message.selectedOperations.some(
			(op) =>
				op.operation === operation.operation &&
				op.type === operation.type &&
				op.id === operation.id &&
				JSON.stringify(op.data) === JSON.stringify(operation.data)
		);

		if (isSelected) {
			// Remove from selection
			message.selectedOperations = message.selectedOperations.filter(
				(op) =>
					!(
						op.operation === operation.operation &&
						op.type === operation.type &&
						op.id === operation.id &&
						JSON.stringify(op.data) === JSON.stringify(operation.data)
					)
			);
		} else {
			// Add to selection
			message.selectedOperations = [...message.selectedOperations, operation];
		}

		messages = [...messages];
	}

	async function handleInlineQuestionSubmit(index: number, answers: Record<string, string>) {
		const message = messages[index];
		if (!message.questions) return;

		// Update message to show user's responses
		messages = messages.map((msg, idx) =>
			idx === index
				? {
						...msg,
						awaitingResponse: false,
						userResponse: answers
					}
				: msg
		);

		// Send answers back to AI
		const answersText = Object.entries(answers)
			.map(([q, a]) => `${q}: ${a}`)
			.join('\n');
		await sendMessage(`Here are my answers:\n${answersText}`);
	}

	function handleInlineQuestionCancel(index: number) {
		const message = messages[index];
		const questions = message.questions || [];

		// Try to determine what was being created from the questions
		let cancelMessage = 'Cancelled.';

		// Check question text for hints about what's being created
		const questionText = questions.map(q => q.question.toLowerCase()).join(' ');

		if (questionText.includes('task')) {
			cancelMessage = 'Task creation cancelled.';
		} else if (questionText.includes('note')) {
			cancelMessage = 'Note creation cancelled.';
		} else if (questionText.includes('project') || questionText.includes('domain')) {
			cancelMessage = 'Operation cancelled.';
		} else {
			cancelMessage = 'Cancelled. Let me know if you need anything else.';
		}

		messages = messages.map((msg, idx) =>
			idx === index
				? {
						...msg,
						content: cancelMessage,
						awaitingResponse: false,
						questions: undefined
					}
				: msg
		);
	}

	async function saveMessageFileToLibrary(file: any) {
		await chatOps.saveFileToLibrary({
			name: file.name,
			url: file.url,
			type: file.type,
			size: file.size,
			conversationId: conversation?.id
		});
	}

	async function saveFileToLibrary(file: any, index: number) {
		uploadedFiles[index] = { ...uploadedFiles[index], saving: true };
		uploadedFiles = [...uploadedFiles];

		try {
			await chatOps.saveFileToLibrary({
				name: file.name,
				url: file.url,
				type: file.type,
				size: file.size,
				conversationId: conversation?.id
			});

			uploadedFiles[index] = {
				...uploadedFiles[index],
				temporary: false,
				addedToLibrary: true,
				saving: false
			};
			uploadedFiles = [...uploadedFiles];
		} catch (error) {
			logger.error('Failed to save file to library', error);
			uploadedFiles[index] = { ...uploadedFiles[index], saving: false };
			uploadedFiles = [...uploadedFiles];
		}
	}

	function updateMessageFile(messageIndex: number, fileIndex: number, updates: Record<string, unknown>) {
		if (messages[messageIndex].files && messages[messageIndex].files[fileIndex]) {
			messages[messageIndex].files[fileIndex] = {
				...messages[messageIndex].files[fileIndex],
				...updates
			};
			messages = [...messages];

			// Persist to database
			if (messages[messageIndex].id && messages[messageIndex].files) {
				updateMessageMetadata(messages[messageIndex].id!, {
					files: messages[messageIndex].files
				});
			}
		}
	}

	async function toggleTalkMode() {
		talkModeActive = !talkModeActive;

		if (talkModeActive) {
			await talkModeService.unlockAudio();
			startInactivityTimer();
			// Try both desktop and mobile voice refs
			if (voiceInputRef) {
				voiceInputRef.startListening();
			} else if (mobileChatLayout) {
				mobileChatLayout.startListening();
			}
		} else {
			stopInactivityTimer();
			stopAutoListen();
			talkModeService.stopAudio();
			// Try both desktop and mobile voice refs
			if (voiceInputRef) {
				voiceInputRef.stopListening();
			} else if (mobileChatLayout && mobileChatLayout.stopListening) {
				mobileChatLayout.stopListening();
			}
		}
	}

	function triggerAutoListen() {
		if (!talkModeActive) {
			logger.debug('Auto-listen skipped: talk mode not active');
			return;
		}

		// Always clear existing timeout to prevent "already waiting" issues
		if (autoListenTimeout) {
			clearTimeout(autoListenTimeout);
			autoListenTimeout = undefined;
		}

		logger.debug('Triggering auto-listen in 500ms');
		autoListenTimeout = window.setTimeout(() => {
			if (!talkModeActive) {
				logger.debug('Auto-listen cancelled - talk mode inactive');
				return;
			}

			// Try both desktop and mobile voice refs
			if (voiceInputRef) {
				logger.debug('Starting auto-listen now (desktop)');
				voiceInputRef.startListening();
			} else if (mobileChatLayout) {
				logger.debug('Starting auto-listen now (mobile)');
				mobileChatLayout.startListening();
			} else {
				logger.debug('Auto-listen cancelled - no voice ref available');
			}
		}, 500);
	}

	function stopAutoListen() {
		if (autoListenTimeout) {
			clearTimeout(autoListenTimeout);
			autoListenTimeout = undefined;
		}
	}

	function resetActivityTimer() {
		lastActivityTime = Date.now();
	}

	function startInactivityTimer() {
		stopInactivityTimer();
		inactivityTimer = window.setInterval(() => {
			const now = Date.now();
			if (now - lastActivityTime > 120000) {
				// 2 minutes
				talkModeActive = false;
				stopInactivityTimer();
				talkModeService.cleanup();
				if (voiceInputRef) {
					voiceInputRef.stopListening();
				}
			}
		}, 5000);
	}

	function stopInactivityTimer() {
		if (inactivityTimer) {
			clearInterval(inactivityTimer);
			inactivityTimer = undefined;
		}
	}

	async function toggleMode() {
		const newMode = aiMode === 'chat' ? 'action' : 'chat';
		aiMode = newMode;
		if (conversation) {
			await chatOps.updateMode(conversation.id, newMode);
		}
	}

	onMount(async () => {
		// Get user session
		const { supabase } = await import('$lib/supabase');
		const {
			data: { session: userSession }
		} = await supabase.auth.getSession();
		session = userSession;

		// Lock viewport on mobile
		if (typeof document !== 'undefined') {
			document.documentElement.style.overflow = 'hidden';
			document.body.style.overflow = 'hidden';
			document.documentElement.style.overscrollBehavior = 'none';
			document.body.style.overscrollBehavior = 'none';
		}

		// Get or create conversation
		conversation = await getOrCreateConversation(scope, projectId);

		// Load AI mode from conversation
		if (conversation.mode) {
			aiMode = conversation.mode;
		}

		// Load message history
		const dbMessages = await getRecentMessages(conversation.id, 50);
		messages = dbMessages.map((msg, index) => {
			// Parse questions if needed
			let questions = msg.metadata?.questions;

			// If questions is already an array, use it directly
			if (Array.isArray(questions)) {
				// Already parsed, use as-is
			} else if (typeof questions === 'string') {
				// Try to parse JSON string
				try {
					// Clean up any trailing HTML tags or extra characters
					let cleanedString = questions.trim();
					// Remove any trailing </invoke> or similar tags
					cleanedString = cleanedString.replace(/<\/[^>]+>.*$/s, '');
					questions = JSON.parse(cleanedString);
				} catch (e) {
					console.warn('Could not parse questions from database, skipping:', e);
					questions = undefined;
				}
			}

			// Check if this is the last message and has unanswered questions/operations
			const isLastMessage = index === dbMessages.length - 1;
			const hasOperations = msg.metadata?.operations && Array.isArray(msg.metadata.operations) && msg.metadata.operations.length > 0;
			const hasQuestions = questions && Array.isArray(questions) && questions.length > 0;
			const shouldAwaitResponse = isLastMessage && msg.role === 'assistant' && (hasOperations || hasQuestions);

			return {
				id: msg.id,
				role: msg.role === 'assistant' ? 'ai' : 'user',
				content: msg.content,
				files: msg.metadata?.files && msg.metadata.files.length > 0 ? msg.metadata.files : undefined,
				operations: msg.metadata?.operations,
				questions,
				awaitingResponse: shouldAwaitResponse,
				selectedOperations: hasOperations ? msg.metadata?.operations : undefined
			};
		});

		// Load workspace context
		const workspaceContext = await loadWorkspaceContext();
		workspaceContextString = formatWorkspaceContextForAI(workspaceContext);

		// Ready for display
		messagesReady = true;
		scrollToBottom();
	});

	onDestroy(() => {
		// Restore default overflow behavior
		if (typeof document !== 'undefined') {
			document.documentElement.style.overflow = '';
			document.body.style.overflow = '';
			document.documentElement.style.overscrollBehavior = '';
			document.body.style.overscrollBehavior = '';
		}

		// Clean up Talk Mode
		stopInactivityTimer();
		stopAutoListen();
		talkModeService.cleanup();
	});
</script>

<div class="chat-page">
	<!-- Desktop: Full-screen chat -->
	<div class="desktop-chat {isEmbedded ? 'embedded' : 'standalone'}">
		<ChatHeader
			{pageTitle}
			{pageIcon}
			{pageSubtitle}
			{isEmbedded}
			{talkModeActive}
			{isPlayingAudio}
			onToggleTalkMode={toggleTalkMode}
		/>

		{#if !messagesReady}
			<div class="chat-loading-overlay">
				<div class="spinner"></div>
				<p>Loading conversation...</p>
			</div>
		{/if}

		<div
			class="messages"
			bind:this={desktopMessagesContainer}
			style:opacity={messagesReady ? '1' : '0'}
		>
			{#each messages as message, index (index)}
				<MessageBubble
					{message}
					{index}
					onOperationConfirm={handleInlineOperationConfirm}
					onOperationCancel={handleInlineOperationCancel}
					onOperationToggle={toggleOperationSelection}
					onQuestionSubmit={handleInlineQuestionSubmit}
					onQuestionCancel={handleInlineQuestionCancel}
					onSaveFile={saveMessageFileToLibrary}
					onUpdateMessageFile={updateMessageFile}
				/>
			{/each}
		</div>

		<ChatInput
			bind:inputMessage
			{isStreaming}
			bind:uploadedFiles
			conversationId={conversation?.id}
			{session}
			{talkModeActive}
			{aiMode}
			{uploadStatus}
			onSendMessage={() => sendMessage()}
			onVoiceTranscript={(transcript) => {
				inputMessage = transcript;
			}}
			onFileUpload={(file) => {
				uploadedFiles = [...uploadedFiles, file];
			}}
			onRemoveFile={(index) => {
				uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
			}}
			onSaveFileToLibrary={saveFileToLibrary}
			onToggleMode={toggleMode}
			onResetActivityTimer={resetActivityTimer}
			onStartAutoListen={() => {
				// Placeholder for future auto-listen tracking
			}}
			onListeningChange={(listening) => {
				isListening = listening;
			}}
			bind:voiceInputRef
		/>

		<!-- Talk Mode Indicator -->
		<TalkModeIndicator
			{isListening}
			isSpeaking={isPlayingAudio}
			{talkModeActive}
			onStopTalkMode={toggleTalkMode}
		/>
	</div>

	<!-- Mobile: Header + full-screen chat -->
	<MobileChatLayout
		bind:this={mobileChatLayout}
		bind:messages={messages as any}
		bind:inputMessage
		bind:uploadedFiles
		{isStreaming}
		{messagesReady}
		{session}
		onSubmit={() => sendMessage()}
		onQuestionSubmit={handleInlineQuestionSubmit}
		onQuestionCancel={handleInlineQuestionCancel}
		onOperationConfirm={handleInlineOperationConfirm}
		onOperationCancel={handleInlineOperationCancel}
		onSaveFileToLibrary={saveFileToLibrary}
		{updateMessageMetadata}
		title={pageTitle}
		subtitle={pageSubtitle}
		backUrl={scope === 'tasks'
			? '/tasks'
			: scope === 'notes'
				? '/notes'
				: scope === 'project' && projectId
					? `/projects/${projectId}/chat`
					: null}
		{talkModeActive}
		{isPlayingAudio}
		{toggleTalkMode}
		{aiMode}
		toggleAiMode={toggleMode}
		onListeningChange={(listening) => {
			isListening = listening;
		}}
	/>

	<!-- Talk Mode Indicator (Mobile) -->
	<TalkModeIndicator
		{isListening}
		isSpeaking={isPlayingAudio}
		{talkModeActive}
		onStopTalkMode={toggleTalkMode}
	/>
</div>

<style>
	.chat-page {
		min-height: 100vh;
		background: var(--bg-primary);
	}

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

	.desktop-chat.embedded {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--bg-primary);
		height: 100%;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		transition: opacity 0.3s;
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

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--border-color);
		border-top-color: var(--accent-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.chat-loading-overlay p {
		color: var(--text-secondary);
		font-size: 0.9375rem;
		margin: 0;
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
</style>
