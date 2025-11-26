<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import { supabase } from '$lib/supabase';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	let status = '';
	let cleaning = false;

	$: userEmail = $auth.user?.email || '';

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
					<h2>Chat History</h2>
				</div>
				<div class="section-content">
					<p class="section-description">
						Clear all your conversation history across the entire app. This will delete all messages in Global Chat, Tasks Chat, Notes Chat, and Project Chats.
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
			</div>
		</div>
	</div>
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

	.section-description {
		margin: 0 0 20px 0;
		font-size: 0.9375rem;
		line-height: 1.6;
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
</style>
