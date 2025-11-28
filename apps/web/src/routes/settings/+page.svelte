<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import { supabase } from '$lib/supabase';
	import { auth } from '$lib/stores/auth';
	import { onMount } from 'svelte';

	let status = '';
	let cleaning = false;

	let showDeleteAllModal = false;
	let deleteConfirmText = '';
	let deleteAllStatus = '';
	let deletingAll = false;

	// Theme state
	let theme: 'light' | 'dark' = 'light';

	$: userEmail = $auth.user?.email || '';
	$: canDeleteAll = deleteConfirmText.toLowerCase() === 'delete';

	onMount(() => {
		// Load theme preference from localStorage
		const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
		if (savedTheme) {
			theme = savedTheme;
			applyTheme(savedTheme);
		}
	});

	function applyTheme(newTheme: 'light' | 'dark') {
		if (newTheme === 'dark') {
			document.documentElement.setAttribute('data-theme', 'dark');
		} else {
			document.documentElement.removeAttribute('data-theme');
		}
	}

	function toggleTheme() {
		const newTheme = theme === 'light' ? 'dark' : 'light';
		theme = newTheme;
		applyTheme(newTheme);
		localStorage.setItem('theme', newTheme);
	}

	async function clearChatHistory() {
		if (!confirm('⚠️ Are you sure you want to delete ALL your chat history?\n\nThis will remove all conversations and messages across:\n• Global Chat\n• Tasks Chat\n• Notes Chat\n• Project Chats\n\nThis action cannot be undone.')) {
			return;
		}

		if (!$auth.user) {
			status = 'Error: Not authenticated';
			return;
		}

		cleaning = true;
		status = 'Deleting chat history...';

		try {
			const user = $auth.user;

			// Get all conversations for this user
			const { data: conversations, error: convError } = await supabase
				.from('conversations')
				.select('id, scope')
				.eq('user_id', user.id);

			if (convError) {
				status = `Error: ${convError.message}`;
				cleaning = false;
				return;
			}

			if (!conversations || conversations.length === 0) {
				status = 'No chat history found.';
				cleaning = false;
				return;
			}

			// Delete all messages for these conversations
			const conversationIds = conversations.map(c => c.id);

			const { error: msgError } = await supabase
				.from('messages')
				.delete()
				.in('conversation_id', conversationIds);

			if (msgError) {
				status = `Error deleting messages: ${msgError.message}`;
				cleaning = false;
				return;
			}

			// Delete all conversations
			const { error: delError } = await supabase
				.from('conversations')
				.delete()
				.eq('user_id', user.id);

			if (delError) {
				status = `Error deleting conversations: ${delError.message}`;
				cleaning = false;
				return;
			}

			status = `✅ Successfully deleted ${conversations.length} conversation(s). Refreshing...`;

			// Refresh page after 1.5 seconds
			setTimeout(() => {
				window.location.reload();
			}, 1500);

		} catch (error) {
			status = `Error: ${error instanceof Error ? error.message : String(error)}`;
		} finally {
			cleaning = false;
		}
	}

	async function handleDeleteAllContent() {
		if (!$auth.user || !canDeleteAll) return;

		deletingAll = true;
		deleteAllStatus = 'Deleting all content...';

		try {
			const user = $auth.user;

			// First, get all files to retrieve r2_keys for deletion
			deleteAllStatus = 'Deleting files from storage...';
			const { data: files, error: filesQueryError } = await supabase
				.from('files')
				.select('id, r2_key')
				.eq('user_id', user.id);

			if (filesQueryError) throw new Error(`Failed to query files: ${filesQueryError.message}`);

			// Delete all files from database
			const { error: filesError } = await supabase
				.from('files')
				.delete()
				.eq('user_id', user.id);

			if (filesError) throw new Error(`Failed to delete files: ${filesError.message}`);

			// Delete files from R2 storage in parallel
			if (files && files.length > 0) {
				const workerUrl = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787';
				await Promise.allSettled(
					files.map((file) =>
						fetch(`${workerUrl}/api/delete-file`, {
							method: 'DELETE',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ r2_key: file.r2_key }),
						})
					)
				);
			}

			// Delete all projects (cascades to project conversations and messages)
			deleteAllStatus = 'Deleting projects...';
			const { error: projectsError } = await supabase
				.from('projects')
				.delete()
				.eq('user_id', user.id);

			if (projectsError) throw new Error(`Failed to delete projects: ${projectsError.message}`);

			// Delete all tasks
			deleteAllStatus = 'Deleting tasks...';
			const { error: tasksError } = await supabase
				.from('tasks')
				.delete()
				.eq('user_id', user.id);

			if (tasksError) throw new Error(`Failed to delete tasks: ${tasksError.message}`);

			// Delete all notes (cascades to note_blocks)
			deleteAllStatus = 'Deleting notes...';
			const { error: notesError } = await supabase
				.from('notes')
				.delete()
				.eq('user_id', user.id);

			if (notesError) throw new Error(`Failed to delete notes: ${notesError.message}`);

			deleteAllStatus = '✅ Successfully deleted all content. Refreshing...';

			// Refresh after 1.5 seconds
			setTimeout(() => {
				window.location.reload();
			}, 1500);

		} catch (error) {
			deleteAllStatus = `Error: ${error instanceof Error ? error.message : String(error)}`;
		} finally {
			deletingAll = false;
		}
	}
