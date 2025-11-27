<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import TaskList from '$lib/components/TaskList.svelte';
	import UnifiedChatPage from '$lib/components/UnifiedChatPage.svelte';
	import SideBySideLayout from '$lib/components/SideBySideLayout.svelte';
	import MobileUserMenu from '$lib/components/MobileUserMenu.svelte';
	import TaskDetailModal from '$lib/components/TaskDetailModal.svelte';
	import TaskEditModal from '$lib/components/TaskEditModal.svelte';
	import { getTasks, createTask, toggleTaskComplete, updateTask, deleteTask, deleteOldCompletedTasks } from '$lib/db/tasks';
	import { getProjects } from '$lib/db/projects';
	import type { Task, Project } from '@chatkin/types';
	import { onMount } from 'svelte';
	import { notificationCounts } from '$lib/stores/notifications';
	import { goto } from '$app/navigation';
	import { handleError } from '$lib/utils/error-handler';
	import { logger } from '$lib/utils/logger';

	let tasks: Task[] = [];
	let projects: Project[] = [];
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
	let selectedTask: Task | null = null;

	// Edit modal state
	let showEditTaskModal = false;
	let editingTask: Task | null = null;

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
			handleError(error, { operation: 'Delete old completed tasks', component: 'TasksPage' });
		}

		await loadData();
	});

	async function loadData() {
		loading = true;
		try {
			[tasks, projects] = await Promise.all([getTasks(), getProjects()]);
		} catch (error) {
			handleError(error, { operation: 'Load tasks and projects', component: 'TasksPage' });
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
			handleError(error, { operation: 'Create task', component: 'TasksPage' });
		}
	}

	async function handleToggleTask(taskId: string, currentStatus: string) {
		try {
			const completed = currentStatus !== 'completed';
			await toggleTaskComplete(taskId, completed);
			await loadData();
		} catch (error) {
			handleError(error, { operation: 'Toggle task completion', component: 'TasksPage' });
		}
	}

	function openTaskDetail(task: Task) {
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
			handleError(error, { operation: 'Delete task', component: 'TasksPage' });
		}
	}

	async function handleUpdateTask(updatedTask: Partial<Task>) {
		if (!editingTask) return;

		try {
			await updateTask(editingTask.id, updatedTask);
			showEditTaskModal = false;
			await loadData();
		} catch (error) {
			handleError(error, { operation: 'Update task', component: 'TasksPage' });
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
			handleError(error, { operation: 'Delete task', component: 'TasksPage' });
		}
	}

	function toggleShowCompleted() {
		showCompletedTasks = !showCompletedTasks;
		localStorage.setItem('showCompletedTasks', String(showCompletedTasks));
	}

	// Callback for when UnifiedChatPage completes operations
	async function handleOperationsComplete() {
		logger.info('AI operations completed, refreshing task list');
		await loadData();
	}
</script>

