<script lang="ts">
	import type { WellnessDomain } from '@chatkin/types';

	let {
		domain,
		domainScore,
		projectCount,
		totalTasks,
		completedTasks,
		totalNotes,
		totalFiles,
		onclick
	}: {
		domain: WellnessDomain | null;
		domainScore: number;
		projectCount: number;
		totalTasks: number;
		completedTasks: number;
		totalNotes: number;
		totalFiles: number;
		onclick: () => void;
	} = $props();

	// Domain metadata configuration
	const domainConfig: Record<
		WellnessDomain,
		{ icon: string; color: string; desc: string }
	> = {
		Body: {
			icon: '💪',
			color: 'var(--domain-body)',
			desc: 'Physical health, energy, and wellbeing'
		},
		Mind: { icon: '🧠', color: 'var(--domain-mind)', desc: 'Mental and emotional health' },
		Purpose: {
			icon: '🎯',
			color: 'var(--domain-purpose)',
			desc: 'Work, meaning, and fulfillment'
		},
		Connection: {
			icon: '🤝',
			color: 'var(--domain-connection)',
			desc: 'Relationships and community'
		},
		Growth: { icon: '🌱', color: 'var(--domain-growth)', desc: 'Learning and development' },
		Finance: {
			icon: '💰',
			color: 'var(--domain-finance)',
			desc: 'Financial and resource stability'
		}
	};

	const config = $derived(domain ? domainConfig[domain] : null);
	const percentage = $derived(domain ? Math.round((domainScore / 10) * 100) : 0);
</script>

<button class="domain-project-card" {onclick}>
	{#if domain && config}
		<!-- Domain with score -->
		<div class="card-header">
			<div class="domain-icon-circle" style="background-color: {config.color}">
				<span class="icon">{config.icon}</span>
			</div>
			<div class="domain-info">
				<h3 class="domain-name">{domain}</h3>
				<p class="domain-desc">{config.desc}</p>
			</div>
			<div class="domain-score" style="color: {config.color}">
				<span class="score-value">{domainScore.toFixed(1)}</span>
				<span class="score-max">/10</span>
			</div>
		</div>

		<div class="progress-bar-container">
			<div class="progress-bar">
				<div
					class="progress-fill"
					style="width: {percentage}%; background-color: {config.color}"
				></div>
			</div>
		</div>

		<div class="project-stats">
			<div class="stat">
				<span class="stat-value">{projectCount}</span>
				<span class="stat-label">{projectCount === 1 ? 'project' : 'projects'}</span>
			</div>
			<div class="stat-divider"></div>
			<div class="stat">
				<span class="stat-value">{totalTasks}</span>
				<span class="stat-label">tasks</span>
			</div>
			<div class="stat-divider"></div>
			<div class="stat">
				<span class="stat-value">{completedTasks}</span>
				<span class="stat-label">completed</span>
			</div>
		</div>
	{:else}
		<!-- Unassigned projects -->
		<div class="card-header">
			<div class="domain-icon-circle unassigned">
				<span class="icon">📋</span>
			</div>
			<div class="domain-info">
				<h3 class="domain-name">Unassigned</h3>
				<p class="domain-desc">
					{projectCount}
					{projectCount === 1 ? 'project' : 'projects'} without a domain
				</p>
			</div>
		</div>
	{/if}
</button>

<style>
	.domain-project-card {
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 24px;
		transition: all 0.2s ease;
		cursor: pointer;
		text-align: left;
		width: 100%;
	}

	.domain-project-card:hover {
		border-color: var(--accent-primary);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
		transform: translateY(-2px);
	}

	.card-header {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		margin-bottom: 20px;
	}

	.domain-icon-circle {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		position: relative;
	}

	.domain-icon-circle .icon {
		font-size: 1.75rem;
		filter: brightness(0) invert(1);
	}

	.domain-icon-circle.unassigned {
		background-color: var(--text-tertiary);
	}

	.domain-info {
		flex: 1;
		min-width: 0;
	}

	.domain-name {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 4px;
	}

	.domain-desc {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.domain-score {
		display: flex;
		align-items: baseline;
		gap: 4px;
		flex-shrink: 0;
	}

	.score-value {
		font-size: 1.75rem;
		font-weight: 700;
	}

	.score-max {
		font-size: 1rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.progress-bar-container {
		margin-bottom: 16px;
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
		transition: width 0.5s ease;
		border-radius: 4px;
	}

	.project-stats {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.stat-label {
		font-size: 0.8125rem;
		color: var(--text-secondary);
	}

	.stat-divider {
		width: 1px;
		height: 32px;
		background: var(--border-color);
	}

	/* Mobile */
	@media (max-width: 768px) {
		.domain-project-card {
			padding: 20px;
		}

		.domain-icon-circle {
			width: 48px;
			height: 48px;
		}

		.domain-icon-circle .icon {
			font-size: 1.5rem;
		}

		.domain-name {
			font-size: 1rem;
		}

		.domain-desc {
			font-size: 0.8125rem;
		}

		.score-value {
			font-size: 1.5rem;
		}

		.stat-value {
			font-size: 1.125rem;
		}

		.project-stats {
			gap: 12px;
		}
	}
</style>
