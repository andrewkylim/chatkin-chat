<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { File, Project } from '@chatkin/types';
	import { updateFileMetadata, updateFileProject } from '$lib/db/files';

	export let file: File;
	export let projects: Project[];

	const dispatch = createEventDispatcher();

	let editTitle = file.title || file.filename;
	let editDescription = file.description || '';
	let selectedProjectId = file.project_id || '';
	let saving = false;

	// Format file size
	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
	}

	async function handleSave() {
		saving = true;
		try {
			// Update metadata
			await updateFileMetadata(file.id, {
				title: editTitle,
				description: editDescription
			});

			// Update project association
			await updateFileProject(file.id, selectedProjectId || null);

			dispatch('save');
			dispatch('close');
		} catch (error) {
			console.error('Failed to update file:', error);
			alert('Failed to update file');
		} finally {
			saving = false;
		}
	}

	function handleClose() {
		dispatch('close');
	}

	function handleOverlayClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}
</script>

<div class="modal-overlay" on:click={handleOverlayClick} role="presentation">
	<div class="modal-content" on:click|stopPropagation role="dialog" aria-labelledby="modal-title">
		<div class="modal-header">
			<h2 id="modal-title">Edit File</h2>
			<button class="close-btn" on:click={handleClose} aria-label="Close modal">×</button>
		</div>

		<div class="modal-body">
			<!-- File Preview (if image) -->
			{#if file.mime_type.startsWith('image/')}
				<div class="file-preview">
					<img src={file.r2_url} alt={file.title || file.filename} />
				</div>
			{/if}

			<!-- Edit Form -->
			<div class="form-group">
				<label for="file-title">Title</label>
				<input id="file-title" type="text" bind:value={editTitle} placeholder="File title" />
			</div>

			<div class="form-group">
				<label for="file-description">Description</label>
				<textarea
					id="file-description"
					bind:value={editDescription}
					placeholder="File description"
					rows="3"
				/>
			</div>

			<div class="form-group">
				<label for="file-project">Project</label>
				<select id="file-project" bind:value={selectedProjectId}>
					<option value="">No project (standalone)</option>
					{#each projects as project}
						<option value={project.id}>{project.name}</option>
					{/each}
				</select>
			</div>

			<!-- File Info -->
			<div class="file-info">
				<p><strong>Filename:</strong> {file.filename}</p>
				<p><strong>Type:</strong> {file.mime_type}</p>
				<p><strong>Size:</strong> {formatBytes(file.size_bytes)}</p>
			</div>
		</div>

		<div class="modal-footer">
			<button class="cancel-btn" on:click={handleClose}>Cancel</button>
			<button class="save-btn" on:click={handleSave} disabled={saving}>
				{saving ? 'Saving...' : 'Save'}
			</button>
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 20px;
	}

	.modal-content {
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 24px;
		border-bottom: 1px solid var(--border-color);
	}

	.modal-header h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 2rem;
		line-height: 1;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md);
		transition: all 0.2s ease;
	}

	.close-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.modal-body {
		padding: 24px;
	}

	.file-preview {
		width: 100%;
		max-height: 300px;
		overflow: hidden;
		border-radius: var(--radius-md);
		margin-bottom: 20px;
		background: var(--bg-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.file-preview img {
		width: 100%;
		height: auto;
		object-fit: contain;
		max-height: 300px;
	}

	.form-group {
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 8px;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 10px 12px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: inherit;
		transition: all 0.2s ease;
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
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 80px;
	}

	.file-info {
		margin-top: 20px;
		padding: 16px;
		background: var(--bg-tertiary);
		border-radius: var(--radius-md);
	}

	.file-info p {
		margin: 8px 0;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.file-info strong {
		color: var(--text-primary);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding: 20px 24px;
		border-top: 1px solid var(--border-color);
	}

	.cancel-btn,
	.save-btn {
		padding: 10px 20px;
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.cancel-btn {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.cancel-btn:hover {
		background: var(--bg-secondary);
	}

	.save-btn {
		background: var(--accent-primary);
		color: white;
		border: none;
	}

	.save-btn:hover:not(:disabled) {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.save-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	@media (max-width: 640px) {
		.modal-content {
			max-height: 95vh;
		}

		.modal-header {
			padding: 16px 20px;
		}

		.modal-body {
			padding: 20px;
		}

		.modal-footer {
			padding: 16px 20px;
			flex-direction: column;
		}

		.cancel-btn,
		.save-btn {
			width: 100%;
		}
	}
</style>
