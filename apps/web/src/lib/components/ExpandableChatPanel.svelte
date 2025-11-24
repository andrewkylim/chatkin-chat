<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { browser } from '$app/environment';

	interface Message {
		role: 'user' | 'ai';
		content: string;
		isTyping?: boolean;
	}

	export let messages: Message[] = [];
	export let onSendMessage: (message: string) => void;
	export let placeholder: string = 'Type a message...';
	export let isStreaming: boolean = false;
	export let context: 'global' | 'project' | 'tasks' | 'notes' = 'global';
	export let showFileUpload: boolean = false;
	export let messagesReady: boolean = false;

	let isExpanded = false;
	let inputMessage = '';
	let messagesContainer: HTMLDivElement;

	// LocalStorage key
	const EXPANDED_KEY = `chatkin-chat-expanded-${context}`;

	onMount(() => {
		if (browser) {
			// Load saved state
			const savedExpanded = localStorage.getItem(EXPANDED_KEY);
			if (savedExpanded) {
				isExpanded = savedExpanded === 'true';
			}
		}
	});

	function toggleExpand() {
		isExpanded = !isExpanded;
		if (browser) {
			localStorage.setItem(EXPANDED_KEY, String(isExpanded));
		}
		if (isExpanded) {
			scrollToBottom();
		}
	}

	async function scrollToBottom() {
		// Wait for DOM to update, then scroll immediately (WhatsApp-style)
		await tick();
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	async function handleSubmit() {
		if (!inputMessage.trim() || isStreaming) return;

		const message = inputMessage.trim();
		inputMessage = '';
		onSendMessage(message);

		await scrollToBottom();
	}

	// Auto-scroll when new messages arrive (but only after initial load is complete)
	$: if (messages.length > 0 && isExpanded && messagesReady) {
		scrollToBottom();
	}
</script>

<div class="chat-panel-container">
	<!-- Messages Area (only visible when expanded) -->
	{#if isExpanded}
		{#if !messagesReady}
			<div class="chat-loading-overlay">
				<div class="spinner"></div>
				<p>Loading conversation...</p>
			</div>
		{/if}

		<div class="messages-area" bind:this={messagesContainer} style:opacity={messagesReady ? '1' : '0'}>
			{#each messages as message}
				<div class="message {message.role}">
					<div class="message-bubble">
						{#if message.isTyping}
							<div class="typing-indicator">
								<span></span>
								<span></span>
								<span></span>
							</div>
						{:else}
							<p>{message.content}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Input Bar (always visible) -->
	<form class="input-bar" on:submit|preventDefault={handleSubmit}>
		<button type="button" class="expand-btn" on:click={toggleExpand} title={isExpanded ? 'Minimize chat' : 'Expand chat'}>
			{#if isExpanded}
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M5 8l5 5 5-5"/>
				</svg>
			{:else}
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M5 12l5-5 5 5"/>
				</svg>
			{/if}
		</button>

		<input
			type="text"
			bind:value={inputMessage}
			placeholder={placeholder}
			class="message-input"
			disabled={isStreaming}
			on:focus={() => {
				if (!isExpanded) {
					isExpanded = true;
					if (browser) {
						localStorage.setItem(EXPANDED_KEY, 'true');
					}
				}
			}}
		/>

		<button type="submit" class="send-btn" disabled={isStreaming || !inputMessage.trim()}>
			<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M5 15L15 5"/>
				<path d="M9 5h6v6"/>
			</svg>
		</button>
	</form>
</div>

<style>
	.chat-panel-container {
		position: fixed;
		bottom: 50px; /* Above bottom nav */
		left: 0;
		right: 0;
		z-index: 90;
		display: flex;
		flex-direction: column;
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
	}

	/* Hide on desktop */
	@media (min-width: 1024px) {
		.chat-panel-container {
			display: none;
		}
	}

	/* Messages Area */
	.messages-area {
		height: 50vh;
		max-height: 50vh;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		background: var(--bg-primary);
		animation: slideDown 0.3s ease;
		opacity: 0;
	}

	.chat-loading-overlay {
		height: 50vh;
		max-height: 50vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		background: var(--bg-primary);
	}

	.chat-loading-overlay p {
		color: var(--text-secondary);
		font-size: 0.9375rem;
		margin: 0;
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

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
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
		padding: 10px 14px;
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
	}

	.message.ai .message-bubble {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
	}

	/* Typing Indicator */
	.typing-indicator {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px;
	}

	.typing-indicator span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--text-secondary);
		animation: typing 1.2s ease-in-out infinite;
	}

	.typing-indicator span:nth-child(1) {
		animation-delay: 0s;
	}

	.typing-indicator span:nth-child(2) {
		animation-delay: 0.15s;
	}

	.typing-indicator span:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes typing {
		0%, 80%, 100% {
			transform: scale(1);
			opacity: 0.5;
		}
		40% {
			transform: scale(1.3);
			opacity: 1;
		}
	}

	/* Input Bar */
	.input-bar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		padding-bottom: max(12px, env(safe-area-inset-bottom));
		background: var(--bg-secondary);
		height: 60px;
		box-sizing: border-box;
	}

	.expand-btn {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
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

	.expand-btn:hover {
		background: var(--bg-primary);
		transform: translateY(-1px);
	}

	.expand-btn:active {
		transform: translateY(0);
	}

	.message-input {
		flex: 1;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 10px 14px;
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
		height: 40px;
	}

	.message-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	.message-input:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.send-btn {
		width: 40px;
		height: 40px;
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

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}
</style>
