<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { auth } from '$lib/stores/auth';
	import AppLayout from '$lib/components/AppLayout.svelte';
	import MobileUserMenu from '$lib/components/MobileUserMenu.svelte';
	import DomainScoreCard from '$lib/components/profile/DomainScoreCard.svelte';

	interface AssessmentResults {
		domain_scores: Record<string, number>;
		ai_report: string;
		completed_at: string;
	}

	let results: AssessmentResults | null = $state(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		if (!$auth.user) {
			goto('/login');
			return;
		}

		await loadResults();
	});

	async function loadResults() {
		try {
			loading = true;
			const { data, error: fetchError } = await supabase
				.from('assessment_results')
				.select('*')
				.eq('user_id', $auth.user!.id)
				.single();

			if (fetchError) {
				if (fetchError.code === 'PGRST116') {
					// No results found
					error = 'No assessment results found. Please complete the questionnaire first.';
				} else {
					throw fetchError;
				}
				return;
			}

			results = data;
		} catch (err) {
			console.error('Error loading assessment results:', err);
			error = 'Failed to load assessment results. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function retakeQuestionnaire() {
		if (!$auth.user) return;

		try {
			const { error: updateError } = await supabase
				.from('user_profiles')
				.update({
					has_completed_questionnaire: false,
					updated_at: new Date().toISOString()
				})
				.eq('user_id', $auth.user.id);

			if (updateError) {
				console.error('Error updating profile:', updateError);
				return;
			}

			goto('/questionnaire');
		} catch (err) {
			console.error('Error retaking questionnaire:', err);
		}
	}
</script>

<AppLayout>
	<!-- Desktop Header -->
	<header class="page-header">
		<div class="header-content">
			<h1>Your Wellness Profile</h1>
			{#if results}
				<button onclick={retakeQuestionnaire} class="secondary-btn"> Retake Assessment </button>
			{/if}
		</div>
	</header>

	<!-- Mobile Header -->
	<header class="mobile-header">
		<div class="mobile-header-left">
			<a href="/chat" class="mobile-logo-button">
				<img src="/logo.webp" alt="Chatkin" class="mobile-logo" />
			</a>
			<h1>Profile</h1>
		</div>
		<MobileUserMenu />
	</header>

	<!-- Main Content -->
	<div class="page-content">
		{#if loading}
			<div class="loading-container">
				<div class="spinner"></div>
				<p>Loading your profile...</p>
			</div>
		{:else if error}
			<div class="error-container">
				<p class="error-message">{error}</p>
				<button onclick={() => goto('/questionnaire')} class="primary-btn">
					Take Questionnaire
				</button>
			</div>
		{:else if results}
			<div class="profile-container">
				<!-- Domain Scores Section -->
				<section class="scores-section">
					<h2 class="section-title">Your Wellness Scores</h2>
					<div class="scores-grid">
						{#each Object.entries(results.domain_scores) as [domain, score]}
							<DomainScoreCard {domain} {score} />
						{/each}
					</div>
				</section>

				<!-- AI Report Section -->
				<section class="report-section">
					<h2 class="section-title">Personalized Insights</h2>
					<div class="report-content">
						{@html results.ai_report.replace(/\n/g, '<br>')}
					</div>
				</section>

				<!-- Completed Date -->
				<div class="completion-info">
					<p>
						Assessment completed on {new Date(results.completed_at).toLocaleDateString('en-US', {
							year: 'numeric',
							month: 'long',
							day: 'numeric'
						})}
					</p>
				</div>
			</div>
		{/if}
	</div>
</AppLayout>

<style>
	.page-header {
		padding: 24px 32px;
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.header-content {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.page-header h1 {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.secondary-btn {
		padding: 10px 20px;
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.secondary-btn:hover {
		border-color: var(--accent-primary);
		background: var(--bg-tertiary);
	}

	.primary-btn {
		padding: 12px 32px;
		border: none;
		border-radius: var(--radius-md);
		background: var(--accent-primary);
		color: white;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.primary-btn:hover {
		background: var(--accent-hover);
	}

	.mobile-header {
		display: none;
	}

	.page-content {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.loading-container,
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		gap: 20px;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid var(--border-color);
		border-top-color: var(--accent-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-container p {
		font-size: 1.125rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.error-container {
		padding: 32px;
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		max-width: 500px;
		margin: 0 auto;
	}

	.error-message {
		font-size: 1rem;
		color: var(--danger);
		text-align: center;
		margin-bottom: 20px;
	}

	.profile-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 40px 32px;
	}

	.scores-section {
		margin-bottom: 48px;
	}

	.section-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 24px;
	}

	.scores-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 20px;
	}

	.report-section {
		margin-bottom: 32px;
	}

	.report-content {
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		padding: 32px;
		line-height: 1.8;
		color: var(--text-secondary);
		border: 1px solid var(--border-color);
	}

	.report-content :global(br) {
		display: block;
		margin: 0.5em 0;
	}

	.completion-info {
		text-align: center;
		padding: 24px;
	}

	.completion-info p {
		font-size: 0.875rem;
		color: var(--text-muted);
		font-style: italic;
	}

	/* Mobile Styles */
	@media (max-width: 1023px) {
		.page-header {
			display: none;
		}

		.mobile-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 16px 20px;
			border-bottom: 1px solid var(--border-color);
			background: var(--bg-secondary);
			height: 64px;
			position: sticky;
			top: 0;
			z-index: 40;
		}

		.mobile-header-left {
			display: flex;
			align-items: center;
			gap: 12px;
		}

		.mobile-logo-button {
			width: 36px;
			height: 36px;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.mobile-logo {
			width: 36px;
			height: 36px;
			border-radius: 6px;
		}

		.mobile-header h1 {
			font-size: 1.25rem;
			font-weight: 700;
			color: var(--text-primary);
		}

		.profile-container {
			padding: 24px 16px;
		}

		.section-title {
			font-size: 1.25rem;
		}

		.scores-grid {
			grid-template-columns: 1fr;
			gap: 16px;
		}

		.report-content {
			padding: 24px 20px;
		}
	}
</style>
