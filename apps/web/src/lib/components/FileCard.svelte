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
	let showMenu = false;

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
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
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

<div class="file-card" class:selected>
	<!-- Checkbox -->
	<input
		type="checkbox"
		class="file-checkbox"
		checked={selected}
		on:change={handleToggle}
	/>

	<!-- Thumbnail -->
	<div
		class="file-thumbnail"
		class:clickable={isImage}
		on:click={() => isImage && dispatch('view')}
		role={isImage ? 'button' : undefined}
		tabindex={isImage ? 0 : undefined}
	>
		{#if isImage}
			<img
				src={getThumbnailUrl(file.r2_url)}
				alt={file.title || file.filename}
				loading="lazy"
				decoding="async"
			/>
		{:else}
			<div class="file-icon">
				<svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor">
					<path d="M14 2H34L42 10V46H6V2H14ZM32 4V12H40M10 20H38M10 28H38M10 36H28" />
				</svg>
			</div>
		{/if}
	</div>

	<!-- File Info -->
	<div class="file-info">
		{#if editing}
			<input type="text" class="edit-title" bind:value={editTitle} placeholder="Title" />
			<textarea
				class="edit-description"
				bind:value={editDescription}
				placeholder="Description"
				rows="2"
			/>
			<div class="edit-actions">
				<button class="save-btn" on:click={handleSaveEdit}>Save</button>
				<button class="cancel-btn" on:click={() => (editing = false)}>Cancel</button>
			</div>
		{:else}
			<h3 class="file-title">{file.title || file.filename}</h3>
			{#if file.description}
				<p class="file-description">{file.description}</p>
			{/if}
			<div class="file-meta">
				<span class="file-size">{formatSize(file.size_bytes)}</span>
				<span class="file-date">{formatDate(file.created_at)}</span>
			</div>
		{/if}
	</div>

	<!-- Actions Menu -->
	<div class="file-actions">
		<button class="action-btn" on:click={() => (showMenu = !showMenu)}>
			<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
				<circle cx="10" cy="4" r="1.5" />
				<circle cx="10" cy="10" r="1.5" />
				<circle cx="10" cy="16" r="1.5" />
			</svg>
		</button>

		{#if showMenu}
			<div class="action-menu" on:click|stopPropagation={() => (showMenu = false)}>
				<button
					on:click={() => {
						editing = true;
						showMenu = false;
					}}
				>
					Edit
				</button>
				<a href={file.r2_url} download={file.filename} target="_blank"> Download </a>
				<button on:click={handleDelete} class="danger"> Delete </button>
			</div>
		{/if}
	</div>
</div>

<style>
	.file-card {
		position: relative;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 16px;
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.file-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.file-card.selected {
		border-color: var(--accent-primary);
		background: var(--bg-tertiary);
	}

	.file-checkbox {
		position: absolute;
		top: 12px;
		left: 12px;
		width: 20px;
		height: 20px;
		cursor: pointer;
		accent-color: var(--accent-primary);
		z-index: 2;
	}

	.file-thumbnail {
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--bg-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 12px;
		transition: all 0.2s ease;
	}

	.file-thumbnail.clickable {
		cursor: pointer;
	}

	.file-thumbnail.clickable:hover {
		transform: scale(1.02);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
	}

	.file-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 4px 0;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.file-description {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		margin: 0 0 8px 0;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.file-meta {
		display: flex;
		gap: 8px;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.edit-title,
	.edit-description {
		width: 100%;
		padding: 8px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		margin-bottom: 8px;
	}

	.edit-actions {
		display: flex;
		gap: 8px;
	}

	.save-btn,
	.cancel-btn {
		flex: 1;
		padding: 8px;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}

	.save-btn {
		background: var(--accent-primary);
		color: white;
		border: none;
	}

	.cancel-btn {
		background: transparent;
		border: 1px solid var(--border-color);
		color: var(--text-secondary);
	}

	.file-actions {
		position: absolute;
		top: 12px;
		right: 12px;
	}

	.action-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-btn:hover {
		background: var(--bg-tertiary);
	}

	.action-menu {
		position: absolute;
		top: 40px;
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		overflow: hidden;
		z-index: 10;
		min-width: 120px;
	}

	.action-menu button,
	.action-menu a {
		display: block;
		width: 100%;
		padding: 10px 16px;
		background: none;
		border: none;
		text-align: left;
		font-size: 0.875rem;
		color: var(--text-primary);
		cursor: pointer;
		text-decoration: none;
	}

	.action-menu button:hover,
	.action-menu a:hover {
		background: var(--bg-tertiary);
	}

	.action-menu button.danger {
		color: var(--danger);
	}
</style>
