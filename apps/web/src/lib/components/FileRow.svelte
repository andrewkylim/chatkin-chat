<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { File } from '@chatkin/types';
	import { deleteFile, updateFileMetadata } from '$lib/db/files';
	import { getThumbnailUrl } from '$lib/utils/image-cdn';

	export let file: File;
	export let selected: boolean = false;

	const dispatch = createEventDispatcher();

	let editing = false;
	let editTitle = file.title || file.filename;
	let editDescription = file.description || '';

	// Format file size
	function formatSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i];
	}

	// Format date
	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString();
	}

	// Check if file is an image
	$: isImage = file.mime_type.startsWith('image/');

	async function handleSaveEdit() {
		try {
			await updateFileMetadata(file.id, {
				title: editTitle,
				description: editDescription
			});
			editing = false;
			dispatch('update');
		} catch (error) {
			console.error('Failed to update file:', error);
		}
	}

	async function handleDelete() {
		if (!confirm('Delete this file?')) return;

		try {
			await deleteFile(file.id);
			dispatch('delete');
		} catch (error) {
			console.error('Failed to delete file:', error);
		}
	}

	function handleToggle() {
		dispatch('toggle');
	}
</script>

<div class="file-row" class:selected>
	<!-- Checkbox -->
	<input type="checkbox" class="file-checkbox" checked={selected} on:change={handleToggle} />

	<!-- Thumbnail -->
	<div class="file-thumbnail">
		{#if isImage}
			<img
				src={getThumbnailUrl(file.r2_url)}
				alt={file.title || file.filename}
				loading="lazy"
				decoding="async"
			/>
		{:else}
			<div class="file-icon">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
					<path d="M7 1H17L21 5V23H3V1H7ZM16 2V6H20M5 10H19M5 14H19M5 18H14" />
				</svg>
			</div>
		{/if}
	</div>

	<!-- File Info -->
	<div class="file-info">
		{#if editing}
			<input type="text" class="edit-title" bind:value={editTitle} placeholder="Title" />
			<input
				type="text"
				class="edit-description"
				bind:value={editDescription}
				placeholder="Description"
			/>
		{:else}
			<h4 class="file-title">{file.title || file.filename}</h4>
		{/if}
	</div>

	<!-- File Metadata -->
	<div class="file-meta">
		<span class="file-size">{formatSize(file.size_bytes)}</span>
	</div>

	<div class="file-date">
		{formatDate(file.created_at)}
	</div>

	<!-- Actions -->
	<div class="file-actions">
		{#if editing}
			<button class="icon-btn" on:click={handleSaveEdit} title="Save">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path
						d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"
					/>
				</svg>
			</button>
			<button class="icon-btn" on:click={() => (editing = false)} title="Cancel">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path
						d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"
					/>
				</svg>
			</button>
		{:else}
			<button class="icon-btn" on:click={() => (editing = true)} title="Edit">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path
						d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"
					/>
				</svg>
			</button>
			<a
				href={file.r2_url}
				download={file.filename}
				target="_blank"
				class="icon-btn"
				title="Download"
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path
						d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"
					/>
					<path
						d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"
					/>
				</svg>
			</a>
			<button class="icon-btn danger" on:click={handleDelete} title="Delete">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path
						d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"
					/>
					<path
						fill-rule="evenodd"
						d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
					/>
				</svg>
			</button>
		{/if}
	</div>
</div>

<style>
	.file-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		transition: all 0.2s ease;
		min-height: 52px;
	}

	.file-row:hover {
		background: var(--bg-tertiary);
	}

	.file-row.selected {
		border-color: var(--accent-primary);
		background: var(--bg-tertiary);
	}

	.file-checkbox {
		width: 20px;
		height: 20px;
		cursor: pointer;
		accent-color: var(--accent-primary);
		flex-shrink: 0;
	}

	.file-thumbnail {
		width: 48px;
		height: 48px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--bg-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.file-thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.file-icon {
		color: var(--text-muted);
	}

	.file-info {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.file-title {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.edit-title,
	.edit-description {
		width: 100%;
		padding: 6px 8px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		margin-bottom: 4px;
	}

	.file-meta {
		font-size: 0.75rem;
		color: var(--text-secondary);
		min-width: 60px;
		flex-shrink: 0;
		white-space: nowrap;
	}

	.file-date {
		font-size: 0.75rem;
		color: var(--text-muted);
		min-width: 90px;
		flex-shrink: 0;
		white-space: nowrap;
	}

	.file-actions {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.icon-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
		text-decoration: none;
	}

	.icon-btn:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent-primary);
		color: var(--accent-primary);
	}

	.icon-btn.danger:hover {
		border-color: var(--danger);
		color: var(--danger);
	}

	/* Hide thumbnail in list view - it's for compact display */
	.file-thumbnail {
		display: none;
	}

	/* Mobile Responsive - keep on one line but hide date */
	@media (max-width: 768px) {
		.file-date {
			display: none;
		}

		.file-meta {
			min-width: 50px;
		}

		.file-actions {
			gap: 2px;
		}

		.icon-btn {
			width: 28px;
			height: 28px;
		}
	}
</style>
