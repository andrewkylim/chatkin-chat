<script lang="ts">
	export let operations: Operation[] = [];
	export let onConfirm: (selectedOperations: Operation[]) => void;
	export let onCancel: () => void;

	interface Operation {
		operation: 'create' | 'update' | 'delete';
		type: 'task' | 'note' | 'project';
		id?: string;
		data?: any;
		changes?: any;
		reason?: string;
		selected?: boolean;
	}

	// Initialize all operations as selected
	let operationsList = operations.map(op => ({ ...op, selected: true }));

	function toggleOperation(index: number) {
		operationsList[index].selected = !operationsList[index].selected;
		operationsList = operationsList;
	}

	function getOperationIcon(op: Operation) {
		if (op.operation === 'create') return '✓';
		if (op.operation === 'update') return '✎';
		if (op.operation === 'delete') return '✗';
		return '';
	}

	function getOperationColor(op: Operation) {
		if (op.operation === 'create') return 'text-green-600';
		if (op.operation === 'update') return 'text-blue-600';
		if (op.operation === 'delete') return 'text-red-600';
		return '';
	}

	function getOperationTitle(op: Operation) {
		if (op.operation === 'create') {
			if (op.type === 'task') return op.data?.title || 'Untitled Task';
			if (op.type === 'note') return op.data?.title || 'Untitled Note';
			if (op.type === 'project') return op.data?.name || 'Untitled Project';
		}
		return `${op.operation} ${op.type}`;
	}

	function getOperationDetails(op: Operation) {
		if (op.operation === 'create' && op.data) {
			if (op.type === 'task') {
				return `Priority: ${op.data.priority || 'medium'}${op.data.due_date ? ', Due: ' + op.data.due_date : ''}`;
			}
			if (op.type === 'project') {
				return op.data.description || 'No description';
			}
			if (op.type === 'note') {
				return op.data.content?.substring(0, 100) + '...' || 'No content';
			}
		}
		if (op.operation === 'update' && op.changes) {
			return Object.entries(op.changes)
				.map(([key, value]) => `${key}: ${value}`)
				.join(', ');
		}
		if (op.operation === 'delete') {
			return op.reason || 'Deleting item';
		}
		return '';
	}

	function confirmSelected() {
		const selected = operationsList.filter(op => op.selected);
		onConfirm(selected);
	}

	$: selectedCount = operationsList.filter(op => op.selected).length;
</script>

<div class="modal-overlay" on:click={onCancel} on:keydown={(e) => e.key === 'Escape' && onCancel()}>
	<div class="modal-content" on:click|stopPropagation on:keydown|stopPropagation>
		<div class="modal-header">
			<h2>Review AI Suggestions</h2>
			<button class="close-button" on:click={onCancel}>×</button>
		</div>

		<div class="operations-list">
			{#each operationsList as op, index}
				<div class="operation-item" class:selected={op.selected} on:click={() => toggleOperation(index)}>
					<div class="operation-checkbox">
						<input type="checkbox" bind:checked={op.selected} />
					</div>
					<div class="operation-icon {getOperationColor(op)}">
						{getOperationIcon(op)}
					</div>
					<div class="operation-content">
						<div class="operation-title">
							<strong>{op.operation}</strong> {op.type}: {getOperationTitle(op)}
						</div>
						<div class="operation-details">
							{getOperationDetails(op)}
						</div>
					</div>
				</div>
			{/each}
		</div>

		<div class="modal-footer">
			<button class="button-secondary" on:click={onCancel}>Cancel</button>
			<button class="button-primary" on:click={confirmSelected} disabled={selectedCount === 0}>
				Confirm {selectedCount > 0 ? `(${selectedCount})` : ''}
			</button>
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(2px);
	}

	.modal-content {
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		max-width: 600px;
		width: 90%;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 24px;
		border-bottom: 1px solid var(--border-color);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.close-button {
		background: none;
		border: none;
		font-size: 2rem;
		cursor: pointer;
		color: #6b7280;
		line-height: 1;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
	}

	.close-button:hover {
		background: var(--bg-tertiary);
	}

	.operations-list {
		flex: 1;
		overflow-y: auto;
		padding: 16px 24px;
	}

	.operation-item {
		display: flex;
		gap: 12px;
		padding: 12px;
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
		margin-bottom: 12px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.operation-item:hover {
		border-color: var(--accent-primary);
		background: var(--bg-tertiary);
	}

	.operation-item.selected {
		border-color: var(--accent-primary);
		background: rgba(199, 124, 92, 0.1);
	}

	.operation-checkbox {
		display: flex;
		align-items: flex-start;
		padding-top: 2px;
	}

	.operation-checkbox input {
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: var(--accent-primary);
	}

	.operation-icon {
		font-size: 1.5rem;
		font-weight: bold;
		display: flex;
		align-items: flex-start;
	}

	.text-green-600 {
		color: var(--accent-success);
	}

	.text-blue-600 {
		color: var(--accent-primary);
	}

	.text-red-600 {
		color: #dc2626;
	}

	.operation-content {
		flex: 1;
	}

	.operation-title {
		font-size: 0.95rem;
		margin-bottom: 4px;
	}

	.operation-details {
		font-size: 0.85rem;
		color: #6b7280;
	}

	.modal-footer {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		padding: 16px 24px;
		border-top: 1px solid var(--border-color);
	}

	.button-primary,
	.button-secondary {
		padding: 10px 20px;
		border-radius: var(--radius-md);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
		font-size: 0.95rem;
	}

	.button-primary {
		background: var(--accent-primary);
		color: white;
	}

	.button-primary:hover:not(:disabled) {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.button-primary:active:not(:disabled) {
		transform: translateY(0);
	}

	.button-primary:disabled {
		background: #9ca3af;
		cursor: not-allowed;
		opacity: 0.6;
	}

	.button-secondary {
		background: transparent;
		border: 1px solid var(--border-color);
		color: var(--text-primary);
	}

	.button-secondary:hover {
		background: var(--bg-tertiary);
	}
</style>
