<script lang="ts">
	export let leftPanelClass: string = 'left-panel';
	export let rightPanelClass: string = 'right-panel';
</script>

<div class="side-by-side-container">
	<div class="{leftPanelClass}">
		<slot name="left" />
	</div>

	<div class="{rightPanelClass}">
		<slot name="right" />
	</div>
</div>

<style>
	.side-by-side-container {
		display: flex;
		height: 100vh;
		overflow: hidden;
		gap: 0;
	}

	.side-by-side-container :global(.left-panel) {
		flex: 0 0 45%;
		overflow-y: auto;
		background: var(--bg-secondary);
	}

	.side-by-side-container :global(.right-panel) {
		flex: 1;
		overflow: hidden;
		background: var(--bg-primary);
		border-left: 1px solid var(--border-color);
	}

	/* CRITICAL: Hide on mobile to show mobile-content instead */
	@media (max-width: 1023px) {
		.side-by-side-container {
			display: none;
		}
	}
</style>
