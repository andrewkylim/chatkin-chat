<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import { page } from '$app/stores';

	$: projectId = $page.params.id;

	// Mock project data - will be replaced with real data later
	const projectData: Record<string, { name: string; emoji: string; description: string }> = {
		'1': { name: 'Wedding Planning', emoji: '🎉', description: 'Planning our June 2026 wedding' },
		'2': { name: 'House Renovation', emoji: '🏠', description: 'Kitchen and bathroom remodeling' },
		'3': { name: 'Product Launch', emoji: '💼', description: 'Q2 2026 product launch planning' }
	};

	$: project = projectData[projectId] || { name: 'Project', emoji: '📁', description: 'Loading...' };
</script>

<AppLayout>
<div class="project-chat-page">
	<header class="chat-header">
		<div class="header-content">
			<a href="/projects" class="back-btn">
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 4l-8 8 8 8"/>
				</svg>
			</a>
			<div class="project-info">
				<div class="project-icon">{project.emoji}</div>
				<div>
					<h1>{project.name}</h1>
					<p class="project-subtitle">{project.description}</p>
				</div>
			</div>
			<div class="header-actions">
				<button class="icon-btn" title="Project details">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="10" cy="10" r="1"/>
						<circle cx="10" cy="5" r="1"/>
						<circle cx="10" cy="15" r="1"/>
					</svg>
				</button>
			</div>
		</div>
	</header>

	<div class="messages">
		<div class="message ai">
			<div class="message-bubble">
				<p>Hi! I'm here to help you with {project.name}. What would you like to work on?</p>
			</div>
		</div>
	</div>

	<form class="input-container">
		<input
			type="text"
			placeholder="Ask about this project..."
			class="message-input"
		/>
		<button type="submit" class="send-btn">
			<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
				<path d="M2 3l16 7-16 7V3zm0 8.5V14l8-4-8-4v5.5z"/>
			</svg>
		</button>
	</form>
</div>
</AppLayout>

<style>
	/* Critical mobile chat UI pattern - ONLY for chat pages */
	.project-chat-page {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--bg-primary);
	}

	/* Header */
	.chat-header {
		flex-shrink: 0;
		padding: 16px 20px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.back-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
		text-decoration: none;
	}

	.back-btn:hover {
		background: var(--bg-primary);
		transform: translateX(-2px);
	}

	.project-info {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.project-icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		background: var(--bg-tertiary);
		border-radius: var(--radius-md);
		flex-shrink: 0;
	}

	.project-info h1 {
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin-bottom: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.project-subtitle {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.icon-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.icon-btn:hover {
		background: var(--bg-primary);
		transform: translateY(-1px);
	}

	.icon-btn:active {
		transform: translateY(0);
	}

	/* Messages */
	.messages {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.message {
		display: flex;
	}

	.message.user {
		justify-content: flex-end;
	}

	.message.ai {
		justify-content: flex-start;
	}

	.message-bubble {
		max-width: 85%;
		padding: 12px 16px;
		border-radius: 12px;
		font-size: 0.9375rem;
		line-height: 1.5;
	}

	.message-bubble p {
		margin: 0;
	}

	.message.user .message-bubble {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		text-align: left;
	}

	.message.ai .message-bubble {
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		text-align: left;
		max-width: 95%;
	}

	/* Input Container */
	.input-container {
		flex-shrink: 0;
		padding: 16px;
		padding-bottom: max(16px, env(safe-area-inset-bottom));
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		display: flex;
		gap: 12px;
	}

	.message-input {
		flex: 1;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 12px 16px;
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
	}

	.message-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	.send-btn {
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

	.send-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.send-btn:active {
		transform: translateY(0);
	}

	/* Mobile adjustments */
	@media (max-width: 640px) {
		.project-subtitle {
			display: none;
		}

		.project-info h1 {
			font-size: 1.125rem;
		}
	}
</style>
