<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import { getProjects, getProjectStats, createProject } from '$lib/db/projects';
	import { onMount } from 'svelte';

	let projects: any[] = [];
	let projectStats: Record<string, any> = {};
	let loading = true;
	let showNewProjectModal = false;
	let newProjectName = '';
	let newProjectDescription = '';
	let selectedEmoji = '📁';

	const availableEmojis = [
		'📁', '💼', '🏠', '🎯', '🚀', '📚', '🎨', '🌟',
		'💡', '🎉', '🔥', '⚡', '🎵', '🎮', '✈️', '🏋️',
		'🍕', '☕', '🌈', '🎭', '🎬', '📸', '🎪', '🎨',
		'🌸', '🌺', '🌻', '🌼', '🌷', '🌱', '🌿', '🍀',
		'🐶', '🐱', '🐼', '🦊', '🦁', '🐯', '🐸', '🦄'
	];

	onMount(async () => {
		await loadProjects();
	});

	async function loadProjects() {
		loading = true;
		try {
			projects = await getProjects();

			// Load stats for each project
			for (const project of projects) {
				projectStats[project.id] = await getProjectStats(project.id);
			}
		} catch (error) {
			console.error('Error loading projects:', error);
		} finally {
			loading = false;
		}
	}

	async function handleCreateProject() {
		if (!newProjectName.trim()) return;

		try {
			await createProject({
				name: newProjectName,
				description: newProjectDescription || null,
				color: selectedEmoji
			});

			// Reset form
			newProjectName = '';
			newProjectDescription = '';
			selectedEmoji = '📁';
			showNewProjectModal = false;

			// Reload projects
			await loadProjects();
		} catch (error) {
			console.error('Error creating project:', error);
		}
	}

	function getRelativeTime(date: string) {
		const now = new Date();
		const past = new Date(date);
		const diff = now.getTime() - past.getTime();
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const days = Math.floor(hours / 24);

		if (hours < 1) return 'Just now';
		if (hours < 24) return `${hours}h ago`;
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${days} days ago`;
		return past.toLocaleDateString();
	}

	function getProjectEmoji(project: any) {
		return project.color || '📁';
	}
</script>

<AppLayout>
<div class="projects-page">
	<header class="page-header">
		<div class="header-content">
			<h1>Projects</h1>
			<button class="primary-btn" on:click={() => showNewProjectModal = true}>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M8 2v12M2 8h12"/>
				</svg>
				New Project
			</button>
		</div>
	</header>

	<div class="page-content">
		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading projects...</p>
			</div>
		{:else if projects.length === 0}
			<div class="empty-state">
				<img src="/projects.png" alt="Projects" class="empty-icon" />
				<h2>No projects yet</h2>
				<p>Create your first project to get started</p>
				<button class="primary-btn" on:click={() => showNewProjectModal = true}>Create Project</button>
			</div>
		{:else}
			<div class="projects-grid">
				{#each projects as project (project.id)}
					{@const stats = projectStats[project.id] || { totalTasks: 0, completedTasks: 0, totalNotes: 0 }}
					<a href="/projects/{project.id}/chat" class="project-card">
						<div class="project-header">
							<div class="project-icon" style="background: rgba(199, 124, 92, 0.1);">
								{getProjectEmoji(project)}
							</div>
							<div class="project-info">
								<h3>{project.name}</h3>
								<p class="project-meta">{stats.totalTasks} tasks · {stats.totalNotes} notes</p>
							</div>
						</div>
						{#if project.description}
							<p class="project-description">{project.description}</p>
						{/if}
						<div class="project-footer">
							<span class="task-status">
								{#if stats.totalTasks > 0}
									<span class="status-dot {stats.completedTasks === stats.totalTasks ? 'completed' : 'in-progress'}"></span>
								{/if}
								{stats.completedTasks} of {stats.totalTasks} completed
							</span>
							<span class="project-date">Updated {getRelativeTime(project.updated_at)}</span>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>

	<!-- New Project Modal -->
	{#if showNewProjectModal}
		<div class="modal-overlay" on:click={() => showNewProjectModal = false}>
			<div class="modal" on:click|stopPropagation>
				<h2>Create New Project</h2>
				<form on:submit|preventDefault={handleCreateProject}>
					<div class="form-group">
						<label>Project Icon</label>
						<div class="emoji-grid">
							{#each availableEmojis as emoji}
								<button
									type="button"
									class="emoji-btn"
									class:selected={selectedEmoji === emoji}
									on:click={() => selectedEmoji = emoji}
								>
									{emoji}
								</button>
							{/each}
						</div>
					</div>
					<div class="form-group">
						<label for="project-name">Project Name</label>
						<input
							type="text"
							id="project-name"
							bind:value={newProjectName}
							placeholder="e.g., Wedding Planning"
							required
							autofocus
						/>
					</div>
					<div class="form-group">
						<label for="project-description">Description (optional)</label>
						<textarea
							id="project-description"
							bind:value={newProjectDescription}
							placeholder="Briefly describe your project..."
							rows="3"
						></textarea>
					</div>
					<div class="modal-actions">
						<button type="button" class="secondary-btn" on:click={() => showNewProjectModal = false}>
							Cancel
						</button>
						<button type="submit" class="primary-btn">
							Create Project
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
</AppLayout>

<style>
	.projects-page {
		min-height: 100vh;
		background: var(--bg-primary);
	}

	.page-header {
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
		padding: 16px 20px;
		height: 64px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.header-content {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.page-header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.primary-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 20px;
		font-size: 0.9375rem;
	}

	.page-content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 24px 20px;
	}

	.projects-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 16px;
	}

	.project-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 20px;
		text-decoration: none;
		color: var(--text-primary);
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.project-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
		border-color: var(--accent-primary);
	}

	.project-card:active {
		transform: scale(0.98);
	}

	.project-header {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}

	.project-icon {
		width: 48px;
		height: 48px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 24px;
		flex-shrink: 0;
	}

	.project-info {
		flex: 1;
		min-width: 0;
	}

	.project-info h3 {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 4px;
		letter-spacing: -0.02em;
	}

	.project-meta {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.project-description {
		font-size: 0.9375rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	.project-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
		color: var(--text-muted);
		padding-top: 8px;
		border-top: 1px solid var(--border-color);
	}

	.task-status {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.status-dot.completed {
		background: var(--accent-success);
	}

	.status-dot.in-progress {
		background: var(--accent-primary);
	}

	.project-date {
		color: var(--text-muted);
	}

	/* Empty State */
	.empty-state {
		padding: 60px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 400px;
	}

	.empty-icon {
		width: 100px;
		height: 100px;
		margin-bottom: 24px;
	}

	.empty-state h2 {
		font-size: 1.5rem;
		margin-bottom: 8px;
	}

	.empty-state p {
		color: var(--text-secondary);
		margin-bottom: 24px;
	}

	/* Loading State */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 20px;
		gap: 16px;
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
		to { transform: rotate(360deg); }
	}

	.loading-state p {
		color: var(--text-secondary);
		margin: 0;
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
		z-index: 1000;
		padding: 20px;
	}

	.modal {
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		padding: 24px;
		max-width: 500px;
		width: 100%;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.modal h2 {
		font-size: 1.5rem;
		margin-bottom: 20px;
	}

	.form-group {
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		font-weight: 600;
		font-size: 0.875rem;
		margin-bottom: 8px;
		color: var(--text-primary);
	}

	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 12px 16px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
	}

	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	.form-group textarea {
		resize: vertical;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
	}

	.secondary-btn {
		padding: 10px 20px;
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.secondary-btn:hover {
		background: var(--bg-tertiary);
	}

	/* Emoji Grid */
	.emoji-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 8px;
		padding: 12px;
		background: var(--bg-tertiary);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
	}

	.emoji-btn {
		width: 100%;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary);
		border: 2px solid transparent;
		border-radius: var(--radius-sm);
		font-size: 1.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.emoji-btn:hover {
		background: var(--bg-primary);
		transform: scale(1.1);
	}

	.emoji-btn.selected {
		background: var(--bg-primary);
		border-color: var(--accent-primary);
		transform: scale(1.1);
	}

	/* Responsive */
	@media (min-width: 640px) {
		.projects-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.projects-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
