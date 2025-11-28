<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';
	import { notificationCounts } from '$lib/stores/notifications';
	import { onMount } from 'svelte';

	let showUserMenu = false;
	let userButton: HTMLDivElement;
	let imageLoadFailed = false;

	$: currentPath = $page.url.pathname;
	$: userName = $auth.user?.user_metadata?.name || $auth.user?.email || 'User';
	$: userInitial = userName.charAt(0).toUpperCase();

	// Reset imageLoadFailed when avatar URL changes
	$: if ($auth.user?.user_metadata?.avatar_url) {
		imageLoadFailed = false;
	}

	function handleImageError() {
		imageLoadFailed = true;
	}

	function toggleUserMenu() {
		showUserMenu = !showUserMenu;
	}

	async function handleSignOut() {
		await auth.signOut();
		goto('/');
	}

	// Close menu when clicking outside
	onMount(() => {
		function handleClickOutside(event: MouseEvent) {
			if (showUserMenu && userButton && !userButton.contains(event.target as Node)) {
				showUserMenu = false;
			}
		}

		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
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
			<img src="/chat.webp" alt="" class="nav-icon" />
			<span>Chat</span>
		</a>

		<div class="nav-section">
			<div class="section-header">
				<span>Workspace</span>
			</div>

			<a href="/projects" class="nav-item" class:active={currentPath.startsWith('/projects')}>
				<img src="/projects.webp" alt="" class="nav-icon" />
				<span>Projects</span>
				{#if $notificationCounts.projects > 0}
					<span class="notification-dot"></span>
				{/if}
			</a>

			<a href="/tasks" class="nav-item" class:active={currentPath === '/tasks'}>
				<img src="/tasks.webp" alt="" class="nav-icon" />
				<span>Tasks</span>
				{#if $notificationCounts.tasks > 0}
					<span class="notification-dot"></span>
				{/if}
			</a>

			<a href="/notes" class="nav-item" class:active={currentPath === '/notes'}>
				<img src="/notes.webp" alt="" class="nav-icon" />
				<span>Notes</span>
				{#if $notificationCounts.notes > 0}
					<span class="notification-dot"></span>
				{/if}
			</a>

			<a href="/files" class="nav-item" class:active={currentPath === '/files'}>
				<img src="/files.webp" alt="" class="nav-icon" />
				<span>Files</span>
			</a>
		</div>
	</nav>

	<div class="sidebar-footer">
		<div class="user-profile" bind:this={userButton} onclick={toggleUserMenu}>
			<div class="user-avatar" class:has-image={$auth.user?.user_metadata?.avatar_url && !imageLoadFailed}>
				{#if $auth.user?.user_metadata?.avatar_url && !imageLoadFailed}
					<img src={$auth.user.user_metadata.avatar_url} alt="User" onerror={handleImageError} />
				{:else}
					<span class="user-initial">{userInitial}</span>
				{/if}
			</div>
			<div class="user-info">
				<span class="user-name">{userName}</span>
			</div>
		</div>

		{#if showUserMenu}
			<div class="user-dropdown-menu">
				<a href="/settings" class="menu-item">
					<svg class="item-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
						<path d="M13.4 8c0-.3 0-.5-.1-.7l1.2-1c.1-.1.1-.3 0-.4l-1.2-2c-.1-.1-.3-.2-.4-.1l-1.4.6c-.4-.3-.8-.5-1.3-.7l-.3-1.5c0-.2-.2-.3-.4-.3h-2.4c-.2 0-.3.1-.4.3l-.3 1.5c-.5.2-.9.4-1.3.7l-1.4-.6c-.2-.1-.3 0-.4.1l-1.2 2c-.1.1-.1.3 0 .4l1.2 1c-.1.2-.1.4-.1.7 0 .3 0 .5.1.7l-1.2 1c-.1.1-.1.3 0 .4l1.2 2c.1.1.3.2.4.1l1.4-.6c.4.3.8.5 1.3.7l.3 1.5c0 .2.2.3.4.3h2.4c.2 0 .3-.1.4-.3l.3-1.5c.5-.2.9-.4 1.3-.7l1.4.6c.2.1.3 0 .4-.1l1.2-2c.1-.1.1-.3 0-.4l-1.2-1c.1-.2.1-.4.1-.7z"/>
					</svg>
					Settings
				</a>
				<button class="menu-item" onclick={handleSignOut}>
					<svg class="item-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3M11 11l3-3-3-3M14 8H6"/>
					</svg>
					Log Out
				</button>
			</div>
		{/if}
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
		width: 46px;
		height: 46px;
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
		position: relative;
	}

	.user-profile {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 8px;
		background: transparent;
		border-radius: var(--radius-md);
		transition: all 0.2s ease;
		color: var(--text-primary);
		cursor: pointer;
	}

	.user-profile:hover {
		background: var(--bg-tertiary);
	}

	.user-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--accent-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		overflow: hidden;
		flex-shrink: 0;
	}

	.user-avatar.has-image {
		background: var(--bg-tertiary);
	}

	.user-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.user-initial {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
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

	.notification-dot {
		width: 8px;
		height: 8px;
		background: var(--accent-primary);
		border-radius: 50%;
		margin-left: 4px;
		flex-shrink: 0;
	}

	.user-dropdown-menu {
		position: absolute;
		bottom: calc(100% - 8px);
		left: 16px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		overflow: hidden;
		z-index: 100;
		min-width: 140px;
		width: max-content;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;
		width: 100%;
		background: none;
		border: none;
		border-bottom: 1px solid var(--border-color);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s ease;
		text-align: left;
		text-decoration: none;
		white-space: nowrap;
	}

	.menu-item:last-child {
		border-bottom: none;
	}

	.menu-item:hover {
		background: var(--bg-tertiary);
	}

	.item-icon {
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: var(--text-secondary);
	}

	/* Hide on mobile */
	@media (max-width: 1023px) {
		.sidebar {
			display: none;
		}
	}
</style>
