<script lang="ts">
	import type { Task, Project, RecurrencePattern } from '@chatkin/types';
	import RecurrencePatternPicker from './RecurrencePatternPicker.svelte';

	export let show = false;
	export let task: Task | null = null;
	export let projects: Project[] = [];
	export let onClose: () => void;
	export let onSave: (updatedTask: Partial<Task>) => void;
	export let onDelete: () => void;

	let editTaskTitle = '';
	let editTaskDescription = '';
	let editTaskPriority = 'medium';
	let editTaskDueDate = '';
	let editTaskProjectId: string | null = null;
	let isRecurring = false;
	let recurrencePattern: RecurrencePattern = {
		frequency: 'daily',
		interval: 1
	};
	let recurrenceEndDate = '';

	$: if (show && task) {
		editTaskTitle = task.title;
		editTaskDescription = task.description || '';
		editTaskPriority = task.priority;
		editTaskDueDate = task.due_date || '';
		editTaskProjectId = task.project_id;
		isRecurring = task.is_recurring || false;
		recurrencePattern = task.recurrence_pattern || {
			frequency: 'daily',
			interval: 1
		};
		recurrenceEndDate = task.recurrence_end_date || '';
	}

	function handleSubmit() {
		onSave({
			title: editTaskTitle,
			description: editTaskDescription || null,
			priority: editTaskPriority,
			due_date: editTaskDueDate || null,
			project_id: editTaskProjectId,
			is_recurring: isRecurring,
			recurrence_pattern: isRecurring ? recurrencePattern : null,
			recurrence_end_date: isRecurring && recurrenceEndDate ? recurrenceEndDate : null
		});
	}
</script>

{#if show && task}
	<div class="modal-overlay" on:click={onClose}>
		<div class="modal" on:click|stopPropagation>
			<h2>Edit Task</h2>
			<form on:submit|preventDefault={handleSubmit}>
				<div class="form-group">
					<label for="edit-task-title">Task Title</label>
					<input
						type="text"
						id="edit-task-title"
						bind:value={editTaskTitle}
						placeholder="e.g., Call the contractor"
						maxlength="50"
						required
					/>
				</div>
				<div class="form-group">
					<label for="edit-task-description">Description (optional)</label>
					<textarea
						id="edit-task-description"
						bind:value={editTaskDescription}
						placeholder="Add details..."
						rows="2"
					></textarea>
				</div>
				<div class="form-row">
					<div class="form-group">
						<label for="edit-task-priority">Priority</label>
						<select id="edit-task-priority" bind:value={editTaskPriority}>
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
						</select>
					</div>
					<div class="form-group">
						<label for="edit-task-due-date">Due Date (optional)</label>
						<input
							type="date"
							id="edit-task-due-date"
							bind:value={editTaskDueDate}
						/>
					</div>
				</div>
				<div class="form-group">
					<label for="edit-task-project">Project (optional)</label>
					<select id="edit-task-project" bind:value={editTaskProjectId}>
						<option value={null}>No project</option>
						{#each projects as project}
							<option value={project.id}>{project.name}</option>
						{/each}
					</select>
				</div>

				<!-- Recurrence Options -->
				<div class="form-group">
					<label class="checkbox-label">
						<input
							type="checkbox"
							bind:checked={isRecurring}
						/>
						<span>Repeat this task</span>
					</label>
				</div>

				{#if isRecurring}
					<div class="recurrence-section">
						<RecurrencePatternPicker bind:pattern={recurrencePattern} />

						<div class="form-group">
							<label for="recurrence-end-date">End date (optional)</label>
							<input
								type="date"
								id="recurrence-end-date"
								bind:value={recurrenceEndDate}
							/>
						</div>
					</div>
				{/if}

				<div class="modal-actions">
					<button type="button" class="delete-btn" on:click={onDelete}>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M2 4h12M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4m2 0v9.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V4"/>
						</svg>
						Delete
					</button>
					<div style="flex: 1;"></div>
					<button type="button" class="secondary-btn" on:click={onClose}>
						Cancel
					</button>
					<button type="submit" class="primary-btn">
						Update Task
					</button>
				</div>
			</form>
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

	.modal-actions {
		display: flex;
		gap: 12px;
		align-items: center;
		margin-top: 24px;
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

	.checkbox-label {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		font-size: 0.9375rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.checkbox-label input[type='checkbox'] {
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: var(--accent-primary);
		margin: 0;
		padding: 0;
		flex-shrink: 0;
		vertical-align: middle;
	}

	.checkbox-label span {
		line-height: 1.2;
	}

	.recurrence-section {
		padding: 16px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		margin-bottom: 16px;
	}
</style>
