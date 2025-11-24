<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	let showMenu = false;
	let menuButton: HTMLButtonElement;

	$: user = $auth.user;
	$: userInitials = user?.email ? user.email[0].toUpperCase() : '?';

	async function handleSignOut() {
		await auth.signOut();
		goto('/login');
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
			<button class="menu-item" on:click={handleSignOut}>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6"/>
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
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--accent-primary);
		color: white;
		border: none;
		font-size: 1rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
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
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		min-width: 160px;
		z-index: 100;
		overflow: hidden;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		width: 100%;
		background: none;
		border: none;
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
	}

	.menu-item:hover {
		background: var(--bg-tertiary);
	}

	.menu-item svg {
		flex-shrink: 0;
	}
</style>
