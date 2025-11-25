<script lang="ts">
</script>

<div class="landing">
	<nav class="nav">
		<div class="nav-container">
			<a href="/" class="logo">
				<img src="/logo.webp" alt="Chatkin" class="logo-icon" />
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
				Chatkin captures your ideas, sorts your tasks, structures your projects, and keeps everything moving - all through conversation
			</p>
			<div class="hero-cta">
				<a href="/signup" class="primary-btn">Start For Free</a>
				<a href="#how-it-works" class="secondary-btn">See How It Works</a>
			</div>

			<div class="hero-demo">
				<div class="chat-preview">
					<div class="message ai">
						<div class="message-bubble">
							<p>👋 Hi! What would you like to work on today?</p>
						</div>
					</div>
					<div class="message user">
						<div class="message-bubble">
							<p>I want to get fit and build a consistent workout routine</p>
						</div>
					</div>
					<div class="message ai">
						<div class="message-bubble">
							<p>I've created a fitness project with 8 workout tasks, nutrition notes, and a weekly plan. Let's get started! 💪</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</main>

	<section id="how-it-works" class="features">
		<div class="features-container">
			<h2 class="section-title">Everything you need, one conversation away</h2>
			<div class="features-grid">
				<div class="feature-card" role="button" tabindex="0">
					<div class="app-icon">
						<img src="/chat.png" alt="Chat" />
					</div>
					<div class="app-content">
						<h3 class="app-name">Chat</h3>
						<p class="app-description">
							Natural conversations with AI that creates projects, tasks, and notes for you
						</p>
					</div>
					<div class="app-badge badge-active">LIVE</div>
				</div>

				<div class="feature-card" role="button" tabindex="0">
					<div class="app-icon">
						<img src="/projects.png" alt="Projects" />
					</div>
					<div class="app-content">
						<h3 class="app-name">Projects</h3>
						<p class="app-description">
							Organize work into projects with AI-powered planning and context management
						</p>
					</div>
					<div class="app-badge badge-active">LIVE</div>
				</div>

				<div class="feature-card" role="button" tabindex="0">
					<div class="app-icon">
						<img src="/tasks.png" alt="Tasks" />
					</div>
					<div class="app-content">
						<h3 class="app-name">Tasks</h3>
						<p class="app-description">
							AI-powered task management that breaks down goals into actionable steps
						</p>
					</div>
					<div class="app-badge badge-active">LIVE</div>
				</div>

				<div class="feature-card" role="button" tabindex="0">
					<div class="app-icon">
						<img src="/notes.png" alt="Notes" />
					</div>
					<div class="app-content">
						<h3 class="app-name">Notes</h3>
						<p class="app-description">
							AI-enhanced note-taking with intelligent organization and search
						</p>
					</div>
					<div class="app-badge badge-active">LIVE</div>
				</div>
			</div>
		</div>
	</section>

	<footer class="footer">
		<div class="footer-container">
			<p class="text-muted">&copy; 2025 Chatkin. Built with care.</p>
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
		padding: 80px 20px 60px;
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
	}

	.hero-cta {
		display: flex;
		gap: 16px;
		justify-content: center;
		margin-bottom: 60px;
		flex-wrap: wrap;
	}

	.hero-demo {
		max-width: 600px;
		margin: 0 auto;
	}

	.chat-preview {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.message {
		display: flex;
	}

	.message.user {
		justify-content: flex-end;
	}

	.message.ai {
		justify-content: flex-start;
	}

	.message-bubble {
		max-width: 85%;
		padding: 12px 16px;
		border-radius: 12px;
		font-size: 0.9375rem;
		line-height: 1.5;
	}

	.message-bubble p {
		margin: 0;
	}

	.message.user .message-bubble {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		text-align: left;
	}

	.message.ai .message-bubble {
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		text-align: left;
		max-width: 95%;
	}

	/* Features */
	.features {
		padding: 80px 20px;
		background: var(--bg-secondary);
	}

	.features-container {
		max-width: 1200px;
		margin: 0 auto;
	}

	.section-title {
		text-align: center;
		margin-bottom: 60px;
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
		transition: all 0.2s ease;
		min-height: 100px;
		-webkit-tap-highlight-color: transparent;
		cursor: pointer;
		user-select: none;
	}

	.feature-card:active {
		transform: scale(0.98);
	}

	.feature-card:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	@media (hover: hover) {
		.feature-card:hover {
			transform: translateY(-2px);
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
			border-color: var(--accent-primary);
		}
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
		transform: translateY(3px) scale(0.95);
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
		border-top: none;
	}

	.footer-container {
		max-width: 1200px;
		margin: 0 auto;
		text-align: center;
	}

	.footer .text-muted {
		color: var(--text-secondary);
	}

	/* Responsive */
	@media (max-width: 639px) {
		.btn-text-desktop {
			display: none;
		}

		.btn-text-mobile {
			display: inline;
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
