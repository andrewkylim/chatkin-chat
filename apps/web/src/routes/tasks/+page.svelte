<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import MobileUserMenu from '$lib/components/MobileUserMenu.svelte';
	import TaskEditModal from '$lib/components/TaskEditModal.svelte';
	import UnifiedChatPage from '$lib/components/UnifiedChatPage.svelte';
	import RecurrencePatternPicker from '$lib/components/RecurrencePatternPicker.svelte';
	import { getTasks, deleteOldCompletedTasks } from '$lib/db/tasks';
	import { useTasks } from '$lib/logic/useTasks';
	import { getProjectName } from '$lib/utils/formatters';
	import type { Task, WellnessDomain, RecurrencePattern } from '@chatkin/types';
	import { onMount } from 'svelte';
	import { notificationCounts } from '$lib/stores/notifications';
	import { goto } from '$app/navigation';
	import { handleError } from '$lib/utils/error-handler';

	// Domain-based task management
	const domains: WellnessDomain[] = ['Body', 'Mind', 'Purpose', 'Connection', 'Growth', 'Finance'];

	let tasks: Task[] = [];
	let loading = true;
	let showNewTaskModal = false;
	let showFabMenu = false;
	let newTaskTitle = '';
	let newTaskDescription = '';
	let newTaskPriority = 'medium';
	let newTaskDueDate = '';
	let newTaskDomain: WellnessDomain = 'Mind';
	let newTaskIsRecurring = false;
	let newTaskRecurrencePattern: RecurrencePattern = {
		frequency: 'daily',
		interval: 1
	};
	let newTaskRecurrenceEndDate = '';
	let newTaskDueTime = '09:00';
	let newTaskIsAllDay = true;
	let showCompletedTasks = false;

	// Edit modal state
	let showEditTaskModal = false;
	let editingTask: Task | null = null;

	// Get task utilities and actions
	$: ({
		formatDueDate,
		categorize,
		createTask,
		toggleTask,
		updateTask,
		deleteTask,
		loadCompletedPreference,
		saveCompletedPreference
	} = useTasks());

	onMount(async () => {
		// Set current section and clear notification count
		notificationCounts.setCurrentSection('tasks');
		notificationCounts.clearCount('tasks');

		// Delete completed tasks older than 30 days
		try {
			await deleteOldCompletedTasks();
		} catch (error) {
			handleError(error, { operation: 'Delete old completed tasks', component: 'TasksPage' });
		}

		await loadData();

		// Load show completed preference from localStorage
		// Only restore "show completed" if there are no active tasks
		const savedPreference = loadCompletedPreference();
		const hasActiveTasks = tasks.some(t => t.status !== 'completed');
		if (savedPreference && !hasActiveTasks) {
			showCompletedTasks = true;
		} else {
			showCompletedTasks = false;
		}
	});

	async function loadData() {
		loading = true;
		try {
			tasks = await getTasks();
		} catch (error) {
			handleError(error, { operation: 'Load tasks', component: 'TasksPage' });
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
				priority: newTaskPriority as 'low' | 'medium' | 'high',
				due_date: newTaskDueDate || null,
				is_all_day: newTaskIsAllDay,
				due_time: newTaskIsAllDay ? null : newTaskDueTime,
				project_id: null,
				domain: newTaskDomain,
				status: 'todo',
				is_recurring: newTaskIsRecurring,
				recurrence_pattern: newTaskIsRecurring ? newTaskRecurrencePattern : null,
				recurrence_end_date: newTaskIsRecurring && newTaskRecurrenceEndDate ? newTaskRecurrenceEndDate : null,
				parent_task_id: null
			});

			// Reset form
			newTaskTitle = '';
			newTaskDescription = '';
			newTaskPriority = 'medium';
			newTaskDueDate = '';
			newTaskDueTime = '09:00';
			newTaskIsAllDay = true;
			newTaskDomain = 'Mind';
			newTaskIsRecurring = false;
			newTaskRecurrencePattern = {
				frequency: 'daily',
				interval: 1
			};
			newTaskRecurrenceEndDate = '';
			showNewTaskModal = false;

			// Reload tasks
			await loadData();
		} catch {
			// Error already handled by createTask action
		}
	}

	async function handleToggleTask(taskId: string, currentStatus: string) {
		try {
			await toggleTask(taskId, currentStatus);
			await loadData();
		} catch {
			// Error already handled by toggleTask action
		}
	}

	function openTaskDetail(task: Task) {
		editingTask = task;
		showEditTaskModal = true;
	}

	async function handleUpdateTask(updatedTask: Partial<Task>) {
		if (!editingTask) return;

		try {
			await updateTask(editingTask.id, updatedTask);
			showEditTaskModal = false;
			await loadData();
		} catch {
			// Error already handled by updateTask action
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
		} catch {
			// Error already handled by deleteTask action
		}
	}

	// Categorize tasks using the helper
	$: ({ todayTasks, thisWeekTasks, laterTasks, completedTasks } = categorize(tasks));

	function toggleShowCompleted() {
		showCompletedTasks = !showCompletedTasks;
		saveCompletedPreference(showCompletedTasks);
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
			{:else if todayTasks.length === 0 && thisWeekTasks.length === 0 && laterTasks.length === 0 && completedTasks.length === 0}
				<div class="empty-state">
					<img src="/tasks.svg" alt="Tasks" class="empty-icon" />
					<h2>No tasks yet</h2>
					<p>Create your first task to get started</p>
				</div>
			{:else}
				<div class="tasks-list">
					{#if !showCompletedTasks || completedTasks.length === 0}
					<!-- Today Section -->
					{#if todayTasks.length > 0 || (todayTasks.length === 0 && thisWeekTasks.length === 0 && laterTasks.length === 0 && completedTasks.length > 0)}
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
											<span class="task-title">{task.title}</span>
											{#if task.domain}
												<span class="task-project">{task.domain}</span>
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
											<span class="task-title">{task.title}</span>
											{#if task.domain}
												<span class="task-project">{task.domain}</span>
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
											<span class="task-title">{task.title}</span>
											{#if task.domain}
												<span class="task-project">{task.domain}</span>
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

					<!-- Fallback when all tasks are completed -->
					{#if todayTasks.length === 0 && thisWeekTasks.length === 0 && laterTasks.length === 0 && completedTasks.length > 0}
						<div class="empty-state">
							<svg class="completion-icon" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M9 11l3 3L22 4"></path>
								<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
							</svg>
							<h2>All tasks completed!</h2>
							<p>Great work! You've completed all your tasks.</p>
							<button class="toggle-link" on:click={toggleShowCompleted}>Show Completed Tasks</button>
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
											<span class="task-title">{task.title}</span>
											{#if task.domain}
												<span class="task-project">{task.domain}</span>
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
			<UnifiedChatPage
				scope="tasks"
				pageTitle="Tasks AI"
				pageIcon="/tasks.svg"
				pageSubtitle="Your task management assistant"
				welcomeMessage="✓ Hi! I can help you manage your tasks. What would you like to work on?"
				onDataChange={loadData}
				isEmbedded={true}
			/>
		</div>
	</div>

	<!-- Mobile Layout (matches Chat structure) -->
	<div class="mobile-content">
		<header class="mobile-header">
			<div class="mobile-header-left">
				<a href="/chat" class="mobile-logo-button">
					<img src="/logo.svg" alt="Chatkin" class="mobile-logo" />
				</a>
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
			{:else if todayTasks.length === 0 && thisWeekTasks.length === 0 && laterTasks.length === 0 && completedTasks.length === 0}
				<div class="empty-state">
					<img src="/tasks.svg" alt="Tasks" class="empty-icon" />
					<h2>No tasks yet</h2>
					<p>Create your first task to get started</p>
				</div>
			{:else}
				{#if !showCompletedTasks || completedTasks.length === 0}
				<!-- Today Section -->
				{#if todayTasks.length > 0 || (todayTasks.length === 0 && thisWeekTasks.length === 0 && laterTasks.length === 0 && completedTasks.length > 0)}
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
										<span class="task-title">{task.title}</span>
										{#if task.domain}
											<span class="task-project">{task.domain}</span>
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
										<span class="task-title">{task.title}</span>
										{#if task.domain}
											<span class="task-project">{task.domain}</span>
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
										<span class="task-title">{task.title}</span>
										{#if task.domain}
											<span class="task-project">{task.domain}</span>
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

				<!-- Fallback when all tasks are completed -->
				{#if todayTasks.length === 0 && thisWeekTasks.length === 0 && laterTasks.length === 0 && completedTasks.length > 0 && !showCompletedTasks}
					<div class="empty-state">
						<svg class="completion-icon" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M9 11l3 3L22 4"></path>
							<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
						</svg>
						<h2>All tasks completed!</h2>
						<p>Great work! You've completed all your tasks.</p>
						<button class="toggle-link" on:click={toggleShowCompleted}>Show Completed Tasks</button>
					</div>
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
										<span class="task-title">{task.title}</span>
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

					{#if newTaskDueDate}
						<div class="form-group">
							<label class="checkbox-label">
								<input
									type="checkbox"
									bind:checked={newTaskIsAllDay}
								/>
								<span>All-day task</span>
							</label>
						</div>

						{#if !newTaskIsAllDay}
							<div class="form-group">
								<label for="task-due-time">Due Time</label>
								<input
									type="time"
									id="task-due-time"
									bind:value={newTaskDueTime}
								/>
							</div>
						{/if}
					{/if}

					<div class="form-group">
						<label for="task-domain">Domain</label>
						<select id="task-domain" bind:value={newTaskDomain}>
							{#each domains as domain}
								<option value={domain}>{domain}</option>
							{/each}
						</select>
					</div>

					<!-- Recurrence Options -->
					<div class="form-group">
						<label class="checkbox-label">
							<input
								type="checkbox"
								bind:checked={newTaskIsRecurring}
							/>
							<span>Repeat this task</span>
						</label>
					</div>

					{#if newTaskIsRecurring}
						<div class="recurrence-section">
							<RecurrencePatternPicker bind:pattern={newTaskRecurrencePattern} />

							<div class="form-group">
								<label for="new-task-recurrence-end-date">End date (optional)</label>
								<input
									type="date"
									id="new-task-recurrence-end-date"
									bind:value={newTaskRecurrenceEndDate}
								/>
							</div>
						</div>
					{/if}

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
	<TaskEditModal
		show={showEditTaskModal}
		task={editingTask}
		onClose={() => showEditTaskModal = false}
		onSave={handleUpdateTask}
		onDelete={handleDeleteTask}
	/>

	<!-- Floating Action Buttons (Mobile Only) -->
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
		<!-- Chat FAB -->
		<a class="fab fab-chat" href="/tasks/chat" aria-label="Chat with AI">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
			</svg>
		</a>
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
		min-width: 0;
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
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.task-group {
		margin-bottom: 32px;
		min-width: 0;
		display: flex;
		flex-direction: column;
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
		min-width: 0;
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
		min-width: 0;
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
		width: 0;
		padding-right: 16px;
		overflow: hidden;
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
		background-color: #1e40af;
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
		0%, 60%, 100% {
			transform: translateY(0);
		}
		30% {
			transform: translateY(-8px);
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
		max-height: 85vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.modal h2 {
		flex-shrink: 0;
		font-size: 1.5rem;
		margin-bottom: 20px;
	}

	.modal form {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
		padding-bottom: 8px;
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
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
	}

	.form-group select {
		cursor: pointer;
		padding-right: 36px;
		background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
		background-color: var(--bg-secondary);
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

	.checkbox-label {
		display: inline-flex;
		align-items: center;
		gap: 16px;
		cursor: pointer;
		font-size: 0.9375rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.checkbox-label input[type='checkbox'] {
		width: 20px;
		height: 20px;
		cursor: pointer;
		accent-color: var(--accent-primary);
		margin: 0;
		margin-right: 4px;
		padding: 0;
		flex-shrink: 0;
		vertical-align: middle;
		border: 2px solid var(--border-color);
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.checkbox-label input[type='checkbox']:checked {
		background-color: var(--accent-primary);
		border-color: var(--accent-primary);
	}

	.checkbox-label input[type='checkbox']:hover {
		border-color: var(--accent-primary);
	}

	.checkbox-label span {
		line-height: 1.2;
		padding-left: 2px;
	}

	.recurrence-section {
		padding: 16px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		margin-bottom: 16px;
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
			width: 48px;
			height: 48px;
			border-radius: 8px;
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
				display: flex;
				gap: 12px;
				position: fixed;
				bottom: 80px;
				left: 27px;
				z-index: 500;
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
				text-decoration: none;
			}

			.fab-chat {
				background: #2563eb;
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

	.completion-icon {
		color: #6B9B6E;
		margin-bottom: 16px;
	}
</style>
