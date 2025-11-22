<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import { getTasks, createTask, toggleTaskComplete } from '$lib/db/tasks';
	import { getProjects } from '$lib/db/projects';
	import { onMount } from 'svelte';
	import { PUBLIC_WORKER_URL } from '$env/static/public';

	interface ChatMessage {
		role: 'user' | 'ai';
		content: string;
	}

	let tasks: any[] = [];
	let projects: any[] = [];
	let loading = true;
	let showNewTaskModal = false;
	let newTaskTitle = '';
	let newTaskDescription = '';
	let newTaskPriority = 'medium';
	let newTaskDueDate = '';
	let newTaskProjectId: string | null = null;

	// Chat state
	let chatMessages: ChatMessage[] = [
		{
			role: 'ai',
			content: "Hi! I'm your Tasks AI. I can help you create, organize, and prioritize your tasks. What would you like to work on?"
		}
	];
	let chatInput = '';
	let isChatStreaming = false;
	let chatMessagesContainer: HTMLDivElement;

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;
		try {
			[tasks, projects] = await Promise.all([getTasks(), getProjects()]);
		} catch (error) {
			console.error('Error loading tasks:', error);
		} finally {
			loading = false;
		}
	}

	async function handleCreateTask() {
		if (!newTaskTitle.trim()) return;

		try {
			await createTask({
				title: newTaskTitle,
				description: newTaskDescription || null,
				priority: newTaskPriority as any,
				due_date: newTaskDueDate || null,
				project_id: newTaskProjectId,
				status: 'todo'
			});

			// Reset form
			newTaskTitle = '';
			newTaskDescription = '';
			newTaskPriority = 'medium';
			newTaskDueDate = '';
			newTaskProjectId = null;
			showNewTaskModal = false;

			// Reload tasks
			await loadData();
		} catch (error) {
			console.error('Error creating task:', error);
		}
	}

	async function handleToggleTask(taskId: string, currentStatus: string) {
		try {
			const completed = currentStatus !== 'completed';
			await toggleTaskComplete(taskId, completed);
			await loadData();
		} catch (error) {
			console.error('Error toggling task:', error);
		}
	}

	function getProjectName(projectId: string | null) {
		if (!projectId) return null;
		const project = projects.find(p => p.id === projectId);
		return project?.name;
	}

	function isToday(date: string | null) {
		if (!date) return false;
		const today = new Date();
		const taskDate = new Date(date);
		return taskDate.toDateString() === today.toDateString();
	}

	function isThisWeek(date: string | null) {
		if (!date) return false;
		const today = new Date();
		const taskDate = new Date(date);
		const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
		return taskDate > today && taskDate <= weekFromNow;
	}

	function formatDueDate(date: string | null) {
		if (!date) return 'No due date';
		const taskDate = new Date(date);
		const today = new Date();

		if (isToday(date)) return 'Due today';
		if (taskDate < today) return 'Overdue';

		return taskDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	$: todayTasks = tasks.filter(t => t.status !== 'completed' && isToday(t.due_date));
	$: thisWeekTasks = tasks.filter(t => t.status !== 'completed' && !isToday(t.due_date) && isThisWeek(t.due_date));
	$: laterTasks = tasks.filter(t => t.status !== 'completed' && !isToday(t.due_date) && !isThisWeek(t.due_date));
	$: completedTasks = tasks.filter(t => t.status === 'completed');

	function scrollChatToBottom() {
		setTimeout(() => {
			if (chatMessagesContainer) {
				chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
			}
		}, 50);
	}

	async function sendChatMessage() {
		if (!chatInput.trim() || isChatStreaming) return;

		const userMessage = chatInput.trim();
		chatInput = '';

		// Add user message
		chatMessages = [...chatMessages, { role: 'user', content: userMessage }];
		scrollChatToBottom();

		// Add placeholder for AI response
		const aiMessageIndex = chatMessages.length;
		chatMessages = [...chatMessages, { role: 'ai', content: '' }];
		isChatStreaming = true;

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

			const reader = response.body?.getReader();
			const decoder = new TextDecoder();

			if (!reader) {
				throw new Error('No response body');
			}

			let accumulatedContent = '';

			while (true) {
				const { done, value } = await reader.read();

				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				accumulatedContent += chunk;

				// Update the AI message with accumulated content
				chatMessages[aiMessageIndex] = {
					role: 'ai',
					content: accumulatedContent
				};
				chatMessages = chatMessages; // Trigger reactivity
				scrollChatToBottom();
			}
		} catch (error) {
			console.error('Error sending message:', error);
			chatMessages[aiMessageIndex] = {
				role: 'ai',
				content: 'Sorry, I encountered an error processing your request. Please try again.'
			};
			chatMessages = chatMessages;
		} finally {
			isChatStreaming = false;
		}
	}
</script>

