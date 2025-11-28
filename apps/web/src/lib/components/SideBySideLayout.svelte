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
	}

	.side-by-side-container :global(.left-panel) {
		flex: 2;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border-color);
		background: var(--bg-secondary);
		overflow: hidden;
	}

	.side-by-side-container :global(.right-panel) {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
		min-width: 400px;
		overflow: hidden;
	}

	/* CRITICAL: Hide on mobile to show mobile-content instead */
	@media (max-width: 1023px) {
		.side-by-side-container {
			display: none;
		}
	}
</style>
