<script lang="ts">
	let { domain, score }: { domain: string; score: number } = $props();

	// Get domain color
	function getDomainColor(domainName: string): string {
		const colorMap: Record<string, string> = {
			Body: 'var(--domain-body)',
			Mind: 'var(--domain-mind)',
			Purpose: 'var(--domain-purpose)',
			Connection: 'var(--domain-connection)',
			Growth: 'var(--domain-growth)',
			Finance: 'var(--domain-finance)'
		};
		return colorMap[domainName] || 'var(--accent-primary)';
	}

	// Get domain icon SVG path
	function _getDomainIcon(domainName: string): string {
		const iconMap: Record<string, string> = {
			Body: 'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2',
			Mind: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4',
			Purpose: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
			Connection: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
			Growth: 'M22 7 13.5 15.5 8.5 10.5 2 17 M16 7h6v6',
			Finance: 'M2 6h20M2 12h20M2 18h20M6 2v20M12 2v20M18 2v20'
		};
		return iconMap[domainName] || 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5';
	}

	const percentage = $derived(Math.round((score / 10) * 100));
</script>

<div class="domain-card">
	<div class="card-header">
		<div class="domain-icon" style="background-color: {getDomainColor(domain)}"></div>
		<div class="domain-info">
			<h3 class="domain-name">{domain}</h3>
			<div class="domain-score">
				<span class="score-value">{score.toFixed(1)}</span>
				<span class="score-max">/10</span>
			</div>
		</div>
	</div>

	<div class="progress-container">
		<div class="progress-bar">
			<div
				class="progress-fill"
				style="width: {percentage}%; background-color: {getDomainColor(domain)}"
			></div>
		</div>
		<span class="percentage-label">{percentage}%</span>
	</div>
</div>

<style>
	.domain-card {
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 24px;
		transition: all 0.2s ease;
	}

	.domain-card:hover {
		border-color: var(--accent-primary);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 20px;
	}

	.domain-icon {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.domain-info {
		flex: 1;
	}

	.domain-name {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 4px;
	}

	.domain-score {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}

	.score-value {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.score-max {
		font-size: 1rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.progress-container {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.progress-bar {
		flex: 1;
		height: 12px;
		background: var(--bg-tertiary);
		border-radius: 6px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		transition: width 0.5s ease;
		border-radius: 6px;
	}

	.percentage-label {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text-secondary);
		min-width: 45px;
		text-align: right;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.domain-card {
			padding: 20px;
		}

		.domain-icon {
			width: 48px;
			height: 48px;
		}

		.domain-name {
			font-size: 1rem;
		}

		.score-value {
			font-size: 1.5rem;
		}
	}
</style>
