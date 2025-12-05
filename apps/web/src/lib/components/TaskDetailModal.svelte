<script lang="ts">
	/* eslint-disable @typescript-eslint/no-explicit-any */
	import type { Task } from '@chatkin/types';
	import { formatRecurrencePattern, updateTask } from '$lib/db/tasks';
	import { handleError } from '$lib/utils/error-handler';

	export let show = false;
	export let task: Task | null = null;
	export let onClose: () => void;
	export let onEdit: () => void;
	export let onDelete: () => void;
	export let onUpdate: () => void = () => {};

	// Inline editing state
	let autosaveTimeout: number | null = null;
	let titleElement: HTMLElement;
	let descriptionElement: HTMLElement;

	// Inline editing functions
	function handleTitleInput() {
		scheduleAutosave();
	}

	function handleDescriptionInput() {
		scheduleAutosave();
	}

	function scheduleAutosave() {
		if (autosaveTimeout) {
			clearTimeout(autosaveTimeout);
		}
		autosaveTimeout = window.setTimeout(async () => {
			await saveInlineChanges();
		}, 500);
	}

	async function saveInlineChanges() {
		if (!task || !titleElement) return;

		try {
			const newTitle = titleElement.innerText.trim();
			const newDescription = descriptionElement?.innerText.trim() || '';

			const updates: any = {};

			// Update title if changed
			if (newTitle && newTitle !== task.title) {
				updates.title = newTitle;
			}

			// Update description if changed
			if (descriptionElement && newDescription !== (task.description || '')) {
				updates.description = newDescription || null;
			}

			// Only update if there are changes
			if (Object.keys(updates).length > 0) {
				await updateTask(task.id, updates);
				// Update local task object
				if (updates.title) task.title = updates.title;
				if ('description' in updates) task.description = updates.description;
				onUpdate();
			}
		} catch (error) {
			handleError(error, { operation: 'Autosave task', component: 'TaskDetailModal' });
		}
	}

	async function handlePriorityChange(event: Event) {
		if (!task) return;
		const newPriority = (event.target as HTMLSelectElement).value as 'low' | 'medium' | 'high';
		try {
			await updateTask(task.id, { priority: newPriority });
			task.priority = newPriority;
			onUpdate();
		} catch (error) {
			handleError(error, { operation: 'Update task priority', component: 'TaskDetailModal' });
		}
	}

	async function handleStatusChange(event: Event) {
		if (!task) return;
		const newStatus = (event.target as HTMLSelectElement).value as 'todo' | 'in_progress' | 'completed';
		try {
			await updateTask(task.id, { status: newStatus });
			task.status = newStatus;
			onUpdate();
		} catch (error) {
			handleError(error, { operation: 'Update task status', component: 'TaskDetailModal' });
		}
	}

	async function handleDueDateChange(event: Event) {
		if (!task) return;
		const newDate = (event.target as HTMLInputElement).value;
		try {
			await updateTask(task.id, { due_date: newDate || null });
			task.due_date = newDate || null;
			onUpdate();
		} catch (error) {
			handleError(error, { operation: 'Update task due date', component: 'TaskDetailModal' });
		}
	}
</script>

{#if show && task}
	<div class="modal-overlay" on:click={onClose}>
		<div class="modal" on:click|stopPropagation>
			<h2>Task Details</h2>
			<div class="task-detail-content">
				<div class="detail-section">
					<label>Title</label>
					<p
						bind:this={titleElement}
						contenteditable="true"
						on:input={handleTitleInput}
						class="detail-text editable"
					>
						{task.title}
					</p>
				</div>

				<div class="detail-section">
					<label>Description</label>
					<p
						bind:this={descriptionElement}
						contenteditable="true"
						on:input={handleDescriptionInput}
						class="detail-text editable description-field"
					>
						{task.description || ''}
					</p>
				</div>

				<div class="detail-row">
					<div class="detail-section">
						<label>Priority</label>
						<select class="priority-select {task.priority}" value={task.priority} on:change={handlePriorityChange}>
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
						</select>
					</div>

					<div class="detail-section">
						<label>Status</label>
						<select class="status-select" value={task.status} on:change={handleStatusChange}>
							<option value="todo">To Do</option>
							<option value="in_progress">In Progress</option>
							<option value="completed">Completed</option>
						</select>
					</div>
				</div>

				<div class="detail-section">
					<label>Due Date</label>
					<input
						type="date"
						class="date-input"
						value={task.due_date || ''}
						on:change={handleDueDateChange}
					/>
				</div>

				{#if task.domain}
					<div class="detail-section">
						<label>Domain</label>
						<p class="detail-text">{task.domain}</p>
					</div>
				{/if}

				{#if task.is_recurring && task.recurrence_pattern}
					<div class="detail-section recurrence-info">
						<label>
							<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" style="display: inline; margin-right: 4px;">
								<path d="M11 3.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0z M6.5 10v2.5M9 12.5 6.5 10 4 12.5"/>
							</svg>
							Repeats
						</label>
						<p class="detail-text recurrence-pattern">
							{formatRecurrencePattern(task.recurrence_pattern)}
						</p>
						{#if task.recurrence_end_date}
							<p class="detail-text recurrence-end">
								Until {new Date(task.recurrence_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
							</p>
						{/if}
					</div>
				{/if}

				{#if task.parent_task_id}
					<div class="detail-section">
						<label>Recurring Task Instance</label>
						<p class="detail-text">This is part of a recurring task series</p>
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

	.detail-text.editable {
		outline: none;
		cursor: text;
		padding: 8px;
		border-radius: var(--radius-sm);
		transition: background 0.2s ease;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.detail-text.editable:hover {
		background: var(--bg-tertiary);
	}

	.detail-text.editable:focus {
		outline: none;
		background: var(--bg-tertiary);
	}

	.detail-text.editable.description-field {
		min-height: 60px;
	}

	.detail-text.editable.description-field:empty:before {
		content: 'Add a description...';
		color: var(--text-secondary);
		opacity: 0.5;
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

	.priority-select,
	.status-select {
		padding: 8px 32px 8px 12px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
		cursor: pointer;
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
		transition: all 0.2s ease;
	}

	.priority-select:hover,
	.status-select:hover {
		background-color: var(--bg-tertiary);
	}

	.priority-select:focus,
	.status-select:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	.priority-select.high {
		background-color: rgba(211, 47, 47, 0.1);
		color: rgb(211, 47, 47);
		font-weight: 600;
	}

	.priority-select.medium {
		background-color: rgba(245, 158, 11, 0.1);
		color: rgb(245, 158, 11);
		font-weight: 600;
	}

	.priority-select.low {
		background-color: rgba(115, 115, 115, 0.1);
		color: var(--text-secondary);
		font-weight: 600;
	}

	.date-input {
		padding: 8px 12px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.date-input:hover {
		background-color: var(--bg-tertiary);
	}

	.date-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	.due-status {
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.due-time {
		color: var(--text-primary);
		font-weight: 500;
		margin-left: 4px;
	}

	.recurrence-info {
		background: var(--bg-tertiary);
		padding: 12px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
	}

	.recurrence-pattern {
		font-weight: 500;
		color: var(--accent-primary);
	}

	.recurrence-end {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		margin-top: 4px;
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
