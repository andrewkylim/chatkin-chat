<script lang="ts">
	import Sidebar from './Sidebar.svelte';
	import BottomNav from './BottomNav.svelte';
	import AuthGuard from './AuthGuard.svelte';

	let { children, hideBottomNav = false } = $props();
</script>

<AuthGuard>
	<div class="app-layout">
		<Sidebar />

		<main class="app-content" class:no-bottom-nav={hideBottomNav}>
			{@render children()}
		</main>

		{#if !hideBottomNav}
			<BottomNav />
		{/if}
	</div>
</AuthGuard>

<style>
	.app-layout {
		display: flex;
		min-height: 100vh;
		background: var(--bg-primary);
	}

	.app-content {
		flex: 1;
		margin-left: 240px;
		margin-bottom: 0;
	}

	/* Mobile responsive */
	@media (max-width: 1023px) {
		.app-content {
			margin-left: 0;
			margin-bottom: 60px; /* Space for bottom nav */
		}

		.app-content.no-bottom-nav {
			margin-bottom: 0; /* No space needed when bottom nav is hidden */
		}
	}
</style>