<AppLayout>
<div class="tasks-page">
	<div class="tasks-container">
		<!-- Task List Section -->
		<div class="tasks-section">
			<header class="section-header">
				<h1>Tasks</h1>
				<div class="header-actions">
					<button class="primary-btn" on:click={() => showNewTaskModal = true}>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M8 2v12M2 8h12"/>
						</svg>
						New Task
					</button>
				</div>
			</header>

			{#if loading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Loading tasks...</p>
				</div>
			{:else if tasks.length === 0}
				<div class="empty-state">
					<div class="empty-icon">✓</div>
					<h2>No tasks yet</h2>
					<p>Create your first task to get started</p>
					<button class="primary-btn" on:click={() => showNewTaskModal = true}>Create Task</button>
				</div>
			{:else}
				<div class="tasks-list">
					<!-- Today Section -->
					{#if todayTasks.length > 0}
						<div class="task-group">
							<h2 class="group-title">Today</h2>
							{#each todayTasks as task (task.id)}
								<div class="task-item">
									<input
										type="checkbox"
										class="task-checkbox"
										id={task.id}
										checked={task.status === 'completed'}
										on:change={() => handleToggleTask(task.id, task.status)}
									/>
									<label for={task.id} class="task-content" class:completed={task.status === 'completed'}>
										<div class="task-main">
											<span class="task-title">{task.title}</span>
											{#if getProjectName(task.project_id)}
												<span class="task-project">{getProjectName(task.project_id)}</span>
											{/if}
										</div>
										<div class="task-meta">
											<span class="priority {task.priority}">{task.priority}</span>
											<span class="task-time">{formatDueDate(task.due_date)}</span>
										</div>
									</label>
								</div>
							{/each}
						</div>
					{/if}

					<!-- This Week Section -->
					{#if thisWeekTasks.length > 0}
						<div class="task-group">
							<h2 class="group-title">This Week</h2>
							{#each thisWeekTasks as task (task.id)}
								<div class="task-item">
									<input
										type="checkbox"
										class="task-checkbox"
										id={task.id}
										checked={task.status === 'completed'}
										on:change={() => handleToggleTask(task.id, task.status)}
									/>
									<label for={task.id} class="task-content" class:completed={task.status === 'completed'}>
										<div class="task-main">
											<span class="task-title">{task.title}</span>
											{#if getProjectName(task.project_id)}
												<span class="task-project">{getProjectName(task.project_id)}</span>
											{/if}
										</div>
										<div class="task-meta">
											<span class="priority {task.priority}">{task.priority}</span>
											<span class="task-time">{formatDueDate(task.due_date)}</span>
										</div>
									</label>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Later / Inbox -->
					{#if laterTasks.length > 0}
						<div class="task-group">
							<h2 class="group-title">Later</h2>
							{#each laterTasks as task (task.id)}
								<div class="task-item">
									<input
										type="checkbox"
										class="task-checkbox"
										id={task.id}
										checked={task.status === 'completed'}
										on:change={() => handleToggleTask(task.id, task.status)}
									/>
									<label for={task.id} class="task-content" class:completed={task.status === 'completed'}>
										<div class="task-main">
											<span class="task-title">{task.title}</span>
											{#if getProjectName(task.project_id)}
												<span class="task-project">{getProjectName(task.project_id)}</span>
											{/if}
										</div>
										<div class="task-meta">
											<span class="priority {task.priority}">{task.priority}</span>
											<span class="task-time">{formatDueDate(task.due_date)}</span>
										</div>
									</label>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Completed -->
					{#if completedTasks.length > 0}
						<div class="task-group">
							<h2 class="group-title">Completed</h2>
							{#each completedTasks as task (task.id)}
								<div class="task-item">
									<input
										type="checkbox"
										class="task-checkbox"
										id={task.id}
										checked={true}
										on:change={() => handleToggleTask(task.id, task.status)}
									/>
									<label for={task.id} class="task-content completed">
										<div class="task-main">
											<span class="task-title">{task.title}</span>
											{#if getProjectName(task.project_id)}
												<span class="task-project">{getProjectName(task.project_id)}</span>
											{/if}
										</div>
										<div class="task-meta">
											<span class="task-time">Completed</span>
										</div>
									</label>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Tasks AI Chat Section -->
		<div class="chat-section">
			<div class="chat-header">
				<div class="header-content">
					<div class="chat-title">
						<img src="/tasks.png" alt="Tasks AI" class="ai-icon" />
						<div>
							<h2>Tasks AI</h2>
							<p class="ai-subtitle">Your task management assistant</p>
						</div>
					</div>
				</div>
			</div>

			<div class="messages" bind:this={chatMessagesContainer}>
				{#each chatMessages as message (message)}
					<div class="message {message.role}">
						<div class="message-bubble">
							<p>{message.content}</p>
						</div>
					</div>
				{/each}
			</div>

			<form class="input-container" on:submit|preventDefault={sendChatMessage}>
				<input
					type="text"
					bind:value={chatInput}
					placeholder="Ask about tasks..."
					class="message-input"
					disabled={isChatStreaming}
				/>
				<button type="submit" class="send-btn" disabled={isChatStreaming || !chatInput.trim()}>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
						<path d="M2 3l16 7-16 7V3zm0 8.5V14l8-4-8-4v5.5z"/>
					</svg>
				</button>
			</form>
		</div>
	</div>

	<!-- New Task Modal -->
	{#if showNewTaskModal}
		<div class="modal-overlay" on:click={() => showNewTaskModal = false}>
			<div class="modal" on:click|stopPropagation>
				<h2>Create New Task</h2>
				<form on:submit|preventDefault={handleCreateTask}>
					<div class="form-group">
						<label for="task-title">Task Title</label>
						<input
							type="text"
							id="task-title"
							bind:value={newTaskTitle}
							placeholder="e.g., Call the contractor"
							required
						/>
					</div>
					<div class="form-group">
						<label for="task-description">Description (optional)</label>
						<textarea
							id="task-description"
							bind:value={newTaskDescription}
							placeholder="Add details..."
							rows="2"
						></textarea>
					</div>
					<div class="form-row">
						<div class="form-group">
							<label for="task-priority">Priority</label>
							<select id="task-priority" bind:value={newTaskPriority}>
								<option value="low">Low</option>
								<option value="medium">Medium</option>
								<option value="high">High</option>
							</select>
						</div>
						<div class="form-group">
							<label for="task-due-date">Due Date (optional)</label>
							<input
								type="date"
								id="task-due-date"
								bind:value={newTaskDueDate}
							/>
						</div>
					</div>
					<div class="form-group">
						<label for="task-project">Project (optional)</label>
						<select id="task-project" bind:value={newTaskProjectId}>
							<option value={null}>No project</option>
							{#each projects as project}
								<option value={project.id}>{project.name}</option>
							{/each}
						</select>
					</div>
					<div class="modal-actions">
						<button type="button" class="secondary-btn" on:click={() => showNewTaskModal = false}>
							Cancel
						</button>
						<button type="submit" class="primary-btn">
							Create Task
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
</AppLayout>

<style>
	.tasks-page {
		min-height: 100vh;
		background: var(--bg-primary);
	}

	.tasks-container {
		display: flex;
		height: 100vh;
		overflow: hidden;
	}

	/* Tasks List Section */
	.tasks-section {
		flex: 2;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.section-header {
		flex-shrink: 0;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.section-header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.header-actions {
		display: flex;
		gap: 12px;
		align-items: center;
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

	.tasks-list {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 20px;
	}

	.task-group {
		margin-bottom: 32px;
	}

	.group-title {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		margin-bottom: 12px;
	}

	.task-item {
		display: flex;
		gap: 12px;
		padding: 12px;
		border-radius: var(--radius-md);
		margin-bottom: 8px;
		transition: all 0.2s ease;
	}

	.task-item:hover {
		background: var(--bg-tertiary);
	}

	.task-checkbox {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		margin-top: 2px;
		cursor: pointer;
		accent-color: var(--accent-success);
	}

	.task-content {
		flex: 1;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		cursor: pointer;
		gap: 16px;
	}

	.task-content.completed .task-title {
		text-decoration: line-through;
		color: var(--text-muted);
	}

	.task-main {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.task-title {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.task-project {
		font-size: 0.8125rem;
		color: var(--text-secondary);
	}

	.task-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.priority {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		padding: 2px 8px;
		border-radius: 4px;
		letter-spacing: 0.05em;
	}

	.priority.high {
		background: rgba(211, 47, 47, 0.1);
		color: var(--danger);
	}

	.priority.medium {
		background: rgba(199, 124, 92, 0.1);
		color: var(--accent-primary);
	}

	.priority.low {
		background: rgba(115, 115, 115, 0.1);
		color: var(--text-secondary);
	}

	.task-time {
		font-size: 0.8125rem;
		color: var(--text-muted);
	}

	/* Chat Section */
	.chat-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
		min-width: 400px;
	}

	.chat-header {
		flex-shrink: 0;
		padding: 16px 20px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
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
		margin-bottom: 2px;
	}

	.ai-subtitle {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		margin: 0;
	}

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
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		text-align: left;
		max-width: 95%;
	}

	.input-container {
		flex-shrink: 0;
		padding: 16px;
		padding-bottom: max(16px, env(safe-area-inset-bottom));
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		display: flex;
		gap: 12px;
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

	/* Loading & Empty States */
	.loading-state, .empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 20px;
		gap: 16px;
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

	.loading-state p {
		color: var(--text-secondary);
		margin: 0;
	}

	.empty-icon {
		font-size: 64px;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-state h2 {
		font-size: 1.5rem;
		margin-bottom: 8px;
	}

	.empty-state p {
		color: var(--text-secondary);
		margin-bottom: 24px;
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
		max-width: 500px;
		width: 100%;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.modal h2 {
		font-size: 1.5rem;
		margin-bottom: 20px;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: block;
		font-weight: 600;
		font-size: 0.875rem;
		margin-bottom: 8px;
		color: var(--text-primary);
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		width: 100%;
		padding: 12px 16px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
	}

	.form-group input:focus,
	.form-group textarea:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	.form-group textarea {
		resize: vertical;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		margin-top: 20px;
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

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.message-input:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	/* Mobile Responsive */
	@media (max-width: 1023px) {
		.chat-section {
			display: none;
		}

		.tasks-section {
			border-right: none;
		}

		.form-row {
			grid-template-columns: 1fr;
		}
	}
</style>
