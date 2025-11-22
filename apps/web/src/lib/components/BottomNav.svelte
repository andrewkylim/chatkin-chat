<script lang="ts">
	import { page } from '$app/stores';

	$: currentPath = $page.url.pathname;
</script>

<nav class="bottom-nav">
	<a href="/chat" class="nav-item" class:active={currentPath === '/chat'}>
		<img src="/chat.png" alt="Chat" class="nav-icon" />
		<span>Chat</span>
	</a>

	<a href="/projects" class="nav-item" class:active={currentPath.startsWith('/projects')}>
		<svg class="nav-icon-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<rect x="3" y="3" width="7" height="7" rx="1"/>
			<rect x="14" y="3" width="7" height="7" rx="1"/>
			<rect x="3" y="14" width="7" height="7" rx="1"/>
			<rect x="14" y="14" width="7" height="7" rx="1"/>
		</svg>
		<span>Projects</span>
	</a>

	<a href="/tasks" class="nav-item" class:active={currentPath === '/tasks'}>
		<img src="/tasks.png" alt="Tasks" class="nav-icon" />
		<span>Tasks</span>
	</a>

	<a href="/notes" class="nav-item" class:active={currentPath === '/notes'}>
		<img src="/notes.png" alt="Notes" class="nav-icon" />
		<span>Notes</span>
	</a>
</nav>

<style>
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		padding: 8px 0;
		padding-bottom: max(8px, env(safe-area-inset-bottom));
		z-index: 100;
	}

	.nav-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 12px;
		text-decoration: none;
		color: var(--text-secondary);
		transition: all 0.2s ease;
		position: relative;
	}

	.nav-item:active {
		transform: scale(0.95);
	}

	.nav-item.active {
		color: var(--accent-primary);
	}

	.nav-item.active::after {
		content: '';
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 32px;
		height: 3px;
		background: var(--accent-primary);
		border-radius: 0 0 3px 3px;
	}

	.nav-icon {
		width: 24px;
		height: 24px;
		object-fit: contain;
		opacity: 0.7;
		transition: opacity 0.2s ease;
	}

	.nav-item.active .nav-icon {
		opacity: 1;
	}

	.nav-icon-svg {
		opacity: 0.7;
		transition: opacity 0.2s ease;
	}

	.nav-item.active .nav-icon-svg {
		opacity: 1;
		stroke: var(--accent-primary);
	}

	.nav-item span {
		font-size: 0.75rem;
		font-weight: 500;
		letter-spacing: -0.01em;
	}

	/* Hide on desktop */
	@media (min-width: 1024px) {
		.bottom-nav {
			display: none;
		}
	}
</style>
