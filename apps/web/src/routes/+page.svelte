<script lang="ts">
	import { dev } from '$app/environment';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Get version from environment variable set during build
	const version = dev ? 'dev' : (import.meta.env.VITE_APP_VERSION || 'unknown');

	// Redirect logged-in users to chat
	onMount(() => {
		if ($auth.user) {
			goto('/chat');
		}
	});
</script>

<div class="landing">
	<nav class="nav">
		<div class="nav-container">
			<a href="/" class="logo">
				<img src="/logo.svg" alt="Chatkin" class="logo-icon" />
				<span>Chatkin</span>
			</a>
			<div class="nav-actions">
				<a href="/login" class="secondary-btn">Sign In</a>
				<a href="/signup" class="primary-btn">
					<span class="btn-text-desktop">Get Started</span>
					<span class="btn-text-mobile">Sign Up</span>
				</a>
			</div>
		</div>
	</nav>

	<main class="hero">
		<div class="hero-container">
			<h1 class="hero-title">
				Sort your life out.
			</h1>
			<p class="hero-subtitle">
				Get a comprehensive assessment and 3-month plan covering health, relationships, career, and personal growth
			</p>
		</div>

		<section class="features">
		<div class="features-container">
			<h2 class="section-title">How it works</h2>
			<div class="features-grid">
				<div class="feature-card" role="presentation" on:touchstart={() => {}} on:click={() => {}}>
					<div class="app-icon">
						<img src="/chat.svg" alt="Chat" />
					</div>
					<div class="app-content">
						<h3 class="app-name">1. Take the Assessment</h3>
						<p class="app-description">
							Answer questions about every area of your life - health, relationships, career, and growth
						</p>
					</div>
				</div>

				<div class="feature-card" role="presentation" on:touchstart={() => {}} on:click={() => {}}>
					<div class="app-icon">
						<img src="/projects.svg" alt="Plan" />
					</div>
					<div class="app-content">
						<h3 class="app-name">2. Get Your 3-Month Plan</h3>
						<p class="app-description">
							Receive a comprehensive plan with projects, tasks, and notes organized by life domain
						</p>
					</div>
				</div>

				<div class="feature-card" role="presentation" on:touchstart={() => {}} on:click={() => {}}>
					<div class="app-icon">
						<img src="/tasks.svg" alt="Tasks" />
					</div>
					<div class="app-content">
						<h3 class="app-name">3. Take Action</h3>
						<p class="app-description">
							Work through your plan with AI guidance, tracking progress across all life domains
						</p>
					</div>
				</div>

				<div class="feature-card" role="presentation" on:touchstart={() => {}} on:click={() => {}}>
					<div class="app-icon">
						<img src="/notes.svg" alt="Track Progress" />
					</div>
					<div class="app-content">
						<h3 class="app-name">4. Track Your Progress</h3>
						<p class="app-description">
							Monitor growth across all domains with regular check-ins and adjustments to your plan
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>
	</main>

	<footer class="footer">
		<div class="footer-container">
			<p class="text-muted">&copy; 2025 Chatkin. Built with care.</p>
			<div class="footer-right">
				<a href="mailto:support@chatkin.ai?subject=yo%20can%20you%20fix%20this%20please" class="support-link">support@chatkin.ai</a>
				<p class="version">v{version}</p>
			</div>
		</div>
	</footer>
</div>

<style>
	.landing {
		min-height: 100vh;
		background: var(--bg-primary);
	}

	/* Navigation */
	.nav {
		position: sticky;
		top: 0;
		z-index: 100;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
		padding: 8px 0;
	}

	.nav-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 12px;
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

	.nav-actions .secondary-btn,
	.nav-actions .primary-btn {
		padding: 10px 16px;
		font-size: 0.875rem;
	}

	.btn-text-mobile {
		display: none;
	}

	.btn-text-desktop {
		display: inline;
	}

	/* Hero */
	.hero {
		padding: 60px 20px 40px;
	}

	.hero-container {
		max-width: 800px;
		margin: 0 auto;
		text-align: center;
	}

	.hero-title {
		font-size: 2.5rem;
		line-height: 1.1;
		margin-bottom: 24px;
		letter-spacing: -0.03em;
	}

	.hero-subtitle {
		font-size: 1.125rem;
		color: var(--text-secondary);
		margin-bottom: 40px;
		line-height: 1.6;
	}

	/* Features */
	.features {
		padding: 0 20px 40px;
	}

	.features-container {
		max-width: 1200px;
		margin: 0 auto;
	}

	.section-title {
		text-align: center;
		margin-bottom: 40px;
		font-size: 2rem;
	}

	.features-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 16px;
	}

	.feature-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 20px;
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 100px;
		-webkit-tap-highlight-color: transparent;
		user-select: none;
	}

	.app-icon {
		width: 56px;
		height: 56px;
		flex-shrink: 0;
		transition: all 0.15s ease;
	}

	.app-icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.feature-card:active .app-icon {
		transform: translateY(4px) scale(0.95);
	}

	.app-content {
		flex: 1;
		min-width: 0;
	}

	.app-name {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 4px;
		color: var(--text-primary);
		letter-spacing: -0.02em;
	}

	.app-description {
		font-size: 0.875rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.app-badge {
		flex-shrink: 0;
		padding: 4px 10px;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.badge-active {
		background: rgba(93, 155, 118, 0.1);
		color: var(--accent-success);
	}

	.badge-soon {
		background: rgba(199, 124, 92, 0.1);
		color: var(--accent-primary);
	}

	/* Footer */
	.footer {
		padding: 32px 20px;
		background: var(--bg-primary);
		border-top: 1px solid var(--border-color);
	}

	.footer-container {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 20px;
	}

	.footer-right {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.footer .text-muted {
		color: var(--text-secondary);
		margin: 0;
	}

	.support-link {
		color: var(--accent-primary);
		text-decoration: none;
		transition: opacity 0.2s ease;
	}

	.support-link:hover {
		opacity: 0.8;
		text-decoration: underline;
	}

	.version {
		color: var(--text-secondary);
		font-size: 0.875rem;
		margin: 0;
	}

	/* Responsive */
	@media (max-width: 639px) {
		.btn-text-desktop {
			display: none;
		}

		.btn-text-mobile {
			display: inline;
		}

		.footer-container {
			flex-direction: column;
			gap: 8px;
			text-align: center;
		}

		.footer-right {
			flex-direction: column;
			gap: 8px;
		}
	}

	@media (min-width: 640px) {
		.hero-title {
			font-size: 3rem;
		}

		.features-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 20px;
		}

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
		.hero-title {
			font-size: 3.5rem;
		}

		.nav-actions .secondary-btn,
		.nav-actions .primary-btn {
			padding: 14px 24px;
			font-size: 0.9375rem;
		}

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
