<script lang="ts">
	import { updateProject } from '$lib/db/projects';
	import type { Project } from '@chatkin/types';

	export let show = false;
	export let project: Project | null = null;
	export let onClose: () => void;
	export let onUpdate: () => void;

	let editProjectName = '';
	let editProjectDescription = '';
	let editSelectedEmoji = '📁';
	let editShowAllEmojis = false;

	const quickEmojis = ['📁', '💼', '🏠', '🎯', '🚀', '📚', '🎨'];
	const allEmojis = [
		'📁', '💼', '🏠', '🎯', '🚀', '📚', '🎨',
		'🌟', '💡', '🎉', '🔥', '⚡', '🎵', '🎮',
		'✈️', '🍕', '☕', '🌈', '🎭', '🎬', '📸',
		'🎪', '🌱', '🌸', '🌻', '🌷', '🍀', '🦄',
		'🐶', '🐱', '🎄', '🦊', '🦁', '🐯', '🎃',
		'⭐', '🎁', '💝', '🎈'
	];

	$: editAvailableEmojis = editShowAllEmojis ? allEmojis : quickEmojis;

	$: if (show && project) {
		editProjectName = project.name;
		editProjectDescription = project.description || '';
		editSelectedEmoji = project.color || '📁';
		editShowAllEmojis = false;
	}

	async function handleUpdateProject() {
		if (!project || !editProjectName.trim()) return;

		try {
			await updateProject(project.id, {
				name: editProjectName,
				description: editProjectDescription || null,
				color: editSelectedEmoji
			});

			onUpdate();
			onClose();
		} catch (error) {
			console.error('Error updating project:', error);
			alert('Failed to update project');
		}
	}

	function handleClose() {
		editProjectName = '';
		editProjectDescription = '';
		editSelectedEmoji = '📁';
		editShowAllEmojis = false;
		onClose();
	}
</script>

{#if show}
	<div class="modal-overlay" on:click={handleClose} on:keydown={(e) => e.key === 'Escape' && handleClose()}>
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" on:click|stopPropagation on:keydown|stopPropagation>
			<h2 id="modal-title">Edit Project</h2>
			<form on:submit|preventDefault={handleUpdateProject}>
				<div class="form-group">
					<label>Project Icon</label>
					<div class="emoji-selector">
						<div class="emoji-row">
							{#each editAvailableEmojis as emoji}
								<button
									type="button"
									class="emoji-btn"
									class:selected={editSelectedEmoji === emoji}
									on:click={() => editSelectedEmoji = emoji}
									aria-label="Select {emoji} icon"
									aria-pressed={editSelectedEmoji === emoji}
								>
									{emoji}
								</button>
							{/each}
							<button
								type="button"
								class="emoji-more-btn"
								class:active={editShowAllEmojis}
								on:click={() => editShowAllEmojis = !editShowAllEmojis}
								aria-label={editShowAllEmojis ? "Show less emojis" : "Show more emojis"}
								aria-expanded={editShowAllEmojis}
							>
								{#if editShowAllEmojis}
									<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
										<path d="M5 15l5-5 5 5"/>
									</svg>
								{:else}
									<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
					<label for="edit-project-name">Project Name</label>
					<input
						type="text"
						id="edit-project-name"
						bind:value={editProjectName}
						placeholder="e.g., Wedding Planning"
						maxlength="50"
						required
						autofocus
					/>
				</div>
				<div class="form-group">
					<label for="edit-project-description">Description (optional)</label>
					<textarea
						id="edit-project-description"
						bind:value={editProjectDescription}
						placeholder="Briefly describe your project..."
						maxlength="200"
						rows="3"
					></textarea>
				</div>
				<div class="modal-actions">
					<button type="button" class="secondary-btn" on:click={handleClose}>
						Cancel
					</button>
					<button type="submit" class="primary-btn">
						Save Changes
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
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

	.primary-btn {
		padding: 10px 20px;
		background: var(--accent-primary);
		border: none;
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.primary-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.primary-btn:active {
		transform: translateY(0);
	}

	/* Emoji selector */
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
</style>
