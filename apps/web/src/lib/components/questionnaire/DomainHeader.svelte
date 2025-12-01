<script lang="ts">
	let {
		domain,
		description
	}: {
		domain: string;
		description?: string;
	} = $props();

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

	// Get domain descriptions
	const domainDescriptions: Record<string, string> = {
		Body: 'Physical health, energy, and wellbeing',
		Mind: 'Mental and emotional health',
		Purpose: 'Work, meaning, and fulfillment',
		Connection: 'Relationships and community',
		Growth: 'Learning and personal development',
		Security: 'Financial and resource stability'
	};
</script>

<div class="domain-header" style="border-left-color: {getDomainColor(domain)}">
	<h2 class="domain-title" style="color: {getDomainColor(domain)}">{domain}</h2>
	<p class="domain-description">
		{description || domainDescriptions[domain] || ''}
	</p>
</div>

<style>
	.domain-header {
		max-width: 700px;
		margin: 0 auto 32px;
		padding: 24px 24px 24px 32px;
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		border-left: 4px solid;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	}

	.domain-title {
		font-size: 1.75rem;
		font-weight: 700;
		margin-bottom: 8px;
	}

	.domain-description {
		font-size: 1rem;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.domain-header {
			padding: 20px 20px 20px 24px;
		}

		.domain-title {
			font-size: 1.5rem;
		}

		.domain-description {
			font-size: 0.9375rem;
		}
	}
</style>
