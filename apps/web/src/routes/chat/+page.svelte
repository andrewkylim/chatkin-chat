<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import { onMount } from 'svelte';
	import { PUBLIC_WORKER_URL } from '$env/static/public';
	import { createTask } from '$lib/db/tasks';
	import { createNote } from '$lib/db/notes';

	interface Message {
		role: 'user' | 'ai';
		content: string;
		files?: Array<{ name: string; url: string; type: string }>;
		actions?: Array<{ type: string; title: string; [key: string]: any }>;
	}

	interface AIAction {
		type: 'task' | 'note';
		title: string;
		description?: string;
		content?: string;
		priority?: 'low' | 'medium' | 'high';
	}

	interface AIResponse {
		message: string;
		actions?: AIAction[];
	}

	let messages: Message[] = [
		{
			role: 'ai',
			content: '👋 Hi! What would you like to work on today?'
		}
	];
	let inputMessage = '';
	let isStreaming = false;
	let messagesContainer: HTMLDivElement;
	let showCreateMenu = false;

	function scrollToBottom() {
		setTimeout(() => {
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
		}, 50);
	}

	async function sendMessage() {
		if (!inputMessage.trim() || isStreaming) return;

		const userMessage = inputMessage.trim();
		inputMessage = '';

		// Add user message
		messages = [...messages, { role: 'user', content: userMessage }];
		scrollToBottom();

		// Add placeholder for AI response
		const aiMessageIndex = messages.length;
		messages = [...messages, { role: 'ai', content: '' }];
		isStreaming = true;

		// Show loading message
		messages[aiMessageIndex] = {
			role: 'ai',
			content: 'Thinking...'
		};
		messages = messages;
		scrollToBottom();

		try {
			const response = await fetch(`${PUBLIC_WORKER_URL}/api/ai/chat`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					message: userMessage,
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			// Handle structured response from worker
			if (data.type === 'actions' && Array.isArray(data.actions)) {
				// Update loading message
				messages[aiMessageIndex] = {
					role: 'ai',
					content: 'Creating tasks and notes...'
				};
				messages = messages;
				scrollToBottom();

				// Create tasks and notes
				const createdActions = [];
				let taskCount = 0;
				let noteCount = 0;

				for (const action of data.actions) {
					try {
						if (action.type === 'task') {
							await createTask({
								title: action.title,
								description: action.description,
								priority: action.priority || 'medium',
								status: 'todo',
								project_id: null,
								due_date: null
							});
							createdActions.push(action);
							taskCount++;
							console.log('Created task:', action.title);
						} else if (action.type === 'note') {
							await createNote({
								title: action.title,
								content: action.content,
								project_id: null
							});
							createdActions.push(action);
							noteCount++;
							console.log('Created note:', action.title);
						}
					} catch (createError) {
						console.error(`Error creating ${action.type}:`, createError);
					}
				}

				// Show custom confirmation message
				let confirmMessage = 'Created ';
				const parts = [];
				if (taskCount > 0) parts.push(`${taskCount} task${taskCount > 1 ? 's' : ''}`);
				if (noteCount > 0) parts.push(`${noteCount} note${noteCount > 1 ? 's' : ''}`);
				confirmMessage += parts.join(' and ') + ' for you.';

				messages[aiMessageIndex] = {
					role: 'ai',
					content: confirmMessage,
					actions: createdActions
				};
				messages = messages;
			} else if (data.type === 'message') {
				// Conversational response
				messages[aiMessageIndex] = {
					role: 'ai',
					content: data.message
				};
				messages = messages;
			}
		} catch (error) {
			console.error('Error sending message:', error);
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

	onMount(() => {
		scrollToBottom();

		// Close create menu when clicking outside
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (showCreateMenu && !target.closest('.create-menu-container')) {
				showCreateMenu = false;
			}
		};

		document.addEventListener('click', handleClickOutside);

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<AppLayout>
<div class="chat-page">
	<header class="chat-header">
		<div class="header-content">
			<h1>Chat</h1>
			<div class="header-actions">
				<div class="create-menu-container">
					<button class="icon-btn" title="Create new" on:click={() => showCreateMenu = !showCreateMenu}>
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M10 4v12M4 10h12"/>
						</svg>
					</button>
					{#if showCreateMenu}
						<div class="create-menu">
							<a href="/projects" class="menu-item">
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="2" y="2" width="4" height="4" rx="1"/>
									<rect x="10" y="2" width="4" height="4" rx="1"/>
									<rect x="2" y="10" width="4" height="4" rx="1"/>
									<rect x="10" y="10" width="4" height="4" rx="1"/>
								</svg>
								New Project
							</a>
							<a href="/tasks" class="menu-item">
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M4 8l2 2 6-6"/>
									<rect x="2" y="2" width="12" height="12" rx="2"/>
								</svg>
								New Task
							</a>
							<a href="/notes" class="menu-item">
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M4 6h8M4 10h6"/>
									<rect x="2" y="2" width="12" height="12" rx="2"/>
								</svg>
								New Note
							</a>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<div class="messages" bind:this={messagesContainer}>
		{#each messages as message (message)}
			<div class="message {message.role}">
				<div class="message-bubble">
					<p>{message.content}</p>
				</div>
			</div>
		{/each}
	</div>

	<form class="input-container" on:submit|preventDefault={sendMessage}>
		<FileUpload
			accept="image/*,application/pdf,.doc,.docx,.txt"
			maxSizeMB={10}
			onUploadComplete={(file) => {
				console.log('File uploaded:', file);
			}}
		/>
		<input
			type="text"
			bind:value={inputMessage}
			placeholder="Ask me anything..."
			class="message-input"
			disabled={isStreaming}
		/>
		<button type="submit" class="send-btn" disabled={isStreaming || !inputMessage.trim()}>
			<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
				<path d="M2 3l16 7-16 7V3zm0 8.5V14l8-4-8-4v5.5z"/>
			</svg>
		</button>
	</form>
</div>
</AppLayout>

<style>
	/* Critical mobile chat UI pattern - ONLY for chat pages */
	.chat-page {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--bg-primary);
	}

	/* Desktop: offset by sidebar width */
	@media (min-width: 1024px) {
		.chat-page {
			left: 240px;
		}
	}

	/* Header */
	.chat-header {
		flex-shrink: 0;
		padding: 16px 20px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
		height: 64px;
		display: flex;
		align-items: center;
		box-sizing: border-box;
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

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.icon-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.icon-btn:hover {
		background: var(--bg-primary);
		transform: translateY(-1px);
	}

	.icon-btn:active {
		transform: translateY(0);
	}

	.create-menu-container {
		position: relative;
	}

	.create-menu {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		min-width: 180px;
		z-index: 100;
		overflow: hidden;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		color: var(--text-primary);
		text-decoration: none;
		font-size: 0.9375rem;
		transition: all 0.2s ease;
		border-bottom: 1px solid var(--border-color);
	}

	.menu-item:last-child {
		border-bottom: none;
	}

	.menu-item:hover {
		background: var(--bg-tertiary);
	}

	.menu-item svg {
		color: var(--text-secondary);
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

	/* Input Container */
	.input-container {
		flex-shrink: 0;
		padding: 16px;
		padding-bottom: max(16px, env(safe-area-inset-bottom));
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		height: 76px;
		display: flex;
		align-items: center;
		gap: 12px;
		box-sizing: border-box;
	}

	.message-input {
		flex: 1;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 12px 16px;
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
</style>
