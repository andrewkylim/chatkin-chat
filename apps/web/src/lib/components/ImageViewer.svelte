<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { File } from '@chatkin/types';
	import { getViewerUrl } from '$lib/utils/image-cdn';

	export let file: File;
	export let allFiles: File[] = [];

	const dispatch = createEventDispatcher();

	$: currentIndex = allFiles.findIndex((f) => f.id === file.id);
	$: hasPrev = currentIndex > 0;
	$: hasNext = currentIndex < allFiles.length - 1;

	function close() {
		dispatch('close');
	}

	function prev() {
		if (hasPrev) {
			dispatch('navigate', allFiles[currentIndex - 1]);
		}
	}

	function next() {
		if (hasNext) {
			dispatch('navigate', allFiles[currentIndex + 1]);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
		if (e.key === 'ArrowLeft') prev();
		if (e.key === 'ArrowRight') next();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			close();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="viewer-backdrop" on:click={handleBackdropClick}>
	<div class="viewer-container">
		<!-- Close Button -->
		<button class="close-btn" on:click={close} aria-label="Close">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>

		<!-- Navigation Buttons -->
		{#if hasPrev}
			<button class="nav-btn nav-btn-prev" on:click={prev} aria-label="Previous">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M15 18l-6-6 6-6" />
				</svg>
			</button>
		{/if}

		{#if hasNext}
			<button class="nav-btn nav-btn-next" on:click={next} aria-label="Next">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M9 18l6-6-6-6" />
				</svg>
			</button>
		{/if}

		<!-- Image -->
		<div class="image-wrapper">
			<img src={getViewerUrl(file.r2_url)} alt={file.title || file.filename} />
		</div>

		<!-- Info -->
		<div class="image-info">
			<h3>{file.title || file.filename}</h3>
			{#if file.description}
				<p>{file.description}</p>
			{/if}
			<div class="meta">
				<span>{currentIndex + 1} / {allFiles.length}</span>
			</div>
		</div>
	</div>
</div>

<style>
	.viewer-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.95);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 20px;
	}

	.viewer-container {
		position: relative;
		max-width: 90vw;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.close-btn {
		position: absolute;
		top: 0;
		right: 0;
		width: 44px;
		height: 44px;
		background: rgba(255, 255, 255, 0.1);
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		z-index: 10;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.nav-btn {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 56px;
		height: 56px;
		background: rgba(255, 255, 255, 0.1);
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		z-index: 10;
	}

	.nav-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.nav-btn-prev {
		left: -70px;
	}

	.nav-btn-next {
		right: -70px;
	}

	.image-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		max-height: 70vh;
	}

	.image-wrapper img {
		max-width: 100%;
		max-height: 70vh;
		object-fit: contain;
		border-radius: var(--radius-lg);
	}

	.image-info {
		background: rgba(255, 255, 255, 0.1);
		padding: 16px 20px;
		border-radius: var(--radius-md);
		color: white;
	}

	.image-info h3 {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 4px 0;
	}

	.image-info p {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.8);
		margin: 0 0 8px 0;
	}

	.meta {
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.6);
	}

	/* Mobile Responsive */
	@media (max-width: 768px) {
		.viewer-backdrop {
			padding: 10px;
		}

		.nav-btn-prev {
			left: 10px;
		}

		.nav-btn-next {
			right: 10px;
		}

		.close-btn {
			top: 10px;
			right: 10px;
		}

		.image-wrapper {
			max-height: 60vh;
		}

		.image-wrapper img {
			max-height: 60vh;
		}
	}
</style>
