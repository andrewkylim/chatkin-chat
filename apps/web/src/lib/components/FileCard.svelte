<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { File, Project } from '@chatkin/types';
	import { deleteFile } from '$lib/db/files';
	import { getThumbnailUrl } from '$lib/utils/image-cdn';
	import FileEditModal from './FileEditModal.svelte';
	import { supabase } from '$lib/supabase';

	export let file: File;
	export let selected: boolean = false;
	export let projects: Project[] = [];
	export let selectMode: boolean = false; // Are we in selection mode?

	const dispatch = createEventDispatcher();

	let showEditModal = false;
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

	function handleOpenEdit() {
		showEditModal = true;
		showMenu = false;
	}

	function handleModalSave() {
		showEditModal = false;
		dispatch('update');
	}

	async function handleDelete() {
		if (!confirm('Delete this file?')) return;

		try {
			const { data: { session } } = await supabase.auth.getSession();
			await deleteFile(file.id, session?.access_token);
			dispatch('delete');
		} catch (error) {
			console.error('Failed to delete file:', error);
		}
	}

	function handleCardClick(_e: MouseEvent) {
		// If in select mode, toggle selection
		if (selectMode) {
			dispatch('toggle');
		} else {
			// Otherwise open viewer
			dispatch('view');
		}
	}

	function handleCheckboxClick(e: MouseEvent) {
		e.stopPropagation();
	}

	function handleMenuToggle(e: MouseEvent) {
		e.stopPropagation();
		showMenu = !showMenu;
	}
</script>

<div class="file-card" class:selected onclick={handleCardClick}>
	<!-- Checkbox -->
	<input
		type="checkbox"
		class="file-checkbox"
		checked={selected}
		onchange={() => dispatch('toggle')}
		onclick={handleCheckboxClick}
	/>

	<!-- Thumbnail -->
	<div
		class="file-thumbnail"
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
		<h3 class="file-title">{file.title || file.filename}</h3>
		{#if file.description}
			<p class="file-description">{file.description}</p>
		{/if}
		<div class="file-meta">
			<span class="file-size">{formatSize(file.size_bytes)}</span>
			<span class="file-date">{formatDate(file.created_at)}</span>
		</div>
	</div>

	<!-- Actions Menu -->
	<div class="file-actions">
		<button class="action-btn" onclick={handleMenuToggle}>
			<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
				<circle cx="10" cy="4" r="1.5" />
				<circle cx="10" cy="10" r="1.5" />
				<circle cx="10" cy="16" r="1.5" />
			</svg>
		</button>

		{#if showMenu}
			<div class="action-menu" onclick={(e) => { e.stopPropagation(); showMenu = false; }}>
				<button onclick={handleOpenEdit}> Edit </button>
				<a href={file.r2_url} download={file.filename} target="_blank"> Download </a>
				<button onclick={handleDelete} class="danger"> Delete </button>
			</div>
		{/if}
	</div>
</div>

{#if showEditModal}
	<FileEditModal
		{file}
		{projects}
		on:save={handleModalSave}
		on:close={() => (showEditModal = false)}
	/>
{/if}

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
		border-radius: var(--radius-md);
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
