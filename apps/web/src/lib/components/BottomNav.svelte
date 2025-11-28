<script lang="ts">
	import { page } from '$app/stores';
	import { notificationCounts } from '$lib/stores/notifications';

	$: currentPath = $page.url.pathname;
</script>

<nav class="bottom-nav">
	<a href="/chat" class="nav-item" class:active={currentPath === '/chat'}>
		<span>Chat</span>
	</a>

	<a href="/projects" class="nav-item" class:active={currentPath.startsWith('/projects')}>
		<span>Projects</span>
		{#if $notificationCounts.projects > 0}
			<span class="notification-dot"></span>
		{/if}
	</a>

	<a href="/tasks" class="nav-item" class:active={currentPath === '/tasks'}>
		<span>Tasks</span>
		{#if $notificationCounts.tasks > 0}
			<span class="notification-dot"></span>
		{/if}
	</a>

	<a href="/notes" class="nav-item" class:active={currentPath === '/notes'}>
		<span>Notes</span>
		{#if $notificationCounts.notes > 0}
			<span class="notification-dot"></span>
		{/if}
	</a>

	<a href="/files" class="nav-item" class:active={currentPath === '/files'}>
		<span>Files</span>
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
		height: calc(50px + env(safe-area-inset-bottom));
		padding-bottom: env(safe-area-inset-bottom);
		z-index: 100;
		transform: translate3d(0, 0, 0);
		-webkit-transform: translate3d(0, 0, 0);
	}

	.nav-item {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
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
		width: 50%;
		height: 3px;
		background: var(--accent-primary);
		border-radius: 0 0 3px 3px;
	}

	.nav-item > span:first-child {
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.notification-dot {
		width: 8px;
		height: 8px;
		background: var(--accent-primary);
		border-radius: 50%;
		margin-left: 6px;
		flex-shrink: 0;
	}

	/* Hide on desktop */
	@media (min-width: 1024px) {
		.bottom-nav {
			display: none;
		}
	}
</style>
