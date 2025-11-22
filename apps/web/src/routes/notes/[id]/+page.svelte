<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import { getNote } from '$lib/db/notes';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { marked } from 'marked';

	$: noteId = $page.params.id;

	let note: any = null;
	let loading = true;

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

	async function renderMarkdown(text: string): Promise<string> {
		return await marked(text, { breaks: true });
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
			<a href="/notes" class="back-btn">
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 4l-8 8 8 8"/>
				</svg>
				Back to Notes
			</a>
			<h1>{note.title || 'Untitled'}</h1>
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
</style>
