<script lang="ts">
	import type { Operation } from '$lib/types/chat';
	import EditOperationModal from './EditOperationModal.svelte';

	let {
		operations = $bindable([]),
		selectedOperations = $bindable([]),
		onToggle,
		onConfirm,
		onCancel
	}: {
		operations: Operation[];
		selectedOperations: Operation[];
		onToggle: (opIndex: number) => void;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	// Modal state
	let showEditModal = $state(false);
	let editingOperation: Operation | null = $state(null);
	let editingOperationIndex = $state(-1);
	let modalKey = $state(0); // Key to force modal remount

	function isSelected(operation: Operation): boolean {
		return selectedOperations.some(
			(op) =>
				op.operation === operation.operation &&
				op.type === operation.type &&
				op.id === operation.id &&
				JSON.stringify(op.data) === JSON.stringify(operation.data)
		);
	}

	// Open edit modal for an operation
	function openEditModal(opIndex: number) {
		// Create a deep copy to avoid modifying the original
		editingOperation = JSON.parse(JSON.stringify(operations[opIndex]));
		editingOperationIndex = opIndex;
		modalKey++; // Increment key to force remount
		showEditModal = true;
	}

	// Close edit modal
	function closeEditModal() {
		showEditModal = false;
		editingOperation = null;
		editingOperationIndex = -1;
	}

	// Save edited operation data
	function saveEditedOperation(newData: Record<string, unknown>) {
		if (editingOperationIndex === -1) return;

		// Update the operation data
		operations[editingOperationIndex].data = newData;

		// Also update in selectedOperations if it exists
		const selectedIndex = selectedOperations.findIndex(
			(op) =>
				op.operation === operations[editingOperationIndex].operation &&
				op.type === operations[editingOperationIndex].type
		);
		if (selectedIndex !== -1) {
			selectedOperations[selectedIndex].data = newData;
		}

		// Trigger reactivity
		operations = [...operations];
		selectedOperations = [...selectedOperations];
	}
</script>

<div class="inline-operations">
	{#each operations as operation, opIndex}
		<label class="operation-item {operation.operation}">
			<input
				type="checkbox"
				checked={isSelected(operation)}
				onchange={() => onToggle(opIndex)}
			/>
			<div class="operation-content">
				<div class="operation-header">
					<div class="operation-title-row">
						{#if operation.operation === 'create'}
							<strong>Create {operation.type}</strong>
						{:else if operation.operation === 'update'}
							<strong>Update {operation.type}</strong>
						{:else if operation.operation === 'delete'}
							<strong>Delete {operation.type}</strong>
						{/if}
					</div>
					<button
						class="edit-operation-btn"
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							openEditModal(opIndex);
						}}
						aria-label="Edit operation"
					>
						<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M11 5L6 10v4h4l5-5M11 5l3-3 4 4-3 3M11 5l4 4"/>
						</svg>
					</button>
				</div>
				{#if operation.data}
					<div class="operation-details">
						{#if operation.data.title || operation.data.name}
							<span class="operation-title">{operation.data.title || operation.data.name}</span>
						{/if}
						{#if operation.data.description}
							<span class="operation-desc">{operation.data.description}</span>
						{/if}
					</div>
				{/if}
				{#if operation.reason}
					<div class="operation-reason">{operation.reason}</div>
				{/if}
			</div>
		</label>
	{/each}
</div>

<div class="confirmation-buttons">
	<button
		class="confirm-btn"
		onclick={onConfirm}
		disabled={selectedOperations.length === 0}
	>
		Confirm
	</button>
	<button class="cancel-btn" onclick={onCancel}>
		Cancel
	</button>
</div>

<!-- Edit Operation Modal -->
{#if showEditModal && editingOperation}
	{#key modalKey}
		<EditOperationModal
			show={showEditModal}
			operation={editingOperation}
			onSave={saveEditedOperation}
			onClose={closeEditModal}
		/>
	{/key}
{/if}

<style>
	.inline-operations {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 400px;
		overflow-y: auto;
	}

	.operation-item {
		display: flex;
		gap: 10px;
		padding: 10px;
		background: var(--bg-tertiary);
		border-radius: var(--radius-md);
		border: 2px solid var(--border-color);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.operation-item:hover {
		background: var(--bg-secondary);
	}

	.operation-item input[type='checkbox'] {
		margin-top: 2px;
		cursor: pointer;
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.operation-item.create {
		border-color: rgba(76, 175, 80, 0.3);
	}

	.operation-item.update {
		border-color: rgba(33, 150, 243, 0.3);
	}

	.operation-item.delete {
		border-color: rgba(211, 47, 47, 0.3);
	}

	.operation-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.operation-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.operation-title-row {
		flex: 1;
		min-width: 0;
	}

	.edit-operation-btn {
		background: none;
		border: none;
		padding: 4px;
		color: var(--text-secondary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.edit-operation-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.edit-operation-btn:active {
		transform: scale(0.95);
	}

	.operation-details {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 4px;
	}

	.operation-title {
		font-size: 0.9375rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.operation-desc {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.operation-reason {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-style: italic;
		margin-top: 4px;
	}

	.confirmation-buttons {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}

	.confirm-btn,
	.cancel-btn {
		flex: 1;
		padding: 10px 16px;
		border-radius: var(--radius-md);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.9375rem;
	}

	.confirm-btn {
		background: var(--accent-primary);
		color: white;
		border: none;
	}

	.confirm-btn:hover:not(:disabled) {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.confirm-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.confirm-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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
</style>
