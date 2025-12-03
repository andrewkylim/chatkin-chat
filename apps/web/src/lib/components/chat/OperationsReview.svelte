<script lang="ts">
	import type { Operation } from '$lib/types/chat';

	export let operations: Operation[];
	export let selectedOperations: Operation[];
	export let onToggle: (opIndex: number) => void;
	export let onConfirm: () => void;
	export let onCancel: () => void;

	function isSelected(operation: Operation): boolean {
		return selectedOperations.some(
			(op) =>
				op.operation === operation.operation &&
				op.type === operation.type &&
				op.id === operation.id &&
				JSON.stringify(op.data) === JSON.stringify(operation.data)
		);
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
					{#if operation.operation === 'create'}
						<strong>Create {operation.type}</strong>
					{:else if operation.operation === 'update'}
						<strong>Update {operation.type}</strong>
					{:else if operation.operation === 'delete'}
						<strong>Delete {operation.type}</strong>
					{/if}
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
