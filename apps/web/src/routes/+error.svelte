<script lang="ts">
	import { page } from '$app/stores';
	import { captureException } from '@sentry/sveltekit';
	import { auth } from '$lib/stores/auth';
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
	$: isLoggedIn = $auth.user !== null;
</script>

<svelte:head>
	<title>{isNotFound ? 'Page Not Found' : 'Error'} - Chatkin</title>
</svelte:head>

<div class="error-page">
	<div class="error-container">
		<div class="error-content">
			<svg class="error-illustration" viewBox="0 0 24 24" fill="none">
				<!-- Outer circle -->
				<circle
					cx="12"
					cy="12"
					r="9"
					stroke="#ef4444"
					stroke-width="2"
					fill="none"
				/>
				<!-- Inner filled circle -->
				<circle
					cx="12"
					cy="12"
					r="9"
					fill="#ef4444"
					opacity="0.6"
				/>
			</svg>

			{#if isNotFound}
				<h1>404 - Page Not Found</h1>
				<p class="error-message">The page you're looking for doesn't exist or has been moved.</p>
			{:else if status === 500}
				<h1>500 - Server Error</h1>
				<p class="error-message">Something went wrong on our end. We're working to fix it.</p>
			{:else}
				<h1>Error {status}</h1>
				<p class="error-message">{message}</p>
			{/if}

			<div class="error-actions">
				<a href={isLoggedIn ? '/chat' : '/'} class="primary-btn">
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
		width: 120px;
		height: auto;
		margin-bottom: 16px;
	}

	.error-content h1 {
		font-size: 2rem;
		font-weight: 700;
		margin: 0;
		color: var(--text-primary);
		letter-spacing: -0.02em;
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
			width: 100px;
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
