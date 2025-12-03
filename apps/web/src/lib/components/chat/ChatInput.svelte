<script lang="ts">
	import FileUpload from '$lib/components/FileUpload.svelte';
	import VoiceInput from '$lib/components/VoiceInput.svelte';

	export let inputMessage: string;
	export let isStreaming: boolean;
	export let uploadedFiles: Array<{
		name: string;
		url: string;
		type: string;
		size: number;
		temporary?: boolean;
		addedToLibrary?: boolean;
		saving?: boolean;
	}>;
	export let conversationId: string | null;
	export let session: any;
	export let talkModeActive: boolean;
	export let aiMode: 'chat' | 'action' = 'chat';
	export let uploadStatus: string = '';
	export let onSendMessage: () => void;
	export let onVoiceTranscript: (transcript: string) => void;
	export let onFileUpload: (file: any) => void;
	export let onRemoveFile: (index: number) => void;
	export let onSaveFileToLibrary: (file: any, index: number) => Promise<void>;
	export let onToggleMode: () => void;
	export let onResetActivityTimer: () => void;
	export let onStartAutoListen: () => void;
	export let onListeningChange: ((listening: boolean) => void) | undefined = undefined;
	export let voiceInputRef: any;

	function handleSubmit(e: Event) {
		e.preventDefault();
		onSendMessage();
	}

	async function handleAutoSend(transcript: string) {
		// Set flag BEFORE sending message so TTS knows to auto-listen
		if (talkModeActive) {
			onStartAutoListen();
		}
		inputMessage = transcript;
		onSendMessage();
		onResetActivityTimer();
	}
</script>

