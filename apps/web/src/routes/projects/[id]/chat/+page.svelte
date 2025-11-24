<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import ExpandableChatPanel from '$lib/components/ExpandableChatPanel.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import EditProjectModal from '$lib/components/EditProjectModal.svelte';
	import TaskDetailModal from '$lib/components/TaskDetailModal.svelte';
	import TaskEditModal from '$lib/components/TaskEditModal.svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import { PUBLIC_WORKER_URL } from '$env/static/public';
	import { getProject, deleteProject, getProjects } from '$lib/db/projects';
	import { getTasks, toggleTaskComplete, updateTask, deleteTask } from '$lib/db/tasks';
	import { getNotes } from '$lib/db/notes';
	import { createTask } from '$lib/db/tasks';
	import { createNote } from '$lib/db/notes';
	import { getOrCreateConversation, getRecentMessages, addMessage } from '$lib/db/conversations';
	import { loadWorkspaceContext, formatWorkspaceContextForAI } from '$lib/db/context';
	import type { Conversation } from '@chatkin/types';

	interface Message {
		role: 'user' | 'ai';
		content: string;
		files?: Array<{ name: string; url: string; type: string }>;
		actions?: Array<{ type: string; title: string; [key: string]: any }>;
		isTyping?: boolean;
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
	let tasks: any[] = [];
	let notes: any[] = [];
	let loading = true;
	let messages: Message[] = [];
	let inputMessage = '';
	let isStreaming = false;
	let messagesContainer: HTMLDivElement;
	let showMenu = false;
	let showDeleteConfirm = false;
	let showEditModal = false;
	let conversation: Conversation | null = null;
	let workspaceContextString = '';
	let isLoadingConversation = true;
	let messagesReady = false;
	let projects: any[] = [];
	let showTaskDetailModal = false;
	let selectedTask: any = null;
	let showEditTaskModal = false;
	let editingTask: any = null;
	let showCompletedTasks = false;

	onMount(async () => {
		await loadData();

		// Load conversation and context
		try {
			// Get or create conversation for this project
			conversation = await getOrCreateConversation('project', projectId);

			// Load recent messages from database
			const dbMessages = await getRecentMessages(conversation.id, 50);

			// Convert DB messages to UI messages
			if (dbMessages.length > 0) {
				messages = dbMessages.map(msg => ({
					role: msg.role === 'assistant' ? 'ai' : 'user',
					content: msg.content
				}));
			} else {
				// Show welcome message if no history
				messages = [
					{
						role: 'ai',
						content: project ? `Hi! I'm here to help you with ${project.name}. What would you like to work on?` : 'Hi! What would you like to work on?'
					}
				];
			}

			// Load workspace context
			const workspaceContext = await loadWorkspaceContext();
			workspaceContextString = formatWorkspaceContextForAI(workspaceContext);

			isLoadingConversation = false;
			await scrollToBottom();
			messagesReady = true;
		} catch (convError) {
			console.error('Error loading conversation:', convError);
			isLoadingConversation = false;
			// Show welcome message as fallback
			messages = [
				{
					role: 'ai',
					content: project ? `Hi! I'm here to help you with ${project.name}. What would you like to work on?` : 'Hi! What would you like to work on?'
				}
			];
			await scrollToBottom();
			messagesReady = true;
		}

		// Load completed tasks preference
		const savedShowCompleted = localStorage.getItem('showCompletedTasks');
		if (savedShowCompleted !== null) {
			showCompletedTasks = savedShowCompleted === 'true';
		}

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

	async function loadData() {
		loading = true;
		try {
			[project, tasks, notes, projects] = await Promise.all([
				getProject(projectId),
				getTasks().then(allTasks => allTasks.filter(t => t.project_id === projectId)),
				getNotes().then(allNotes => allNotes.filter(n => n.project_id === projectId)),
				getProjects()
			]);
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			loading = false;
		}
	}

	async function scrollToBottom() {
		await tick();
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
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

	async function handleToggleTask(taskId: string, currentStatus: string) {
		try {
			const completed = currentStatus !== 'completed';
			await toggleTaskComplete(taskId, completed);
			await loadData();
		} catch (error) {
			console.error('Error toggling task:', error);
		}
	}

	function truncateTitle(title: string, maxLength: number = 30) {
		if (!title) return 'Untitled';
		if (title.length <= maxLength) return title;
		return title.substring(0, maxLength) + '...';
	}

	function getProjectName(projectId: string | null) {
		if (!projectId) return null;
		const project = projects.find(p => p.id === projectId);
		return project?.name;
	}

	function formatDueDate(date: string | null) {
		if (!date) return 'No due date';
		const taskDate = new Date(date);
		const today = new Date();

		// Check if today
		if (taskDate.toDateString() === today.toDateString()) return 'Due today';

		// Compare dates without time component
		taskDate.setHours(0, 0, 0, 0);
		today.setHours(0, 0, 0, 0);
		if (taskDate < today) return 'Overdue';

		return taskDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
		return taskDate >= today && taskDate <= weekFromNow;
	}

	function toggleShowCompleted() {
		showCompletedTasks = !showCompletedTasks;
		localStorage.setItem('showCompletedTasks', String(showCompletedTasks));
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

	async function handleDeleteFromDetail() {
		if (!selectedTask || !confirm('Are you sure you want to delete this task?')) return;

		try {
			await deleteTask(selectedTask.id);
			showTaskDetailModal = false;
			await loadData();
		} catch (error) {
			console.error('Error deleting task:', error);
			alert('Failed to delete task');
		}
	}

	async function handleDeleteTask() {
		if (!editingTask || !confirm('Are you sure you want to delete this task?')) return;

		try {
			await deleteTask(editingTask.id);
			showEditTaskModal = false;
			await loadData();
		} catch (error) {
			console.error('Error deleting task:', error);
			alert('Failed to delete task');
		}
	}

	function getContentPreview(note: any): string {
		if (!note.note_blocks || note.note_blocks.length === 0) return 'No content yet...';

		// Get first text block
		const firstTextBlock = note.note_blocks.find((block: any) => block.type === 'text');
		if (!firstTextBlock || !firstTextBlock.content?.text) return 'No content yet...';

		const text = firstTextBlock.content.text;
		return text.length > 100 ? text.substring(0, 100) + '...' : text;
	}

	function getWordCount(note: any): number {
		if (!note.note_blocks || note.note_blocks.length === 0) return 0;

		// Combine all text blocks
		let allText = '';
		for (const block of note.note_blocks) {
			if (block.type === 'text' && block.content?.text) {
				allText += block.content.text + ' ';
			}
		}

		if (!allText.trim()) return 0;
		return allText.trim().split(/\s+/).length;
	}

	function formatDate(dateString: string) {
		const date = new Date(dateString);
		const now = new Date();
		const diffInMs = now.getTime() - date.getTime();
		const diffInHours = diffInMs / (1000 * 60 * 60);

		if (diffInHours < 1) {
			const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
			return `${diffInMinutes}m ago`;
		} else if (diffInHours < 24) {
			return `${Math.floor(diffInHours)}h ago`;
		} else if (diffInHours < 48) {
			return 'yesterday';
		} else {
			return `${Math.floor(diffInHours / 24)} days ago`;
		}
	}

	async function sendMessage(message?: string) {
		const userMessage = message || inputMessage.trim();
		if (!userMessage || isStreaming || !conversation) return;

		inputMessage = '';

		// Build conversation history BEFORE adding new message (last 50 messages)
		const allMessages = messages.filter(m => m.content && typeof m.content === 'string' && m.content.trim() && !(m as any).isTyping);
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
					conversationHistory: conversationHistory,
					conversationSummary: conversation.conversation_summary,
					workspaceContext: workspaceContextString,
					context: {
						projectId: projectId,
						scope: 'project'
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
					content: 'Creating tasks and notes...',
					isTyping: false
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

				// Reload data
				await loadData();

				// Show custom confirmation message
				let confirmMessage = 'Created ';
				const parts = [];
				if (taskCount > 0) parts.push(`${taskCount} task${taskCount > 1 ? 's' : ''}`);
				if (noteCount > 0) parts.push(`${noteCount} note${noteCount > 1 ? 's' : ''}`);
				confirmMessage += parts.join(' and ') + ' for you.';

				// Save AI response to database
				try {
					await addMessage(conversation!.id, 'assistant', confirmMessage);
				} catch (error) {
					console.error('Error saving AI message:', error);
				}

				messages[aiMessageIndex] = {
					role: 'ai',
					content: confirmMessage,
					actions: createdActions,
					isTyping: false
				};
				messages = messages;
			} else if (data.type === 'message') {
				// Save conversational AI response
				try {
					await addMessage(conversation!.id, 'assistant', data.message);
				} catch (error) {
					console.error('Error saving AI message:', error);
				}

				// Conversational response
				messages[aiMessageIndex] = {
					role: 'ai',
					content: data.message,
					isTyping: false
				};
				messages = messages;
			}
		} catch (error) {
			console.error('Error sending message:', error);
			messages[aiMessageIndex] = {
				role: 'ai',
				content: 'Sorry, I encountered an error processing your request. Please try again.',
				isTyping: false
			};
			messages = messages;
		} finally {
			isStreaming = false;
			scrollToBottom();
		}
	}

	$: todayTasks = tasks.filter(t => t.status !== 'completed' && isToday(t.due_date));
	$: thisWeekTasks = tasks.filter(t => t.status !== 'completed' && isThisWeek(t.due_date) && !isToday(t.due_date));
	$: laterTasks = tasks.filter(t => t.status !== 'completed' && !isToday(t.due_date) && !isThisWeek(t.due_date));
	$: completedTasks = tasks.filter(t => t.status === 'completed');
</script>

<AppLayout>
<div class="project-chat-page">
	<div class="project-container">
		<!-- Project Content Section (Tasks & Notes) -->
		<div class="content-section">
			<header class="section-header">
				{#if loading}
					<h1>Loading...</h1>
				{:else if project}
					<div class="title-group">
						<a href="/projects" class="back-btn">
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M12 4l-8 8 8 8"/>
							</svg>
						</a>
						<h1>{project.name}</h1>
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
			</header>

			{#if loading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Loading project...</p>
				</div>
			{:else if tasks.length === 0 && notes.length === 0}
				<div class="empty-state">
					<div class="project-icon-large">{project?.color || '📁'}</div>
					<h2>No tasks or notes yet</h2>
					<p>Use the chat to create tasks and notes for this project</p>
				</div>
			{:else}
				<div class="content-list">
					<!-- Tasks Section -->
					{#if tasks.length > 0}
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
												checked={false}
												on:change={() => handleToggleTask(task.id, task.status)}
											/>
											<div class="task-content" on:click={() => openTaskDetail(task)}>
												<div class="task-main">
													<span class="task-title">{truncateTitle(task.title)}</span>
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
												checked={false}
												on:change={() => handleToggleTask(task.id, task.status)}
											/>
											<div class="task-content" on:click={() => openTaskDetail(task)}>
												<div class="task-main">
													<span class="task-title">{truncateTitle(task.title)}</span>
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

							<!-- Later Section -->
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
												checked={false}
												on:change={() => handleToggleTask(task.id, task.status)}
											/>
											<div class="task-content" on:click={() => openTaskDetail(task)}>
												<div class="task-main">
													<span class="task-title">{truncateTitle(task.title)}</span>
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
						{:else}
							<!-- Completed Tasks -->
							{#if completedTasks.length > 0}
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
					{/if}

					<!-- Notes -->
					{#if notes.length > 0}
						<div class="content-group">
							<h2 class="group-title">Notes</h2>
							{#each notes as note (note.id)}
								<a href="/notes/{note.id}" class="note-card">
									<div class="note-header">
										<h3>{truncateTitle(note.title, 50)}</h3>
									</div>
									<p class="note-preview">{getContentPreview(note)}</p>
									<div class="note-footer">
										<span class="note-date">{formatDate(note.updated_at)}</span>
										<span class="note-meta">{getWordCount(note)} words</span>
									</div>
								</a>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Chat Section -->
		<div class="chat-section">
			<div class="chat-header">
				<div class="header-content">
					<div class="chat-title">
						<div class="project-icon-small">{project?.color || '📁'}</div>
						<div>
							<h2>Project Chat</h2>
							<p class="ai-subtitle">Plan and organize</p>
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

			<div class="messages" bind:this={messagesContainer} style:opacity={messagesReady ? '1' : '0'}>
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

			<form class="input-container" on:submit|preventDefault={() => sendMessage()}>
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
	</div>

	<!-- Mobile Layout -->
	<div class="mobile-content">
		<header class="mobile-header">
			<a href="/projects" class="back-btn">
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 4l-8 8 8 8"/>
				</svg>
			</a>
			{#if project}
				<div class="project-info-mobile">
					<div class="project-icon-small">{project.color || '📁'}</div>
					<h1>{truncateTitle(project.name, 30)}</h1>
				</div>
			{/if}
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
		</header>

		<div class="mobile-content-area">
			{#if loading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Loading project...</p>
				</div>
			{:else if tasks.length === 0 && notes.length === 0}
				<div class="empty-state">
					<div class="project-icon-large">{project?.color || '📁'}</div>
					<h2>No tasks or notes yet</h2>
					<p>Use the chat to create tasks and notes for this project</p>
				</div>
			{:else}
				<!-- Tasks Section -->
				{#if tasks.length > 0}
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
											checked={false}
											on:change={() => handleToggleTask(task.id, task.status)}
										/>
										<div class="task-content" on:click={() => openTaskDetail(task)}>
											<div class="task-main">
												<span class="task-title">{truncateTitle(task.title)}</span>
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
											checked={false}
											on:change={() => handleToggleTask(task.id, task.status)}
										/>
										<div class="task-content" on:click={() => openTaskDetail(task)}>
											<div class="task-main">
												<span class="task-title">{truncateTitle(task.title)}</span>
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

						<!-- Later Section -->
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
											checked={false}
											on:change={() => handleToggleTask(task.id, task.status)}
										/>
										<div class="task-content" on:click={() => openTaskDetail(task)}>
											<div class="task-main">
												<span class="task-title">{truncateTitle(task.title)}</span>
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
					{:else}
						<!-- Completed Tasks -->
						{#if completedTasks.length > 0}
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
				{/if}

				<!-- Notes -->
				{#if notes.length > 0}
					<div class="content-group">
						<h2 class="group-title">Notes</h2>
						{#each notes as note (note.id)}
							<a href="/notes/{note.id}" class="note-card">
								<div class="note-header">
									<h3>{truncateTitle(note.title, 50)}</h3>
								</div>
								<p class="note-preview">{getContentPreview(note)}</p>
								<div class="note-footer">
									<span class="note-date">{formatDate(note.updated_at)}</span>
									<span class="note-meta">{getWordCount(note)} words</span>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			{/if}
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
		messagesReady={messagesReady}
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
</div>
</AppLayout>

<style>
	.project-chat-page {
		min-height: 100vh;
		background: var(--bg-primary);
	}

	.project-container {
		display: flex;
		height: 100vh;
		overflow: hidden;
	}

	/* Mobile Layout (hidden on desktop) */
	.mobile-content {
		display: none;
	}

	/* Content Section (Tasks & Notes) */
	.content-section {
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

	.title-group {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.section-header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 250px;
	}

	.back-btn {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
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

	.content-list {
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

	.group-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.group-header .group-title {
		margin-bottom: 0;
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

	/* Task Items */
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
		text-decoration: none;
		color: var(--text-primary);
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
	}

	.task-title {
		font-size: 0.9375rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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

	/* Note Cards */
	.note-card {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 16px;
		margin-bottom: 12px;
		transition: all 0.2s ease;
		text-decoration: none;
		color: var(--text-primary);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.note-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		border-color: var(--accent-primary);
		background: var(--bg-secondary);
	}

	.note-header h3 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
		letter-spacing: -0.01em;
	}

	.note-preview {
		font-size: 0.875rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.note-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8125rem;
		color: var(--text-muted);
		padding-top: 8px;
		border-top: 1px solid var(--border-color);
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
	}

	.chat-loading-overlay {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
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

	/* Loading & Empty States */
	.loading-state,
	.empty-state {
		padding: 60px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 400px;
	}

	.loading-state p {
		color: var(--text-secondary);
		margin: 0;
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

	.delete-btn {
		padding: 10px 20px;
		background: transparent;
		border: 1px solid rgb(239, 68, 68);
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		color: rgb(239, 68, 68);
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.delete-btn:hover {
		background: rgba(239, 68, 68, 0.1);
	}

	/* Task Detail Modal Styles */
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
		font-size: 0.8125rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
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
		gap: 16px;
	}

	.due-status {
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	/* Form Styles for Edit Modal */
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}

	.form-group label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		padding: 10px 12px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
		transition: all 0.2s ease;
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
		min-height: 60px;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	/* Mobile Responsive */
	@media (max-width: 1023px) {
		/* Hide desktop layout */
		.project-container {
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
		}

		.mobile-header {
			flex-shrink: 0;
			padding: 16px 20px;
			background: var(--bg-secondary);
			border-bottom: 1px solid var(--border-color);
			height: 64px;
			box-sizing: border-box;
			display: flex;
			align-items: center;
			gap: 12px;
		}

		.project-info-mobile {
			flex: 1;
			display: flex;
			align-items: center;
			gap: 12px;
			min-width: 0;
		}

		.project-info-mobile h1 {
			font-size: 1.25rem;
			font-weight: 700;
			letter-spacing: -0.02em;
			margin: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.mobile-content-area {
			flex: 1;
			overflow-y: auto;
			-webkit-overflow-scrolling: touch;
			padding: 20px;
			background: var(--bg-secondary);
		}
	}
</style>
