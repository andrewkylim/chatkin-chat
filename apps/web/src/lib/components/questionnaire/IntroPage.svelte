<script lang="ts">
	import { onMount } from 'svelte';

	let {
		onBegin,
		onReset,
		existingResponseCount = 0,
		totalQuestions = 35
	}: {
		onBegin: () => void;
		onReset: () => Promise<void>;
		existingResponseCount?: number;
		totalQuestions?: number;
	} = $props();

	// State
	let theme: 'light' | 'dark' = $state('light');
	let dontShowAgain = $state(false);

	// Load saved preferences on mount
	onMount(() => {
		const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
		if (savedTheme) {
			theme = savedTheme;
		}
	});

	// Theme toggle (copy from settings page)
	function applyTheme(newTheme: 'light' | 'dark') {
		if (newTheme === 'dark') {
			document.documentElement.setAttribute('data-theme', 'dark');
		} else {
			document.documentElement.removeAttribute('data-theme');
		}
	}

	// Begin handler - save skip preference
	function handleBegin() {
		if (dontShowAgain) {
			localStorage.setItem('skip_questionnaire_intro', 'true');
		}
		onBegin();
	}

	// Calculate estimated time remaining
	const avgSecondsPerQuestion = 13; // 10 min / 47 questions ≈ 13s/question
	const questionsRemaining = totalQuestions - existingResponseCount;
	const estimatedMinutes = Math.ceil((questionsRemaining * avgSecondsPerQuestion) / 60);

	// Only show progress notification if there are incomplete questions
	const showProgressNotification = existingResponseCount > 0 && existingResponseCount < totalQuestions;

	// Domain data
	const domains = [
		{ name: 'Body', desc: 'Physical health, energy, and wellbeing', color: 'var(--domain-body)' },
		{ name: 'Mind', desc: 'Mental and emotional health', color: 'var(--domain-mind)' },
		{ name: 'Purpose', desc: 'Work, meaning, and fulfillment', color: 'var(--domain-purpose)' },
		{ name: 'Connection', desc: 'Relationships and community', color: 'var(--domain-connection)' },
		{ name: 'Growth', desc: 'Learning and personal development', color: 'var(--domain-growth)' },
		{ name: 'Finance', desc: 'Financial and resource stability', color: 'var(--domain-finance)' }
	];
</script>

