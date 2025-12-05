<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import { supabase } from '$lib/supabase';
	import { auth } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getNotificationPreferences, updateNotificationPreferences } from '$lib/db/notification-preferences';
	import { browserNotifications } from '$lib/services/browser-notifications';
	import type { UserNotificationPreferences } from '@chatkin/types';

	let status = '';
	let cleaning = false;

	let showDeleteAllModal = false;
	let deleteConfirmText = '';
	let deleteAllStatus = '';
	let deletingAll = false;

	let showRetakeModal = false;

	// Collapsible sections
	let notificationsExpanded = false;
	let dangerZoneExpanded = false;

	// Theme state
	let theme: 'light' | 'dark' = 'light';

	// Notification preferences state
	let notificationPrefs: UserNotificationPreferences | null = null;
	let loadingPrefs = true;
	let savingPrefs = false;
	let prefsStatus = '';
	let browserPermissionStatus: NotificationPermission = 'default';

	$: userEmail = $auth.user?.email || '';
	$: canDeleteAll = deleteConfirmText.toLowerCase() === 'delete';

	onMount(async () => {
		// Load theme preference from localStorage
		const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
		if (savedTheme) {
			theme = savedTheme;
			applyTheme(savedTheme);
		}

		// Load notification preferences
		try {
			notificationPrefs = await getNotificationPreferences();
			browserPermissionStatus = Notification.permission;
		} catch (_error) {
			console.error('Failed to load notification preferences:', _error);
			prefsStatus = 'Failed to load preferences';
		} finally {
			loadingPrefs = false;
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

	async function toggleEmailNotification(type: 'task_due_soon' | 'ai_proposals' | 'ai_insights') {
		if (!notificationPrefs) return;

		savingPrefs = true;
		try {
			const field = `email_${type}` as keyof UserNotificationPreferences;
			const newValue = !notificationPrefs[field];

			notificationPrefs = await updateNotificationPreferences({
				[field]: newValue
			});

			prefsStatus = 'Saved';
			setTimeout(() => (prefsStatus = ''), 2000);
		} catch {
			prefsStatus = 'Error saving preferences';
		} finally {
			savingPrefs = false;
		}
	}

	async function toggleBrowserNotification(type: 'task_due_soon' | 'ai_proposals' | 'ai_insights') {
		if (!notificationPrefs) return;

		// Check browser permission first
		if (browserPermissionStatus !== 'granted') {
			const granted = await browserNotifications.requestPermission();
			browserPermissionStatus = granted ? 'granted' : 'denied';

			if (!granted) {
				prefsStatus = 'Browser notification permission denied';
				setTimeout(() => (prefsStatus = ''), 3000);
				return;
			}
		}

		savingPrefs = true;
		try {
			const field = `browser_${type}` as keyof UserNotificationPreferences;
			const newValue = !notificationPrefs[field];

			notificationPrefs = await updateNotificationPreferences({
				[field]: newValue
			});

			prefsStatus = 'Saved';
			setTimeout(() => (prefsStatus = ''), 2000);
		} catch {
			prefsStatus = 'Error saving preferences';
		} finally {
			savingPrefs = false;
		}
	}

	async function toggleReminderTime(hours: number, enabled: boolean) {
		if (!notificationPrefs) return;

		savingPrefs = true;
		try {
			let times = [...notificationPrefs.task_reminder_times];

			if (enabled) {
				if (!times.includes(hours)) {
					times.push(hours);
				}
			} else {
				times = times.filter(h => h !== hours);
			}

			// Ensure at least one reminder time
			if (times.length === 0) {
				times = [24];
			}

			notificationPrefs = await updateNotificationPreferences({
				task_reminder_times: times
			});

			prefsStatus = 'Saved';
			setTimeout(() => (prefsStatus = ''), 2000);
		} catch {
			prefsStatus = 'Error saving preferences';
		} finally {
			savingPrefs = false;
		}
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
			const { data: conversations, error: _convError } = await supabase
				.from('conversations')
				.select('id, scope')
				.eq('user_id', user.id);

			if (_convError) {
				status = `Error: ${_convError.message}`;
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

			const { error: _msgError } = await supabase
				.from('messages')
				.delete()
				.in('conversation_id', conversationIds);

			if (_msgError) {
				status = `Error deleting messages: ${_msgError.message}`;
				cleaning = false;
				return;
			}

			// Delete all conversations
			const { error: _delError } = await supabase
				.from('conversations')
				.delete()
				.eq('user_id', user.id);

			if (_delError) {
				status = `Error deleting conversations: ${_delError.message}`;
				cleaning = false;
				return;
			}

			status = `✅ Successfully deleted ${conversations.length} conversation(s). Refreshing...`;

			// Refresh page after 1.5 seconds
			setTimeout(() => {
				window.location.reload();
			}, 1500);

		} catch (_error) {
			status = `Error: ${_error instanceof Error ? _error.message : String(_error)}`;
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

			// Get session for authentication
			const { data: { session } } = await supabase.auth.getSession();
			const accessToken = session?.access_token;

			// First, get all files to retrieve r2_keys for deletion
			deleteAllStatus = 'Deleting files from storage...';
			const { data: files, error: _filesQueryError } = await supabase
				.from('files')
				.select('id, r2_key')
				.eq('user_id', user.id);

			if (_filesQueryError) throw new Error(`Failed to query files: ${_filesQueryError.message}`);

			// Delete all files from database
			const { error: _filesError } = await supabase
				.from('files')
				.delete()
				.eq('user_id', user.id);

			if (_filesError) throw new Error(`Failed to delete files: ${_filesError.message}`);

			// Delete files from R2 storage in parallel
			if (files && files.length > 0) {
				const workerUrl = import.meta.env.DEV ? 'http://localhost:8787' : 'https://chatkin.ai';
				await Promise.allSettled(
					files.map((file) =>
						fetch(`${workerUrl}/api/delete-file`, {
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
								...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
							},
							body: JSON.stringify({ r2_key: file.r2_key }),
						})
					)
				);
			}

			// Delete all tasks
			deleteAllStatus = 'Deleting tasks...';
			const { error: _tasksError } = await supabase
				.from('tasks')
				.delete()
				.eq('user_id', user.id);

			if (_tasksError) throw new Error(`Failed to delete tasks: ${_tasksError.message}`);

			// Delete all notes (cascades to note_blocks)
			deleteAllStatus = 'Deleting notes...';
			const { error: _notesError } = await supabase
				.from('notes')
				.delete()
				.eq('user_id', user.id);

			if (_notesError) throw new Error(`Failed to delete notes: ${_notesError.message}`);

			// Delete all conversations and messages
			deleteAllStatus = 'Deleting chat conversations...';
			const { data: conversations, error: _convError } = await supabase
				.from('conversations')
				.select('id')
				.eq('user_id', user.id);

			if (_convError) throw new Error(`Failed to query conversations: ${_convError.message}`);

			if (conversations && conversations.length > 0) {
				const conversationIds = conversations.map(c => c.id);

				// Delete all messages for these conversations
				const { error: _msgError } = await supabase
					.from('messages')
					.delete()
					.in('conversation_id', conversationIds);

				if (_msgError) throw new Error(`Failed to delete messages: ${_msgError.message}`);

				// Delete all conversations
				const { error: _delConvError } = await supabase
					.from('conversations')
					.delete()
					.eq('user_id', user.id);

				if (_delConvError) throw new Error(`Failed to delete conversations: ${_delConvError.message}`);
			}

			// Delete assessment responses
			deleteAllStatus = 'Deleting assessment responses...';
			const { error: _responsesError } = await supabase
				.from('assessment_responses')
				.delete()
				.eq('user_id', user.id);

			if (_responsesError) throw new Error(`Failed to delete assessment responses: ${_responsesError.message}`);

			// Delete assessment results
			deleteAllStatus = 'Deleting assessment results...';
			const { error: _resultsError } = await supabase
				.from('assessment_results')
				.delete()
				.eq('user_id', user.id);

			if (_resultsError) throw new Error(`Failed to delete assessment results: ${_resultsError.message}`);

			// Delete user profile
			deleteAllStatus = 'Deleting user profile...';
			const { error: _profileError } = await supabase
				.from('user_profiles')
				.delete()
				.eq('user_id', user.id);

			if (_profileError) throw new Error(`Failed to delete user profile: ${_profileError.message}`);

			deleteAllStatus = '✅ Successfully deleted all content. Refreshing...';

			// Refresh after 1.5 seconds
			setTimeout(() => {
				window.location.reload();
			}, 1500);

		} catch (_error) {
			deleteAllStatus = `Error: ${_error instanceof Error ? _error.message : String(_error)}`;
		} finally {
			deletingAll = false;
		}
	}

	async function handleRetakeAssessment() {
		if (!$auth.user) return;

		try {
			const user = $auth.user;

			// Delete all content first (same as handleDeleteAllContent)
			const { data: { session } } = await supabase.auth.getSession();
			const accessToken = session?.access_token;

			// Delete files from database and R2 storage
			const { data: files } = await supabase
				.from('files')
				.select('id, r2_key')
				.eq('user_id', user.id);

			const { error: _filesError } = await supabase
				.from('files')
				.delete()
				.eq('user_id', user.id);

			if (_filesError) throw _filesError;

			if (files && files.length > 0) {
				const workerUrl = import.meta.env.DEV ? 'http://localhost:8787' : 'https://chatkin.ai';
				await Promise.allSettled(
					files.map((file) =>
						fetch(`${workerUrl}/api/delete-file`, {
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
								...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
							},
							body: JSON.stringify({ r2_key: file.r2_key }),
						})
					)
				);
			}

			// Delete all tasks
			await supabase.from('tasks').delete().eq('user_id', user.id);

			// Delete all notes
			await supabase.from('notes').delete().eq('user_id', user.id);

			// Delete assessment responses
			await supabase.from('assessment_responses').delete().eq('user_id', user.id);

			// Delete assessment results
			await supabase.from('assessment_results').delete().eq('user_id', user.id);

			// NOW update the profile to mark questionnaire as incomplete
			const { error: _updateError } = await supabase
				.from('user_profiles')
				.update({
					has_completed_questionnaire: false,
					updated_at: new Date().toISOString()
				})
				.eq('user_id', user.id);

			if (_updateError) throw _updateError;

			// Close modal and redirect
			showRetakeModal = false;
			goto('/questionnaire');
		} catch (_err) {
			console.error('Error retaking questionnaire:', _err);
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

			<div class="settings-section collapsible">
				<button class="section-header collapsible-header" on:click={() => notificationsExpanded = !notificationsExpanded}>
					<h2>Notifications</h2>
					<svg
						class="chevron"
						class:expanded={notificationsExpanded}
						width="20"
						height="20"
						viewBox="0 0 20 20"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					>
						<path d="M6 8l4 4 4-4"/>
					</svg>
				</button>
				{#if notificationsExpanded}
				<div class="section-content">
					{#if loadingPrefs}
						<p>Loading preferences...</p>
					{:else if notificationPrefs}
						<div class="notification-category">
							<h3>Task Reminders</h3>
							<p class="section-description">Get notified when tasks are due soon</p>

							<div class="notification-toggle-row">
								<div class="toggle-label">
									<span>Email notifications</span>
									<p class="toggle-description">Receive email reminders</p>
								</div>
								<button
									class="toggle-switch"
									class:active={notificationPrefs.email_task_due_soon}
									on:click={() => toggleEmailNotification('task_due_soon')}
									disabled={savingPrefs}
								>
									<div class="toggle-track" class:active={notificationPrefs.email_task_due_soon}>
										<div class="toggle-thumb"></div>
									</div>
								</button>
							</div>

							<div class="notification-toggle-row">
								<div class="toggle-label">
									<span>Browser notifications</span>
									<p class="toggle-description">Receive browser push notifications</p>
								</div>
								<button
									class="toggle-switch"
									class:active={notificationPrefs.browser_task_due_soon}
									on:click={() => toggleBrowserNotification('task_due_soon')}
									disabled={savingPrefs}
								>
									<div class="toggle-track" class:active={notificationPrefs.browser_task_due_soon}>
										<div class="toggle-thumb"></div>
									</div>
								</button>
							</div>

							<div class="reminder-timing">
								<label>Send reminders</label>
								<p class="reminder-description">Select when to receive task reminders</p>
								<div class="reminder-options">
									<label class="reminder-checkbox">
										<input
											type="checkbox"
											checked={notificationPrefs.task_reminder_times.includes(1)}
											on:change={(e) => toggleReminderTime(1, e.currentTarget.checked)}
											disabled={savingPrefs}
										/>
										<span>1 hour before</span>
									</label>
									<label class="reminder-checkbox">
										<input
											type="checkbox"
											checked={notificationPrefs.task_reminder_times.includes(24)}
											on:change={(e) => toggleReminderTime(24, e.currentTarget.checked)}
											disabled={savingPrefs}
										/>
										<span>1 day before</span>
									</label>
									<label class="reminder-checkbox">
										<input
											type="checkbox"
											checked={notificationPrefs.task_reminder_times.includes(168)}
											on:change={(e) => toggleReminderTime(168, e.currentTarget.checked)}
											disabled={savingPrefs}
										/>
										<span>1 week before</span>
									</label>
								</div>
							</div>
						</div>

						<div class="notification-divider"></div>

						<div class="notification-category">
							<h3>AI Proposals</h3>
							<p class="section-description">Get notified when AI suggests actions</p>

							<div class="notification-toggle-row">
								<div class="toggle-label">
									<span>Email notifications</span>
								</div>
								<button
									class="toggle-switch"
									class:active={notificationPrefs.email_ai_proposals}
									on:click={() => toggleEmailNotification('ai_proposals')}
									disabled={savingPrefs}
								>
									<div class="toggle-track" class:active={notificationPrefs.email_ai_proposals}>
										<div class="toggle-thumb"></div>
									</div>
								</button>
							</div>

							<div class="notification-toggle-row">
								<div class="toggle-label">
									<span>Browser notifications</span>
								</div>
								<button
									class="toggle-switch"
									class:active={notificationPrefs.browser_ai_proposals}
									on:click={() => toggleBrowserNotification('ai_proposals')}
									disabled={savingPrefs}
								>
									<div class="toggle-track" class:active={notificationPrefs.browser_ai_proposals}>
										<div class="toggle-thumb"></div>
									</div>
								</button>
							</div>
						</div>

						<div class="notification-divider"></div>

						<div class="notification-category">
							<h3>AI Insights</h3>
							<p class="section-description">Get notified about AI-generated insights</p>

							<div class="notification-toggle-row">
								<div class="toggle-label">
									<span>Email notifications</span>
								</div>
								<button
									class="toggle-switch"
									class:active={notificationPrefs.email_ai_insights}
									on:click={() => toggleEmailNotification('ai_insights')}
									disabled={savingPrefs}
								>
									<div class="toggle-track" class:active={notificationPrefs.email_ai_insights}>
										<div class="toggle-thumb"></div>
									</div>
								</button>
							</div>

							<div class="notification-toggle-row">
								<div class="toggle-label">
									<span>Browser notifications</span>
								</div>
								<button
									class="toggle-switch"
									class:active={notificationPrefs.browser_ai_insights}
									on:click={() => toggleBrowserNotification('ai_insights')}
									disabled={savingPrefs}
								>
									<div class="toggle-track" class:active={notificationPrefs.browser_ai_insights}>
										<div class="toggle-thumb"></div>
									</div>
								</button>
							</div>
						</div>

						{#if prefsStatus}
							<div class="status" class:success={prefsStatus === 'Saved'} class:error={prefsStatus.includes('Error')}>
								{prefsStatus}
							</div>
						{/if}
					{:else}
						<p class="error">Failed to load notification preferences</p>
					{/if}
				</div>
				{/if}
			</div>

			<div class="settings-section danger-zone collapsible">
				<button class="section-header collapsible-header" on:click={() => dangerZoneExpanded = !dangerZoneExpanded}>
					<h2>Danger Zone</h2>
					<svg
						class="chevron"
						class:expanded={dangerZoneExpanded}
						width="20"
						height="20"
						viewBox="0 0 20 20"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					>
						<path d="M6 8l4 4 4-4"/>
					</svg>
				</button>
				{#if dangerZoneExpanded}
				<div class="section-content">
					<div class="danger-item">
						<h3 class="danger-item-title">Clear All Chat History</h3>
						<p class="section-description">
							Clear all your conversation history across the entire app. This will delete all messages in Global Chat, Tasks Chat, Notes Chat, and Domain Chats. Note: This does not delete your files, tasks, or notes.
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
						<h3 class="danger-item-title">Retake Assessment</h3>
						<p class="section-description">
							Retake the assessment to update your profile. This will delete all existing tasks, notes, and files. This action cannot be undone.
						</p>

						<button
							class="danger-btn"
							on:click={() => showRetakeModal = true}
						>
							Retake Assessment
						</button>
					</div>

					<div class="danger-divider"></div>

					<div class="danger-item">
						<h3 class="danger-item-title">Delete All Content</h3>
						<p class="section-description">
							Permanently delete all your content including chat conversations, tasks, notes, files, and images. This action cannot be undone.
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
				{/if}
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
				<li>All chat conversations and messages</li>
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

{#if showRetakeModal}
	<div class="modal-overlay" on:click={() => showRetakeModal = false}>
		<div class="modal" on:click|stopPropagation>
			<div class="modal-header-with-icon">
				<svg class="warning-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M12 2L2 20h20L12 2z" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
					<path d="M12 9v4" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/>
					<circle cx="12" cy="17" r="0.5" fill="#F59E0B" stroke="#F59E0B" stroke-width="1"/>
				</svg>
				<h2>Retake Assessment?</h2>
			</div>
			<p class="warning-text">
				Retaking this assessment will delete all your existing content:
			</p>
			<ul class="delete-list">
				<li>All projects</li>
				<li>All tasks</li>
				<li>All notes</li>
				<li>Your assessment results</li>
			</ul>
			<p class="warning-text">
				Your current progress will be replaced with new AI-generated content based on your updated responses.
			</p>

			<div class="modal-actions">
				<button
					type="button"
					class="secondary-btn"
					on:click={() => showRetakeModal = false}
				>
					Cancel
				</button>
				<button
					type="button"
					class="danger-btn"
					on:click={handleRetakeAssessment}
				>
					Continue & Delete All
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

	.settings-section.collapsible {
		padding: 16px 24px;
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
		line-height: 1;
	}

	.collapsible-header {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		transition: all 0.2s ease;
		margin-bottom: 0;
	}

	.collapsible-header:hover h2 {
		color: var(--accent-primary);
	}

	.chevron {
		color: var(--text-secondary);
		transition: transform 0.3s ease;
		flex-shrink: 0;
	}

	.chevron.expanded {
		transform: rotate(180deg);
	}

	.collapsible .section-content {
		margin-top: 16px;
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
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.danger-item-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary) !important;
		margin: 0;
	}

	.danger-divider {
		height: 1px;
		background: var(--border-color);
		margin: 32px 0;
		opacity: 0.5;
	}

	.section-description {
		margin: 0;
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
		align-self: flex-start;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.danger-btn:hover:not(:disabled) {
		background: rgb(220, 38, 38);
		transform: translateY(-1px);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}

	.danger-btn:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.danger-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.status {
		margin-top: 0;
		padding: 12px 16px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-size: 0.875rem;
		line-height: 1.5;
		align-self: stretch;
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

	.modal-header-with-icon {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 20px;
	}

	.modal-header-with-icon h2 {
		margin: 0;
	}

	.warning-icon {
		flex-shrink: 0;
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

	@media (max-width: 768px) {
		.settings-page {
			padding: 20px 16px;
		}

		.settings-header {
			margin-bottom: 24px;
		}

		.settings-container h1 {
			font-size: 1.5rem;
		}

		.settings-section {
			padding: 20px 16px;
			margin-bottom: 24px;
		}

		.settings-section.collapsible {
			padding: 12px 16px;
		}

		.section-header h2 {
			font-size: 1.125rem;
		}

		.danger-item-title {
			font-size: 1rem;
		}

		.section-description {
			font-size: 0.8125rem;
		}

		.danger-btn {
			width: 100%;
			min-width: unset;
		}

		.danger-divider {
			margin: 24px 0;
		}
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

	/* Notification Settings */
	.notification-category {
		margin-bottom: 24px;
	}

	.notification-category h3 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 8px 0;
	}

	.notification-toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 0;
		border-bottom: 1px solid var(--border-color);
	}

	.notification-toggle-row:last-child {
		border-bottom: none;
	}

	.toggle-label {
		flex: 1;
	}

	.toggle-label span {
		display: block;
		font-size: 0.9375rem;
		color: var(--text-primary);
		margin-bottom: 2px;
	}

	.toggle-description {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.toggle-switch {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.toggle-switch:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.notification-divider {
		height: 1px;
		background: var(--border-color);
		margin: 24px 0;
		opacity: 0.5;
	}

	.reminder-timing {
		margin-top: 16px;
		padding: 16px 0;
	}

	.reminder-timing > label {
		display: block;
		font-size: 0.875rem;
		color: var(--text-primary);
		margin-bottom: 4px;
		font-weight: 500;
	}

	.reminder-description {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		margin: 0 0 12px 0;
	}

	.reminder-options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.reminder-checkbox {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		cursor: pointer;
		font-size: 0.9375rem;
		color: var(--text-primary);
	}

	.reminder-checkbox input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: var(--accent-primary);
	}

	.reminder-checkbox input[type="checkbox"]:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.reminder-checkbox span {
		user-select: none;
	}
</style>
