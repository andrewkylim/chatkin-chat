<script lang="ts">
	export let pageTitle: string;
	export let pageIcon: string | undefined = undefined;
	export let pageSubtitle: string | undefined = undefined;
	export let isEmbedded: boolean = false;
	export let talkModeActive: boolean = false;
	export let isPlayingAudio: boolean = false;
	export let onToggleTalkMode: () => void;
</script>

<header class="chat-header">
	<div class="header-content">
		{#if pageIcon && pageSubtitle}
			<!-- Embedded mode: icon + title + subtitle -->
			<div class="chat-title">
				<img src={pageIcon} alt={pageTitle} class="ai-icon" />
				<div>
					<h2>{pageTitle}</h2>
					<p class="ai-subtitle">{pageSubtitle}</p>
				</div>
			</div>
		{:else}
			<!-- Standalone mode: just title -->
			<h1>{pageTitle}</h1>
		{/if}
		<!-- Talk Mode Toggle -->
		<div class="header-actions">
			<button
				class="talk-mode-btn {talkModeActive ? 'active' : ''} {isEmbedded ? 'icon-only' : ''}"
				title={talkModeActive ? 'Turn off Talk Mode' : 'Turn on Talk Mode'}
				onclick={onToggleTalkMode}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
					<line x1="4" y1="14" x2="4" y2="10"/>
					<line x1="8" y1="16" x2="8" y2="8"/>
					<line x1="12" y1="18" x2="12" y2="6"/>
					<line x1="16" y1="16" x2="16" y2="8"/>
					<line x1="20" y1="14" x2="20" y2="10"/>
				</svg>
				{#if !isEmbedded}
					<span class="talk-mode-label">Talk</span>
				{/if}
			</button>
		</div>
	</div>
</header>

<style>
	.chat-header {
		flex-shrink: 0;
		padding: 16px 20px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
		height: 64px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
	}

	.header-content {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.chat-title {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.ai-icon {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0;
	}

	h2 {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 2px 0;
	}

	.ai-subtitle {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.talk-mode-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: var(--bg-tertiary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.talk-mode-btn:hover {
		background: var(--bg-primary);
		transform: translateY(-1px);
		border-color: var(--accent-primary);
	}

	.talk-mode-btn:active {
		transform: translateY(0);
	}

	.talk-mode-btn.active {
		background: var(--accent-primary);
		border-color: var(--accent-primary);
		color: white;
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.2);
	}

	.talk-mode-btn.active:hover {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
	}

	.talk-mode-btn.icon-only {
		padding: 8px;
		min-width: auto;
	}

	.talk-mode-label {
		white-space: nowrap;
	}
</style>
