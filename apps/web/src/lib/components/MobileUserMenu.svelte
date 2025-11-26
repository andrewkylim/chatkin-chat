<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	let showMenu = false;
	let menuButton: HTMLButtonElement;

	$: user = $auth.user;
	$: userInitials = user?.email ? user.email[0].toUpperCase() : '?';

	async function handleSignOut() {
		await auth.signOut();
		goto('/');
	}

	function toggleMenu() {
		showMenu = !showMenu;
	}

	// Close menu when clicking outside
	function handleClickOutside(event: MouseEvent) {
		if (showMenu && !menuButton.contains(event.target as Node)) {
			showMenu = false;
		}
	}

	$: if (typeof window !== 'undefined') {
		if (showMenu) {
			document.addEventListener('click', handleClickOutside);
		} else {
			document.removeEventListener('click', handleClickOutside);
		}
	}
</script>

<div class="user-menu-container">
	<button
		class="user-avatar"
		on:click|stopPropagation={toggleMenu}
		bind:this={menuButton}
		aria-label="User menu"
	>
		{userInitials}
	</button>

	{#if showMenu}
		<div class="dropdown-menu">
			<a href="/settings" class="menu-item">
				<svg class="menu-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
					<path d="M13.4 8c0-.3 0-.5-.1-.7l1.2-1c.1-.1.1-.3 0-.4l-1.2-2c-.1-.1-.3-.2-.4-.1l-1.4.6c-.4-.3-.8-.5-1.3-.7l-.3-1.5c0-.2-.2-.3-.4-.3h-2.4c-.2 0-.3.1-.4.3l-.3 1.5c-.5.2-.9.4-1.3.7l-1.4-.6c-.2-.1-.3 0-.4.1l-1.2 2c-.1.1-.1.3 0 .4l1.2 1c-.1.2-.1.4-.1.7 0 .3 0 .5.1.7l-1.2 1c-.1.1-.1.3 0 .4l1.2 2c.1.1.3.2.4.1l1.4-.6c.4.3.8.5 1.3.7l.3 1.5c0 .2.2.3.4.3h2.4c.2 0 .3-.1.4-.3l.3-1.5c.5-.2.9-.4 1.3-.7l1.4.6c.2.1.3 0 .4-.1l1.2-2c.1-.1.1-.3 0-.4l-1.2-1c.1-.2.1-.4.1-.7z"/>
				</svg>
				Settings
			</a>
			<button class="menu-item" on:click={handleSignOut}>
				<svg class="menu-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3M11 11l3-3-3-3M14 8H6"/>
				</svg>
				Log Out
			</button>
		</div>
	{/if}
</div>

<style>
	.user-menu-container {
		position: relative;
	}

	.user-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--accent-primary);
		color: white;
		border: none;
		font-size: 0.9rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.user-avatar:hover {
		background: var(--accent-hover);
	}

	.user-avatar:active {
		transform: scale(0.95);
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		min-width: 140px;
		width: max-content;
		z-index: 1000;
		overflow: hidden;
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

	.menu-icon {
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: var(--text-secondary);
	}
</style>