<form class="input-container" onsubmit={handleSubmit}>
	<!-- Character counter -->
	{#if inputMessage.length > 8000}
		<div class="char-counter-container">
			<div class="char-counter" class:warning={inputMessage.length > 9500}>
				{inputMessage.length} / 10,000 characters
			</div>
		</div>
	{/if}

	{#if uploadedFiles.length > 0}
		<div class="uploaded-files-preview">
			{#each uploadedFiles as file, index}
				{#if file && file.type && file.type.startsWith('image/')}
					<!-- Compact image preview for images -->
					<div class="image-preview-compact">
						<img src={file.url} alt={file.name} class="preview-thumbnail" />
						<div class="preview-info">
							<span class="preview-name">{file.name}</span>
							<span class="preview-size">{(file.size / 1024).toFixed(1)} KB</span>
						</div>
						<div class="preview-actions-compact">
							{#if file.temporary || file.addedToLibrary}
								<button
									type="button"
									class="add-to-library-btn"
									class:added={file.addedToLibrary}
									class:saving={file.saving}
									disabled={file.addedToLibrary || file.saving}
									onclick={async () => {
										await onSaveFileToLibrary(file, index);
									}}
								>
									{#if file.saving}
										<span class="spinner-small"></span>
										Saving...
									{:else if file.addedToLibrary}
										Added
									{:else}
										Add to library
									{/if}
								</button>
							{/if}
							<button
								type="button"
								class="remove-preview-btn"
								onclick={() => onRemoveFile(index)}
								aria-label="Remove file"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 20 20"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M15 5L5 15M5 5l10 10" />
								</svg>
							</button>
						</div>
					</div>
				{:else}
					<!-- File chip for non-images -->
					<div class="file-chip">
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
						<span class="file-name">{file.name}</span>
						{#if file.temporary}
							<button
								type="button"
								class="save-chip-btn"
								onclick={async () => {
									await onSaveFileToLibrary(file, index);
								}}
								title="Save to library"
							>
								<svg
									width="12"
									height="12"
									viewBox="0 0 20 20"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M5 3v16l7-5 7 5V3a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z" />
								</svg>
							</button>
						{/if}
						<button
							type="button"
							class="remove-file-btn"
							onclick={() => onRemoveFile(index)}
							aria-label="Remove file"
						>
							<svg
								width="12"
								height="12"
								viewBox="0 0 20 20"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M15 5L5 15M5 5l10 10" />
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
		permanent={false}
		{conversationId}
		{session}
		bind:uploadStatus
		onUploadComplete={(file) => {
			onFileUpload({
				name: file.originalName,
				url: file.url,
				type: file.type,
				size: file.size,
				temporary: file.temporary
			});
		}}
	/>

	<div class="input-wrapper">
		<button
			type="button"
			class="mode-toggle-btn {aiMode}"
			onclick={onToggleMode}
			aria-label={aiMode === 'chat'
				? 'Switch to Action Mode'
				: 'Switch to Chat Mode'}
			title={aiMode === 'chat'
				? 'Chat Mode (Read-only) - Click to switch to Action Mode'
				: 'Action Mode (Full Access) - Click to switch to Chat Mode'}
		>
			{#if aiMode === 'chat'}
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
				</svg>
			{:else}
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
				</svg>
			{/if}
		</button>
		<input
			type="text"
			bind:value={inputMessage}
			maxlength="10000"
			placeholder={uploadStatus || 'Ask me anything...'}
			class="message-input"
			disabled={isStreaming}
		/>
		<VoiceInput
			bind:this={voiceInputRef}
			autoSendEnabled={talkModeActive}
			{talkModeActive}
			onTranscriptUpdate={(transcript) => {
				onVoiceTranscript(transcript);
				onResetActivityTimer();
			}}
			onTranscriptComplete={(transcript) => {
				onVoiceTranscript(transcript);
				onResetActivityTimer();
			}}
			onAutoSend={handleAutoSend}
			onRecordingChange={onListeningChange}
		/>
	</div>
	<button
		type="submit"
		class="send-btn"
		disabled={isStreaming || !inputMessage.trim()}
	>
		<svg
			width="20"
			height="20"
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M5 15L15 5" />
			<path d="M9 5h6v6" />
		</svg>
	</button>
</form>

<style>
	.input-container {
		position: relative;
		flex-shrink: 0;
		padding: 16px;
		padding-bottom: max(16px, env(safe-area-inset-bottom));
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		height: 76px;
		min-height: 76px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		box-sizing: border-box;
		transform: translate3d(0, 0, 0);
		-webkit-transform: translate3d(0, 0, 0);
	}

	.char-counter-container {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 16px;
		right: 16px;
		z-index: 10;
	}

	.char-counter {
		display: inline-block;
		font-size: 0.75rem;
		color: var(--text-secondary);
		background: var(--bg-secondary);
		padding: 4px 10px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	}

	.char-counter.warning {
		color: #ef4444;
		background: #fef2f2;
	}

	.uploaded-files-preview {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 16px;
		right: 16px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 12px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
		z-index: 10;
	}

	.image-preview-compact {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		width: 100%;
	}

	.preview-thumbnail {
		width: 48px;
		height: 48px;
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
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-size {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.preview-actions-compact {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.add-to-library-btn {
		padding: 6px 12px;
		background: var(--accent-primary);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.add-to-library-btn:hover:not(:disabled) {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.add-to-library-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.add-to-library-btn.added {
		background: #4caf50;
		cursor: default;
	}

	.add-to-library-btn.saving {
		cursor: wait;
	}

	.add-to-library-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.remove-preview-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.remove-preview-btn:hover {
		background: var(--bg-secondary);
		color: var(--danger);
		border-color: var(--danger);
	}

	.save-chip-btn,
	.remove-file-btn {
		padding: 0.375rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.2s;
		border: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.save-chip-btn:hover {
		background: var(--bg-tertiary);
	}

	.remove-file-btn:hover {
		background: #fee;
		border-color: #ef4444;
	}

	.file-chip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
	}

	.file-name {
		color: var(--text-primary);
	}

	.input-wrapper {
		position: relative;
		flex: 1;
		display: flex;
		align-items: center;
	}

	.mode-toggle-btn {
		position: absolute;
		left: 8px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 0;
		z-index: 5;
	}

	.mode-toggle-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.mode-toggle-btn.action {
		color: var(--accent-primary);
	}

	.mode-toggle-btn.action:hover {
		background: rgba(199, 124, 92, 0.1);
	}

	.mode-toggle-btn svg {
		flex-shrink: 0;
	}

	.message-input {
		flex: 1;
		width: 100%;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 12px 48px 12px 48px;
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

	.input-wrapper :global(.voice-input) {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
	}

	.input-wrapper :global(.mic-btn) {
		width: 32px;
		height: 32px;
		background: transparent;
		border: none;
		padding: 0;
	}

	.message-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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

	.send-btn:hover:not(:disabled) {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.send-btn:active {
		transform: translateY(0);
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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

	@media (max-width: 1024px) {
		.input-container {
			padding: 0.75rem 1rem;
		}
	}
</style>
