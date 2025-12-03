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
			<div class="animation-container">
				<div class="orbit">
					<div class="ball ball-1"></div>
					<div class="ball ball-2"></div>
					<div class="ball ball-3"></div>
					<div class="ball ball-4"></div>
				</div>
			</div>
			<h1 class="hero-title">
				Sort your life out.
			</h1>
			<p class="hero-subtitle">
				Get a comprehensive assessment and personalized plan covering health, relationships, career, and personal growth
			</p>
			<div class="hero-cta">
				<a href="/signup" class="primary-btn">Get Started</a>
			</div>
		</div>
	</main>

	<section class="features" style="display: none;">
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
						<h3 class="app-name">2. Get Your Personalized Plan</h3>
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

	<footer class="footer">
		<div class="footer-container">
			<div class="footer-content">
				<div class="footer-section">
					<div class="footer-logo">
						<img src="/logo.svg" alt="Chatkin" class="footer-logo-icon" />
						<span>Chatkin</span>
					</div>
					<p class="footer-tagline">Sort your life out.</p>
				</div>

				<div class="footer-section">
					<h3>Product</h3>
					<ul>
						<li><a href="/signup">Get Started</a></li>
						<li><a href="/login">Sign In</a></li>
					</ul>
				</div>

				<div class="footer-section">
					<h3>Support</h3>
					<ul>
						<li><a href="mailto:support@chatkin.ai">support@chatkin.ai</a></li>
					</ul>
				</div>
			</div>

			<div class="footer-bottom">
				<p>&copy; 2025 Chatkin. Built with care.</p>
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
		margin-bottom: 32px;
		line-height: 1.6;
		max-width: 600px;
		margin-left: auto;
		margin-right: auto;
	}

	.hero-cta {
		display: flex;
		justify-content: center;
		gap: 16px;
	}

	.animation-container {
		display: flex;
		justify-content: center;
		margin-bottom: 32px;
	}

	.orbit {
		position: relative;
		width: 100px;
		height: 100px;
	}

	.ball {
		position: absolute;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		top: 50%;
		left: 50%;
		margin: -8px 0 0 -8px;
	}

	.ball-1 {
		background: #3b82f6;
		animation: orbit 3s linear infinite;
	}

	.ball-2 {
		background: #14b8a6;
		animation: orbit 3s linear infinite 0.75s;
	}

	.ball-3 {
		background: #ec4899;
		animation: orbit 3s linear infinite 1.5s;
	}

	.ball-4 {
		background: #f59e0b;
		animation: orbit 3s linear infinite 2.25s;
	}

	@keyframes orbit {
		from {
			transform: rotate(0deg) translateX(50px) rotate(0deg);
		}
		to {
			transform: rotate(360deg) translateX(50px) rotate(-360deg);
		}
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
		padding: 40px 20px 24px;
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
	}

	.footer-container {
		max-width: 1200px;
		margin: 0 auto;
	}

	.footer-content {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		gap: 32px;
		margin-bottom: 32px;
	}

	.footer-section h3 {
		font-size: 0.875rem;
		font-weight: 600;
		margin-bottom: 16px;
		color: var(--text-primary);
	}

	.footer-section ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.footer-section ul li {
		margin-bottom: 12px;
	}

	.footer-section a {
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 0.875rem;
		transition: color 0.2s ease;
	}

	.footer-section a:hover {
		color: var(--text-primary);
	}

	.footer-logo {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 12px;
	}

	.footer-logo-icon {
		width: 32px;
		height: 32px;
		border-radius: 6px;
	}

	.footer-tagline {
		color: var(--text-secondary);
		font-size: 0.875rem;
		margin: 0;
	}

	.footer-bottom {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 24px;
		border-top: 1px solid var(--border-color);
	}

	.footer-bottom p {
		color: var(--text-secondary);
		font-size: 0.875rem;
		margin: 0;
	}

	.version {
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	/* Responsive */
	@media (max-width: 639px) {
		.btn-text-desktop {
			display: none;
		}

		.btn-text-mobile {
			display: inline;
		}

		.footer-content {
			grid-template-columns: 1fr;
			gap: 32px;
			margin-bottom: 32px;
		}

		.footer-bottom {
			flex-direction: column;
			gap: 8px;
			text-align: center;
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
