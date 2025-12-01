<script lang="ts">
	let {
		current,
		total,
		domain
	}: {
		current: number;
		total: number;
		domain?: string;
	} = $props();

	const percentage = $derived((current / total) * 100);

	// Get domain color
	function getDomainColor(domainName?: string): string {
		if (!domainName) return 'var(--accent-primary)';

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
</script>

<div class="progress-container">
	<div class="progress-info">
		<span class="progress-text">Question {current} of {total}</span>
		{#if domain}
			<span class="domain-text">{domain}</span>
		{/if}
	</div>
	<div class="progress-bar">
		<div
			class="progress-fill"
			style="width: {percentage}%; background-color: {getDomainColor(domain)}"
		></div>
	</div>
</div>

<style>
	.progress-container {
		width: 100%;
		max-width: 700px;
		margin: 0 auto 32px;
	}

	.progress-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
		padding: 0 4px;
	}

	.progress-text {
		font-size: 0.9375rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.domain-text {
		font-size: 0.875rem;
		color: var(--text-muted);
		font-weight: 500;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background: var(--bg-tertiary);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		transition: width 0.3s ease, background-color 0.3s ease;
		border-radius: 4px;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.progress-info {
			flex-direction: column;
			align-items: flex-start;
			gap: 4px;
		}
	}
</style>
