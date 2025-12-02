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

	// Domain metadata configuration with SVG icons
	const domainConfig: Record<
		WellnessDomain,
		{ icon: string; color: string; desc: string }
	> = {
		Body: {
			icon: 'dumbbell',
			color: 'var(--domain-body)',
			desc: 'Physical health & energy'
		},
		Mind: {
			icon: 'brain',
			color: 'var(--domain-mind)',
			desc: 'Mental & emotional wellbeing'
		},
		Purpose: {
			icon: 'target',
			color: 'var(--domain-purpose)',
			desc: 'Work, meaning & fulfillment'
		},
		Connection: {
			icon: 'users',
			color: 'var(--domain-connection)',
			desc: 'Relationships & community'
		},
		Growth: {
			icon: 'trending-up',
			color: 'var(--domain-growth)',
			desc: 'Learning & development'
		},
		Finance: {
			icon: 'dollar-sign',
			color: 'var(--domain-finance)',
			desc: 'Financial & resource stability'
		}
	};

	const config = $derived(domain ? domainConfig[domain] : null);
	const percentage = $derived(domain ? Math.round((domainScore / 10) * 100) : 0);

	// Icon SVG paths (Lucide icons - clean)
	const icons: Record<string, string> = {
		'dumbbell': 'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2',
		'brain': 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4',
		'target': 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
		'users': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
		'trending-up': 'M22 7 13.5 15.5 8.5 10.5 2 17 M16 7h6v6',
		'dollar-sign': 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
		'folder': 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z'
	};
</script>

<button class="domain-card" onclick={onclick}>
	{#if domain && config}
		<div class="card-top">
			<div class="left-section">
				<div class="icon-square" style="background-color: {config.color}">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="white"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d={icons[config.icon]} />
					</svg>
				</div>
				<div class="domain-text">
					<h3 class="domain-name">{domain}</h3>
					<p class="domain-desc">{config.desc}</p>
				</div>
			</div>
			<div class="score-badge">
				<span class="score-large">{domainScore.toFixed(1)}</span>
				<span class="score-small">/10</span>
			</div>
		</div>

		<div class="progress-section">
			<div class="progress-bar">
				<div class="progress-fill" style="width: {percentage}%; background: {config.color}"></div>
			</div>
			<span class="progress-percent">{percentage}%</span>
		</div>

		<div class="stats-section">
			<div class="stat">
				<div class="stat-number">{projectCount}</div>
				<div class="stat-label">{projectCount === 1 ? 'Project' : 'Projects'}</div>
			</div>
			<div class="stat-divider"></div>
			<div class="stat">
				<div class="stat-number">{totalTasks}</div>
				<div class="stat-label">Tasks</div>
			</div>
			<div class="stat-divider"></div>
			<div class="stat">
				<div class="stat-number">{completedTasks}</div>
				<div class="stat-label">Completed</div>
			</div>
		</div>
	{:else}
		<!-- Unassigned projects -->
		<div class="card-top">
			<div class="left-section">
				<div class="icon-square unassigned">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="white"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d={icons['folder']} />
					</svg>
				</div>
				<div class="domain-text">
					<h3 class="domain-name">Unassigned</h3>
					<p class="domain-desc">
						{projectCount} {projectCount === 1 ? 'project' : 'projects'} without a domain
					</p>
				</div>
			</div>
		</div>

		<div class="stats-section">
			<div class="stat">
				<div class="stat-number">{totalTasks}</div>
				<div class="stat-label">Tasks</div>
			</div>
			<div class="stat-divider"></div>
			<div class="stat">
				<div class="stat-number">{completedTasks}</div>
				<div class="stat-label">Completed</div>
			</div>
		</div>
	{/if}
</button>

<style>
	.domain-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 0;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		text-align: left;
		width: 100%;
		overflow: hidden;
	}

	.domain-card:hover {
		border-color: var(--accent-primary);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
		transform: translateY(-2px);
	}

	.card-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 20px;
		gap: 16px;
	}

	.left-section {
		display: flex;
		gap: 14px;
		flex: 1;
		min-width: 0;
	}

	.icon-square {
		width: 48px;
		height: 48px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.icon-square.unassigned {
		background-color: #94a3b8;
	}

	.domain-text {
		flex: 1;
		min-width: 0;
	}

	.domain-name {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 4px 0;
		line-height: 1.3;
	}

	.domain-desc {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.4;
	}

	.score-badge {
		display: flex;
		align-items: baseline;
		gap: 2px;
		padding: 8px 14px;
		border-radius: 8px;
		flex-shrink: 0;
		font-weight: 700;
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.score-large {
		font-size: 1.75rem;
		line-height: 1;
		letter-spacing: -0.02em;
	}

	.score-small {
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.progress-section {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 20px 16px 20px;
	}

	.progress-bar {
		flex: 1;
		height: 6px;
		background: var(--bg-tertiary);
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.progress-percent {
		font-size: 0.75rem;
		font-weight: 600;
		flex-shrink: 0;
		color: var(--text-secondary);
	}

	.stats-section {
		display: flex;
		align-items: center;
		border-top: 1px solid var(--border-color);
		padding: 16px 20px;
	}

	.stat {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: center;
	}

	.stat-number {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1;
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.stat-divider {
		width: 1px;
		height: 32px;
		background: var(--border-color);
		margin: 0 8px;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.card-top {
			padding: 16px;
		}

		.icon-square {
			width: 40px;
			height: 40px;
		}

		.icon-square svg {
			width: 20px;
			height: 20px;
		}

		.domain-name {
			font-size: 1rem;
		}

		.domain-desc {
			font-size: 0.75rem;
		}

		.score-large {
			font-size: 1.5rem;
		}

		.progress-section {
			padding: 0 16px 12px 16px;
		}

		.stats-section {
			padding: 12px 16px;
		}

		.stat-number {
			font-size: 1.25rem;
		}

		.stat-label {
			font-size: 0.6875rem;
		}
	}
</style>
