<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import MobileUserMenu from '$lib/components/MobileUserMenu.svelte';
	import TaskDetailModal from '$lib/components/TaskDetailModal.svelte';
	import TaskEditModal from '$lib/components/TaskEditModal.svelte';
	import { getTasks, createTask, toggleTaskComplete, updateTask, deleteTask, deleteOldCompletedTasks } from '$lib/db/tasks';
	import { createNote } from '$lib/db/notes';
	import { getProjects } from '$lib/db/projects';
	import { getOrCreateConversation, getRecentMessages, addMessage } from '$lib/db/conversations';
	import { loadWorkspaceContext, formatWorkspaceContextForAI } from '$lib/db/context';
	import type { Conversation } from '@chatkin/types';
	import { onMount, tick } from 'svelte';
	import { PUBLIC_WORKER_URL } from '$env/static/public';
	import { notificationCounts } from '$lib/stores/notifications';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	interface ChatMessage {
		role: 'user' | 'ai';
		content: string;
		isTyping?: boolean;
	}

	let tasks: any[] = [];
	let projects: any[] = [];
	let loading = true;
	let showNewTaskModal = false;
	let showFabMenu = false;
	let newTaskTitle = '';
	let newTaskDescription = '';
	let newTaskPriority = 'medium';
	let newTaskDueDate = '';
	let newTaskProjectId: string | null = null;
	let showCompletedTasks = false;

	// Task detail modal state
	let showTaskDetailModal = false;
	let selectedTask: any = null;

	// Edit modal state
	let showEditTaskModal = false;
	let editingTask: any = null;

	// Chat state
	let chatMessages: ChatMessage[] = [];
	let chatInput = '';
	let isChatStreaming = false;
	let chatMessagesContainer: HTMLDivElement;
	let conversation: Conversation | null = null;
	let workspaceContextString = '';
	let messagesReady = false;
	let isLoadingConversation = true;

	onMount(async () => {
		// Set current section and clear notification count
		notificationCounts.setCurrentSection('tasks');
		notificationCounts.clearCount('tasks');

		// Load show completed preference from localStorage
		const savedShowCompleted = localStorage.getItem('showCompletedTasks');
		if (savedShowCompleted !== null) {
			showCompletedTasks = savedShowCompleted === 'true';
		}

		// Delete completed tasks older than 30 days
		try {
			await deleteOldCompletedTasks();
		} catch (error) {
			console.error('Error deleting old completed tasks:', error);
		}

		await loadData();

		// Load conversation and context
		try {
			// Get or create conversation for tasks scope
			conversation = await getOrCreateConversation('tasks');

			// Load recent messages from database
			const dbMessages = await getRecentMessages(conversation.id, 50);

			// Convert DB messages to UI messages
			if (dbMessages.length > 0) {
				chatMessages = dbMessages.map(msg => ({
					role: msg.role === 'assistant' ? 'ai' : 'user',
					content: msg.content
				}));
			} else {
				// Show welcome message if no history
				chatMessages = [{
					role: 'ai',
					content: "Hi! I'm your Tasks AI. I can help you create, organize, and prioritize your tasks. What would you like to work on?"
				}];
			}

			// Load workspace context
			const workspaceContext = await loadWorkspaceContext();
			workspaceContextString = formatWorkspaceContextForAI(workspaceContext);

			isLoadingConversation = false;
			await scrollChatToBottom();
			messagesReady = true;
		} catch (error) {
			console.error('Error loading conversation:', error);
			isLoadingConversation = false;
			// Show welcome message as fallback
			chatMessages = [{
				role: 'ai',
				content: "Hi! I'm your Tasks AI. I can help you create, organize, and prioritize your tasks. What would you like to work on?"
			}];
			await scrollChatToBottom();
			messagesReady = true;
		}
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

	function openTaskDetail(task: any) {
		selectedTask = task;
		showTaskDetailModal = true;
	}

	function openEditFromDetail() {
		editingTask = selectedTask;
		showTaskDetailModal = false;
		showEditTaskModal = true;
	}

	async function handleDeleteFromDetail() {
		if (!selectedTask) return;

		try {
			await deleteTask(selectedTask.id);
			showTaskDetailModal = false;
			selectedTask = null;
			await loadData();
		} catch (error) {
			console.error('Error deleting task:', error);
		}
	}

	async function handleUpdateTask(updatedTask: any) {
		if (!editingTask) return;

		try {
			await updateTask(editingTask.id, updatedTask);
			showEditTaskModal = false;
			await loadData();
		} catch (error) {
			console.error('Error updating task:', error);
			alert('Failed to update task');
		}
	}

	async function handleDeleteTask() {
		if (!editingTask) return;

		try {
			await deleteTask(editingTask.id);
			showEditTaskModal = false;
			editingTask = null;
			await loadData();
		} catch (error) {
			console.error('Error deleting task:', error);
		}
	}

	function truncateTitle(title: string, maxLength: number = 30) {
		if (title.length <= maxLength) return title;
		return title.substring(0, maxLength) + '...';
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

		// Compare dates without time component
		taskDate.setHours(0, 0, 0, 0);
		today.setHours(0, 0, 0, 0);
		if (taskDate < today) return 'Overdue';

		return taskDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	$: todayTasks = tasks
		.filter(t => t.status !== 'completed' && isToday(t.due_date))
		.sort((a, b) => {
			if (!a.due_date) return 1;
			if (!b.due_date) return -1;
			return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
		});
	$: thisWeekTasks = tasks
		.filter(t => t.status !== 'completed' && !isToday(t.due_date) && isThisWeek(t.due_date))
		.sort((a, b) => {
			if (!a.due_date) return 1;
			if (!b.due_date) return -1;
			return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
		});
	$: laterTasks = tasks
		.filter(t => t.status !== 'completed' && !isToday(t.due_date) && !isThisWeek(t.due_date))
		.sort((a, b) => {
			if (!a.due_date) return 1;
			if (!b.due_date) return -1;
			return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
		});
	$: completedTasks = tasks
		.filter(t => t.status === 'completed')
		.sort((a, b) => {
			if (!a.updated_at) return 1;
			if (!b.updated_at) return -1;
			return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
		});
	$: completedTodayCount = completedTasks.filter(t => {
		if (!t.updated_at) return false;
		const completedDate = new Date(t.updated_at);
		const today = new Date();
		return completedDate.toDateString() === today.toDateString();
	}).length;

	function toggleShowCompleted() {
		showCompletedTasks = !showCompletedTasks;
		localStorage.setItem('showCompletedTasks', String(showCompletedTasks));
	}

	async function scrollChatToBottom() {
		await tick();
		if (chatMessagesContainer) {
			chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
		}
	}

	async function sendChatMessage(message?: string) {
		const userMessage = message || chatInput.trim();
		if (!userMessage || isChatStreaming || !conversation) return;

		chatInput = '';

		// Build conversation history BEFORE adding new message (last 50 messages)
		const allMessages = chatMessages.filter(m => m.content && typeof m.content === 'string' && m.content.trim() && !(m as any).isTyping);
		const recentMessages = allMessages.slice(-50);

		const conversationHistory = recentMessages.map(m => ({
			role: m.role,
			content: m.content
		}));

		// Save user message to database
		try {
			await addMessage(conversation.id, 'user', userMessage);
		} catch (error) {
			console.error('Error saving user message:', error);
		}

		// Add user message
		chatMessages = [...chatMessages, { role: 'user', content: userMessage }];
		scrollChatToBottom();

		// Add placeholder for AI response
		const aiMessageIndex = chatMessages.length;
		chatMessages = [...chatMessages, { role: 'ai', content: '' }];
		isChatStreaming = true;

		// Show loading message
		chatMessages[aiMessageIndex] = {
			role: 'ai',
			content: '',
		isTyping: true
		};
		chatMessages = chatMessages;
		scrollChatToBottom();

		try {

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
						scope: 'tasks'
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
				chatMessages[aiMessageIndex] = {
					role: 'ai',
					content: 'Processing...',
					isTyping: false
				};
				chatMessages = chatMessages;
				scrollChatToBottom();

				// Process all operations
				let createCount = 0;
				let updateCount = 0;
				let deleteCount = 0;

				for (const action of data.actions) {
					try {
						if (action.type === 'task') {
							if (action.operation === 'create') {
								const taskData = action.data;
								const dueDate = taskData.due_date || null;
								await createTask({
									title: taskData.title,
									description: taskData.description,
									priority: taskData.priority || 'medium',
									status: 'todo',
									project_id: null,
									due_date: dueDate
								});
								createCount++;
							} else if (action.operation === 'update' && action.id) {
								await updateTask(action.id, action.changes);
								updateCount++;
							} else if (action.operation === 'delete' && action.id) {
								await deleteTask(action.id);
								deleteCount++;
							}
						}
					} catch (error) {
						console.error(`Error processing ${action.operation} task:`, error);
					}
				}

				// Reload tasks
				await loadData();

				// Show custom confirmation message
				const parts = [];
				if (createCount > 0) parts.push(`Created ${createCount} task${createCount > 1 ? 's' : ''}`);
				if (updateCount > 0) parts.push(`Updated ${updateCount} task${updateCount > 1 ? 's' : ''}`);
				if (deleteCount > 0) parts.push(`Deleted ${deleteCount} task${deleteCount > 1 ? 's' : ''}`);
				const confirmMessage = parts.length > 0 ? parts.join(', ') + '.' : 'No changes made.';

				// Save AI response to database
				try {
					await addMessage(conversation!.id, 'assistant', confirmMessage);
				} catch (error) {
					console.error('Error saving AI message:', error);
				}

				chatMessages[aiMessageIndex] = {
					role: 'ai',
					content: confirmMessage,
					isTyping: false
				};
				chatMessages = chatMessages;
			} else if (data.type === 'message') {
				// Save conversational AI response
				try {
					await addMessage(conversation!.id, 'assistant', data.message);
				} catch (error) {
					console.error('Error saving AI message:', error);
				}

				// Conversational response
				chatMessages[aiMessageIndex] = {
					role: 'ai',
					content: data.message,
					isTyping: false
				};
				chatMessages = chatMessages;
			}
		} catch (error) {
			console.error('Error sending message:', error);
			chatMessages[aiMessageIndex] = {
				role: 'ai',
				content: 'Sorry, I encountered an error processing your request. Please try again.',
				isTyping: false
			};
			chatMessages = chatMessages;
		} finally {
			isChatStreaming = false;
			scrollChatToBottom();
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
			{:else if todayTasks.length === 0 && thisWeekTasks.length === 0 && laterTasks.length === 0}
				<div class="empty-state">
					<img src="/tasks.webp" alt="Tasks" class="empty-icon" />
					<h2>No tasks yet</h2>
					<p>Create your first task to get started</p>
				</div>
			{:else}
				<div class="tasks-list">
					{#if !showCompletedTasks}
					<!-- Today Section -->
					{#if todayTasks.length > 0}
						<div class="task-group">
							<div class="group-header">
								<h2 class="group-title">Today</h2>
								{#if completedTasks.length > 0}
									<button class="toggle-link" on:click={toggleShowCompleted}>Show Completed</button>
								{/if}
							</div>
							{#each todayTasks as task (task.id)}
								<div class="task-item">
									<input
										type="checkbox"
										class="task-checkbox"
										id={task.id}
										checked={task.status === 'completed'}
										on:change={() => handleToggleTask(task.id, task.status)}
									/>
									<div class="task-content" class:completed={task.status === 'completed'} on:click={() => openTaskDetail(task)}>
										<div class="task-main">
											<span class="task-title">{truncateTitle(task.title)}</span>
											{#if getProjectName(task.project_id)}
												<span class="task-project">{getProjectName(task.project_id)}</span>
											{/if}
										</div>
										<div class="task-meta">
											<span class="priority {task.priority}">{task.priority}</span>
											<span class="task-time">{formatDueDate(task.due_date)}</span>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<!-- This Week Section -->
					{#if thisWeekTasks.length > 0}
						<div class="task-group">
							<div class="group-header">
								<h2 class="group-title">This Week</h2>
								{#if completedTasks.length > 0 && todayTasks.length === 0}
									<button class="toggle-link" on:click={toggleShowCompleted}>Show Completed</button>
								{/if}
							</div>
							{#each thisWeekTasks as task (task.id)}
								<div class="task-item">
									<input
										type="checkbox"
										class="task-checkbox"
										id={task.id}
										checked={task.status === 'completed'}
										on:change={() => handleToggleTask(task.id, task.status)}
									/>
									<div class="task-content" class:completed={task.status === 'completed'} on:click={() => openTaskDetail(task)}>
										<div class="task-main">
											<span class="task-title">{truncateTitle(task.title)}</span>
											{#if getProjectName(task.project_id)}
												<span class="task-project">{getProjectName(task.project_id)}</span>
											{/if}
										</div>
										<div class="task-meta">
											<span class="priority {task.priority}">{task.priority}</span>
											<span class="task-time">{formatDueDate(task.due_date)}</span>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Later / Inbox -->
					{#if laterTasks.length > 0}
						<div class="task-group">
							<div class="group-header">
								<h2 class="group-title">Later</h2>
								{#if completedTasks.length > 0 && todayTasks.length === 0 && thisWeekTasks.length === 0}
									<button class="toggle-link" on:click={toggleShowCompleted}>Show Completed</button>
								{/if}
							</div>
							{#each laterTasks as task (task.id)}
								<div class="task-item">
									<input
										type="checkbox"
										class="task-checkbox"
										id={task.id}
										checked={task.status === 'completed'}
										on:change={() => handleToggleTask(task.id, task.status)}
									/>
									<div class="task-content" class:completed={task.status === 'completed'} on:click={() => openTaskDetail(task)}>
										<div class="task-main">
											<span class="task-title">{truncateTitle(task.title)}</span>
											{#if getProjectName(task.project_id)}
												<span class="task-project">{getProjectName(task.project_id)}</span>
											{/if}
										</div>
										<div class="task-meta">
											<span class="priority {task.priority}">{task.priority}</span>
											<span class="task-time">{formatDueDate(task.due_date)}</span>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
					{/if}

					<!-- Completed -->
					{#if showCompletedTasks && completedTasks.length > 0}
						<div class="task-group">
							<div class="group-header">
								<h2 class="group-title">Completed</h2>
								<button class="toggle-link" on:click={toggleShowCompleted}>Show All Tasks</button>
							</div>
							{#each completedTasks as task (task.id)}
								<div class="task-item">
									<input
										type="checkbox"
										class="task-checkbox"
										id={task.id}
										checked={true}
										on:change={() => handleToggleTask(task.id, task.status)}
									/>
									<div class="task-content completed" on:click={() => openTaskDetail(task)}>
										<div class="task-main">
											<span class="task-title">{truncateTitle(task.title)}</span>
											{#if getProjectName(task.project_id)}
												<span class="task-project">{getProjectName(task.project_id)}</span>
											{/if}
										</div>
										<div class="task-meta">
											<span class="task-time">Completed</span>
										</div>
									</div>
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
						<img src="/tasks.webp" alt="Tasks AI" class="ai-icon" />
						<div>
							<h2>Tasks AI</h2>
							<p class="ai-subtitle">Your task management assistant</p>
						</div>
					</div>
				</div>
			</div>

			{#if !messagesReady}
				<div class="chat-loading-overlay">
					<div class="spinner"></div>
					<p>Loading conversation...</p>
				</div>
			{/if}

			<div class="messages" bind:this={chatMessagesContainer} style:opacity={messagesReady ? '1' : '0'}>
				{#each chatMessages as message (message)}
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

			<form class="input-container" on:submit|preventDefault={() => sendChatMessage()}>
				<input
					type="text"
					bind:value={chatInput}
					placeholder="Ask about tasks..."
					class="message-input"
					disabled={isChatStreaming}
				/>
				<button type="submit" class="send-btn" disabled={isChatStreaming || !chatInput.trim()}>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M5 15L15 5"/>
						<path d="M9 5h6v6"/>
					</svg>
				</button>
			</form>
		</div>
	</div>

	<!-- Mobile Layout (matches Chat structure) -->
	<div class="mobile-content">
		<header class="mobile-header">
			<div class="mobile-header-left">
				<button class="mobile-logo-button">
					<img src="/tasks.webp" alt="Tasks" class="mobile-logo" />
				</button>
				<h1>Tasks</h1>
			</div>
			<MobileUserMenu />
		</header>

		<div class="mobile-tasks">
			{#if loading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Loading tasks...</p>
				</div>
			{:else if todayTasks.length === 0 && thisWeekTasks.length === 0 && laterTasks.length === 0}
				<div class="empty-state">
					<img src="/tasks.webp" alt="Tasks" class="empty-icon" />
					<h2>No tasks yet</h2>
					<p>Create your first task to get started</p>
				</div>
			{:else}
				{#if !showCompletedTasks}
				<!-- Today Section -->
				{#if todayTasks.length > 0}
					<div class="task-group">
						<div class="group-header">
							<h2 class="group-title">Today</h2>
							{#if completedTasks.length > 0}
								<button class="toggle-link" on:click={toggleShowCompleted}>Show Completed</button>
							{/if}
						</div>
						{#each todayTasks as task (task.id)}
							<div class="task-item">
								<input
									type="checkbox"
									class="task-checkbox"
									id={task.id}
									checked={task.status === 'completed'}
									on:change={() => handleToggleTask(task.id, task.status)}
								/>
								<div class="task-content" class:completed={task.status === 'completed'} on:click={() => openTaskDetail(task)}>
									<div class="task-main">
										<span class="task-title">{truncateTitle(task.title)}</span>
										{#if getProjectName(task.project_id)}
											<span class="task-project">{getProjectName(task.project_id)}</span>
										{/if}
									</div>
									<div class="task-meta">
										<span class="priority {task.priority}">{task.priority}</span>
										<span class="task-time">{formatDueDate(task.due_date)}</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<!-- This Week Section -->
				{#if thisWeekTasks.length > 0}
					<div class="task-group">
						<div class="group-header">
							<h2 class="group-title">This Week</h2>
							{#if completedTasks.length > 0 && todayTasks.length === 0}
								<button class="toggle-link" on:click={toggleShowCompleted}>Show Completed</button>
							{/if}
						</div>
						{#each thisWeekTasks as task (task.id)}
							<div class="task-item">
								<input
									type="checkbox"
									class="task-checkbox"
									id={task.id}
									checked={task.status === 'completed'}
									on:change={() => handleToggleTask(task.id, task.status)}
								/>
								<div class="task-content" class:completed={task.status === 'completed'} on:click={() => openTaskDetail(task)}>
									<div class="task-main">
										<span class="task-title">{truncateTitle(task.title)}</span>
										{#if getProjectName(task.project_id)}
											<span class="task-project">{getProjectName(task.project_id)}</span>
										{/if}
									</div>
									<div class="task-meta">
										<span class="priority {task.priority}">{task.priority}</span>
										<span class="task-time">{formatDueDate(task.due_date)}</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Later / Inbox -->
				{#if laterTasks.length > 0}
					<div class="task-group">
						<div class="group-header">
							<h2 class="group-title">Later</h2>
							{#if completedTasks.length > 0 && todayTasks.length === 0 && thisWeekTasks.length === 0}
								<button class="toggle-link" on:click={toggleShowCompleted}>Show Completed</button>
							{/if}
						</div>
						{#each laterTasks as task (task.id)}
							<div class="task-item">
								<input
									type="checkbox"
									class="task-checkbox"
									id={task.id}
									checked={task.status === 'completed'}
									on:change={() => handleToggleTask(task.id, task.status)}
								/>
								<div class="task-content" class:completed={task.status === 'completed'} on:click={() => openTaskDetail(task)}>
									<div class="task-main">
										<span class="task-title">{truncateTitle(task.title)}</span>
										{#if getProjectName(task.project_id)}
											<span class="task-project">{getProjectName(task.project_id)}</span>
										{/if}
									</div>
									<div class="task-meta">
										<span class="priority {task.priority}">{task.priority}</span>
										<span class="task-time">{formatDueDate(task.due_date)}</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
				{/if}

				<!-- Completed -->
				{#if showCompletedTasks && completedTasks.length > 0}
					<div class="task-group">
						<div class="group-header">
							<h2 class="group-title">Completed</h2>
							<button class="toggle-link" on:click={toggleShowCompleted}>Show All Tasks</button>
						</div>
						{#each completedTasks as task (task.id)}
							<div class="task-item">
								<input
									type="checkbox"
									class="task-checkbox"
									id={task.id}
									checked={true}
									on:change={() => handleToggleTask(task.id, task.status)}
								/>
								<div class="task-content completed" on:click={() => openTaskDetail(task)}>
									<div class="task-main">
										<span class="task-title">{truncateTitle(task.title)}</span>
										{#if getProjectName(task.project_id)}
											<span class="task-project">{getProjectName(task.project_id)}</span>
										{/if}
									</div>
									<div class="task-meta">
										<span class="task-time">Completed</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
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
							maxlength="50"
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

	<!-- Task Modals -->
	<TaskDetailModal
		show={showTaskDetailModal}
		task={selectedTask}
		projects={projects}
		onClose={() => showTaskDetailModal = false}
		onEdit={openEditFromDetail}
		onDelete={handleDeleteFromDetail}
	/>

	<TaskEditModal
		show={showEditTaskModal}
		task={editingTask}
		projects={projects}
		onClose={() => showEditTaskModal = false}
		onSave={handleUpdateTask}
		onDelete={handleDeleteTask}
	/>

	<!-- Floating Action Button with Menu (Mobile Only) -->
	<div class="fab-container">
		{#if showFabMenu}
			<div class="fab-menu">
				<button class="fab-menu-item" on:click={() => { showNewTaskModal = true; showFabMenu = false; }}>
					<svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M15 3l2 2-9 9-4 1 1-4 9-9z"/>
					</svg>
					<span>Quick Add</span>
				</button>
				<button class="fab-menu-item" on:click={() => goto('/tasks/chat')}>
					<svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor">
						<path d="M10 2l1.5 3.5L15 7l-3.5 1.5L10 12l-1.5-3.5L5 7l3.5-1.5L10 2z"/>
						<path d="M5 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/>
						<path d="M15 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/>
					</svg>
					<span>Create with AI</span>
				</button>
			</div>
		{/if}
		<button class="fab" on:click={() => showFabMenu = !showFabMenu} aria-label="Create options">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<path d="M12 5v14M5 12h14"/>
			</svg>
		</button>
	</div>

</div>
</AppLayout>

<style>
	.tasks-page {
		height: 100vh;
		overflow: hidden;
		background: var(--bg-primary);
	}

	.tasks-container {
		display: flex;
		height: 100vh;
		overflow: hidden;
	}

	/* Mobile Layout (hidden on desktop) */
	.mobile-content {
		display: none;
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
		height: 64px;
		box-sizing: border-box;
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

	.header-actions .primary-btn {
		display: flex;
		align-items: center;
		padding: 10px 20px;
		font-size: 0.9375rem;
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

	.tasks-list {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 20px;
	}

	.task-group {
		margin-bottom: 32px;
	}

	.group-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.group-title {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		margin-bottom: 12px;
	}

	.group-header .group-title {
		margin-bottom: 0;
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
		flex: 1;
		min-width: 0;
		padding-right: 16px;
	}

	.task-title {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
		opacity: 0;
		position: relative;
	}

	.chat-loading-overlay {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		padding-top: calc(50% + 20px);
		gap: 16px;
		background: var(--bg-primary);
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
		background: var(--bg-secondary);
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

	.input-container {
		flex-shrink: 0;
		padding: 16px;
		padding-bottom: max(16px, env(safe-area-inset-bottom));
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		display: flex;
		gap: 12px;
		min-height: calc(76px + env(safe-area-inset-bottom));
		transform: translate3d(0, 0, 0);
		-webkit-transform: translate3d(0, 0, 0);
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
		padding: 60px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 400px;
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
		width: 100px;
		height: 100px;
		margin-bottom: 12px;
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

	/* Task Detail Styles */
	.task-detail-content {
		display: flex;
		flex-direction: column;
		gap: 20px;
		margin-bottom: 24px;
	}

	.detail-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.detail-section label {
		display: block;
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.detail-text {
		font-size: 0.9375rem;
		color: var(--text-primary);
		margin: 0;
		line-height: 1.5;
	}

	.detail-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}

	.primary-btn {
		padding: 10px 20px;
		background: var(--accent-primary);
		border: none;
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.primary-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.primary-btn:active {
		transform: translateY(0);
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

	.toggle-link {
		background: none;
		border: none;
		color: var(--accent-primary);
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		transition: all 0.2s ease;
	}

	.toggle-link:hover {
		background: var(--bg-tertiary);
	}

	.delete-btn {
		padding: 10px 20px;
		background: transparent;
		border: 1px solid var(--danger);
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--danger);
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.delete-btn:hover {
		background: rgba(211, 47, 47, 0.1);
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
		/* Hide desktop layout */
		.tasks-container {
			display: none;
		}

		/* Show mobile layout */
		.mobile-content {
			display: flex;
			flex-direction: column;
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 50px; /* Above bottom nav */
			background: var(--bg-secondary);
			overflow-x: hidden;
		}

		.mobile-header {
			flex-shrink: 0;
			padding: 16px 20px;
			background: var(--bg-secondary);
			border-bottom: 1px solid var(--border-color);
			height: 64px;
			box-sizing: border-box;
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.mobile-header-left {
			display: flex;
			align-items: center;
			gap: 12px;
		}

		.mobile-logo-button {
			display: flex;
			align-items: center;
			background: none;
			border: none;
			padding: 0;
			cursor: pointer;
		}

		.mobile-logo {
			width: 52px;
			height: 52px;
			border-radius: var(--radius-sm);
			transition: all 0.15s ease;
		}

		.mobile-logo-button:active .mobile-logo {
			transform: translateY(4px) scale(0.95);
		}

		.mobile-header h1 {
			font-size: 1.5rem;
			font-weight: 700;
			letter-spacing: -0.02em;
			margin: 0;
		}

		.fab-container {
			display: none;
		}

		@media (max-width: 1023px) {
			.fab-container {
				display: block;
				position: fixed;
				bottom: 80px;
				left: 27px;
				z-index: 50;
				margin-bottom: env(safe-area-inset-bottom);
			}

			.fab {
				width: 56px;
				height: 56px;
				border-radius: 50%;
				background: var(--accent-primary);
				color: white;
				border: none;
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
				transition: transform 0.3s ease;
				opacity: 0.7;
			}

			.fab:active {
				transform: scale(0.95);
			}

			.fab-menu {
				position: absolute;
				bottom: calc(100% + 12px);
				left: 0;
				background: var(--bg-secondary);
				border: 1px solid var(--border-color);
				border-radius: var(--radius-md);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
				min-width: 180px;
				overflow: hidden;
				animation: slideUp 0.2s ease;
			}

			@keyframes slideUp {
				from {
					opacity: 0;
					transform: translateY(10px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}

			.fab-menu-item {
				display: flex;
				align-items: center;
				gap: 12px;
				padding: 14px 16px;
				width: 100%;
				background: transparent;
				border: none;
				border-bottom: 1px solid var(--border-color);
				cursor: pointer;
				transition: background 0.2s ease;
				color: var(--text-primary);
				font-size: 0.9375rem;
				font-weight: 500;
				text-align: left;
			}

			.fab-menu-item:last-child {
				border-bottom: none;
			}

			.fab-menu-item:hover {
				background: var(--bg-tertiary);
			}

			.fab-menu-item:active {
				transform: scale(0.98);
			}

			.fab-menu-item svg {
				flex-shrink: 0;
				color: var(--text-secondary);
			}
		}

		.mobile-tasks {
			flex: 1;
			overflow-y: auto;
			overflow-x: hidden;
			-webkit-overflow-scrolling: touch;
			padding: 20px;
			padding-bottom: 120px;
			background: var(--bg-secondary);
		}

		/* Mobile task item adjustments */
		.task-item {
			gap: 10px;
			padding: 10px;
		}

		.task-content {
			gap: 12px;
			min-width: 0;
		}

		.task-main {
			padding-right: 8px;
			min-width: 0;
		}

		.task-title {
			font-size: 0.875rem;
		}

		.task-meta {
			gap: 6px;
		}

		.priority {
			font-size: 0.6875rem;
			padding: 2px 6px;
		}

		.task-time {
			font-size: 0.75rem;
			white-space: nowrap;
		}

		.form-row {
			grid-template-columns: 1fr;
		}
	}
</style>
