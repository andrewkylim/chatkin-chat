<script lang="ts">
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	$: currentPath = $page.url.pathname;

	async function handleSignOut() {
		await auth.signOut();
		goto('/login');
	}
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<a href="/chat" class="logo">
			<img src="/logo.webp" alt="Chatkin" class="logo-icon" />
			<span>Chatkin</span>
		</a>
	</div>

	<nav class="sidebar-nav">
		<a href="/chat" class="nav-item" class:active={currentPath === '/chat'}>
			<img src="/chat.png" alt="" class="nav-icon" />
			<span>Chat</span>
		</a>

		<div class="nav-section">
			<div class="section-header">
				<span>Workspace</span>
			</div>

			<a href="/projects" class="nav-item" class:active={currentPath.startsWith('/projects')}>
				<img src="/projects.png" alt="" class="nav-icon" />
				<span>Projects</span>
			</a>

			<a href="/tasks" class="nav-item" class:active={currentPath === '/tasks'}>
				<img src="/tasks.png" alt="" class="nav-icon" />
				<span>Tasks</span>
			</a>

			<a href="/notes" class="nav-item" class:active={currentPath === '/notes'}>
				<img src="/notes.png" alt="" class="nav-icon" />
				<span>Notes</span>
			</a>
		</div>
	</nav>

	<div class="sidebar-footer">
		<button class="user-profile" on:click={handleSignOut} title="Sign out">
			<div class="user-avatar">
				{#if $auth.user?.user_metadata?.avatar_url}
					<img src={$auth.user.user_metadata.avatar_url} alt="User" />
				{:else}
					<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
						<path d="M10 10c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
					</svg>
				{/if}
			</div>
			<div class="user-info">
				<span class="user-name">{$auth.user?.user_metadata?.name || $auth.user?.email || 'User'}</span>
			</div>
			<svg class="signout-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6"/>
			</svg>
		</button>
	</div>
</aside>

<style>
	.sidebar {
		width: 240px;
		height: 100vh;
		background: var(--bg-secondary);
		border-right: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		position: fixed;
		left: 0;
		top: 0;
		z-index: 50;
	}

	.sidebar-header {
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-color);
		height: 64px;
		display: flex;
		align-items: center;
		box-sizing: border-box;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 8px;
		text-decoration: none;
		color: var(--text-primary);
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		cursor: pointer;
	}

	.logo-icon {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		transition: all 0.1s ease;
	}

	.logo:active .logo-icon {
		transform: scale(0.95);
	}

	.sidebar-nav {
		flex: 1;
		padding: 12px;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--text-secondary);
		font-size: 0.9375rem;
		font-weight: 500;
		transition: all 0.2s ease;
		margin-bottom: 4px;
	}

	.nav-item:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.nav-item.active {
		background: var(--bg-tertiary);
		color: var(--accent-primary);
		font-weight: 600;
	}

	.nav-icon {
		width: 40px;
		height: 40px;
		transition: all 0.1s ease;
	}

	.nav-item:active .nav-icon {
		transform: scale(0.95);
	}

	.nav-icon-svg {
		opacity: 0.7;
	}

	.nav-item.active .nav-icon-svg {
		opacity: 1;
		stroke: var(--accent-primary);
	}

	.nav-section {
		margin-top: 24px;
	}

	.section-header {
		padding: 8px 12px;
		margin-bottom: 4px;
	}

	.section-header span {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.sidebar-footer {
		padding: 16px;
		border-top: 1px solid var(--border-color);
		height: 76px;
		display: flex;
		align-items: center;
		box-sizing: border-box;
	}

	.user-profile {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 8px;
		background: transparent;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all 0.2s ease;
		color: var(--text-primary);
	}

	.user-profile:hover {
		background: var(--bg-tertiary);
	}

	.user-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-secondary);
		overflow: hidden;
	}

	.user-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.user-info {
		flex: 1;
		text-align: left;
	}

	.user-name {
		font-size: 0.9375rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.signout-icon {
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.user-profile:hover .signout-icon {
		opacity: 0.7;
	}

	/* Hide on mobile */
	@media (max-width: 1023px) {
		.sidebar {
			display: none;
		}
	}
</style>
