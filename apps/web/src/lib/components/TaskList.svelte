<script lang="ts">
	import type { Task } from '@chatkin/types';
	import { formatDueDateTime, isToday, isThisWeek } from '$lib/utils/formatters';

	export let tasks: Task[] = [];
	export let loading: boolean = false;
	export let showCompletedTasks: boolean = true;
	export let showHeader: boolean = true;
	export let onToggleTask: (taskId: string, currentStatus: string) => void;
	export let onTaskClick: (task: Task) => void;
	export let onCreateTask: (() => void) | undefined = undefined;
	export let onToggleShowCompleted: () => void;

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
</script>

<div class="task-list-container">
	{#if showHeader}
		<header class="section-header">
			<h1>Tasks</h1>
			<div class="header-actions">
				{#if onCreateTask}
					<button class="primary-btn" on:click={onCreateTask}>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M8 2v12M2 8h12"/>
						</svg>
						New Task
					</button>
				{/if}
			</div>
		</header>
	{/if}

	<div class="task-list-content">
		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading tasks...</p>
			</div>
		{:else if todayTasks.length === 0 && thisWeekTasks.length === 0 && laterTasks.length === 0 && completedTasks.length === 0}
			<div class="empty-state">
				<img src="/tasks.webp" alt="Tasks" class="empty-icon" />
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
									<button class="toggle-link" on:click={onToggleShowCompleted}>Show Completed</button>
								{/if}
							</div>
							{#each todayTasks as task (task.id)}
								<div class="task-item">
									<input
										type="checkbox"
										class="task-checkbox"
										id={task.id}
										checked={task.status === 'completed'}
										on:change={() => onToggleTask(task.id, task.status)}
									/>
									<div class="task-content" class:completed={task.status === 'completed'} on:click={() => onTaskClick(task)} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && onTaskClick(task)}>
										<div class="task-main">
											<span class="task-title">{task.title}</span>
											{#if task.domain}
												<span class="task-project">{task.domain}</span>
											{/if}
										</div>
										<div class="task-meta">
											<span class="priority {task.priority}">{task.priority}</span>
											<span class="task-time">{formatDueDateTime(task.due_date, task.due_time, task.is_all_day)}</span>
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
									<button class="toggle-link" on:click={onToggleShowCompleted}>Show Completed</button>
								{/if}
							</div>
							{#each thisWeekTasks as task (task.id)}
								<div class="task-item">
									<input
										type="checkbox"
										class="task-checkbox"
										id={task.id}
										checked={task.status === 'completed'}
										on:change={() => onToggleTask(task.id, task.status)}
									/>
									<div class="task-content" class:completed={task.status === 'completed'} on:click={() => onTaskClick(task)} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && onTaskClick(task)}>
										<div class="task-main">
											<span class="task-title">{task.title}</span>
											{#if task.domain}
												<span class="task-project">{task.domain}</span>
											{/if}
										</div>
										<div class="task-meta">
											<span class="priority {task.priority}">{task.priority}</span>
											<span class="task-time">{formatDueDateTime(task.due_date, task.due_time, task.is_all_day)}</span>
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
									<button class="toggle-link" on:click={onToggleShowCompleted}>Show Completed</button>
								{/if}
							</div>
							{#each laterTasks as task (task.id)}
								<div class="task-item">
									<input
										type="checkbox"
										class="task-checkbox"
										id={task.id}
										checked={task.status === 'completed'}
										on:change={() => onToggleTask(task.id, task.status)}
									/>
									<div class="task-content" class:completed={task.status === 'completed'} on:click={() => onTaskClick(task)} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && onTaskClick(task)}>
										<div class="task-main">
											<span class="task-title">{task.title}</span>
											{#if task.domain}
												<span class="task-project">{task.domain}</span>
											{/if}
										</div>
										<div class="task-meta">
											<span class="priority {task.priority}">{task.priority}</span>
											<span class="task-time">{formatDueDateTime(task.due_date, task.due_time, task.is_all_day)}</span>
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
							<button class="toggle-link" on:click={onToggleShowCompleted}>Show All Tasks</button>
						</div>
						{#each completedTasks as task (task.id)}
							<div class="task-item">
								<input
									type="checkbox"
									class="task-checkbox"
									id={task.id}
									checked={true}
									on:change={() => onToggleTask(task.id, task.status)}
								/>
								<div class="task-content completed" on:click={() => onTaskClick(task)} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && onTaskClick(task)}>
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
</div>

<style>
	.task-list-container {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.section-header {
		flex-shrink: 0;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-color);
		height: 64px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--bg-secondary);
	}

	.section-header h1 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0;
	}

	.header-actions {
		display: flex;
		gap: 12px;
	}

	.primary-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: var(--accent-primary);
		border: none;
		border-radius: var(--radius-md);
		color: white;
		font-weight: 600;
		font-size: 0.875rem;
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

	.task-list-content {
		flex: 1;
		overflow-y: auto;
		padding: 24px 20px;
	}

	.tasks-list {
		max-width: 800px;
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
		margin: 0;
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

	.loading-state,
	.empty-state {
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
		to {
			transform: rotate(360deg);
		}
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

	.empty-active-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 0;
		gap: 16px;
		color: var(--text-secondary);
	}

	.empty-active-state p {
		margin: 0;
		font-size: 0.9375rem;
	}
</style>
