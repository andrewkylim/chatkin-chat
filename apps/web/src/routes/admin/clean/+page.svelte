<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';

	let status = '';
	let cleaning = false;

	$: isAuthenticated = !!$auth.user;
	$: userEmail = $auth.user?.email || '';

	async function cleanConversations() {
		if (!confirm('Are you sure you want to delete ALL conversations and messages? This cannot be undone.')) {
			return;
		}

		if (!$auth.user) {
			status = 'Error: Not authenticated';
			return;
		}

		cleaning = true;
		status = 'Fetching conversations...';

		try {
			const user = $auth.user;
			status = `Cleaning conversations for ${user.email}...`;

			// Get all conversations for this user
			const { data: conversations, error: convError } = await supabase
				.from('conversations')
				.select('id, scope, title')
				.eq('user_id', user.id);

			if (convError) {
				status = `Error fetching conversations: ${convError.message}`;
				cleaning = false;
				return;
			}

			if (!conversations || conversations.length === 0) {
				status = 'No conversations found to delete.';
				cleaning = false;
				return;
			}

			status = `Found ${conversations.length} conversations. Deleting messages...`;

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

			status = 'Messages deleted. Deleting conversations...';

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

			const deletedList = conversations.map(c => `${c.scope}: ${c.title}`).join(', ');
			status = `✅ Success! Deleted ${conversations.length} conversations: ${deletedList}`;

			setTimeout(() => {
				goto('/');
			}, 3000);

		} catch (error) {
			status = `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
		} finally {
			cleaning = false;
		}
	}
</script>

<div class="admin-page">
	<div class="container">
		<h1>Clean Conversations</h1>

		{#if isAuthenticated}
			<p class="info">Logged in as: <strong>{userEmail}</strong></p>
			<p class="warning">
				⚠️ This will delete ALL your conversations and messages across all scopes (global, tasks, notes, projects).
				This action cannot be undone.
			</p>

			<button
				class="danger-btn"
				on:click={cleanConversations}
				disabled={cleaning}
			>
				{cleaning ? 'Cleaning...' : 'Delete All Conversations'}
			</button>
		{:else}
			<p class="warning">
				⚠️ You must be logged in to use this feature.
			</p>
			<a href="/" class="primary-btn">Go to Login</a>
		{/if}

		{#if status}
			<div class="status" class:success={status.includes('✅')}>
				{status}
			</div>
		{/if}

		<a href="/" class="back-link">← Back to Home</a>
	</div>
</div>

<style>
	.admin-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		background: var(--bg-primary);
	}

	.container {
		max-width: 600px;
		width: 100%;
		padding: 40px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		text-align: center;
	}

	h1 {
		font-size: 2rem;
		margin-bottom: 20px;
		color: var(--text-primary);
	}

	.info {
		padding: 16px;
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.3);
		border-radius: var(--radius-md);
		color: rgb(59, 130, 246);
		margin-bottom: 20px;
		line-height: 1.6;
	}

	.warning {
		padding: 20px;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: var(--radius-md);
		color: rgb(239, 68, 68);
		margin-bottom: 30px;
		line-height: 1.6;
	}

	.primary-btn {
		display: inline-block;
		padding: 14px 32px;
		background: var(--accent-primary);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.primary-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.danger-btn {
		padding: 14px 32px;
		background: rgb(239, 68, 68);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
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
		margin-top: 30px;
		padding: 16px;
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

	.back-link {
		display: inline-block;
		margin-top: 30px;
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 0.9375rem;
		transition: color 0.2s ease;
	}

	.back-link:hover {
		color: var(--text-primary);
	}
</style>
