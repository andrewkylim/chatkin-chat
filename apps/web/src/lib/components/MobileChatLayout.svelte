<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';
	import { notificationCounts } from '$lib/stores/notifications';
	import MobileUserMenu from './MobileUserMenu.svelte';
	import FileUpload from './FileUpload.svelte';
	import VoiceInput from './VoiceInput.svelte';
	import OnboardingMessages from './chat/OnboardingMessages.svelte';
	import QuestionsForm from './chat/QuestionsForm.svelte';
	import EditOperationModal from './chat/EditOperationModal.svelte';

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
		id?: string; // Database message ID for updating metadata
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
		files?: Array<{ name: string; url: string; type: string; size: number; temporary?: boolean; saving?: boolean; saved?: boolean }>;
	}

	let {
		messages = $bindable([]),
		inputMessage = $bindable(''),
		uploadedFiles = $bindable([]),
		isStreaming = false,
		messagesReady = false,
		session = null,
		onSubmit,
		onQuestionSubmit,
		onQuestionCancel,
		onOperationConfirm,
		onOperationCancel,
		onSaveFileToLibrary,
		updateMessageMetadata,
		title = 'Chat',
		subtitle = null,
		backUrl = null,
		talkModeActive = false,
		isPlayingAudio: _isPlayingAudio = false,
		toggleTalkMode = undefined,
		aiMode = 'chat',
		toggleAiMode = undefined,
		onListeningChange = undefined,
		showOnboarding = false,
		onboardingDraftTasksCount = 0,
		handleOnboardingComplete = undefined
	}: {
		messages: Message[];
		inputMessage: string;
		uploadedFiles: Array<{ name: string; url: string; type: string; size: number; temporary?: boolean; addedToLibrary?: boolean; saving?: boolean }>;
		isStreaming: boolean;
		messagesReady: boolean;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		session: any;
		onSubmit: () => void;
		onQuestionSubmit?: (messageIndex: number, answers: Record<string, string>) => void;
		onQuestionCancel?: (messageIndex: number) => void;
		onOperationConfirm?: (messageIndex: number) => void;
		onOperationCancel?: (messageIndex: number) => void;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		onSaveFileToLibrary?: (file: any, index: number) => Promise<void>;
		updateMessageMetadata?: (messageId: string, metadata: Record<string, unknown>) => Promise<void>;
		title?: string;
		subtitle?: string | null;
		backUrl?: string | null;
		talkModeActive?: boolean;
		isPlayingAudio?: boolean;
		toggleTalkMode?: () => Promise<void>;
		aiMode?: 'chat' | 'action';
		toggleAiMode?: () => void;
		onListeningChange?: (listening: boolean) => void;
		showOnboarding?: boolean;
		onboardingDraftTasksCount?: number;
		handleOnboardingComplete?: () => void;
	} = $props();

	let messagesContainer: HTMLDivElement;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let voiceInputRef: any;
	let uploading = $state(false);
	let uploadProgress = $state(0);
	let uploadStatus = $state('');
	const currentPath = $derived($page.url.pathname);

	// Edit operation modal state
	let showEditModal = $state(false);
	let editingOperation: Operation | null = $state(null);
	let editingMessageIndex = $state(-1);
	let editingOperationIndex = $state(-1);
	let modalKey = $state(0); // Key to force modal remount

	// Map current route to section color
	const sectionColorMap: Record<string, string> = {
		'/chat': '#3b82f6',      // Blue
		'/profile': '#8b5cf6',   // Purple
		'/projects': '#14b8a6',  // Teal
		'/tasks': '#ec4899',     // Pink
		'/notes': '#f59e0b',     // Amber
		'/files': '#64748b'      // Slate Gray
	};

	// Domain colors for domain-specific pages
	const _domainColors: Record<string, string> = {
		Body: '#10B981',      // Green
		Mind: '#3B82F6',      // Blue
		Purpose: '#8B5CF6',   // Purple
		Connection: '#F59E0B', // Amber
		Growth: '#EAB308',    // Yellow
		Finance: '#EF4444'    // Red
	};

	const logoColor = $derived.by(() => {
		// Check for exact matches first
		if (sectionColorMap[currentPath]) {
			return sectionColorMap[currentPath];
		}

		// Check for partial matches
		for (const [route, color] of Object.entries(sectionColorMap)) {
			if (currentPath.startsWith(route)) {
				return color;
			}
		}

		// Default to chat blue if no match
		return '#3b82f6';
	});

	export function scrollToBottom() {
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	// Expose voiceInputRef methods
	export const startListening = () => {
		if (voiceInputRef) {
			voiceInputRef.startListening();
		}
	};

	export const stopListening = () => {
		if (voiceInputRef) {
			voiceInputRef.stopListening();
		}
	};

	// Auto-scroll when messages change (after ready)
	$effect(() => {
		if (messages.length > 0 && messagesReady) {
			tick().then(() => scrollToBottom());
		}
	});

	// Scroll to bottom on mount
	onMount(async () => {
		if (messagesReady) {
			scrollToBottom();
		}
	});

	// Toggle operation selection (for checkboxes)
	function toggleOperationSelection(messageIndex: number, opIndex: number) {
		const message = messages[messageIndex];
		if (!message.operations) return;

		// Initialize selectedOperations if it doesn't exist
		if (!message.selectedOperations) {
			message.selectedOperations = [];
		}

		const operation = message.operations[opIndex];
		const isSelected = message.selectedOperations.some(
			(op) =>
				op.operation === operation.operation &&
				op.type === operation.type &&
				JSON.stringify(op.data) === JSON.stringify(operation.data)
		);

		if (isSelected) {
			// Remove from selection
			message.selectedOperations = message.selectedOperations.filter(
				(op) =>
					!(
						op.operation === operation.operation &&
						op.type === operation.type &&
						JSON.stringify(op.data) === JSON.stringify(operation.data)
					)
			);
		} else {
			// Add to selection
			message.selectedOperations = [...message.selectedOperations, operation];
		}

		// Trigger reactivity
		messages = [...messages];
	}

	// Open edit modal for an operation
	function openEditModal(messageIndex: number, opIndex: number) {
		const message = messages[messageIndex];
		if (!message.operations) return;

		// Create a deep copy to avoid modifying the original
		editingOperation = JSON.parse(JSON.stringify(message.operations[opIndex]));
		editingMessageIndex = messageIndex;
		editingOperationIndex = opIndex;
		modalKey++; // Increment key to force remount
		showEditModal = true;
	}

	// Close edit modal
	function closeEditModal() {
		showEditModal = false;
		editingOperation = null;
		editingMessageIndex = -1;
		editingOperationIndex = -1;
	}

	// Save edited operation data
	function saveEditedOperation(newData: Record<string, unknown>) {
		if (editingMessageIndex === -1 || editingOperationIndex === -1) return;

		const message = messages[editingMessageIndex];
		if (!message.operations) return;

		// Update the operation data
		message.operations[editingOperationIndex].data = newData;

		// Also update in selectedOperations if it exists
		if (message.selectedOperations) {
			const selectedIndex = message.selectedOperations.findIndex(
				(op) =>
					op.operation === message.operations![editingOperationIndex].operation &&
					op.type === message.operations![editingOperationIndex].type
			);
			if (selectedIndex !== -1) {
				message.selectedOperations[selectedIndex].data = newData;
			}
		}

		// Trigger reactivity
		messages = [...messages];
	}
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
					<div class="chat-logo" style="background-color: {logoColor}"></div>
				</button>
			{/if}
			<div class="header-title-group">
				<h1>{title}</h1>
				{#if subtitle}
					<span class="header-subtitle">{subtitle}</span>
				{/if}
			</div>
		</div>
		<div class="header-right">
			<!-- Talk Mode Button -->
			{#if toggleTalkMode}
				<button
					class="talk-mode-btn {talkModeActive ? 'active' : ''}"
					title={talkModeActive ? 'Turn off Talk Mode' : 'Turn on Talk Mode'}
					onclick={toggleTalkMode}
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
						<line x1="4" y1="14" x2="4" y2="10"/>
						<line x1="8" y1="16" x2="8" y2="8"/>
						<line x1="12" y1="18" x2="12" y2="6"/>
						<line x1="16" y1="16" x2="16" y2="8"/>
						<line x1="20" y1="14" x2="20" y2="10"/>
					</svg>
				</button>
			{/if}
			<MobileUserMenu />
		</div>
	</header>

	<!-- Messages: flex: 1, overflow-y: auto -->
	<div class="messages-area" bind:this={messagesContainer}>
		{#if !messagesReady}
			<div class="loading-content">
				<div class="spinner"></div>
				<p>Loading conversation...</p>
			</div>
		{:else}
			{#if showOnboarding && handleOnboardingComplete}
				<OnboardingMessages
					draftTasksCount={onboardingDraftTasksCount}
					onComplete={handleOnboardingComplete}
				/>
			{/if}
			{#each messages as message, index (index)}
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
															// Set saving state
															if (message.files && message.files[fileIndex]) {
																message.files[fileIndex] = {
																	...message.files[fileIndex],
																	saving: true
																};
																messages = messages;
															}

															try {
																if (onSaveFileToLibrary) {
																	await onSaveFileToLibrary(file, fileIndex);
																}

																// Update to saved state
																if (message.files && message.files[fileIndex]) {
																	message.files[fileIndex] = {
																		...message.files[fileIndex],
																		saving: false,
																		saved: true,
																		temporary: false
																	};
																	messages = messages;

																	// Persist saved state to database
																	if (message.id && updateMessageMetadata) {
																		const updatedFiles = [...message.files];
																		await updateMessageMetadata(message.id, {
																			files: updatedFiles
																		});
																	}
																}
															} catch (error) {
																console.error('Failed to save file:', error);
																// Reset saving state on error
																if (message.files && message.files[fileIndex]) {
																	message.files[fileIndex] = {
																		...message.files[fileIndex],
																		saving: false
																	};
																	messages = messages;
																}
															}
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
								<QuestionsForm
									questions={message.questions}
									messageIndex={index}
									onSubmit={(answers) => {
										if (onQuestionSubmit) onQuestionSubmit(index, answers);
									}}
									onCancel={() => {
										if (onQuestionCancel) onQuestionCancel(index);
									}}
								/>
							{/if}

							{#if message.operations && message.awaitingResponse}
								<!-- Inline Operations Preview -->
								<div class="inline-operations">
									{#each message.operations as operation, opIndex}
										<div class="operation-item {operation.operation}">
											<input
												type="checkbox"
												checked={message.selectedOperations?.some(
													op => op.operation === operation.operation &&
													op.type === operation.type &&
													JSON.stringify(op.data) === JSON.stringify(operation.data)
												) ?? false}
												onchange={() => toggleOperationSelection(index, opIndex)}
											/>
											<div class="operation-content">
												<div class="operation-header">
													<div class="operation-title-row">
														{#if operation.operation === 'create'}
															<strong>Create {operation.type}</strong>
														{:else if operation.operation === 'update'}
															<strong>Update {operation.type}</strong>
														{:else if operation.operation === 'delete'}
															<strong>Delete {operation.type}</strong>
														{/if}
													</div>
													<button
														class="edit-operation-btn"
														onclick={() => openEditModal(index, opIndex)}
														aria-label="Edit operation"
													>
														<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
															<path d="M11 5L6 10v4h4l5-5M11 5l3-3 4 4-3 3M11 5l4 4"/>
														</svg>
													</button>
												</div>
												{#if operation.data}
													{#if operation.data.title}
														<div class="operation-title">{operation.data.title}</div>
													{/if}
													{#if operation.data.description}
														<div class="operation-desc">{operation.data.description}</div>
													{/if}
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
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<!-- Input Bar: flex-shrink: 0 (NOT position: fixed) -->
	<form class="input-bar" onsubmit={(e) => { e.preventDefault(); onSubmit(); }}>
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
											if (onSaveFileToLibrary) {
												await onSaveFileToLibrary(file, index);
											}
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
			permanent={false}
			{session}
			bind:uploading
			bind:uploadProgress
			bind:uploadStatus
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
		<div class="input-wrapper">
			{#if toggleAiMode}
				<button
					type="button"
					class="mode-toggle-btn {aiMode}"
					onclick={toggleAiMode}
					aria-label={aiMode === 'chat' ? 'Switch to Action Mode' : 'Switch to Chat Mode'}
				>
					{#if aiMode === 'chat'}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
						</svg>
					{:else}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
						</svg>
					{/if}
				</button>
			{/if}
			<input
				type="text"
				bind:value={inputMessage}
				maxlength="10000"
				placeholder={uploading ? uploadStatus : "Ask me anything..."}
				class="message-input"
				disabled={isStreaming || uploading}
			/>
			<VoiceInput
				bind:this={voiceInputRef}
				autoSendEnabled={talkModeActive}
				{talkModeActive}
				onTranscriptUpdate={(transcript) => {
					inputMessage = transcript;
				}}
				onTranscriptComplete={(transcript) => {
					inputMessage = transcript;
				}}
				onAutoSend={async (transcript) => {
					inputMessage = transcript;
					await onSubmit();
				}}
				onRecordingChange={onListeningChange}
			/>
		</div>
		<button type="submit" class="send-btn" disabled={isStreaming || (!inputMessage.trim() && uploadedFiles.length === 0) || uploading} aria-label="Send message">
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

		<a href="/projects" class="nav-item" class:active={currentPath === '/projects'}>
			<span>Projects</span>
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

		<a href="/files" class="nav-item" class:active={currentPath === '/files'}>
			<span>Files</span>
		</a>
	</nav>
</div>

<!-- Edit Operation Modal -->
{#if showEditModal && editingOperation}
	{#key modalKey}
		<EditOperationModal
			show={showEditModal}
			operation={editingOperation}
			onSave={saveEditedOperation}
			onClose={closeEditModal}
		/>
	{/key}
{/if}

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
		flex: 1;
		min-width: 0;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
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
		width: 40px;
		height: 40px;
		border-radius: 50%;
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
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.chat-header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
	}

	.header-subtitle {
		font-size: 0.8125rem;
		font-weight: 400;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
	}

	/* Talk Mode Button */
	.talk-mode-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 10px;
		background: var(--bg-tertiary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		box-sizing: border-box;
	}

	.talk-mode-btn:active {
		transform: scale(0.95);
	}

	.talk-mode-btn.active {
		background: var(--accent-primary);
		border-color: var(--accent-primary);
		color: white;
	}

	.talk-mode-label {
		white-space: nowrap;
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
		position: relative;
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

	.message-save-btn {
		position: absolute;
		bottom: 8px;
		right: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 6px 12px;
		background: rgba(199, 124, 92, 0.6);
		backdrop-filter: blur(8px);
		border: none;
		border-radius: var(--radius-md);
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		font-size: 0.6875rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.message-save-btn:active {
		background: rgba(199, 124, 92, 0.85);
		transform: scale(0.95);
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

	.message-save-btn.saved:active {
		background: rgba(76, 175, 80, 0.85);
		transform: none;
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

	/* Input Bar - flex-shrink: 0 (DESIGN-SPEC pattern) */
	.input-bar {
		position: relative;
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

	.input-wrapper {
		position: relative;
		flex: 1;
		display: flex;
		align-items: center;
	}

	.message-input {
		flex: 1;
		width: 100%;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 10px 40px 10px 44px; /* Increased left padding for toggle */
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
		-webkit-appearance: none; /* Remove iOS shadow */
		height: 40px;
		/* Touch optimization */
		touch-action: manipulation;
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
		width: 40px;
		height: 40px;
		background: transparent;
		border: none;
		padding: 0;
	}

	.message-input:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	/* Character counter */
	.char-counter-container {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 12px;
		right: 12px;
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
		border-color: #fecaca;
		font-weight: 600;
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
	}

	/* Mode Toggle */
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

	/* Uploaded Files Preview */
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

	/* Compact Image Preview */
	.image-preview-compact {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px;
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

	.preview-actions-compact {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		margin-left: auto;
	}

	.add-to-library-btn {
		padding: 6px 12px;
		background: var(--accent-primary);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.add-to-library-btn:active:not(:disabled) {
		background: var(--accent-hover);
		transform: scale(0.95);
	}

	.add-to-library-btn.added {
		background: #4caf50;
		cursor: default;
	}

	.add-to-library-btn.saving {
		cursor: wait;
	}

	.add-to-library-btn:disabled {
		opacity: 1;
	}

	.spinner-small {
		width: 12px;
		height: 12px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin-small 0.6s linear infinite;
	}

	@keyframes spin-small {
		to { transform: rotate(360deg); }
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

	/* Confirmation buttons (used by QuestionsForm and operations) */
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
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 4px;
	}

	.operation-title-row {
		flex: 1;
		min-width: 0;
	}

	.edit-operation-btn {
		background: none;
		border: none;
		padding: 4px;
		color: var(--text-secondary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.edit-operation-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.edit-operation-btn:active {
		transform: scale(0.95);
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
		.message.ai .message-bubble:has(:global(.inline-questions)) {
			max-width: 100%;
		}
	}
</style>
