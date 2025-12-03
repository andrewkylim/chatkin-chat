<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import EditProjectModal from '$lib/components/EditProjectModal.svelte';
	import MobileUserMenu from '$lib/components/MobileUserMenu.svelte';
	import DomainProjectCard from '$lib/components/projects/DomainProjectCard.svelte';
	import { getProjects, getProjectStats } from '$lib/db/projects';
	import { getAssessmentResults } from '$lib/db/assessment';
	import type { AssessmentResults } from '$lib/db/assessment';
	import { onMount } from 'svelte';
	import { notificationCounts } from '$lib/stores/notifications';
	import type { Project, WellnessDomain } from '@chatkin/types';
	import { handleError } from '$lib/utils/error-handler';

	interface ProjectStats {
		totalTasks: number;
		completedTasks: number;
		totalNotes: number;
		totalFiles: number;
	}

	interface DomainWithProjects {
		domain: WellnessDomain | null;
		domainScore: number;
		projects: Project[];
		totalTasks: number;
		completedTasks: number;
		totalNotes: number;
		totalFiles: number;
	}

	let projects: Project[] = [];
	let projectStats: Record<string, ProjectStats> = {};
	let assessmentResults: AssessmentResults | null = null;
	let domainGroups: DomainWithProjects[] = [];
	let expandedDomain: WellnessDomain | null = null;
	let loading = true;
	let editProject: Project | null = null;
	let showEditModal = false;

	const domains: WellnessDomain[] = ['Body', 'Mind', 'Purpose', 'Connection', 'Growth', 'Finance'];

	onMount(async () => {
		notificationCounts.setCurrentSection('projects');
		notificationCounts.clearCount('projects');
		await loadProjects();
	});

	async function loadProjects() {
		loading = true;
		try {
			// Fetch projects and assessment results in parallel
			const [projectsData, assessmentData] = await Promise.all([
				getProjects(),
				getAssessmentResults()
			]);

			projects = projectsData;
			assessmentResults = assessmentData;

			// Load stats for each project
			for (const project of projects) {
				projectStats[project.id] = await getProjectStats(project.id);
			}

			// Group projects by domain
			domainGroups = groupProjectsByDomain(projects, assessmentResults);
		} catch (error) {
			handleError(error, { operation: 'Load projects', component: 'ProjectsPage' });
		} finally {
			loading = false;
		}
	}

	function groupProjectsByDomain(
		projects: Project[],
		results: AssessmentResults | null
	): DomainWithProjects[] {
		const groups: DomainWithProjects[] = [];

		// Create group for each domain (each domain should have exactly 1 project)
		for (const domain of domains) {
			const domainProjects = projects.filter((p) => p.domain === domain);
			const group: DomainWithProjects = {
				domain,
				domainScore: results?.domain_scores[domain] || 0,
				projects: domainProjects,
				totalTasks: 0,
				completedTasks: 0,
				totalNotes: 0,
				totalFiles: 0
			};

			// Aggregate stats for this domain (should be just 1 project)
			for (const project of domainProjects) {
				const stats = projectStats[project.id];
				if (stats) {
					group.totalTasks += stats.totalTasks;
					group.completedTasks += stats.completedTasks;
					group.totalNotes += stats.totalNotes;
					group.totalFiles += stats.totalFiles;
				}
			}

			groups.push(group);
		}

		return groups;
	}


	function getProjectEmoji(project: Project) {
		return project.color || '📁';
	}

	function getDomainColor(domain: WellnessDomain | null): string {
		const colorMap: Record<WellnessDomain, string> = {
			Body: 'var(--domain-body)',
			Mind: 'var(--domain-mind)',
			Purpose: 'var(--domain-purpose)',
			Connection: 'var(--domain-connection)',
			Growth: 'var(--domain-growth)',
			Finance: 'var(--domain-finance)'
		};
		return domain ? colorMap[domain] : 'rgba(199, 124, 92, 0.2)';
	}

	function getDomainConfig(domain: WellnessDomain): { color: string; iconPath: string; desc: string } {
		const icons: Record<string, string> = {
			'dumbbell': 'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2',
			'brain': 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4',
			'target': 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
			'users': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
			'trending-up': 'M22 7 13.5 15.5 8.5 10.5 2 17 M16 7h6v6',
			'dollar-sign': 'M2 6h20M2 12h20M2 18h20M6 2v20M12 2v20M18 2v20'
		};

		const domainConfig: Record<WellnessDomain, { icon: string; color: string; desc: string }> = {
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

		const config = domainConfig[domain];
		return {
			color: config.color,
			iconPath: icons[config.icon],
			desc: config.desc
		};
	}

	function truncateDescription(description: string, maxLength: number = 50) {
		if (description.length <= maxLength) return description;
		return description.substring(0, maxLength) + '...';
	}

	function _startEditProject(project: Project) {
		editProject = project;
		showEditModal = true;
	}

	function handleCloseEditModal() {
		editProject = null;
		showEditModal = false;
	}

	async function handleProjectUpdated() {
		await loadProjects();
	}

	function handleDomainClick(domain: WellnessDomain | null) {
		expandedDomain = domain;
	}

	function handleBackToAllDomains() {
		expandedDomain = null;
	}
</script>

<AppLayout>
	<div class="projects-page">
		<header class="page-header">
			<div class="header-content">
				<h1>Projects</h1>
			</div>
		</header>

		<!-- Mobile Header -->
		<header class="mobile-header">
			<div class="mobile-header-left">
				<a href="/chat" class="mobile-logo-button">
					<img src="/logo.webp" alt="Chatkin" class="mobile-logo" />
				</a>
				<h1>Projects</h1>
			</div>
			<MobileUserMenu />
		</header>

		<div class="page-content">
			{#if loading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Loading projects...</p>
				</div>
			{:else if projects.length === 0}
				<div class="empty-state">
					<img src="/projects.webp" alt="Projects" class="empty-icon" />
					<h2>No projects yet</h2>
					<p>Create your first project to get started</p>
				</div>
			{:else}
				{#if expandedDomain === null}
					<!-- Domain Cards Grid View -->
					<div class="domains-grid">
						{#each domainGroups as group (group.domain || 'unassigned')}
							<DomainProjectCard
								domain={group.domain}
								domainScore={group.domainScore}
								projectCount={group.projects.length}
								totalTasks={group.totalTasks}
								completedTasks={group.completedTasks}
								onclick={() => handleDomainClick(group.domain)}
							/>
						{/each}
					</div>
				{:else}
					<!-- Expanded Domain View -->
					{@const group = domainGroups.find((g) => g.domain === expandedDomain)}
					{#if group}
						<div class="expanded-domain-view">
							<button class="back-button" on:click={handleBackToAllDomains}>
								<svg
									width="16"
									height="16"
									viewBox="0 0 16 16"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M10 4L6 8l4 4" />
								</svg>
								Back to All Domains
							</button>

							<div class="domain-header">
								<div class="domain-header-top">
									<div class="domain-header-left">
										{#if group.domain}
											{@const config = getDomainConfig(group.domain)}
											<div class="domain-icon-large" style="background-color: {config.color}">
												<svg
													width="28"
													height="28"
													viewBox="0 0 24 24"
													fill="none"
													stroke="white"
													stroke-width="2.5"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<path d={config.iconPath} />
												</svg>
											</div>
											<div class="domain-info">
												<h2>{group.domain}</h2>
												<p class="domain-desc">{config.desc}</p>
											</div>
										{:else}
											<div class="domain-icon-large unassigned">
												<svg
													width="28"
													height="28"
													viewBox="0 0 24 24"
													fill="none"
													stroke="white"
													stroke-width="2.5"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z" />
												</svg>
											</div>
											<div class="domain-info">
												<h2>Unassigned</h2>
												<p class="domain-desc">{group.projects.length} {group.projects.length === 1 ? 'project' : 'projects'} without a domain</p>
											</div>
										{/if}
									</div>
									{#if group.domain}
										<div class="domain-score-badge">
											<span class="score-value">{group.domainScore.toFixed(1)}</span>
											<span class="score-max">/10</span>
										</div>
									{/if}
								</div>
								{#if group.domain}
									{@const percentage = Math.round((group.domainScore / 10) * 100)}
									{@const config = getDomainConfig(group.domain)}
									<div class="domain-progress-section">
										<div class="progress-bar">
											<div class="progress-fill" style="width: {percentage}%; background: {config.color}"></div>
										</div>
										<span class="progress-percent">{percentage}%</span>
									</div>
								{/if}
							</div>

							<!-- Projects Grid for this domain -->
							<div class="projects-grid">
								{#each group.projects as project (project.id)}
									{@const stats = projectStats[project.id] || { totalTasks: 0, completedTasks: 0, totalNotes: 0, totalFiles: 0 }}
									<div class="project-card">
										<a href="/projects/{project.id}/chat" class="project-card-link">
											<div class="project-header">
												<div class="project-icon-circle" style="background-color: {getDomainColor(project.domain)};">
													<span class="icon">{getProjectEmoji(project)}</span>
												</div>
												<div class="project-info">
													<h3>{project.name}</h3>
													<p class="project-meta">
														{stats.totalTasks} tasks · {stats.totalNotes} notes · {stats.totalFiles} files
													</p>
												</div>
											</div>
											{#if project.description}
												<p class="project-description">{truncateDescription(project.description)}</p>
											{/if}
											<div class="project-footer">
												<span class="task-status">
													{#if stats.totalTasks > 0}
														<span
															class="status-dot {stats.completedTasks === stats.totalTasks
																? 'completed'
																: 'in-progress'}"
														></span>
													{/if}
													{stats.completedTasks} of {stats.totalTasks} completed
												</span>
												<span class="project-date">Updated {new Date(project.updated_at).toLocaleDateString()}</span>
											</div>
										</a>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/if}
			{/if}
		</div>

		<!-- Edit Project Modal -->
		<EditProjectModal
			show={showEditModal}
			project={editProject}
			onClose={handleCloseEditModal}
			onUpdate={handleProjectUpdated}
		/>
	</div>
</AppLayout>

<style>
	.projects-page {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.page-header {
		padding: 32px 48px 24px;
		border-bottom: 1px solid var(--border-color);
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.page-header h1 {
		font-size: 1.875rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.page-content {
		flex: 1;
		overflow-y: auto;
		padding: 32px 48px;
	}

	/* Domain Cards Grid */
	.domains-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 24px;
	}

	/* Expanded Domain View */
	.expanded-domain-view {
		max-width: 1200px;
	}

	.back-button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		margin-bottom: 28px;
	}

	.back-button:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent-primary);
	}

	.back-button svg {
		flex-shrink: 0;
	}

	.domain-header {
		padding: 24px 28px;
		margin-bottom: 32px;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-lg);
	}

	.domain-header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		margin-bottom: 20px;
	}

	.domain-header-left {
		display: flex;
		align-items: center;
		gap: 16px;
		flex: 1;
		min-width: 0;
	}

	.domain-icon-large {
		width: 56px;
		height: 56px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: white;
	}

	.domain-icon-large.unassigned {
		background-color: #94a3b8;
	}

	.domain-info {
		flex: 1;
		min-width: 0;
	}

	.domain-header h2 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 4px 0;
		line-height: 1.2;
	}

	.domain-desc {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.4;
	}

	.domain-score-badge {
		display: flex;
		align-items: baseline;
		gap: 3px;
		padding: 10px 18px;
		background: var(--bg-tertiary);
		border-radius: var(--radius-md);
		flex-shrink: 0;
	}

	.domain-score-badge .score-value {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1;
		letter-spacing: -0.02em;
	}

	.domain-score-badge .score-max {
		font-size: 0.9375rem;
		color: var(--text-secondary);
		font-weight: 600;
	}

	.domain-progress-section {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.domain-progress-section .progress-bar {
		flex: 1;
		height: 8px;
		background: var(--bg-tertiary);
		border-radius: 4px;
		overflow: hidden;
	}

	.domain-progress-section .progress-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.domain-progress-section .progress-percent {
		font-size: 0.875rem;
		font-weight: 600;
		flex-shrink: 0;
		color: var(--text-secondary);
	}

	/* Projects Grid */
	.projects-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 24px;
	}

	.project-card {
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-lg);
		transition: all 0.2s ease;
		position: relative;
	}

	.project-card:hover {
		border-color: var(--accent-primary);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}

	.project-card-link {
		display: block;
		padding: 24px;
		text-decoration: none;
		color: inherit;
	}

	.project-header {
		display: flex;
		gap: 16px;
		margin-bottom: 16px;
	}

	.project-icon-circle {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		position: relative;
	}

	.project-icon-circle .icon {
		font-size: 1.75rem;
		filter: brightness(0) invert(1);
	}

	.project-info {
		flex: 1;
		min-width: 0;
	}

	.project-info h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 6px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.project-meta {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.project-description {
		font-size: 0.9375rem;
		color: var(--text-secondary);
		margin-bottom: 16px;
		line-height: 1.5;
	}

	.project-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.task-status {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.status-dot.in-progress {
		background: var(--accent-primary);
	}

	.status-dot.completed {
		background: #10b981;
	}

	/* Loading State */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		padding: 80px 20px;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--border-color);
		border-top-color: var(--accent-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 80px 20px;
	}

	.empty-icon {
		width: 100px;
		height: 100px;
		margin-bottom: 12px;
	}

	.empty-state h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 8px;
	}

	.empty-state p {
		font-size: 1rem;
		color: var(--text-secondary);
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
		padding: 20px;
	}

	.modal {
		background: var(--bg-primary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 32px;
		max-width: 500px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 24px;
	}

	.modal p {
		font-size: 1rem;
		color: var(--text-secondary);
		line-height: 1.6;
		margin-bottom: 24px;
	}

	.form-content {
		display: flex;
		flex-direction: column;
		gap: 20px;
		margin-bottom: 24px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.form-group label {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		padding: 12px;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
		font-size: 1rem;
		color: var(--text-primary);
		transition: border-color 0.2s ease;
	}

	.form-group select {
		cursor: pointer;
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
		padding-right: 36px;
	}

	.form-group input:focus,
	.form-group textarea:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.form-group textarea {
		resize: vertical;
		font-family: inherit;
	}

	.form-group select option {
		background: var(--bg-secondary);
		color: var(--text-primary);
		padding: 8px;
	}

	.emoji-selector {
		padding: 16px;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
	}

	.emoji-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.emoji-btn {
		width: 44px;
		height: 44px;
		padding: 0;
		background: var(--bg-primary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
		font-size: 1.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.emoji-btn:hover {
		border-color: var(--accent-primary);
		transform: scale(1.05);
	}

	.emoji-btn.selected {
		border-color: var(--accent-primary);
		background: rgba(199, 124, 92, 0.1);
	}

	.emoji-more-btn {
		width: 44px;
		height: 44px;
		padding: 0;
		background: var(--bg-primary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.emoji-more-btn:hover {
		border-color: var(--accent-primary);
		color: var(--text-primary);
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
	}

	.primary-btn,
	.secondary-btn,
	.danger-btn {
		padding: 12px 24px;
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.primary-btn {
		background: var(--accent-primary);
		border: none;
		color: white;
	}

	.primary-btn:hover {
		background: var(--accent-hover);
	}

	.secondary-btn {
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		color: var(--text-primary);
	}

	.secondary-btn:hover {
		border-color: var(--accent-primary);
	}

	.danger-btn {
		background: var(--danger);
		border: none;
		color: white;
	}

	.danger-btn:hover {
		background: #dc2626;
	}

	/* Mobile Header */
	.mobile-header {
		display: none;
	}

	/* Mobile Styles */
	@media (max-width: 768px) {
		.page-header {
			display: none;
		}

		.mobile-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 16px 20px;
			border-bottom: 1px solid var(--border-color);
			background: var(--bg-primary);
		}

		.mobile-header-left {
			display: flex;
			align-items: center;
			gap: 12px;
		}

		.mobile-logo-button {
			display: flex;
			align-items: center;
		}

		.mobile-logo {
			width: 32px;
			height: 32px;
		}

		.mobile-header h1 {
			font-size: 1.25rem;
			font-weight: 600;
			color: var(--text-primary);
		}

		.page-content {
			padding: 20px;
		}

		.domains-grid,
		.projects-grid {
			grid-template-columns: 1fr;
			gap: 16px;
		}

		.modal {
			padding: 24px;
		}

		.modal h2 {
			font-size: 1.25rem;
		}
	}
</style>
