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

	let retaking = false;

	// Collapsible sections
	let notificationsExpanded = false;
	let aiPreferencesExpanded = false;
	let dangerZoneExpanded = false;

	// Theme state
	let theme: 'light' | 'dark' = 'light';

	// AI Preferences state
	interface UserAIPreferences {
		ai_tone: 'challenging' | 'supportive' | 'balanced';
		proactivity_level: 'high' | 'medium' | 'low';
		communication_style: 'brief' | 'detailed' | 'conversational';
	}
	let aiPreferences: UserAIPreferences | null = null;
	let loadingAIPrefs = true;
	let savingAIPrefs = false;
	let aiPrefsStatus = '';

	// Notification preferences state
	let notificationPrefs: UserNotificationPreferences | null = null;
	let loadingPrefs = true;
	let savingPrefs = false;
	let prefsStatus = '';
	let browserPermissionStatus: NotificationPermission = 'default';

	$: userEmail = $auth.user?.email || '';

	onMount(async () => {
		// Load theme preference from localStorage
		const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
		if (savedTheme) {
			theme = savedTheme;
			applyTheme(savedTheme);
		}

		// Wait for auth to finish loading
		if ($auth.loading) {
			const unsubscribe = auth.subscribe((state) => {
				if (!state.loading) {
					unsubscribe();
					if (state.user) {
						loadPreferences();
					} else {
						loadingAIPrefs = false;
						loadingPrefs = false;
					}
				}
			});
		} else if ($auth.user) {
			await loadPreferences();
		} else {
			loadingAIPrefs = false;
			loadingPrefs = false;
		}
	});

	async function loadPreferences() {
		// Load AI preferences
		try {
			if (!$auth.user) {
				loadingAIPrefs = false;
				return;
			}

			const { data: profileData, error: profileError } = await supabase
				.from('user_profiles')
				.select('ai_tone, proactivity_level, communication_style')
				.eq('user_id', $auth.user.id)
				.single();

			if (profileError) {
				throw profileError;
			}

			if (profileData) {
				aiPreferences = {
					ai_tone: profileData.ai_tone,
					proactivity_level: profileData.proactivity_level,
					communication_style: profileData.communication_style
				};
			}
		} catch (_error) {
			console.error('Failed to load AI preferences:', _error);
			aiPrefsStatus = 'Failed to load AI preferences';
		} finally {
			loadingAIPrefs = false;
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
	}

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

	async function saveAIPreferences() {
		if (!aiPreferences) return;

		savingAIPrefs = true;
		aiPrefsStatus = '';

		try {
			const { data: { session } } = await supabase.auth.getSession();
			const accessToken = session?.access_token;

			if (!accessToken) {
				throw new Error('Not authenticated');
			}

			const workerUrl = import.meta.env.DEV ? 'http://localhost:8787' : 'https://chatkin.ai';
			const response = await fetch(`${workerUrl}/api/update-preferences`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify({
					ai_tone: aiPreferences.ai_tone,
					proactivity_level: aiPreferences.proactivity_level,
					communication_style: aiPreferences.communication_style
				})
			});

			if (!response.ok) {
				throw new Error('Failed to save AI preferences');
			}

			aiPrefsStatus = 'Saved';
			setTimeout(() => {
				aiPrefsStatus = '';
			}, 2000);
		} catch (_error) {
			console.error('Failed to save AI preferences:', _error);
			aiPrefsStatus = 'Error saving AI preferences';
		} finally {
			savingAIPrefs = false;
		}
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

	async function handleRetakeAssessment() {
		if (!$auth.user) return;

		// Confirm before deleting everything
		if (!confirm('⚠️ This will delete ALL your tasks, notes, files, and chat conversations.\n\nYou will be redirected to retake the assessment.\n\nThis action cannot be undone. Continue?')) {
			return;
		}

		retaking = true;

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

			// Delete all conversations and messages
			const { data: conversations } = await supabase
				.from('conversations')
				.select('id')
				.eq('user_id', user.id);

			if (conversations && conversations.length > 0) {
				const conversationIds = conversations.map(c => c.id);
				await supabase.from('messages').delete().in('conversation_id', conversationIds);
				await supabase.from('conversations').delete().eq('user_id', user.id);
			}

			// Delete assessment responses
			await supabase.from('assessment_responses').delete().eq('user_id', user.id);

			// Delete assessment results (CRITICAL: must complete before redirect)
			const { error: deleteAssessmentError, data: deletedData } = await supabase
				.from('assessment_results')
				.delete()
				.eq('user_id', user.id);

			console.log('[Retake] Deleted assessment_results:', deletedData, 'Error:', deleteAssessmentError);

			if (deleteAssessmentError) {
				console.error('Failed to delete assessment results:', deleteAssessmentError);
				alert('Failed to reset assessment. Please try again.');
				retaking = false;
				return;
			}

			// Verify deletion worked
			const { data: checkResults } = await supabase
				.from('assessment_results')
				.select('*')
				.eq('user_id', user.id)
				.maybeSingle();

			console.log('[Retake] Verification - assessment_results after delete:', checkResults);

			// Update the profile to mark questionnaire as incomplete
			const { error: _updateError } = await supabase
				.from('user_profiles')
				.update({
					has_completed_questionnaire: false,
					updated_at: new Date().toISOString()
				})
				.eq('user_id', user.id);

			console.log('[Retake] Updated profile, error:', _updateError);

			if (_updateError) {
				console.error('Failed to update profile:', _updateError);
				alert('Failed to reset profile. Please try again.');
				retaking = false;
				return;
			}

			// Redirect to questionnaire
			console.log('[Retake] Redirecting to /questionnaire');
			goto('/questionnaire');
		} catch (_err) {
			console.error('Error retaking questionnaire:', _err);
			alert('An error occurred. Please try again.');
			retaking = false;
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
				<button class="section-header collapsible-header" on:click={() => aiPreferencesExpanded = !aiPreferencesExpanded}>
					<h2>AI Preferences</h2>
					<svg
						class="chevron"
						class:expanded={aiPreferencesExpanded}
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
				{#if aiPreferencesExpanded}
				<div class="section-content">
					{#if loadingAIPrefs}
						<p>Loading preferences...</p>
					{:else if aiPreferences}
						<p class="section-description" style="margin-bottom: 20px;">
							Customize how Chatkin interacts with you. These preferences affect the AI's tone, proactivity, and communication style.
						</p>

						<div class="preference-group">
							<label for="ai-tone-setting">How should I coach you?</label>
							<select id="ai-tone-setting" bind:value={aiPreferences.ai_tone} on:change={saveAIPreferences} disabled={savingAIPrefs}>
								<option value="challenging">Direct and challenging</option>
								<option value="supportive">Supportive and encouraging</option>
								<option value="balanced">Balanced approach</option>
							</select>
							<p class="preference-description">
								{#if aiPreferences.ai_tone === 'challenging'}
									I'll call you out when you're avoiding things and use tough love to keep you accountable.
								{:else if aiPreferences.ai_tone === 'supportive'}
									I'll focus on your progress and wins, and be gentle in my guidance.
								{:else}
									I'll adapt my approach based on the situation, balancing challenge with support.
								{/if}
							</p>
						</div>

						<div class="preference-group">
							<label for="proactivity-setting">How proactive should I be?</label>
							<select id="proactivity-setting" bind:value={aiPreferences.proactivity_level} on:change={saveAIPreferences} disabled={savingAIPrefs}>
								<option value="high">Very proactive (suggest often)</option>
								<option value="medium">Somewhat proactive</option>
								<option value="low">Only when asked</option>
							</select>
							<p class="preference-description">
								{#if aiPreferences.proactivity_level === 'high'}
									I'll frequently spot patterns and suggest actions to help you stay on track.
								{:else if aiPreferences.proactivity_level === 'low'}
									I'll wait for you to ask before offering suggestions or insights.
								{:else}
									I'll balance between suggesting actions and waiting for your lead.
								{/if}
							</p>
						</div>

						<div class="preference-group">
							<label for="communication-setting">Communication style?</label>
							<select id="communication-setting" bind:value={aiPreferences.communication_style} on:change={saveAIPreferences} disabled={savingAIPrefs}>
								<option value="brief">Keep it brief</option>
								<option value="detailed">Give me context</option>
								<option value="conversational">Natural conversation</option>
							</select>
							<p class="preference-description">
								{#if aiPreferences.communication_style === 'brief'}
									I'll keep my responses short and to the point.
								{:else if aiPreferences.communication_style === 'detailed'}
									I'll provide thorough explanations with plenty of context.
								{:else}
									I'll communicate naturally with back-and-forth dialogue.
								{/if}
							</p>
						</div>

						{#if aiPrefsStatus}
							<div class="status" class:success={aiPrefsStatus === 'Saved'} class:error={aiPrefsStatus.includes('Error')}>
								{aiPrefsStatus}
							</div>
						{/if}
					{:else}
						<p class="error">Failed to load AI preferences</p>
					{/if}
				</div>
				{/if}
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
							Retake the assessment to update your profile. This will delete all existing tasks, notes, files, and chat conversations. This action cannot be undone.
						</p>

						<button
							class="danger-btn"
							on:click={handleRetakeAssessment}
							disabled={retaking}
						>
							{retaking ? 'Resetting...' : 'Retake Assessment'}
						</button>
					</div>

				</div>
				{/if}
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

	/* AI Preferences */
	.preference-group {
		margin-bottom: 24px;
	}

	.preference-group:last-of-type {
		margin-bottom: 16px;
	}

	.preference-group label {
		display: block;
		font-weight: 600;
		font-size: 0.9375rem;
		margin-bottom: 8px;
		color: var(--text-primary);
	}

	.preference-group select {
		width: 100%;
		padding: 12px 16px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s ease;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 16px center;
		padding-right: 44px;
	}

	.preference-group select:hover:not(:disabled) {
		border-color: rgba(199, 124, 92, 0.5);
		background-color: var(--bg-primary);
	}

	.preference-group select:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
		background-color: var(--bg-primary);
	}

	.preference-group select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.preference-description {
		margin: 8px 0 0 0;
		font-size: 0.875rem;
		color: var(--text-secondary);
		font-style: italic;
		line-height: 1.5;
	}
</style>
