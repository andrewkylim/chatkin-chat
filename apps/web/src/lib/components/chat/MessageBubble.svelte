<script lang="ts">
	import OperationsReview from './OperationsReview.svelte';
	import QuestionsForm from './QuestionsForm.svelte';
	import type { Operation, AIQuestion } from '$lib/types/chat';

	interface Message {
		id?: string;
		role: 'user' | 'ai';
		content: string;
		files?: Array<{
			name: string;
			url: string;
			type: string;
			size: number;
			temporary?: boolean;
			saving?: boolean;
			saved?: boolean;
		}>;
		isTyping?: boolean;
		operations?: Operation[];
		questions?: AIQuestion[];
		awaitingResponse?: boolean;
		selectedOperations?: Operation[];
		userResponse?: Record<string, string>;
	}

	export let message: Message;
	export let index: number;
	export let onOperationConfirm: (index: number) => void;
	export let onOperationCancel: (index: number) => void;
	export let onOperationToggle: (index: number, opIndex: number) => void;
	export let onQuestionSubmit: (index: number, answers: Record<string, string>) => void;
	export let onQuestionCancel: (index: number) => void;
	export let onSaveFile: (file: any, fileIndex: number) => Promise<void>;
	export let onUpdateMessageFile: (
		messageIndex: number,
		fileIndex: number,
		updates: Record<string, unknown>
	) => void;

	async function handleSaveFile(file: any, fileIndex: number) {
		// Set saving state
		if (message.files && message.files[fileIndex]) {
			onUpdateMessageFile(index, fileIndex, { saving: true });
		}

		try {
			await onSaveFile(file, fileIndex);

			// Update the file to saved state
			if (message.files && message.files[fileIndex]) {
				onUpdateMessageFile(index, fileIndex, {
					saving: false,
					saved: true,
					temporary: false
				});
			}
		} catch (error) {
			console.error('Failed to save file:', error);
			// Reset saving state on error
			if (message.files && message.files[fileIndex]) {
				onUpdateMessageFile(index, fileIndex, { saving: false });
			}
		}
	}
</script>

<div class="message {message.role}">
	{#if message.isTyping}
		<div class="typing-indicator">
			<div class="color-circle"></div>
		</div>
	{:else}
		<div class="message-bubble">
			<p>{message.content}</p>

			{#if message.files && message.files.length > 0}
				<!-- Inline files display -->
				<div class="message-files">
					{#each message.files as file, fileIndex}
						{#if file && file.type && file.type.startsWith('image/')}
							<!-- Inline image -->
							<div class="message-image">
								<img src={file.url} alt={file.name} />
								{#if file.temporary || file.saved}
									<button
										type="button"
										class="message-save-btn"
										class:saving={file.saving}
										class:saved={file.saved}
										disabled={file.saving || file.saved}
										onclick={async () => {
											await handleSaveFile(file, fileIndex);
										}}
										title="Save to library"
									>
										{#if file.saving}
											<span class="spinner-small"></span>
											Saving...
										{:else if file.saved}
											✓ Saved!
										{:else}
											Save
										{/if}
									</button>
								{/if}
							</div>
						{:else}
							<!-- File attachment chip -->
							<div class="message-file-chip">
								<svg
									width="14"
									height="14"
									viewBox="0 0 20 20"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M6 2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
									<path d="M14 2v6h6" />
								</svg>
								<span>{file.name}</span>
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			{#if message.operations && message.awaitingResponse && message.selectedOperations}
				<!-- Inline Operations Preview -->
				<OperationsReview
					operations={message.operations}
					selectedOperations={message.selectedOperations}
					onToggle={(opIndex) => onOperationToggle(index, opIndex)}
					onConfirm={() => onOperationConfirm(index)}
					onCancel={() => onOperationCancel(index)}
				/>
			{/if}

			{#if message.questions && message.awaitingResponse}
				<!-- Inline Questions Form -->
				<QuestionsForm
					questions={message.questions}
					messageIndex={index}
					onSubmit={(answers) => onQuestionSubmit(index, answers)}
					onCancel={() => onQuestionCancel(index)}
				/>
			{/if}

			{#if message.userResponse}
				<!-- Show user's responses after submission -->
				<div class="user-responses">
					{#each Object.entries(message.userResponse) as [question, answer]}
						<div class="response-item">
							<strong>{question}</strong>
							<span>→ {answer}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.message {
		display: flex;
		margin-bottom: 1rem;
		animation: fadeIn 0.3s ease-in-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
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

	.message.user .message-bubble {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		text-align: left;
		color: var(--text-primary);
	}

	.message.ai .message-bubble {
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		text-align: left;
		max-width: 95%;
		color: var(--text-primary);
	}

	.message-bubble p {
		margin: 0;
		line-height: 1.5;
		color: inherit;
	}

	.typing-indicator {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		padding: 0;
	}

	.color-circle {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		animation: colorCycle 3s linear infinite;
	}

	@keyframes colorCycle {
		0% {
			background-color: #10B981; /* Body - green */
		}
		16.66% {
			background-color: #3B82F6; /* Mind - blue */
		}
		33.33% {
			background-color: #8B5CF6; /* Purpose - purple */
		}
		50% {
			background-color: #F59E0B; /* Connection - orange */
		}
		66.66% {
			background-color: #EAB308; /* Growth - yellow */
		}
		83.33% {
			background-color: #EF4444; /* Finance - red */
		}
		100% {
			background-color: #10B981; /* Back to Body */
		}
	}

	.message-files {
		margin-top: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.message-image {
		position: relative;
		max-width: 20rem;
	}

	.message-image img {
		width: 100%;
		border-radius: var(--radius-md);
		display: block;
	}

	.message-save-btn {
		position: absolute;
		bottom: 8px;
		right: 8px;
		padding: 6px 12px;
		background: rgba(199, 124, 92, 0.6);
		backdrop-filter: blur(8px);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.6875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		white-space: nowrap;
	}

	.message-save-btn:hover:not(:disabled) {
		background: rgba(199, 124, 92, 0.85);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.message-save-btn.saving {
		cursor: wait;
		background: rgba(199, 124, 92, 0.6);
	}

	.message-save-btn.saved {
		background: rgba(76, 175, 80, 0.85);
		cursor: default;
	}

	.message-save-btn.saved:hover {
		background: rgba(76, 175, 80, 0.85);
		transform: none;
	}

	.message-save-btn:disabled {
		cursor: not-allowed;
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

	.user-responses {
		margin-top: 0.75rem;
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
	}

	.message.ai .user-responses {
		background: var(--bg-tertiary);
	}

	.response-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}

	.response-item:last-child {
		margin-bottom: 0;
	}

	.response-item strong {
		font-weight: 500;
	}

	.spinner-small {
		display: inline-block;
		width: 0.75rem;
		height: 0.75rem;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 768px) {
		.message-bubble {
			max-width: 85%;
		}
	}
</style>
