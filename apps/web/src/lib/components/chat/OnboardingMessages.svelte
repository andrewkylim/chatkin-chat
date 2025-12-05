<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';

	export let draftTasksCount: number;
	export let onComplete: () => void;

	let visibleMessages: boolean[] = [];
	let showPreferences = false;
	let saving = false;
	let error = '';

	// Preference selections
	let aiTone = 'balanced';
	let proactivityLevel = 'medium';
	let communicationStyle = 'conversational';

	const messages = [
		"Your assessment is complete. I've analyzed your responses and created a personalized plan to get you started.",
		"You can view your full assessment results and domain scores in your [profile](/profile).",
		`I've created ${draftTasksCount} starter tasks based on your assessment. Let's review and customize them together.`
	];

	onMount(() => {
		// Start displaying messages after a brief delay
		setTimeout(() => {
			showNextMessage(0);
		}, 500);
	});

	function showNextMessage(index: number) {
		if (index < messages.length) {
			visibleMessages[index] = true;
			visibleMessages = visibleMessages; // Trigger reactivity

			// Auto-advance to next message after delay
			setTimeout(() => {
				showNextMessage(index + 1);
			}, 1800); // 1.8 seconds between messages
		} else {
			// All messages shown, show preference form
			setTimeout(() => {
				showPreferences = true;
			}, 1000);
		}
	}

	async function handleContinue() {
		saving = true;
		error = '';

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
					ai_tone: aiTone,
					proactivity_level: proactivityLevel,
					communication_style: communicationStyle
				})
			});

			if (!response.ok) {
				throw new Error('Failed to save preferences');
			}

			// Preferences saved, trigger completion
			onComplete();
		} catch (err) {
			console.error('Failed to save preferences:', err);
			error = 'Failed to save preferences. Please try again.';
		} finally {
			saving = false;
		}
	}
</script>

{#each messages as message, index}
	{#if visibleMessages[index]}
		<div class="message ai">
			<div class="message-bubble">
				<p>
					{@html message.replace(
						/\[([^\]]+)\]\(([^)]+)\)/g,
						'<a href="$2" class="profile-link">$1</a>'
					)}
				</p>
			</div>
		</div>
	{/if}
{/each}

{#if showPreferences}
	<div class="message ai">
		<div class="message-bubble preferences-form">
			<p class="form-intro">Before we dive in, help me understand how you'd like to work together:</p>

			<div class="preference-group">
				<label for="ai-tone">How should I coach you?</label>
				<select id="ai-tone" bind:value={aiTone}>
					<option value="challenging">Direct and challenging</option>
					<option value="supportive">Supportive and encouraging</option>
					<option value="balanced">Balanced approach</option>
				</select>
			</div>

			<div class="preference-group">
				<label for="proactivity">How proactive should I be?</label>
				<select id="proactivity" bind:value={proactivityLevel}>
					<option value="high">Very proactive (suggest often)</option>
					<option value="medium">Somewhat proactive</option>
					<option value="low">Only when asked</option>
				</select>
			</div>

			<div class="preference-group">
				<label for="communication">Communication style?</label>
				<select id="communication" bind:value={communicationStyle}>
					<option value="brief">Keep it brief</option>
					<option value="detailed">Give me context</option>
					<option value="conversational">Natural conversation</option>
				</select>
			</div>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<button
				class="continue-btn"
				onclick={handleContinue}
				disabled={saving}
			>
				{saving ? 'Saving...' : 'Continue'}
			</button>
		</div>
	</div>
{/if}

<style>
	.message {
		display: flex;
		margin-bottom: 1rem;
		animation: fadeIn 0.3s ease-in-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.message.ai {
		justify-content: flex-start;
	}

	.message-bubble {
		max-width: 85%;
		padding: 10px 14px;
		border-radius: 12px;
		font-size: 0.9375rem;
		line-height: 1.5;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
	}

	.message-bubble p {
		margin: 0;
	}

	.message-bubble :global(.profile-link) {
		color: var(--accent-primary);
		text-decoration: none;
		font-weight: 500;
		border-bottom: 1px solid transparent;
		transition: border-color 0.2s;
	}

	.message-bubble :global(.profile-link:hover) {
		border-bottom-color: var(--accent-primary);
	}

	.preferences-form {
		max-width: 95% !important;
	}

	.form-intro {
		margin: 0 0 1rem 0;
		font-weight: 500;
	}

	.preference-group {
		margin-bottom: 1rem;
	}

	.preference-group label {
		display: block;
		font-weight: 500;
		font-size: 0.875rem;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
	}

	.preference-group select {
		width: 100%;
		padding: 0.625rem 0.75rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		color: var(--text-primary);
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s ease;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.75rem center;
		padding-right: 2.5rem;
	}

	.preference-group select:hover {
		border-color: rgba(199, 124, 92, 0.5);
		background-color: var(--bg-secondary);
	}

	.preference-group select:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
		background-color: var(--bg-secondary);
	}

	.error {
		color: #ef4444;
		font-size: 0.875rem;
		margin: 0.5rem 0;
	}

	.continue-btn {
		width: 100%;
		padding: 0.75rem;
		margin-top: 0.5rem;
		background: var(--accent-primary);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-weight: 500;
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.continue-btn:hover:not(:disabled) {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.continue-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.continue-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
