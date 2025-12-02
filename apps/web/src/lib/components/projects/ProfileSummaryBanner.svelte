<script lang="ts">
	import type { AssessmentResults } from '$lib/db/assessment';

	let { results }: { results: AssessmentResults | null } = $props();

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	};
</script>

{#if results}
	<a href="/profile" class="profile-summary-banner">
		<div class="banner-content">
			<div class="banner-icon">🧘</div>
			<div class="banner-text">
				<h3>Your Wellness Profile</h3>
				<p>6 areas assessed • Last updated {formatDate(results.completed_at)}</p>
			</div>
		</div>
		<div class="banner-action">
			<span>View Full Report</span>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M6 4l4 4-4 4" />
			</svg>
		</div>
	</a>
{:else}
	<a href="/questionnaire" class="profile-summary-banner incomplete">
		<div class="banner-content">
			<div class="banner-icon">📊</div>
			<div class="banner-text">
				<h3>Complete Your Wellness Assessment</h3>
				<p>Get personalized insights and domain scores</p>
			</div>
		</div>
		<div class="banner-action">
			<span>Start Assessment</span>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M6 4l4 4-4 4" />
			</svg>
		</div>
	</a>
{/if}

<style>
	.profile-summary-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 20px 24px;
		margin-bottom: 32px;
		text-decoration: none;
		color: var(--text-primary);
		transition: all 0.2s ease;
	}

	.profile-summary-banner:hover {
		border-color: var(--accent-primary);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.banner-content {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.banner-icon {
		font-size: 2rem;
	}

	.banner-text h3 {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 4px;
	}

	.banner-text p {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.banner-action {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--accent-primary);
		font-weight: 600;
	}

	.profile-summary-banner.incomplete {
		background: linear-gradient(
			135deg,
			rgba(199, 124, 92, 0.05) 0%,
			rgba(199, 124, 92, 0.1) 100%
		);
	}

	@media (max-width: 640px) {
		.profile-summary-banner {
			padding: 16px;
		}

		.banner-icon {
			font-size: 1.5rem;
		}

		.banner-text h3 {
			font-size: 1rem;
		}

		.banner-text p {
			font-size: 0.8125rem;
		}

		.banner-action span {
			display: none;
		}
	}
</style>
