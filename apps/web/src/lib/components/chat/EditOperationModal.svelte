<script lang="ts">
	interface Operation {
		operation: 'create' | 'update' | 'delete';
		type: 'task' | 'note' | 'project';
		data: Record<string, unknown>;
		reason?: string;
	}

	let {
		show = false,
		operation = null,
		onSave,
		onClose
	}: {
		show: boolean;
		operation: Operation | null;
		onSave: (data: Record<string, unknown>) => void;
		onClose: () => void;
	} = $props();

	// Editable fields
	let title = $state('');
	let description = $state('');
	let priority = $state('medium');
	let domain = $state('');

	// Initialize fields when operation changes
	$effect(() => {
		if (operation?.data) {
			title = (operation.data.title as string) || (operation.data.name as string) || '';
			description = (operation.data.description as string) || (operation.data.content as string) || '';
			priority = (operation.data.priority as string) || 'medium';
			domain = (operation.data.domain as string) || '';
		} else {
			// Reset fields when operation is null
			title = '';
			description = '';
			priority = 'medium';
			domain = '';
		}
	});

	function handleSave() {
		const updatedData: Record<string, unknown> = {
			...operation?.data
		};

		// Update fields based on type
		if (operation?.type === 'task') {
			updatedData.title = title;
			updatedData.description = description;
			updatedData.priority = priority;
			updatedData.domain = domain;
		} else if (operation?.type === 'note') {
			updatedData.title = title;
			updatedData.content = description;
			updatedData.domain = domain;
		} else if (operation?.type === 'project') {
			updatedData.name = title;
			updatedData.description = description;
		}

		onSave(updatedData);
		onClose();
	}
</script>

{#if show && operation}
	<div class="modal-overlay" onclick={onClose}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>Edit {operation.operation} {operation.type}</h3>
				<button class="close-btn" onclick={onClose} aria-label="Close">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M15 5L5 15M5 5l10 10"/>
					</svg>
				</button>
			</div>

			<div class="modal-content">
				<!-- Title/Name Field -->
				<div class="form-group">
					<label for="edit-title">
						{operation.type === 'project' ? 'Name' : 'Title'}
					</label>
					<input
						id="edit-title"
						type="text"
						bind:value={title}
						placeholder="Enter {operation.type === 'project' ? 'name' : 'title'}..."
						class="form-input"
					/>
				</div>

				<!-- Description/Content Field -->
				<div class="form-group">
					<label for="edit-description">
						{operation.type === 'note' ? 'Content' : 'Description'}
					</label>
					<textarea
						id="edit-description"
						bind:value={description}
						placeholder="Enter {operation.type === 'note' ? 'content' : 'description'}..."
						class="form-textarea"
						rows="4"
					></textarea>
				</div>

				<!-- Priority Field (for tasks only) -->
				{#if operation.type === 'task'}
					<div class="form-group">
						<label for="edit-priority">Priority</label>
						<select id="edit-priority" bind:value={priority} class="form-select">
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
						</select>
					</div>
				{/if}

				<!-- Domain Field (for tasks and notes) -->
				{#if operation.type === 'task' || operation.type === 'note'}
					<div class="form-group">
						<label for="edit-domain">Domain</label>
						<select id="edit-domain" bind:value={domain} class="form-select">
							<option value="Body">Body</option>
							<option value="Mind">Mind</option>
							<option value="Purpose">Purpose</option>
							<option value="Connection">Connection</option>
							<option value="Growth">Growth</option>
							<option value="Finance">Finance</option>
						</select>
					</div>
				{/if}
			</div>

			<div class="modal-actions">
				<button class="save-btn" onclick={handleSave}>Save Changes</button>
				<button class="cancel-btn" onclick={onClose}>Cancel</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal {
		background: var(--bg-primary);
		border-radius: 0.75rem;
		max-width: 500px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem;
		border-bottom: 1px solid var(--border-color);
	}

	.modal-header h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		text-transform: capitalize;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.375rem;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.modal-content {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.form-input,
	.form-textarea,
	.form-select {
		width: 100%;
		padding: 0.625rem 0.75rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: inherit;
		transition: all 0.2s;
	}

	.form-input:focus,
	.form-textarea:focus,
	.form-select:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
		background: var(--bg-secondary);
	}

	.form-textarea {
		resize: vertical;
		min-height: 80px;
	}

	.form-select {
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.75rem center;
		padding-right: 2.5rem;
	}

	.modal-actions {
		display: flex;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--border-color);
	}

	.save-btn,
	.cancel-btn {
		flex: 1;
		padding: 0.625rem 1rem;
		border-radius: 0.5rem;
		font-weight: 500;
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
	}

	.save-btn {
		background: var(--accent-primary);
		color: white;
	}

	.save-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.save-btn:active {
		transform: translateY(0);
	}

	.cancel-btn {
		background: transparent;
		color: var(--text-secondary);
		border: 1px solid var(--border-color);
	}

	.cancel-btn:hover {
		background: var(--bg-secondary);
		transform: translateY(-1px);
	}

	.cancel-btn:active {
		transform: translateY(0);
	}

	/* Mobile optimizations */
	@media (max-width: 768px) {
		.modal {
			max-width: 100%;
			border-radius: 0.5rem;
		}

		.modal-header {
			padding: 1rem;
		}

		.modal-header h3 {
			font-size: 1rem;
		}

		.modal-content {
			padding: 1rem;
		}

		.form-input,
		.form-textarea,
		.form-select {
			font-size: 0.875rem;
		}

		.modal-actions {
			padding: 0.75rem 1rem;
		}

		.save-btn,
		.cancel-btn {
			font-size: 0.875rem;
			padding: 0.5rem 0.75rem;
		}
	}
</style>
