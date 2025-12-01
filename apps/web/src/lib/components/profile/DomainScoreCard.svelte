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
			Security: 'var(--domain-security)'
		};
		return colorMap[domainName] || 'var(--accent-primary)';
	}

	// Get domain icon/emoji
	function getDomainEmoji(domainName: string): string {
		const emojiMap: Record<string, string> = {
			Body: '💪',
			Mind: '🧠',
			Purpose: '🎯',
			Connection: '🤝',
			Growth: '🌱',
			Security: '🛡️'
		};
		return emojiMap[domainName] || '✨';
	}

	const percentage = $derived(Math.round((score / 10) * 100));
</script>

<div class="domain-card">
	<div class="card-header">
		<div class="domain-icon" style="background-color: {getDomainColor(domain)}">
			{getDomainEmoji(domain)}
		</div>
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
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
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
			font-size: 1.75rem;
		}

		.domain-name {
			font-size: 1rem;
		}

		.score-value {
			font-size: 1.5rem;
		}
	}
</style>