</script>

<AppLayout>
	<div class="settings-page">
		<div class="settings-container">
			<div class="settings-header">
				<h1>Settings</h1>
				<button class="mobile-close-button" on:click={() => window.history.back()}>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
						<path d="M18 6L6 18M6 6l12 12"/>
					</svg>
				</button>
			</div>

			<div class="settings-section">
				<div class="section-header">
					<h2>Account</h2>
				</div>
				<div class="section-content">
					<p class="user-email">Signed in as: <strong>{userEmail}</strong></p>
				</div>
			</div>

			<div class="settings-section">
				<div class="section-header">
					<h2>Appearance</h2>
				</div>
				<div class="section-content">
					<div class="theme-toggle-container">
						<div class="theme-toggle-label">
							<h3>Theme</h3>
							<p class="theme-description">Choose your preferred color scheme</p>
						</div>
						<button class="theme-toggle" on:click={toggleTheme} aria-label="Toggle theme">
							<div class="toggle-track" class:active={theme === 'dark'}>
								<div class="toggle-thumb"></div>
							</div>
							<span class="theme-text">{theme === 'light' ? 'Light' : 'Dark'}</span>
						</button>
					</div>
				</div>
			</div>

			<div class="settings-section danger-zone">
				<div class="section-header">
					<h2>Danger Zone</h2>
				</div>
				<div class="section-content">
					<div class="danger-item">
						<h3 class="danger-item-title">Clear All Chat History</h3>
						<p class="section-description">
							Clear all your conversation history across the entire app. This will delete all messages in Global Chat, Tasks Chat, Notes Chat, and Project Chats. Note: This does not delete your files, projects, tasks, or notes.
						</p>

						<button
							class="danger-btn"
							on:click={clearChatHistory}
							disabled={cleaning}
						>
							{cleaning ? 'Clearing...' : 'Clear All Chat History'}
						</button>

						{#if status}
							<div class="status" class:success={status.includes('✅')} class:error={status.includes('Error')}>
								{status}
							</div>
						{/if}
					</div>

					<div class="danger-divider"></div>

					<div class="danger-item">
						<h3 class="danger-item-title">Delete All Content</h3>
						<p class="section-description">
							Permanently delete all your content including projects, tasks, notes, files, and images. This action cannot be undone.
						</p>

						<button
							class="danger-btn"
							on:click={() => showDeleteAllModal = true}
							disabled={deletingAll}
						>
							{deletingAll ? 'Deleting...' : 'Delete All Content'}
						</button>

						{#if deleteAllStatus}
							<div class="status" class:success={deleteAllStatus.includes('✅')} class:error={deleteAllStatus.includes('Error')}>
								{deleteAllStatus}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>

{#if showDeleteAllModal}
	<div class="modal-overlay" on:click={() => { showDeleteAllModal = false; deleteConfirmText = ''; }}>
		<div class="modal" on:click|stopPropagation>
			<h2>⚠️ Delete All Content?</h2>
			<p class="warning-text">
				This will permanently delete:
			</p>
			<ul class="delete-list">
				<li>All projects and their conversations</li>
				<li>All tasks (completed and incomplete)</li>
				<li>All notes and attachments</li>
				<li>All files and uploads from storage</li>
			</ul>
			<p class="warning-text">
				<strong>This action cannot be undone.</strong>
			</p>

			<div class="form-group">
				<label for="confirm-delete">
					Type <strong>delete</strong> to confirm:
				</label>
				<input
					type="text"
					id="confirm-delete"
					bind:value={deleteConfirmText}
					placeholder="delete"
					autocomplete="off"
				/>
			</div>

			<div class="modal-actions">
				<button
					type="button"
					class="secondary-btn"
					on:click={() => { showDeleteAllModal = false; deleteConfirmText = ''; }}
				>
					Cancel
				</button>
				<button
					type="button"
					class="danger-btn"
					on:click={handleDeleteAllContent}
					disabled={!canDeleteAll}
				>
					Delete All Content
				</button>
			</div>
		</div>
	</div>
{/if}
</AppLayout>

<style>
	.settings-page {
		padding: 32px 24px;
		max-width: 800px;
		margin: 0 auto;
	}

	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 32px;
	}

	.settings-container h1 {
		font-size: 2rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.mobile-close-button {
		display: none;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: none;
		border: none;
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.mobile-close-button:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.mobile-close-button:active {
		transform: scale(0.95);
	}

	@media (max-width: 1023px) {
		.mobile-close-button {
			display: flex;
		}
	}

	.settings-section {
		margin-bottom: 32px;
		padding: 24px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
	}

	.settings-section.danger-zone {
		border-color: rgba(239, 68, 68, 0.3);
	}

	.section-header {
		margin-bottom: 16px;
	}

	.section-header h2 {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.section-content {
		color: var(--text-secondary);
	}

	.user-email {
		margin: 0;
		font-size: 0.9375rem;
	}

	.danger-item {
		margin-bottom: 0;
	}

	.danger-item-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary) !important;
		margin: 0 0 8px 0;
	}

	.danger-divider {
		height: 1px;
		background: var(--border-color);
		margin: 40px 0;
		opacity: 0.5;
	}

	.section-description {
		margin: 0 0 16px 0;
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.danger-btn {
		padding: 12px 24px;
		background: rgb(239, 68, 68);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 200px;
	}

	.danger-btn:hover:not(:disabled) {
		background: rgb(220, 38, 38);
		transform: translateY(-1px);
	}

	.danger-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.status {
		margin-top: 16px;
		padding: 12px 16px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-size: 0.9375rem;
		line-height: 1.6;
	}

	.status.success {
		background: rgba(34, 197, 94, 0.1);
		border-color: rgba(34, 197, 94, 0.3);
		color: rgb(34, 197, 94);
	}

	.status.error {
		background: rgba(239, 68, 68, 0.1);
		border-color: rgba(239, 68, 68, 0.3);
		color: rgb(239, 68, 68);
	}

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
		padding: 32px;
		max-width: 500px;
		width: 100%;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	.modal h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 20px 0;
	}

	.warning-text {
		color: rgb(239, 68, 68);
		font-size: 0.9375rem;
		line-height: 1.6;
		margin: 12px 0;
	}

	.delete-list {
		margin: 12px 0;
		padding-left: 24px;
		color: var(--text-secondary);
		font-size: 0.9375rem;
		line-height: 1.8;
	}

	.delete-list li {
		margin: 4px 0;
	}

	.form-group {
		margin: 20px 0;
	}

	.form-group label {
		display: block;
		font-size: 0.9375rem;
		color: var(--text-primary);
		margin-bottom: 8px;
	}

	.form-group input {
		width: 100%;
		padding: 12px 16px;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: inherit;
		transition: all 0.2s ease;
	}

	.form-group input:focus {
		outline: none;
		border-color: rgb(59, 130, 246);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		margin-top: 24px;
		justify-content: flex-end;
	}

	.secondary-btn {
		padding: 12px 24px;
		background: var(--bg-tertiary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.secondary-btn:hover {
		background: var(--bg-primary);
	}

	/* Theme Toggle */
	.theme-toggle-container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.theme-toggle-label h3 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 4px 0;
	}

	.theme-description {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.theme-toggle {
		display: flex;
		align-items: center;
		gap: 12px;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.toggle-track {
		position: relative;
		width: 52px;
		height: 28px;
		background: var(--border-color);
		border-radius: 14px;
		transition: all 0.3s ease;
	}

	.toggle-track.active {
		background: var(--accent-primary);
	}

	.toggle-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 22px;
		height: 22px;
		background: white;
		border-radius: 50%;
		transition: transform 0.3s ease;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.toggle-track.active .toggle-thumb {
		transform: translateX(24px);
	}

	.theme-text {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--text-primary);
		min-width: 50px;
	}

	@media (max-width: 640px) {
		.modal {
			padding: 24px;
		}

		.modal-actions {
			flex-direction: column;
		}

		.modal-actions button {
			width: 100%;
		}
	}
</style>
