<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import ExpandableChatPanel from '$lib/components/ExpandableChatPanel.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import EditProjectModal from '$lib/components/EditProjectModal.svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { PUBLIC_WORKER_URL } from '$env/static/public';
	import { getProject, deleteProject } from '$lib/db/projects';
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

	$: projectId = $page.params.id;

	let project: any = null;
	let loading = true;
	let messages: Message[] = [];
	let inputMessage = '';
	let isStreaming = false;
	let messagesContainer: HTMLDivElement;
	let showMenu = false;
	let showDeleteConfirm = false;
	let showEditModal = false;

	onMount(async () => {
		try {
			project = await getProject(projectId);
			messages = [
				{
					role: 'ai',
					content: `Hi! I'm here to help you with ${project.name}. What would you like to work on?`
				}
			];
		} catch (error) {
			console.error('Error loading project:', error);
			messages = [
				{
					role: 'ai',
					content: 'Hi! What would you like to work on?'
				}
			];
		} finally {
			loading = false;
		}
		scrollToBottom();

		// Close menu when clicking outside
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (showMenu && !target.closest('.menu-container')) {
				showMenu = false;
			}
		};

		document.addEventListener('click', handleClickOutside);

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	function scrollToBottom() {
		setTimeout(() => {
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
		}, 50);
	}

	async function handleDeleteProject() {
		try {
			await deleteProject(projectId);
			goto('/projects');
		} catch (error) {
			console.error('Error deleting project:', error);
			alert('Failed to delete project');
		}
	}

	function startEditProject() {
		if (!project) return;
		showMenu = false;
		showEditModal = true;
	}

	function handleCloseEditModal() {
		showEditModal = false;
	}

	async function handleProjectUpdated() {
		// Reload project data
		project = await getProject(projectId);
	}

	async function sendMessage(message?: string) {
		const userMessage = message || inputMessage.trim();
		if (!userMessage || isStreaming) return;

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
			content: '',
		isTyping: true
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
					context: {
						projectId: projectId
					}
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
								project_id: projectId
							});
							createdActions.push(action);
							taskCount++;
							console.log('Created task:', action.title);
						} else if (action.type === 'note') {
							await createNote({
								title: action.title,
								content: action.content,
								project_id: projectId
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
</script>

<AppLayout>
<div class="project-chat-page">
	<!-- Desktop: Full-screen chat interface -->
	<div class="desktop-chat">
		<header class="chat-header">
			<div class="header-content">
				<a href="/projects" class="back-btn">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 4l-8 8 8 8"/>
					</svg>
				</a>
				{#if loading}
					<div class="project-info">
						<div class="project-icon">📁</div>
						<div>
							<h1>Loading...</h1>
						</div>
					</div>
				{:else if project}
					<div class="project-info">
						<div class="project-icon">{project.color || '📁'}</div>
						<div class="project-text">
							<h1>{project.name}</h1>
							{#if project.description}
								<p class="project-subtitle">{project.description}</p>
							{/if}
						</div>
					</div>
				{/if}
				<div class="header-actions">
					<div class="menu-container">
						<button class="icon-btn" title="Project menu" on:click={() => showMenu = !showMenu}>
							<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
								<circle cx="10" cy="10" r="1.5"/>
								<circle cx="4" cy="10" r="1.5"/>
								<circle cx="16" cy="10" r="1.5"/>
							</svg>
						</button>
						{#if showMenu}
							<div class="dropdown-menu">
								<button class="menu-item" on:click={startEditProject}>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M11.5 2l2.5 2.5L6 12.5H3.5V10L11.5 2z"/>
									</svg>
									Edit Project
								</button>
								<button class="menu-item delete-item" on:click={() => { showMenu = false; showDeleteConfirm = true; }}>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M2 4h12M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M13 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V4"/>
									</svg>
									Delete Project
								</button>
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
						{#if message.isTyping}
							<div class="typing-indicator">
								<span></span>
								<span></span>
								<span></span>
							</div>
						{:else}
							<p>{message.content}</p>
						{/if}
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
				placeholder="Ask about this project..."
				class="message-input"
				disabled={isStreaming}
			/>
			<button type="submit" class="send-btn" disabled={isStreaming || !inputMessage.trim()}>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M5 15L15 5"/>
					<path d="M9 5h6v6"/>
				</svg>
			</button>
		</form>
	</div>

	<!-- Mobile: Message history + expandable panel -->
	<div class="mobile-chat">
		<header class="chat-header">
			<div class="header-content">
				<a href="/projects" class="back-btn">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 4l-8 8 8 8"/>
					</svg>
				</a>
				{#if loading}
					<div class="project-info">
						<div class="project-icon">📁</div>
						<div>
							<h1>Loading...</h1>
						</div>
					</div>
				{:else if project}
					<div class="project-info">
						<div class="project-icon">{project.color || '📁'}</div>
						<div class="project-text">
							<h1>{project.name}</h1>
							{#if project.description}
								<p class="project-subtitle">{project.description}</p>
							{/if}
						</div>
					</div>
				{/if}
				<div class="header-actions">
					<div class="menu-container">
						<button class="icon-btn" title="Project menu" on:click={() => showMenu = !showMenu}>
							<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
								<circle cx="10" cy="10" r="1.5"/>
								<circle cx="4" cy="10" r="1.5"/>
								<circle cx="16" cy="10" r="1.5"/>
							</svg>
						</button>
						{#if showMenu}
							<div class="dropdown-menu">
								<button class="menu-item" on:click={startEditProject}>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M11.5 2l2.5 2.5L6 12.5H3.5V10L11.5 2z"/>
									</svg>
									Edit Project
								</button>
								<button class="menu-item delete-item" on:click={() => { showMenu = false; showDeleteConfirm = true; }}>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M2 4h12M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M13 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V4"/>
									</svg>
									Delete Project
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</header>

		<div class="messages mobile-messages">
			{#each messages as message (message)}
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
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Expandable Chat Panel (Mobile Only) -->
	<ExpandableChatPanel
		messages={messages}
		onSendMessage={sendMessage}
		placeholder="Ask about this project..."
		isStreaming={isStreaming}
		context="project"
		showFileUpload={true}
	/>

	<!-- Edit Project Modal -->
	<EditProjectModal
		show={showEditModal}
		project={project}
		onClose={handleCloseEditModal}
		onUpdate={handleProjectUpdated}
	/>

	<!-- Delete Confirmation Modal -->
	{#if showDeleteConfirm}
		<div class="modal-overlay" on:click={() => showDeleteConfirm = false}>
			<div class="modal" on:click|stopPropagation>
				<h2>Delete Project?</h2>
				<p>Are you sure you want to delete "{project?.name || 'this project'}"? This will also delete all tasks and notes in this project. This action cannot be undone.</p>
				<div class="modal-actions">
					<button type="button" class="secondary-btn" on:click={() => showDeleteConfirm = false}>
						Cancel
					</button>
					<button type="button" class="danger-btn" on:click={handleDeleteProject}>
						Delete Project
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
</AppLayout>

<style>
	.project-chat-page {
		min-height: 100vh;
		background: var(--bg-primary);
	}

	/* Desktop Chat - Full screen chat interface */
	.desktop-chat {
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

	/* Mobile Chat - Header + message history */
	.mobile-chat {
		display: none;
	}

	/* Show/hide based on screen size */
	@media (max-width: 1023px) {
		.desktop-chat {
			display: none;
		}

		.mobile-chat {
			display: flex;
			flex-direction: column;
			min-height: 100vh;
			padding-bottom: 110px; /* Space for bottom nav (50px) + chat input (60px) */
		}

		.mobile-messages {
			flex: 1;
			padding-bottom: 20px;
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
		gap: 12px;
	}

	.back-btn {
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
		text-decoration: none;
	}

	.back-btn:hover {
		background: var(--bg-primary);
		transform: translateX(-2px);
	}

	.project-info {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
		padding-right: 50px;
	}

	.project-icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		background: var(--bg-tertiary);
		border-radius: var(--radius-md);
		flex-shrink: 0;
	}

	.project-text {
		flex: 1;
		min-width: 0;
	}

	.project-info h1 {
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin-bottom: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.project-subtitle {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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

	.menu-container {
		position: relative;
	}

	.dropdown-menu {
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
		width: 100%;
		background: none;
		border: none;
		color: var(--text-primary);
		text-decoration: none;
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
	}

	.menu-item:hover {
		background: var(--bg-tertiary);
	}

	.delete-item {
		color: rgb(239, 68, 68);
	}

	.delete-item svg {
		color: rgb(239, 68, 68);
	}

	.delete-item:hover {
		background: rgba(239, 68, 68, 0.1);
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

	/* Modal */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 20px;
	}

	.modal {
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		padding: 24px;
		max-width: 400px;
		width: 100%;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.modal h2 {
		font-size: 1.25rem;
		margin-bottom: 12px;
	}

	.modal p {
		color: var(--text-secondary);
		margin-bottom: 24px;
		line-height: 1.5;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
	}

	.secondary-btn {
		padding: 10px 20px;
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.secondary-btn:hover {
		background: var(--bg-tertiary);
	}

	.danger-btn {
		padding: 10px 20px;
		background: rgb(239, 68, 68);
		border: none;
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.danger-btn:hover {
		background: rgb(220, 38, 38);
		transform: translateY(-1px);
	}

	.danger-btn:active {
		transform: translateY(0);
	}
</style>
