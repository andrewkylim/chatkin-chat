<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';
	import { notificationCounts } from '$lib/stores/notifications';
	import MobileUserMenu from './MobileUserMenu.svelte';
	import FileUpload from './FileUpload.svelte';
	import { logger } from '$lib/utils/logger';

	interface AIQuestion {
		question: string;
		options: string[];
	}

	interface Operation {
		operation: 'create' | 'update' | 'delete';
		type: 'task' | 'note' | 'project';
		data: Record<string, unknown>;
		reason?: string;
	}

	interface Message {
		role: 'user' | 'ai';
		content: string;
		isTyping?: boolean;
		questions?: AIQuestion[];
		operations?: Operation[];
		awaitingResponse?: boolean;
		userResponse?: Record<string, string>;
		selectedOperations?: Operation[];
		proposedActions?: Array<{ type: string; title?: string; name?: string; [key: string]: unknown }>;
		awaitingConfirmation?: boolean;
		files?: Array<{ name: string; url: string; type: string }>;
	}

	let {
		messages = [],
		inputMessage = $bindable(''),
		uploadedFiles = $bindable([]),
		isStreaming = false,
		messagesReady = false,
		onSubmit,
		onQuestionSubmit,
		onQuestionCancel,
		onOperationConfirm,
		onOperationCancel,
		title = 'Chat',
		subtitle = null,
		backUrl = null
	}: {
		messages: Message[];
		inputMessage: string;
		uploadedFiles: Array<{ name: string; url: string; type: string; size: number; temporary?: boolean }>;
		isStreaming: boolean;
		messagesReady: boolean;
		onSubmit: () => void;
		onQuestionSubmit?: (messageIndex: number, answers: Record<string, string>) => void;
		onQuestionCancel?: (messageIndex: number) => void;
		onOperationConfirm?: (messageIndex: number) => void;
		onOperationCancel?: (messageIndex: number) => void;
		title?: string;
		subtitle?: string | null;
		backUrl?: string | null;
	} = $props();

	let messagesContainer: HTMLDivElement;
	const currentPath = $derived($page.url.pathname);

	export function scrollToBottom() {
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	// Auto-scroll when messages change (after ready)
	$effect(() => {
		if (messages.length > 0 && messagesReady) {
			tick().then(() => scrollToBottom());
		}
	});

	// Scroll to bottom on mount
	onMount(() => {
		if (messagesReady) {
			scrollToBottom();
		}
	});
</script>

<!-- Full-screen flex container following DESIGN-SPEC pattern -->
<div class="mobile-chat-layout">
	<!-- Header: flex-shrink: 0 (NOT position: fixed) -->
	<header class="chat-header">
		<div class="header-left">
			{#if backUrl}
				<a href={backUrl} class="back-btn" title="Back">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 5L7 10l5 5"/>
					</svg>
				</a>
			{:else}
				<button class="logo-button">
					<img src="/logo.webp" alt="Chatkin" class="chat-logo" />
				</button>
			{/if}
			<div class="header-title-group">
				<h1>{title}</h1>
				{#if subtitle}
					<span class="header-subtitle">{subtitle}</span>
				{/if}
			</div>
		</div>
		<MobileUserMenu />
	</header>

	<!-- Messages: flex: 1, overflow-y: auto -->
	<div class="messages-area" bind:this={messagesContainer}>
		{#if !messagesReady}
			<div class="loading-content">
				<div class="spinner"></div>
				<p>Loading conversation...</p>
			</div>
		{:else}
			{#each messages as message, index (index)}
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

							{#if message.files && message.files.length > 0}
								<!-- Inline files display -->
								<div class="message-files">
									{#each message.files as file}
										{#if file.type.startsWith('image/')}
											<!-- Inline image -->
											<div class="message-image">
												<img src={file.url} alt={file.name} />
											</div>
										{:else}
											<!-- File attachment chip -->
											<div class="message-file-chip">
												<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
													<path d="M6 2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
													<path d="M14 2v6h6"/>
												</svg>
												<span>{file.name}</span>
											</div>
										{/if}
									{/each}
								</div>
							{/if}

							{#if message.questions && message.awaitingResponse}
								<!-- Inline Questions Form -->
								<div class="inline-questions">
									{#each message.questions as question, qIndex}
										{@const questionId = `q${index}_${qIndex}`}
										<div class="question-block">
											<label class="question-label">{question.question}</label>
											<div class="question-options">
												{#each question.options.filter(opt => opt.toLowerCase() !== 'other') as option, optIndex}
													<label class="option-label">
														<input
															type="radio"
															name={questionId}
															value={option}
															id={`${questionId}_${optIndex}`}
														/>
														<span>{option}</span>
													</label>
												{/each}
												<label class="option-label other-option">
													<input
														type="radio"
														name={questionId}
														value="__other__"
														id={`${questionId}_other`}
													/>
													<span>Other:</span>
													<input
														type="text"
														class="other-input"
														placeholder="Enter your answer"
														id={`${questionId}_other_text`}
														onfocus={(e) => {
															const radio = e.currentTarget.parentElement?.querySelector('input[type="radio"]') as HTMLInputElement;
															if (radio) radio.checked = true;
														}}
														onclick={(e) => {
															const radio = e.currentTarget.parentElement?.querySelector('input[type="radio"]') as HTMLInputElement;
															if (radio) radio.checked = true;
														}}
													/>
												</label>
											</div>
										</div>
									{/each}
								</div>

								<!-- Submit/Cancel Buttons -->
								<div class="confirmation-buttons">
									<button class="confirm-btn" type="button" onclick={() => {
										if (!onQuestionSubmit) return;
										const answers = {};
										message.questions.forEach((q, qIdx) => {
											const questionId = `q${index}_${qIdx}`;
											const selected = document.querySelector(`input[name="${questionId}"]:checked`) as HTMLInputElement;
											if (selected) {
												if (selected.value === '__other__') {
													const otherInput = document.getElementById(`${questionId}_other_text`) as HTMLInputElement;
													answers[q.question] = otherInput?.value || '';
												} else {
													answers[q.question] = selected.value;
												}
											}
										});
										if (Object.keys(answers).length === 0) {
											alert('Please select an answer for each question');
											return;
										}
										onQuestionSubmit(index, answers);
									}}>Submit</button>
									<button class="cancel-btn" type="button" onclick={() => {
										if (onQuestionCancel) onQuestionCancel(index);
									}}>Cancel</button>
								</div>
							{/if}

							{#if message.operations && message.awaitingResponse}
								<!-- Inline Operations Preview -->
								<div class="inline-operations">
									{#each message.operations as operation, _opIndex}
										<div class="operation-item {operation.operation}">
											<input
												type="checkbox"
												checked={true}
												disabled
											/>
											<div class="operation-content">
												<div class="operation-header">
													{#if operation.operation === 'create'}
														<span class="operation-icon create">✓</span>
														<strong>Create {operation.type}</strong>
													{:else if operation.operation === 'update'}
														<span class="operation-icon update">✎</span>
														<strong>Update {operation.type}</strong>
													{:else if operation.operation === 'delete'}
														<span class="operation-icon delete">✕</span>
														<strong>Delete {operation.type}</strong>
													{/if}
												</div>
												{#if operation.data.title}
													<div class="operation-title">{operation.data.title}</div>
												{/if}
												{#if operation.data.description}
													<div class="operation-desc">{operation.data.description}</div>
												{/if}
												{#if operation.reason}
													<div class="operation-reason">{operation.reason}</div>
												{/if}
											</div>
										</div>
									{/each}
								</div>

								<!-- Confirmation Buttons -->
								<div class="confirmation-buttons">
									<button class="confirm-btn" type="button" onclick={() => {
										if (onOperationConfirm) onOperationConfirm(index);
									}}>
										Confirm
									</button>
									<button class="cancel-btn" type="button" onclick={() => {
										if (onOperationCancel) onOperationCancel(index);
									}}>
										Cancel
									</button>
								</div>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Input Bar: flex-shrink: 0 (NOT position: fixed) -->
	<form class="input-bar" onsubmit={(e) => { e.preventDefault(); onSubmit(); }}>
		{#if uploadedFiles.length > 0}
			<div class="uploaded-files-preview">
				{#each uploadedFiles as file, index}
					{#if file.type.startsWith('image/')}
						<!-- Compact image preview for images -->
						<div class="image-preview-compact">
							<img src={file.url} alt={file.name} class="preview-thumbnail" />
							<div class="preview-info">
								<span class="preview-name">{file.name}</span>
								<span class="preview-size">{(file.size / 1024).toFixed(1)} KB</span>
							</div>
							<button
								type="button"
								class="action-icon-btn remove"
								onclick={() => {
									uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
								}}
								aria-label="Remove file"
							>
								<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M15 5L5 15M5 5l10 10"/>
								</svg>
							</button>
						</div>
					{:else}
						<!-- File chip for documents -->
						<div class="file-chip">
							<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M6 2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
								<path d="M14 2v6h6"/>
							</svg>
							<span class="file-name">{file.name}</span>
							<button
								type="button"
								class="remove-file-btn"
								onclick={() => {
									uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
								}}
								aria-label="Remove file"
							>
								<svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M15 5L5 15M5 5l10 10"/>
								</svg>
							</button>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
		<FileUpload
			accept="image/*,application/pdf,.doc,.docx,.txt"
			maxSizeMB={10}
			onUploadComplete={(file) => {
				uploadedFiles = [...uploadedFiles, {
					name: file.originalName,
					url: file.url,
					type: file.type,
					size: file.size,
					temporary: file.temporary
				}];
			}}
		/>
			}}
		/>
		<input
			type="text"
			bind:value={inputMessage}
			placeholder="Ask me anything..."
			class="message-input"
			disabled={isStreaming}
		/>
		<button type="submit" class="send-btn" disabled={isStreaming || !inputMessage.trim()} aria-label="Send message">
			<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M5 15L15 5"/>
				<path d="M9 5h6v6"/>
			</svg>
		</button>
	</form>

	<!-- Bottom Navigation: flex-shrink: 0 (NOT position: fixed) -->
	<nav class="bottom-nav">
		<a href="/chat" class="nav-item" class:active={currentPath === '/chat'}>
			<span>Chat</span>
		</a>

		<a href="/projects" class="nav-item" class:active={currentPath.startsWith('/projects')}>
			<span>Projects</span>
			{#if $notificationCounts.projects > 0}
				<span class="notification-dot"></span>
			{/if}
		</a>

		<a href="/tasks" class="nav-item" class:active={currentPath === '/tasks'}>
			<span>Tasks</span>
			{#if $notificationCounts.tasks > 0}
				<span class="notification-dot"></span>
			{/if}
		</a>

		<a href="/notes" class="nav-item" class:active={currentPath === '/notes'}>
			<span>Notes</span>
			{#if $notificationCounts.notes > 0}
				<span class="notification-dot"></span>
			{/if}
		</a>
	</nav>
</div>

<style>
	/* Full-screen container - DESIGN-SPEC WhatsApp pattern */
	.mobile-chat-layout {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
		overflow: hidden;
		overscroll-behavior: none; /* Prevent elastic scroll at container level */
	}

	/* Header Section - flex-shrink: 0 (DESIGN-SPEC pattern) */
	.chat-header {
		flex-shrink: 0;
		padding: 16px 20px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
		height: 64px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.logo-button {
		display: flex;
		align-items: center;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.chat-logo {
		width: 62px;
		height: 62px;
		border-radius: var(--radius-sm);
		transition: all 0.15s ease;
	}

	.logo-button:active .chat-logo {
		transform: translateY(4px) scale(0.95);
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

	.back-btn:active {
		transform: scale(0.95);
	}

	.header-title-group {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.chat-header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.header-subtitle {
		font-size: 0.875rem;
		font-weight: 400;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Messages Area - flex: 1 (DESIGN-SPEC pattern) */
	.messages-area {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		/* GPU acceleration */
		transform: translate3d(0, 0, 0);
		-webkit-transform: translate3d(0, 0, 0);
		/* Touch optimization */
		touch-action: pan-y;
		overscroll-behavior: contain; /* Contain scroll to this element */
	}

	/* Loading Spinner */
	.loading-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		flex: 1;
	}

	.loading-content p {
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

	/* Message Styles */
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


	/* Wider bubble for inline questions */
	.message.ai .message-bubble:has(.inline-questions) {
		max-width: 95%;
	}

	/* Message Files Display */
	.message-files {
		margin-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.message-image {
		max-width: 100%;
		border-radius: var(--radius-md);
		overflow: hidden;
		border: 1px solid var(--border-color);
	}

	.message-image img {
		width: 100%;
		height: auto;
		display: block;
	}

	.message-file-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		color: var(--text-primary);
		width: fit-content;
	}

	.message-file-chip svg {
		flex-shrink: 0;
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

	/* Input Bar - flex-shrink: 0 (DESIGN-SPEC pattern) */
	.input-bar {
		flex-shrink: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		min-height: 60px;
		box-sizing: border-box;
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
		/* Touch optimization */
		touch-action: manipulation;
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

	/* Uploaded Files Preview */
	.uploaded-files-preview {
		width: 100%;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		order: -1;
	}

	/* Compact Image Preview */
	.image-preview-compact {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		width: 100%;
		max-width: 100%;
	}

	.preview-thumbnail {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		border-radius: var(--radius-sm);
		object-fit: cover;
		background: var(--bg-secondary);
	}

	.preview-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.preview-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-size {
		font-size: 0.6875rem;
		color: var(--text-secondary);
	}

	.action-icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		padding: 0;
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-icon-btn:active {
		background: var(--bg-secondary);
		color: var(--accent-primary);
		border-color: var(--accent-primary);
	}

	.action-icon-btn.remove:active {
		color: var(--danger);
		border-color: var(--danger);
	}

	.file-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.file-chip .file-name {
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.remove-file-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		padding: 0;
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.remove-file-btn:active {
		color: var(--danger);
	}

	/* Bottom Navigation - flex-shrink: 0 (DESIGN-SPEC pattern) */
	.bottom-nav {
		flex-shrink: 0;
		display: flex;
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		height: calc(50px + env(safe-area-inset-bottom));
		padding-bottom: env(safe-area-inset-bottom);
	}

	.nav-item {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		color: var(--text-secondary);
		transition: all 0.2s ease;
		position: relative;
		/* Faster tap response */
		touch-action: manipulation;
	}

	.nav-item:active {
		transform: scale(0.95);
	}

	.nav-item.active {
		color: var(--accent-primary);
	}

	.nav-item.active::after {
		content: '';
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 50%;
		height: 3px;
		background: var(--accent-primary);
		border-radius: 0 0 3px 3px;
	}

	.nav-item > span:first-child {
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.notification-dot {
		width: 8px;
		height: 8px;
		background: var(--accent-primary);
		border-radius: 50%;
		margin-left: 6px;
		flex-shrink: 0;
	}

	/* Hide on desktop */
	@media (min-width: 1024px) {
		.mobile-chat-layout {
			display: none;
		}
	}

	/* Inline Questions Styles */
	.inline-questions {
		margin-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.question-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.question-label {
		font-weight: 600;
		color: var(--text-primary);
		font-size: 0.9375rem;
	}

	.question-options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.option-label {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 8px;
		padding: 10px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.option-label:hover {
		background: var(--bg-secondary);
		border-color: var(--accent-primary);
	}

	.option-label input[type="radio"] {
		flex-shrink: 0;
		width: auto;
		margin: 0;
		cursor: pointer;
	}

	.option-label span {
		flex: 1;
	}

	.other-option {
		align-items: center;
	}

	.other-option span {
		flex: 0 0 auto;
	}

	.other-input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		width: auto;
	}

	.confirmation-buttons {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}

	.confirm-btn, .cancel-btn {
		flex: 1;
		padding: 10px 16px;
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
	}

	.confirm-btn {
		background: var(--accent-primary);
		color: white;
	}

	.confirm-btn:hover {
		background: var(--accent-hover);
	}

	.cancel-btn {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.cancel-btn:hover {
		background: var(--bg-secondary);
	}

	/* Inline Operations Styles */
	.inline-operations {
		margin-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.operation-item {
		display: flex;
		gap: 12px;
		padding: 12px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		align-items: flex-start;
	}

	.operation-item input[type="checkbox"] {
		margin-top: 2px;
		flex-shrink: 0;
		width: auto;
	}

	.operation-content {
		flex: 1;
		min-width: 0;
		overflow-wrap: break-word;
		word-break: break-word;
	}

	.operation-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
	}

	.operation-icon {
		font-size: 1rem;
		line-height: 1;
	}

	.operation-icon.create {
		color: var(--accent-success);
	}

	.operation-icon.update {
		color: var(--accent-primary);
	}

	.operation-icon.delete {
		color: var(--danger);
	}

	.operation-title {
		font-weight: 500;
		color: var(--text-primary);
		margin-top: 4px;
	}

	.operation-desc {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin-top: 4px;
	}

	.operation-reason {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-top: 4px;
		font-style: italic;
	}

	/* Responsive fixes for mobile */
	@media (max-width: 768px) {
		/* Wider AI bubbles on mobile */
		.message.ai .message-bubble {
			max-width: 95%;
		}

		/* Wider bubbles for inline content on mobile */
		.message.ai .message-bubble:has(.inline-questions) {
			max-width: 100%;
		}
	}
</style>
