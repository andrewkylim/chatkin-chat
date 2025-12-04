<script lang="ts">
	/* eslint-disable svelte/no-at-html-tags */
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
	let showRetakeModal = $state(false);

	onMount(async () => {
		// Wait for auth to finish loading
		if ($auth.loading) {
			const unsubscribe = auth.subscribe((state) => {
				if (!state.loading) {
					unsubscribe();
					if (!state.user) {
						goto('/login');
					} else {
						loadResults();
					}
				}
			});
		} else {
			if (!$auth.user) {
				goto('/login');
				return;
			}
			await loadResults();
		}
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
					// No results found - redirect to questionnaire
					goto('/questionnaire');
					return;
				} else {
					throw fetchError;
				}
			}

			results = data;
		} catch (err) {
			console.error('Error loading assessment results:', err);
			error = 'Failed to load assessment results. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleRetakeAssessment() {
		if (!$auth.user) return;

		try {
			const user = $auth.user;

			// Delete all content first
			const { data: { session } } = await supabase.auth.getSession();
			const accessToken = session?.access_token;

			// Delete files from database and R2 storage
			const { data: files } = await supabase
				.from('files')
				.select('id, r2_key')
				.eq('user_id', user.id);

			const { error: filesError } = await supabase
				.from('files')
				.delete()
				.eq('user_id', user.id);

			if (filesError) throw filesError;

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

			// Delete all projects
			await supabase.from('projects').delete().eq('user_id', user.id);

			// Delete all tasks
			await supabase.from('tasks').delete().eq('user_id', user.id);

			// Delete all notes
			await supabase.from('notes').delete().eq('user_id', user.id);

			// Delete assessment responses
			await supabase.from('assessment_responses').delete().eq('user_id', user.id);

			// Delete assessment results
			await supabase.from('assessment_results').delete().eq('user_id', user.id);

			// NOW update the profile to mark questionnaire as incomplete
			const { error: updateError } = await supabase
				.from('user_profiles')
				.update({
					has_completed_questionnaire: false,
					updated_at: new Date().toISOString()
				})
				.eq('user_id', user.id);

			if (updateError) throw updateError;

			// Close modal and redirect
			showRetakeModal = false;
			goto('/questionnaire');
		} catch (err) {
			console.error('Error retaking questionnaire:', err);
		}
	}

	function formatAIReport(report: string): string {
		// Parse markdown to HTML with proper formatting
		let html = report;

		// Remove main title (# Title) from the beginning (fallback)
		html = html.replace(/^#\s+.+$/m, '').trim();

		// Remove horizontal rules (---, ***, ___)
		html = html.replace(/^[-*_]{3,}$/gm, '').trim();

		// Convert any heading markers (##, ###, ####) to styled h3 elements
		html = html.replace(/^#{2,4}\s+(.+)$/gm, '<h3 class="section-marker">$1</h3>');

		// Convert **bold** text to strong tags
		html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

		// Convert bullet points (-, *, •) to list items
		html = html.replace(/^[-*•]\s+(.+)$/gm, '<li>$1</li>');

		// Wrap consecutive list items in ul tags
		html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul class="report-list">$&</ul>');

		// Split by double line breaks and process paragraphs
		const sections = html.split(/\n\n+/);
		html = sections.map(section => {
			section = section.trim();
			if (!section) return '';

			// Don't wrap headings, lists, or already formatted content
			if (section.startsWith('<h3') || section.startsWith('<ul') || section.includes('</')) {
				return section;
			}

			// Wrap plain text in paragraphs
			return `<p>${section.replace(/\n/g, ' ')}</p>`;
		}).filter(s => s).join('\n\n');

		// Split by section headings and wrap each in a div
		const sectionParts = html.split(/(<h3 class="section-marker">.*?<\/h3>)/s);
		let result = '';
		let currentContent = '';

		for (let i = 0; i < sectionParts.length; i++) {
			const part = sectionParts[i];
			if (!part.trim()) continue;

			if (part.includes('section-marker')) {
				// If we have previous content, close the div
				if (currentContent) {
					result += `<div class="report-section-block">${currentContent}</div>`;
					currentContent = '';
				}
				// Start new section with heading
				currentContent = part;
			} else {
				// Add content to current section
				currentContent += part;
			}
		}

		// Add the last section
		if (currentContent) {
			result += `<div class="report-section-block">${currentContent}</div>`;
		}

		return result;
	}
</script>

<AppLayout>
	<!-- Desktop Header -->
	<header class="page-header">
		<div class="header-content">
			<h1>Profile</h1>
		</div>
	</header>

	<!-- Mobile Header -->
	<header class="mobile-header">
		<div class="mobile-header-left">
			<a href="/chat" class="mobile-logo-button">
				<img src="/logo.svg" alt="Chatkin" class="mobile-logo" />
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
					<div class="scores-grid">
						{#each Object.entries(results.domain_scores) as [domain, score]}
							<DomainScoreCard {domain} {score} />
						{/each}
					</div>
				</section>

				<!-- AI Report Section -->
				<div class="report-sections-wrapper">
					<!-- svelte-ignore svelte/no-at-html-tags -->
					{@html formatAIReport(results.ai_report)}
				</div>

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

				<!-- Retake Assessment Section -->
				<div class="retake-section">
					<div class="retake-warning">
						<h3>Retake Assessment</h3>
						<p>
							Retaking the assessment will reset your profile and delete all existing projects, tasks, notes,
							and files. This action cannot be undone.
						</p>
						<button onclick={() => showRetakeModal = true} class="danger-btn">
							Retake Assessment
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>

	{#if showRetakeModal}
		<div class="modal-overlay" onclick={() => showRetakeModal = false}>
			<div class="modal" onclick={(e) => e.stopPropagation()}>
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
						onclick={() => showRetakeModal = false}
					>
						Cancel
					</button>
					<button
						type="button"
						class="danger-btn"
						onclick={handleRetakeAssessment}
					>
						Continue & Delete All
					</button>
				</div>
			</div>
		</div>
	{/if}
</AppLayout>

<style>
	.page-header {
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-secondary);
		height: 64px;
		display: flex;
		align-items: center;
		box-sizing: border-box;
	}

	.header-content {
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.page-header h1 {
		font-size: 1.5rem;
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

	.report-sections-wrapper {
		margin-bottom: 32px;
	}

	.report-sections-wrapper :global(.report-section-block) {
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		padding: 24px 32px;
		margin-bottom: 24px;
		line-height: 1.8;
		color: var(--text-secondary);
		border: 1px solid var(--border-color);
	}

	.report-sections-wrapper :global(.report-section-block:last-child) {
		margin-bottom: 0;
	}

	.report-sections-wrapper :global(br) {
		display: block;
		margin: 0.5em 0;
	}

	.report-sections-wrapper :global(.section-marker) {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 1rem 0;
	}

	.report-sections-wrapper :global(.section-marker:only-child) {
		margin-bottom: 0;
	}

	.report-sections-wrapper :global(.report-list) {
		margin: 1.25rem 0 1.75rem 0;
		padding-left: 1.5rem;
		color: var(--text-primary);
	}

	.report-sections-wrapper :global(.report-list li) {
		margin: 0.75rem 0;
		line-height: 1.7;
		color: var(--text-primary);
	}

	.report-sections-wrapper :global(p) {
		margin: 1.25rem 0;
		line-height: 1.7;
		color: var(--text-primary);
	}

	.report-sections-wrapper :global(p:first-of-type) {
		margin-top: 0;
	}

	.report-sections-wrapper :global(p:last-of-type) {
		margin-bottom: 0;
	}

	.report-sections-wrapper :global(p + p) {
		margin-top: 1.5rem;
	}

	.report-sections-wrapper :global(strong) {
		color: var(--text-primary);
		font-weight: 600;
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

	.retake-section {
		margin-top: 48px;
	}

	.retake-warning {
		background: #FEF2F2;
		border: 2px solid #FCA5A5;
		border-radius: var(--radius-lg);
		padding: 24px;
		max-width: 600px;
		margin: 0 auto;
	}

	.retake-warning h3 {
		font-size: 1.25rem;
		font-weight: 700;
		color: #991B1B;
		margin: 0 0 12px 0;
	}

	.retake-warning p {
		font-size: 0.9375rem;
		color: #7F1D1D;
		line-height: 1.6;
		margin: 0 0 20px 0;
	}

	.danger-btn {
		padding: 12px 24px;
		border: none;
		border-radius: var(--radius-md);
		background: #DC2626;
		color: white;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.danger-btn:hover {
		background: #B91C1C;
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
			display: flex;
			align-items: center;
			background: none;
			border: none;
			padding: 0;
			cursor: pointer;
		}

		.mobile-logo {
			width: 48px;
			height: 48px;
			border-radius: 8px;
			transition: all 0.15s ease;
		}

		.mobile-logo-button:active .mobile-logo {
			transform: translateY(4px) scale(0.95);
		}

		.mobile-header h1 {
			font-size: 1.5rem;
			font-weight: 700;
			letter-spacing: -0.02em;
			margin: 0;
		}

		.profile-container {
			padding: 24px 16px;
		}

		.section-title {
			font-size: 1.25rem;
		}

		.scores-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 12px;
		}

		.report-content {
			padding: 24px 20px;
		}
	}

	/* Modal Styles */
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

	.modal-actions {
		display: flex;
		gap: 12px;
		margin-top: 24px;
		justify-content: flex-end;
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