<div class="intro-page">
	<div class="intro-container">
		<!-- Progress notification (if returning with partial completion) -->
		{#if showProgressNotification}
			<div class="progress-notification">
				<div class="progress-icon">🔄</div>
				<div class="progress-content">
					<h3>Welcome back!</h3>
					<p>You've completed {existingResponseCount} of {totalQuestions} questions</p>
					<p class="time-estimate">About {estimatedMinutes} {estimatedMinutes === 1 ? 'minute' : 'minutes'} remaining</p>
				</div>
			</div>
		{/if}

		<!-- Main content -->
		<div class="intro-content">
			<p class="intro-description">
				Help us understand you better with this comprehensive assessment.
				Your responses will enable personalized recommendations and insights.
			</p>

			<!-- Assessment details -->
			<div class="assessment-info">
				<div class="info-item">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"/>
						<polyline points="12 6 12 12 16 14"/>
					</svg>
					<span>10 minutes</span>
				</div>
				<div class="info-item">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="8" y1="6" x2="21" y2="6"/>
						<line x1="8" y1="12" x2="21" y2="12"/>
						<line x1="8" y1="18" x2="21" y2="18"/>
						<line x1="3" y1="6" x2="3.01" y2="6"/>
						<line x1="3" y1="12" x2="3.01" y2="12"/>
						<line x1="3" y1="18" x2="3.01" y2="18"/>
					</svg>
					<span>{totalQuestions} questions</span>
				</div>
				<div class="info-item">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
						<polyline points="17 21 17 13 7 13 7 21"/>
						<polyline points="7 3 7 8 15 8"/>
					</svg>
					<span>Auto-saves progress</span>
				</div>
			</div>

			<!-- Theme selection -->
			<div class="theme-selection">
				<h3 class="theme-heading">Choose your appearance</h3>
				<div class="theme-options">
					<button
						class="theme-option-card"
						class:active={theme === 'light'}
						onclick={() => {
							theme = 'light';
							applyTheme('light');
							localStorage.setItem('theme', 'light');
						}}
					>
						<svg class="theme-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="5"/>
							<line x1="12" y1="1" x2="12" y2="3"/>
							<line x1="12" y1="21" x2="12" y2="23"/>
							<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
							<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
							<line x1="1" y1="12" x2="3" y2="12"/>
							<line x1="21" y1="12" x2="23" y2="12"/>
							<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
							<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
						</svg>
						<div class="theme-name">Light</div>
						<div class="theme-description">Bright and clear for daytime use</div>
					</button>
					<button
						class="theme-option-card"
						class:active={theme === 'dark'}
						onclick={() => {
							theme = 'dark';
							applyTheme('dark');
							localStorage.setItem('theme', 'dark');
						}}
					>
						<svg class="theme-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
						</svg>
						<div class="theme-name">Dark</div>
						<div class="theme-description">Easy on the eyes in low light</div>
					</button>
				</div>
			</div>

			<!-- Domain cards -->
			<div class="domains-section">
				<div class="domains-grid">
					{#each domains as domain}
						<div class="domain-card">
							<div class="domain-header-row">
								<div class="domain-circle" style="background-color: {domain.color}"></div>
								<h3>{domain.name}</h3>
							</div>
							<p>{domain.desc}</p>
						</div>
					{/each}
				</div>
			</div>

			<!-- Skip intro checkbox -->
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={dontShowAgain} />
				<span>Don't show this again</span>
			</label>

			<!-- Begin button -->
			<button class="begin-button" onclick={handleBegin}>
				Begin Assessment
			</button>

			<p class="note">
				You can navigate back through questions to review or change your answers.
			</p>
		</div>
	</div>
</div>

<style>
	/* Intro page */
	.intro-page {
		min-height: 100vh;
		background: var(--bg-primary);
		padding: 0;
		margin: 0;
	}

	/* Navigation (homepage style) */
	.nav {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
		padding: 8px 0;
	}

	.nav-container {
		max-width: 100%;
		margin: 0;
		padding: 0 20px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.logo {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text-primary);
		text-decoration: none;
		display: flex;
		align-items: center;
		gap: 4px;
		-webkit-tap-highlight-color: transparent;
	}

	.logo-icon {
		width: 56px;
		height: 56px;
		border-radius: 12px;
		overflow: hidden;
		transition: all 0.15s ease;
	}

	.logo:active .logo-icon {
		transform: translateY(4px) scale(0.95);
	}

	.nav-actions {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	/* Reset button in header */
	.reset-btn {
		padding: 10px 20px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.reset-btn:hover {
		background: var(--bg-tertiary);
		border-color: var(--text-muted);
		color: var(--text-primary);
	}

	.toggle-track {
		position: relative;
		width: 40px;
		height: 22px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: 11px;
		transition: all 0.2s ease;
	}

	.toggle-track.active {
		background: var(--accent-primary);
		border-color: var(--accent-primary);
	}

	.toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		background: white;
		border-radius: 50%;
		transition: all 0.2s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.toggle-track.active .toggle-thumb {
		left: 20px;
	}

	.theme-text {
		min-width: 40px;
	}

	/* Container */
	.intro-container {
		max-width: 800px;
		margin: 0 auto;
		padding: 100px 20px 40px 20px; /* Add top padding for fixed header */
	}

	/* Progress notification */
	.progress-notification {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-left: 4px solid var(--accent-primary);
		border-radius: var(--radius-md);
		padding: 20px;
		margin-bottom: 32px;
		display: flex;
		gap: 16px;
		align-items: flex-start;
	}

	.progress-icon {
		font-size: 2rem;
		line-height: 1;
	}

	.progress-content h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 8px 0;
	}

	.progress-content p {
		font-size: 0.9375rem;
		color: var(--text-secondary);
		margin: 4px 0;
	}

	.progress-content .time-estimate {
		font-size: 0.875rem;
		color: var(--text-muted);
		font-style: italic;
	}

	/* Main content */
	.intro-content {
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		padding: 48px 40px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
	}

	.intro-description {
		font-size: 1.125rem;
		color: var(--text-secondary);
		line-height: 1.6;
		margin: 0 0 32px 0;
		text-align: center;
	}

	/* Assessment info */
	.assessment-info {
		display: flex;
		gap: 24px;
		margin: 32px 0;
		padding: 24px;
		background: var(--bg-tertiary);
		border-radius: var(--radius-md);
		flex-wrap: wrap;
		justify-content: center;
	}

	.info-item {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-secondary);
		font-size: 0.9375rem;
	}

	.info-item svg {
		flex-shrink: 0;
	}

	/* Theme selection */
	.theme-selection {
		margin: 32px 0;
		padding: 24px;
		background: var(--bg-tertiary);
		border-radius: var(--radius-md);
	}

	.theme-heading {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 16px 0;
		text-align: center;
	}

	.theme-options {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
	}

	.theme-option-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
	}

	.theme-option-card:hover {
		border-color: var(--text-muted);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	}

	.theme-option-card.active {
		border-color: var(--accent-primary);
		background: var(--bg-primary);
		box-shadow: 0 2px 8px rgba(199, 124, 92, 0.2);
	}

	.theme-icon {
		flex-shrink: 0;
		color: var(--text-secondary);
	}

	.theme-option-card.active .theme-icon {
		color: var(--accent-primary);
	}

	.theme-name {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 2px;
	}

	.theme-description {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		line-height: 1.3;
	}

	/* Domains section */
	.domains-section {
		margin: 32px 0;
	}

	.domains-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 16px;
	}

	.domain-card {
		padding: 16px 20px;
		background: var(--bg-primary);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		transition: all 0.2s ease;
	}

	.domain-card:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
		transform: translateY(-1px);
	}

	.domain-header-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 8px;
	}

	.domain-circle {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.domain-card h3 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
		color: var(--text-primary);
	}

	.domain-card p {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.5;
	}

	/* Checkbox */
	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		justify-content: center;
		margin: 24px 0 16px 0;
		font-size: 0.9375rem;
		color: var(--text-secondary);
		cursor: pointer;
		user-select: none;
	}

	.checkbox-label input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	/* Begin button */
	.begin-button {
		width: 100%;
		padding: 16px 32px;
		border: none;
		border-radius: var(--radius-md);
		background: var(--accent-primary);
		color: white;
		font-size: 1.125rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		margin: 0 0 16px 0;
	}

	.begin-button:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(199, 124, 92, 0.3);
	}

	.begin-button:active {
		transform: translateY(0);
	}

	/* Note */
	.note {
		text-align: center;
		font-size: 0.875rem;
		color: var(--text-muted);
		margin: 0;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.intro-container {
			margin: 20px auto;
		}

		.intro-content {
			padding: 32px 24px;
		}

		.intro-description {
			font-size: 1rem;
		}

		.assessment-info {
			flex-direction: column;
			gap: 12px;
			padding: 16px;
		}

		.theme-options {
			grid-template-columns: 1fr;
		}

		.domains-grid {
			grid-template-columns: 1fr;
		}

		.progress-notification {
			flex-direction: column;
			text-align: center;
		}

		.progress-icon {
			font-size: 3rem;
		}
	}

	@media (min-width: 640px) {
		.logo {
			font-size: 1.75rem;
		}

		.logo-icon {
			width: 64px;
			height: 64px;
			border-radius: 13px;
		}

		.nav-container {
			padding: 0 20px;
		}
	}

	@media (min-width: 1024px) {
		.logo {
			font-size: 2rem;
		}

		.logo-icon {
			width: 72px;
			height: 72px;
			border-radius: 14px;
		}
	}
</style>
