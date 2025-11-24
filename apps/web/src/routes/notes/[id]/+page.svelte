<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import { getNote, deleteNote, updateNote, updateNoteBlock } from '$lib/db/notes';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { marked } from 'marked';

	$: noteId = $page.params.id;

	let note: any = null;
	let loading = true;
	let showDeleteConfirm = false;
	let isEditing = false;
	let editTitle = '';
	let editContent = '';
	let editBlockId = '';

	$: backUrl = note?.project_id ? `/projects/${note.project_id}/chat` : '/notes';
	$: backText = note?.project_id ? 'Back to Project' : 'Back to Notes';

	onMount(async () => {
		await loadNote();
	});

	async function loadNote() {
		loading = true;
		try {
			if (noteId) {
				note = await getNote(noteId);
			}
		} catch (error) {
			console.error('Error loading note:', error);
		} finally {
			loading = false;
		}
	}

	function renderMarkdown(text: string): string {
		return marked(text, { breaks: true }) as string;
	}

	async function handleDelete() {
		try {
			await deleteNote(noteId);
			goto('/notes');
		} catch (error) {
			console.error('Error deleting note:', error);
			alert('Failed to delete note');
		}
	}

	function startEdit() {
		editTitle = note.title;
		// Get the first text block's content
		const firstTextBlock = note.note_blocks?.find((b: any) => b.type === 'text');
		editContent = firstTextBlock?.content?.text || '';
		editBlockId = firstTextBlock?.id || '';
		isEditing = true;
	}

	async function handleSaveEdit() {
		if (!editTitle.trim()) return;

		try {
			// Update note title
			await updateNote(noteId, { title: editTitle });

			// Update note block content if it exists
			if (editBlockId && editContent !== undefined) {
				await updateNoteBlock(editBlockId, editContent);
			}

			isEditing = false;
			await loadNote();
		} catch (error) {
			console.error('Error updating note:', error);
			alert('Failed to update note');
		}
	}
</script>

