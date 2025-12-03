<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import { getNote, deleteNote, updateNote, updateNoteBlock } from '$lib/db/notes';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { handleError } from '$lib/utils/error-handler';
	import type { Note, NoteBlock, WellnessDomain } from '@chatkin/types';

	$: noteId = $page.params.id;

	interface NoteWithBlocks extends Note {
		note_blocks: NoteBlock[];
	}

	let note: NoteWithBlocks | null = null;
	let loading = true;
	let showDeleteConfirm = false;
	let isEditing = false;
	let editTitle = '';
	let editContent = '';
	let editBlockId = '';
	let editDomain: WellnessDomain = 'Body';

	const domains: WellnessDomain[] = ['Body', 'Mind', 'Purpose', 'Connection', 'Growth', 'Finance'];

	// Inline editing state
	let isEditingInline = false;
	let autosaveTimeout: number | null = null;
	let titleElement: HTMLElement;
	let contentElement: HTMLElement;

	// Determine back navigation based on referrer or default to /notes
	let backUrl = '/notes';
	let backText = 'Back to Notes';

	function formatMarkdown(text: string): string {
		if (!text) return '';
		let html = text;

		// Convert headers (###, ####, #####)
		html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
		html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
		html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
		html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

		// Convert **bold** text
		html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

		// Convert bullet points (-, *, •)
		html = html.replace(/^[-*•] (.+)$/gm, '<li>$1</li>');

		// Wrap consecutive list items in ul tags
		html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

		// Convert line breaks to <br> for remaining content
		html = html.replace(/\n/g, '<br>');

		return html;
	}

	onMount(async () => {
		await loadNote();

		// Check if user came from a project page
		const referrer = document.referrer;
		if (referrer && referrer.includes('/projects/')) {
			const projectMatch = referrer.match(/\/projects\/([^/]+)/);
			if (projectMatch && note?.project_id) {
				backUrl = `/projects/${note.project_id}/chat`;
				backText = 'Back to Project';
			}
		}
	});

	async function loadNote() {
		loading = true;
		try {
			if (noteId) {
				note = await getNote(noteId);
			}
		} catch (error) {
			handleError(error, { operation: 'Load note', component: 'NoteDetailPage' });
		} finally {
			loading = false;
		}
	}

	async function handleDelete() {
		if (!noteId) return;
		try {
			await deleteNote(noteId);
			goto('/notes');
		} catch (error) {
			handleError(error, { operation: 'Delete note', component: 'NoteDetailPage' });
			alert('Failed to delete note');
		}
	}

	function startEdit() {
		if (!note) return;
		editTitle = note.title || '';
		editDomain = note.domain || 'Body';
		// Get the first text block's content
		const firstTextBlock = note.note_blocks?.find((b: NoteBlock) => b.type === 'text');
		editContent = (firstTextBlock?.content?.text as string) || '';
		editBlockId = firstTextBlock?.id || '';
		isEditing = true;
	}

	async function handleSaveEdit() {
		if (!editTitle.trim() || !noteId) return;

		try {
			// Update note title and domain
			await updateNote(noteId, {
				title: editTitle,
				domain: editDomain
			});

			// Update note block content if it exists
			if (editBlockId && editContent !== undefined) {
				await updateNoteBlock(editBlockId, editContent);
			}

			isEditing = false;
			await loadNote();
		} catch (error) {
			handleError(error, { operation: 'Update note', component: 'NoteDetailPage' });
			alert('Failed to update note');
		}
	}

	// Inline editing functions
	function handleTitleInput() {
		scheduleAutosave();
	}

	function handleContentInput() {
		scheduleAutosave();
	}

	function scheduleAutosave() {
		if (autosaveTimeout) {
			clearTimeout(autosaveTimeout);
		}
		autosaveTimeout = window.setTimeout(async () => {
			await saveInlineChanges();
		}, 500);
	}

	async function saveInlineChanges() {
		if (!note || !titleElement || !contentElement || !noteId) return;

		try {
			const newTitle = titleElement.innerText.trim();
			const newContent = contentElement.innerText.trim();

			// Update title if changed
			if (newTitle && newTitle !== note.title) {
				await updateNote(noteId, { title: newTitle });
				note.title = newTitle;
			}

			// Update content if changed
			const firstTextBlock = note.note_blocks?.find((b: NoteBlock) => b.type === 'text');
			const currentContent = firstTextBlock?.content?.text || '';

			if (firstTextBlock && newContent !== currentContent) {
				await updateNoteBlock(firstTextBlock.id, newContent);
				if (firstTextBlock.content) {
					firstTextBlock.content.text = newContent;
				}
			}
		} catch (error) {
			handleError(error, { operation: 'Autosave note', component: 'NoteDetailPage' });
		}
	}

	function handleTitleClick() {
		isEditingInline = true;
	}

	function handleContentClick() {
		isEditingInline = true;
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
		<div class="page-header">
			<a href={backUrl} class="back-btn">
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 4l-8 8 8 8"/>
				</svg>
				{backText}
			</a>
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

		<div class="note-content">
			<h1
				bind:this={titleElement}
				contenteditable="true"
				on:input={handleTitleInput}
				on:click={handleTitleClick}
				class:editing={isEditingInline}
			>
				{note.title || 'Untitled'}
			</h1>

			{#if note.note_blocks && note.note_blocks.length > 0}
				{#each note.note_blocks.sort((a: NoteBlock, b: NoteBlock) => a.position - b.position) as block (block.id)}
					{#if block.type === 'text'}
						{#if isEditingInline}
							<div
								bind:this={contentElement}
								contenteditable="true"
								on:input={handleContentInput}
								on:click={handleContentClick}
								class="text-block editable-content editing"
							>
								{block.content.text || ''}
							</div>
						{:else}
							<div
								on:click={handleContentClick}
								class="text-block formatted-content"
							>
								{@html formatMarkdown(block.content.text || '')}
							</div>
						{/if}
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
							maxlength="50"
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
					<div class="form-group">
						<label for="edit-domain">Domain</label>
						<select id="edit-domain" bind:value={editDomain}>
							{#each domains as domain}
								<option value={domain}>{domain}</option>
							{/each}
						</select>
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

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.header-actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
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

	.back-btn svg {
		margin-top: -1px;
	}

	.back-btn:hover {
		color: var(--text-primary);
		background: var(--bg-tertiary);
	}

	.note-content {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 2rem;
	}

	.note-content h1 {
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0 0 2rem 0;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--border-color);
		outline: none;
		cursor: text;
	}

	.note-content h1:focus {
		outline: none;
	}

	.note-content h1:empty:before {
		content: 'Untitled';
		color: var(--text-secondary);
		opacity: 0.5;
	}

	.text-block {
		margin-bottom: 1.5rem;
	}

	.text-block p {
		line-height: 1.6;
		margin: 0;
		white-space: pre-wrap;
	}

	.editable-content {
		outline: none;
		cursor: text;
		white-space: pre-wrap;
		word-wrap: break-word;
		min-height: 100px;
		line-height: 1.6;
	}

	.editable-content:focus {
		outline: none;
	}

	.editable-content:empty:before {
		content: 'Start typing...';
		color: var(--text-secondary);
		opacity: 0.5;
	}

	/* Formatted markdown content styling */
	.formatted-content {
		line-height: 1.6;
		cursor: text;
	}

	.formatted-content :global(h2) {
		font-size: 1.5rem;
		font-weight: 700;
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		color: var(--text-primary);
	}

	.formatted-content :global(h3) {
		font-size: 1.25rem;
		font-weight: 700;
		margin-top: 1.25rem;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
	}

	.formatted-content :global(h4) {
		font-size: 1.125rem;
		font-weight: 600;
		margin-top: 1rem;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
	}

	.formatted-content :global(h5) {
		font-size: 1rem;
		font-weight: 600;
		margin-top: 0.75rem;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
	}

	.formatted-content :global(strong) {
		font-weight: 700;
		color: var(--text-primary);
	}

	.formatted-content :global(ul) {
		margin-left: 1.5rem;
		margin-top: 0.75rem;
		margin-bottom: 0.75rem;
		list-style-type: disc;
	}

	.formatted-content :global(li) {
		margin-bottom: 0.5rem;
		line-height: 1.6;
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
	.form-group textarea,
	.form-group select {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
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
	.form-group textarea:focus,
	.form-group select:focus {
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

	/* Mobile adjustments */
	@media (max-width: 768px) {
		.note-detail-page {
			padding: 1rem;
		}

		.note-content {
			padding: 1.5rem;
		}

		.note-content h1 {
			font-size: 1.5rem;
		}
	}
</style>