<AppLayout>
	<div class="tasks-page">
		<!-- DESKTOP: Side-by-side layout (hidden on mobile) -->
		<SideBySideLayout leftPanelClass="tasks-panel" rightPanelClass="chat-panel">
			<svelte:fragment slot="left">
				<TaskList
					{tasks}
					{projects}
					{loading}
					{showCompletedTasks}
					showHeader={true}
					onToggleTask={handleToggleTask}
					onTaskClick={openTaskDetail}
					onCreateTask={() => (showNewTaskModal = true)}
					onToggleShowCompleted={toggleShowCompleted}
				/>
			</svelte:fragment>

			<svelte:fragment slot="right">
				<UnifiedChatPage
					scope="tasks"
					pageTitle="Tasks AI"
					welcomeMessage="✓ Hi! I can help you manage your tasks. What would you like to work on?"
					onDataChange={handleOperationsComplete}
				/>
			</svelte:fragment>
		</SideBySideLayout>

		<!-- MOBILE: List only with FAB (shown only on mobile) -->
		<div class="mobile-content">
			<header class="mobile-header">
				<div class="mobile-header-left">
					<button class="mobile-logo-button">
						<img src="/logo.webp" alt="Chatkin" class="mobile-logo" />
					</button>
					<h1>Tasks</h1>
				</div>
				<MobileUserMenu />
			</header>

			<div class="mobile-tasks">
				<TaskList
					{tasks}
					{projects}
					{loading}
					{showCompletedTasks}
					showHeader={false}
					onToggleTask={handleToggleTask}
					onTaskClick={openTaskDetail}
					onToggleShowCompleted={toggleShowCompleted}
				/>
			</div>
		</div>

		<!-- New Task Modal -->
		{#if showNewTaskModal}
			<div class="modal-overlay" on:click={() => (showNewTaskModal = false)} on:keydown={(e) => e.key === 'Escape' && (showNewTaskModal = false)}>
				<div class="modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" aria-labelledby="modal-title">
					<h2 id="modal-title">Create New Task</h2>
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
								<input type="date" id="task-due-date" bind:value={newTaskDueDate} />
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
							<button type="button" class="secondary-btn" on:click={() => (showNewTaskModal = false)}>
								Cancel
							</button>
							<button type="submit" class="primary-btn"> Create Task </button>
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
			onClose={() => (showTaskDetailModal = false)}
			onEdit={openEditFromDetail}
			onDelete={handleDeleteFromDetail}
		/>

		<TaskEditModal
			show={showEditTaskModal}
			task={editingTask}
			projects={projects}
			onClose={() => (showEditTaskModal = false)}
			onSave={handleUpdateTask}
			onDelete={handleDeleteTask}
		/>

		<!-- Floating Action Button with Menu (Mobile Only) -->
		<div class="fab-container">
			{#if showFabMenu}
				<div class="fab-menu">
					<button
						class="fab-menu-item"
						on:click={() => {
							showNewTaskModal = true;
							showFabMenu = false;
						}}
					>
						<svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M15 3l2 2-9 9-4 1 1-4 9-9z" />
						</svg>
						<span>Quick Add</span>
					</button>
					<button class="fab-menu-item" on:click={() => goto('/tasks/chat')}>
						<svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor">
							<path d="M10 2l1.5 3.5L15 7l-3.5 1.5L10 12l-1.5-3.5L5 7l3.5-1.5L10 2z" />
							<path d="M5 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
							<path d="M15 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
						</svg>
						<span>Create with AI</span>
					</button>
				</div>
			{/if}
			<button class="fab" on:click={() => (showFabMenu = !showFabMenu)} aria-label="Create options">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<path d="M12 5v14M5 12h14" />
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

	/* Mobile Layout (hidden on desktop) */
	.mobile-content {
		display: none;
	}

	@media (max-width: 1023px) {
		.mobile-content {
			display: flex;
			flex-direction: column;
			height: 100vh;
			overflow: hidden;
		}
	}

	.mobile-header {
		flex-shrink: 0;
		padding: 12px 16px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 60px;
		box-sizing: border-box;
	}

	.mobile-header-left {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.mobile-logo-button {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		display: flex;
		align-items: center;
	}

	.mobile-logo {
		width: 32px;
		height: 32px;
		border-radius: 8px;
	}

	.mobile-header h1 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
	}

	.mobile-tasks {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		padding-bottom: 100px;
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
		max-height: 90vh;
		overflow-y: auto;
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
		margin-bottom: 6px;
		color: var(--text-primary);
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		width: 100%;
		padding: 10px 12px;
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
	}

	.primary-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.primary-btn:active {
		transform: translateY(0);
	}

	/* FAB */
	.fab-container {
		display: none;
		position: fixed;
		bottom: 24px;
		right: 24px;
		z-index: 100;
	}

	@media (max-width: 1023px) {
		.fab-container {
			display: block;
		}
	}

	.fab-menu {
		position: absolute;
		bottom: 70px;
		right: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 180px;
	}

	.fab-menu-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 18px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		color: var(--text-primary);
		font-weight: 500;
		font-size: 0.9375rem;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		transition: all 0.2s ease;
	}

	.fab-menu-item:hover {
		background: var(--bg-tertiary);
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	}

	.fab-menu-item:active {
		transform: translateY(0);
	}

	.fab {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--accent-primary);
		border: none;
		color: white;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.fab:hover {
		background: var(--accent-hover);
		transform: scale(1.05);
	}

	.fab:active {
		transform: scale(0.95);
	}
</style>
