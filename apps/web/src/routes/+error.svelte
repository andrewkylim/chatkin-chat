<script lang="ts">
	import { page } from '$app/stores';
	import { captureException } from '@sentry/sveltekit';
	import { onMount } from 'svelte';

	// Report error to Sentry on mount
	onMount(() => {
		if ($page.error) {
			captureException($page.error, {
				contexts: {
					route: {
						url: $page.url.pathname,
						params: $page.params
					}
				}
			});
		}
	});

	// Get error details
	$: status = $page.status || 500;
	$: message = $page.error?.message || 'An unexpected error occurred';
	$: isNotFound = status === 404;
</script>

<svelte:head>
	<title>{isNotFound ? 'Page Not Found' : 'Error'} - Chatkin</title>
</svelte:head>

<div class="error-page">
	<div class="error-container">
		<div class="error-content">
			{#if isNotFound}
				<img src="/error.webp" alt="Error illustration" class="error-illustration" />
				<h1>Page Not Found</h1>
				<p class="error-message">The page you're looking for doesn't exist or has been moved.</p>
			{:else}
				<svg class="error-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/>
					<line x1="12" y1="8" x2="12" y2="12"/>
					<line x1="12" y1="16" x2="12.01" y2="16"/>
				</svg>
				<h1>Something Went Wrong</h1>
				<p class="error-code">Error {status}</p>
				<p class="error-message">{message}</p>
			{/if}

			<div class="error-actions">
				<a href="/" class="primary-btn">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
					</svg>
					Go Home
				</a>
				<button class="secondary-btn" onclick={() => window.history.back()}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M19 12H5M12 19l-7-7 7-7"/>
					</svg>
					Go Back
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.error-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-primary);
		padding: 20px;
	}

	.error-container {
		max-width: 600px;
		width: 100%;
	}

	.error-content {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
	}

	.error-illustration {
		width: 200px;
		height: auto;
		margin-bottom: 16px;
	}

	.error-icon {
		color: var(--danger, #ef4444);
		margin-bottom: 8px;
	}

	.error-content h1 {
		font-size: 2rem;
		font-weight: 700;
		margin: 0;
		color: var(--text-primary);
		letter-spacing: -0.02em;
	}

	.error-code {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin: 0;
	}

	.error-message {
		color: var(--text-secondary);
		font-size: 1rem;
		line-height: 1.6;
		margin: 0;
		max-width: 400px;
	}

	.error-actions {
		display: flex;
		gap: 12px;
		margin-top: 12px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.primary-btn,
	.secondary-btn {
		padding: 12px 24px;
		border-radius: var(--radius-md, 8px);
		font-weight: 600;
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 8px;
		text-decoration: none;
	}

	.primary-btn {
		background: var(--accent-primary, #c77c5c);
		color: white;
		border: none;
	}

	.primary-btn:hover {
		background: var(--accent-hover, #b06b4a);
		transform: translateY(-1px);
	}

	.secondary-btn {
		background: transparent;
		border: 1px solid var(--border-color);
		color: var(--text-primary);
	}

	.secondary-btn:hover {
		background: var(--bg-secondary);
	}

	@media (max-width: 640px) {
		.error-content h1 {
			font-size: 1.5rem;
		}

		.error-illustration {
			width: 150px;
		}

		.error-actions {
			flex-direction: column;
			width: 100%;
		}

		.primary-btn,
		.secondary-btn {
			width: 100%;
			justify-content: center;
		}
	}
</style>
