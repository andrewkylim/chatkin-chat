<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import EditProjectModal from '$lib/components/EditProjectModal.svelte';
	import MobileUserMenu from '$lib/components/MobileUserMenu.svelte';
	import { getProjects, getProjectStats, createProject, deleteProject } from '$lib/db/projects';
	import { onMount } from 'svelte';

	let projects: any[] = [];
	let projectStats: Record<string, any> = {};
	let loading = true;
	let showNewProjectModal = false;
	let newProjectName = '';
	let newProjectDescription = '';
	let selectedEmoji = '📁';
	let showAllEmojis = false;
	let deleteConfirmProject: any = null;
	let editProject: any = null;
	let showEditModal = false;

	const quickEmojis = ['📁', '💼', '🏠', '🎯', '🚀', '📚', '🎨'];

	const allEmojis = [
		'📁', '💼', '🏠', '🎯', '🚀', '📚', '🎨',
		'🌟', '💡', '🎉', '🔥', '⚡', '🎵', '🎮',
		'✈️', '🍕', '☕', '🌈', '🎭', '🎬', '📸',
		'🎪', '🌱', '🌸', '🌻', '🌷', '🍀', '🦄',
		'🐶', '🐱', '🎄', '🦊', '🦁', '🐯', '🎃',
		'⭐', '🎁', '💝', '🎈'
	];

	$: availableEmojis = showAllEmojis ? allEmojis : quickEmojis;

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
			showAllEmojis = false;
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

	function truncateProjectName(name: string, maxLength: number = 30) {
		if (name.length <= maxLength) return name;
		return name.substring(0, maxLength) + '...';
	}

	function truncateDescription(description: string, maxLength: number = 50) {
		if (description.length <= maxLength) return description;
		return description.substring(0, maxLength) + '...';
	}

	async function handleDeleteProject() {
		if (!deleteConfirmProject) return;

		try {
			await deleteProject(deleteConfirmProject.id);
			deleteConfirmProject = null;
			await loadProjects();
		} catch (error) {
			console.error('Error deleting project:', error);
			alert('Failed to delete project');
		}
	}

	function startEditProject(project: any) {
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

	<!-- Mobile Header -->
	<header class="mobile-header">
		<h1>Projects</h1>
		<div class="mobile-header-actions">
			<button class="mobile-new-btn" on:click={() => showNewProjectModal = true}>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M8 2v12M2 8h12"/>
				</svg>
			</button>
			<MobileUserMenu />
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
					<div class="project-card">
						<a href="/projects/{project.id}/chat" class="project-card-link">
							<div class="project-header">
								<div class="project-icon" style="background: rgba(199, 124, 92, 0.1);">
									{getProjectEmoji(project)}
								</div>
								<div class="project-info">
									<h3>{truncateProjectName(project.name)}</h3>
									<p class="project-meta">{stats.totalTasks} tasks · {stats.totalNotes} notes</p>
								</div>
							</div>
							{#if project.description}
								<p class="project-description">{truncateDescription(project.description)}</p>
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
						<div class="card-actions">
							<button class="edit-icon-btn" on:click|stopPropagation={() => startEditProject(project)} title="Edit project">
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M11.5 2l2.5 2.5L6 12.5H3.5V10L11.5 2z"/>
								</svg>
							</button>
							<button class="delete-icon-btn" on:click|stopPropagation={() => deleteConfirmProject = project} title="Delete project">
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M2 4h12M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M13 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V4"/>
								</svg>
							</button>
						</div>
					</div>
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
						<div class="emoji-selector">
							<div class="emoji-row">
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
								<button
									type="button"
									class="emoji-more-btn"
									class:active={showAllEmojis}
									on:click={() => showAllEmojis = !showAllEmojis}
									title={showAllEmojis ? "Show less" : "More emojis"}
								>
									{#if showAllEmojis}
										<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M5 15l5-5 5 5"/>
										</svg>
									{:else}
										<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
											<circle cx="4" cy="10" r="1.5"/>
											<circle cx="10" cy="10" r="1.5"/>
											<circle cx="16" cy="10" r="1.5"/>
										</svg>
									{/if}
								</button>
							</div>
						</div>
					</div>
					<div class="form-group">
						<label for="project-name">Project Name</label>
						<input
							type="text"
							id="project-name"
							bind:value={newProjectName}
							placeholder="e.g., Wedding Planning"
							maxlength="50"
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
							maxlength="200"
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

	<!-- Edit Project Modal -->
	<EditProjectModal
		show={showEditModal}
		project={editProject}
		onClose={handleCloseEditModal}
		onUpdate={handleProjectUpdated}
	/>

	<!-- Delete Confirmation Modal -->
	{#if deleteConfirmProject}
		<div class="modal-overlay" on:click={() => deleteConfirmProject = null}>
			<div class="modal" on:click|stopPropagation>
				<h2>Delete Project?</h2>
				<p>Are you sure you want to delete "{deleteConfirmProject.name}"? This will also delete all tasks and notes in this project. This action cannot be undone.</p>
				<div class="modal-actions">
					<button type="button" class="secondary-btn" on:click={() => deleteConfirmProject = null}>
						Cancel
					</button>
					<button type="button" class="danger-btn" on:click={handleDeleteProject}>
						Delete Project
					</button>
				</div>
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
		position: relative;
		width: 100%;
		min-width: 0;
	}

	.project-card-link {
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
		min-height: 180px;
		width: 100%;
		box-sizing: border-box;
	}

	.project-card-link:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
		border-color: var(--accent-primary);
	}

	.project-card-link:active {
		transform: scale(0.98);
	}

	.card-actions {
		position: absolute;
		top: 16px;
		right: 16px;
		display: flex;
		gap: 8px;
		opacity: 1;
		transition: opacity 0.2s ease;
		z-index: 1;
	}

	.edit-icon-btn,
	.delete-icon-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.edit-icon-btn {
		color: var(--text-primary);
	}

	.edit-icon-btn:hover {
		background: var(--bg-primary);
		border-color: var(--accent-primary);
		color: var(--accent-primary);
		transform: scale(1.1);
	}

	.delete-icon-btn {
		color: rgb(239, 68, 68);
	}

	.delete-icon-btn:hover {
		background: rgba(239, 68, 68, 0.1);
		border-color: rgb(239, 68, 68);
		transform: scale(1.1);
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
		padding-right: 40px;
	}

	.project-info h3 {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 4px;
		letter-spacing: -0.02em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		word-break: break-all;
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
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.project-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
		color: var(--text-muted);
		padding-top: 8px;
		border-top: 1px solid var(--border-color);
		margin-top: auto;
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
		padding: 180px 20px 60px;
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
		max-height: 90vh;
		overflow-y: auto;
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

	.danger-btn {
		padding: 10px 20px;
		background: rgb(239, 68, 68);
		border: none;
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.danger-btn:hover {
		background: rgb(220, 38, 38);
		transform: translateY(-1px);
	}

	.danger-btn:active {
		transform: translateY(0);
	}

	/* Emoji Selector */
	.emoji-selector {
		padding: 12px;
		background: var(--bg-tertiary);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		max-height: 300px;
		overflow-y: auto;
	}

	.emoji-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: center;
	}

	.emoji-btn {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary);
		border: 2px solid transparent;
		border-radius: var(--radius-sm);
		font-size: 1.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.emoji-btn:hover {
		background: var(--bg-primary);
		transform: scale(1.1);
	}

	.emoji-btn.selected {
		background: var(--bg-primary);
		border-color: var(--accent-primary);
		transform: scale(1.05);
	}

	.emoji-more-btn {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
		color: var(--text-muted);
	}

	.emoji-more-btn:hover {
		background: var(--bg-primary);
		color: var(--text-secondary);
	}

	.emoji-more-btn.active {
		background: var(--bg-primary);
		border-color: var(--accent-primary);
		color: var(--accent-primary);
	}

	/* Responsive - max 2 columns */
	@media (min-width: 640px) {
		.projects-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	/* Mobile Layout */
	.mobile-header {
		display: none;
	}

	@media (max-width: 1023px) {
		.page-header {
			display: none;
		}

		.mobile-header {
			display: flex;
			flex-shrink: 0;
			padding: 16px 20px;
			background: var(--bg-secondary);
			border-bottom: 1px solid var(--border-color);
			height: 64px;
			box-sizing: border-box;
			justify-content: space-between;
			align-items: center;
		}

		.mobile-header h1 {
			font-size: 1.5rem;
			font-weight: 700;
			letter-spacing: -0.02em;
			margin: 0;
		}

		.mobile-header-actions {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.mobile-new-btn {
			width: 44px;
			height: 44px;
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--accent-primary);
			color: white;
			border: none;
			border-radius: var(--radius-md);
			cursor: pointer;
			transition: all 0.2s ease;
		}

		.mobile-new-btn:hover {
			background: var(--accent-hover);
			transform: translateY(-1px);
		}

		.mobile-new-btn:active {
			transform: translateY(0);
		}

		.page-content {
			padding: 20px;
		}
	}
</style>