<AppLayout>
<div class="note-detail-page">
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Loading note...</p>
		</div>
	{:else if note}
		<header class="note-header">
			<a href={backUrl} class="back-btn">
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 4l-8 8 8 8"/>
				</svg>
				{backText}
			</a>
			<div class="header-title-row">
				<h1>{note.title || 'Untitled'}</h1>
				<div class="header-actions">
					<button class="icon-btn" on:click={startEdit} title="Edit note">
						<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12.5 2.5l3 3L6 15H3v-3L12.5 2.5z"/>
						</svg>
					</button>
					<button class="icon-btn delete-btn" on:click={() => showDeleteConfirm = true} title="Delete note">
						<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 4h12M7 4V3a1 1 0 011-1h2a1 1 0 011 1v1M14 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4"/>
						</svg>
					</button>
				</div>
			</div>
		</header>

		<div class="note-content">
			{#if note.note_blocks && note.note_blocks.length > 0}
				{#each note.note_blocks.sort((a: any, b: any) => a.position - b.position) as block (block.id)}
					{#if block.type === 'text'}
						<div class="text-block markdown-content">
							{@html renderMarkdown(block.content.text || '')}
						</div>
					{:else if block.type === 'code'}
						<div class="code-block">
							<pre><code>{block.content.code || ''}</code></pre>
						</div>
					{:else}
						<div class="block">
							<p>Unsupported block type: {block.type}</p>
						</div>
					{/if}
				{/each}
			{:else}
				<div class="empty-content">
					<p>No content yet</p>
				</div>
			{/if}
		</div>
	{:else}
		<div class="error-state">
			<h2>Note not found</h2>
			<a href="/notes">Back to Notes</a>
		</div>
	{/if}

	<!-- Edit Modal -->
	{#if isEditing}
		<div class="modal-overlay" on:click={() => isEditing = false}>
			<div class="modal edit-modal" on:click|stopPropagation>
				<h2>Edit Note</h2>
				<form on:submit|preventDefault={handleSaveEdit}>
					<div class="form-group">
						<label for="edit-title">Title</label>
						<input
							type="text"
							id="edit-title"
							bind:value={editTitle}
							placeholder="Note title"
							required
							autofocus
						/>
					</div>
					<div class="form-group">
						<label for="edit-content">Content</label>
						<textarea
							id="edit-content"
							bind:value={editContent}
							placeholder="Note content (supports Markdown)"
							rows="10"
						></textarea>
					</div>
					<div class="modal-actions">
						<button type="button" class="secondary-btn" on:click={() => isEditing = false}>
							Cancel
						</button>
						<button type="submit" class="primary-btn">
							Save Changes
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Delete Confirmation Modal -->
	{#if showDeleteConfirm}
		<div class="modal-overlay" on:click={() => showDeleteConfirm = false}>
			<div class="modal" on:click|stopPropagation>
				<h2>Delete Note?</h2>
				<p>Are you sure you want to delete "{note?.title || 'Untitled'}"? This action cannot be undone.</p>
				<div class="modal-actions">
					<button type="button" class="secondary-btn" on:click={() => showDeleteConfirm = false}>
						Cancel
					</button>
					<button type="button" class="danger-btn" on:click={handleDelete}>
						Delete Note
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
</AppLayout>

<style>
	.note-detail-page {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
	}

	.loading-state, .error-state {
		text-align: center;
		padding: 3rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--border-color);
		border-top-color: var(--accent-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.note-header {
		margin-bottom: 2rem;
	}

	.header-title-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.icon-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.icon-btn:hover {
		background: var(--bg-primary);
		transform: translateY(-1px);
	}

	.icon-btn:active {
		transform: translateY(0);
	}

	.delete-btn:hover {
		background: rgba(239, 68, 68, 0.1);
		border-color: rgb(239, 68, 68);
		color: rgb(239, 68, 68);
	}

	.back-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 0.875rem;
		margin-bottom: 1rem;
		padding: 0.5rem;
		border-radius: var(--radius-sm);
		transition: all 0.2s ease;
	}

	.back-btn:hover {
		color: var(--text-primary);
		background: var(--bg-tertiary);
	}

	.note-header h1 {
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.note-content {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 2rem;
	}

	.text-block {
		margin-bottom: 1.5rem;
	}

	.text-block p {
		line-height: 1.6;
		margin: 0;
		white-space: pre-wrap;
	}

	/* Markdown content styling */
	.markdown-content :global(p) {
		line-height: 1.6;
		margin-bottom: 1rem;
	}

	.markdown-content :global(strong) {
		font-weight: 700;
		color: var(--text-primary);
		font-size: 1.1em;
	}

	.markdown-content :global(em) {
		font-style: italic;
	}

	.markdown-content :global(ul),
	.markdown-content :global(ol) {
		margin-left: 1.5rem;
		margin-bottom: 1rem;
	}

	.markdown-content :global(li) {
		margin-bottom: 0.5rem;
		line-height: 1.6;
	}

	.markdown-content :global(h1),
	.markdown-content :global(h2),
	.markdown-content :global(h3) {
		font-weight: 700;
		margin-top: 1.5rem;
		margin-bottom: 1rem;
		color: var(--text-primary);
	}

	.markdown-content :global(h1) {
		font-size: 1.75rem;
	}

	.markdown-content :global(h2) {
		font-size: 1.5rem;
	}

	.markdown-content :global(h3) {
		font-size: 1.25rem;
	}

	.markdown-content :global(code) {
		background: var(--bg-tertiary);
		padding: 0.2em 0.4em;
		border-radius: 3px;
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 0.875em;
	}

	.markdown-content :global(pre) {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 1rem;
		overflow-x: auto;
		margin-bottom: 1rem;
	}

	.markdown-content :global(pre code) {
		background: none;
		padding: 0;
	}

	.markdown-content :global(blockquote) {
		border-left: 3px solid var(--accent-primary);
		padding-left: 1rem;
		margin-left: 0;
		color: var(--text-secondary);
		font-style: italic;
	}

	.code-block {
		margin-bottom: 1.5rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 1rem;
	}

	.code-block pre {
		margin: 0;
		overflow-x: auto;
	}

	.code-block code {
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 0.875rem;
	}

	.empty-content {
		text-align: center;
		padding: 3rem;
		color: var(--text-secondary);
	}

	.error-state a {
		display: inline-block;
		margin-top: 1rem;
		padding: 0.75rem 1.5rem;
		background: var(--accent-primary);
		color: white;
		text-decoration: none;
		border-radius: var(--radius-md);
	}

	/* Modal */
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
		border-radius: var(--radius-lg);
		padding: 24px;
		max-width: 400px;
		width: 100%;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.edit-modal {
		max-width: 600px;
	}

	.form-group {
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		font-weight: 600;
		font-size: 0.875rem;
		margin-bottom: 8px;
		color: var(--text-primary);
	}

	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 12px 16px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
	}

	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	.modal h2 {
		font-size: 1.25rem;
		margin-bottom: 12px;
	}

	.modal p {
		color: var(--text-secondary);
		margin-bottom: 24px;
		line-height: 1.5;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
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

	.danger-btn {
		padding: 10px 20px;
		background: rgb(239, 68, 68);
		border: none;
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.danger-btn:hover {
		background: rgb(220, 38, 38);
		transform: translateY(-1px);
	}

	.danger-btn:active {
		transform: translateY(0);
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
	}

	.primary-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.primary-btn:active {
		transform: translateY(0);
	}
</style>
