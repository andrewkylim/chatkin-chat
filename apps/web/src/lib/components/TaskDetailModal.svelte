<script lang="ts">
	import type { Task, Project } from '@chatkin/types';

	export let show = false;
	export let task: Task | null = null;
	export let projects: Project[] = [];
	export let onClose: () => void;
	export let onEdit: () => void;
	export let onDelete: () => void;

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

	function getProjectName(projectId: string | null) {
		if (!projectId) return null;
		const project = projects.find(p => p.id === projectId);
		return project?.name;
	}
</script>

{#if show && task}
	<div class="modal-overlay" on:click={onClose}>
		<div class="modal" on:click|stopPropagation>
			<h2>Task Details</h2>
			<div class="task-detail-content">
				<div class="detail-section">
					<label>Title</label>
					<p class="detail-text">{task.title}</p>
				</div>

				{#if task.description}
					<div class="detail-section">
						<label>Description</label>
						<p class="detail-text">{task.description}</p>
					</div>
				{/if}

				<div class="detail-row">
					<div class="detail-section">
						<label>Priority</label>
						<span class="priority {task.priority}">{task.priority}</span>
					</div>

					<div class="detail-section">
						<label>Status</label>
						<p class="detail-text">{task.status === 'completed' ? 'Completed' : 'To Do'}</p>
					</div>
				</div>

				<div class="detail-section">
					<label>Due Date</label>
					{#if task.due_date}
						<p class="detail-text">
							{new Date(task.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
							{#if formatDueDate(task.due_date) !== 'No due date'}
								<span class="due-status">({formatDueDate(task.due_date)})</span>
							{/if}
						</p>
					{:else}
						<p class="detail-text">No due date</p>
					{/if}
				</div>

				{#if getProjectName(task.project_id)}
					<div class="detail-section">
						<label>Project</label>
						<p class="detail-text">{getProjectName(task.project_id)}</p>
					</div>
				{/if}
			</div>

			<div class="modal-actions">
				<button type="button" class="delete-btn" on:click={onDelete}>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M2 4h12M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4m2 0v9.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V4"/>
					</svg>
					<span class="btn-text">Delete</span>
				</button>
				<div style="flex: 1;"></div>
				<button type="button" class="secondary-btn" on:click={onClose}>
					Close
				</button>
				<button type="button" class="primary-btn" on:click={onEdit}>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11.5 2l2.5 2.5L6 12.5H3.5V10L11.5 2z"/>
					</svg>
					<span class="btn-text">Edit</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
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
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 24px;
		max-width: 500px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal h2 {
		margin-bottom: 20px;
		font-size: 1.25rem;
	}

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

	.priority {
		display: inline-block;
		padding: 4px 12px;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		width: fit-content;
	}

	.priority.high {
		background: rgba(211, 47, 47, 0.1);
		color: rgb(211, 47, 47);
	}

	.priority.medium {
		background: rgba(245, 158, 11, 0.1);
		color: rgb(245, 158, 11);
	}

	.priority.low {
		background: rgba(115, 115, 115, 0.1);
		color: var(--text-secondary);
	}

	.due-status {
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		align-items: center;
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

	/* Mobile: Hide button text, show only icons */
	@media (max-width: 640px) {
		.delete-btn .btn-text,
		.primary-btn .btn-text {
			display: none;
		}

		.delete-btn,
		.primary-btn {
			padding: 10px 12px;
		}
	}
</style>
