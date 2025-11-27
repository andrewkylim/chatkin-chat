<script lang="ts">
	import { captureException } from '@sentry/sveltekit';
	import { onMount } from 'svelte';

	// Props
	export let fallback: string | undefined = undefined;
	export let showDetails = false;

	// State
	let error: Error | null = null;
	let errorInfo: string = '';

	// Reset error state
	export function reset() {
		error = null;
		errorInfo = '';
	}

	// Handle errors from child components
	function handleError(event: ErrorEvent) {
		error = event.error || new Error('Unknown error occurred');
		errorInfo = event.error?.stack || '';

		// Report to Sentry
		try {
			captureException(error, {
				contexts: {
					errorBoundary: {
						componentStack: errorInfo
					}
				}
			});
		} catch (sentryError) {
			console.error('Failed to report error to Sentry:', sentryError);
		}

		// Prevent default error handling
		event.preventDefault();
	}

	onMount(() => {
		// Listen for errors from child components
		window.addEventListener('error', handleError);

		return () => {
			window.removeEventListener('error', handleError);
		};
	});
</script>

{#if error}
	<div class="error-boundary">
		<div class="error-content">
			<svg class="error-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10"/>
				<line x1="12" y1="8" x2="12" y2="12"/>
				<line x1="12" y1="16" x2="12.01" y2="16"/>
			</svg>

			<h2>Something went wrong</h2>

			{#if fallback}
				<p class="fallback-message">{fallback}</p>
			{:else}
				<p>We're sorry, but something unexpected happened. Please try refreshing the page.</p>
			{/if}

			{#if showDetails && errorInfo}
				<details class="error-details">
					<summary>Error details</summary>
					<pre>{error.message}\n\n{errorInfo}</pre>
				</details>
			{/if}

			<div class="error-actions">
				<button class="primary-btn" onclick={() => window.location.reload()}>
					Reload Page
				</button>
				<button class="secondary-btn" onclick={reset}>
					Try Again
				</button>
			</div>
		</div>
	</div>
{:else}
	<slot />
{/if}

<style>
	.error-boundary {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 400px;
		padding: 40px 20px;
		background: var(--bg-secondary);
	}

	.error-content {
		max-width: 500px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
	}

	.error-icon {
		color: var(--danger, #ef4444);
		margin-bottom: 8px;
	}

	.error-content h2 {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
		color: var(--text-primary);
	}

	.error-content p {
		color: var(--text-secondary);
		line-height: 1.6;
		margin: 0;
	}

	.fallback-message {
		font-weight: 500;
	}

	.error-details {
		width: 100%;
		margin-top: 16px;
		text-align: left;
	}

	.error-details summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--text-secondary);
		padding: 8px;
		border-radius: var(--radius-md, 8px);
		transition: background 0.2s ease;
	}

	.error-details summary:hover {
		background: var(--bg-tertiary);
	}

	.error-details pre {
		margin-top: 12px;
		padding: 16px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md, 8px);
		font-size: 0.875rem;
		line-height: 1.5;
		overflow-x: auto;
		color: var(--text-primary);
	}

	.error-actions {
		display: flex;
		gap: 12px;
		margin-top: 8px;
	}

	.primary-btn {
		padding: 10px 20px;
		background: var(--accent-primary, #c77c5c);
		color: white;
		border: none;
		border-radius: var(--radius-md, 8px);
		font-weight: 600;
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.primary-btn:hover {
		background: var(--accent-hover, #b06b4a);
		transform: translateY(-1px);
	}

	.secondary-btn {
		padding: 10px 20px;
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md, 8px);
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.secondary-btn:hover {
		background: var(--bg-tertiary);
	}
</style>
