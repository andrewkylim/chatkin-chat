<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
	import MobileUserMenu from '$lib/components/MobileUserMenu.svelte';
	import { getNotes, createNote, deleteNote, updateNote, updateNoteBlock } from '$lib/db/notes';
	import { getProjects } from '$lib/db/projects';
	import { getOrCreateConversation, getRecentMessages, addMessage } from '$lib/db/conversations';
	import { loadWorkspaceContext, formatWorkspaceContextForAI } from '$lib/db/context';
	import type { Conversation, Note, Project, NoteBlock } from '@chatkin/types';
	import { onMount, tick } from 'svelte';
	import { notificationCounts } from '$lib/stores/notifications';
	import { PUBLIC_WORKER_URL } from '$env/static/public';
	import { goto } from '$app/navigation';

	interface ChatMessage {
		role: 'user' | 'ai';
		content: string;
		isTyping?: boolean;
	}

	interface NoteWithBlocks extends Note {
		note_blocks: NoteBlock[];
	}

	let notes: NoteWithBlocks[] = [];
	let projects: Project[] = [];
	let projectsMap: Record<string, Project> = {};
	let loading = true;
	let showNewNoteModal = false;
	let showFabMenu = false;
	let newNoteTitle = '';
	let newNoteContent = '';
	let newNoteProjectId: string | null = null;
	let deleteNoteId: string | null = null;
	let editNoteId: string | null = null;
	let editNoteTitle = '';
	let editNoteContent = '';
	let editBlockId = '';

	// Chat state
	let chatMessages: ChatMessage[] = [];
	let chatInput = '';
	let isChatStreaming = false;
	let chatMessagesContainer: HTMLDivElement;
	let conversation: Conversation | null = null;
	let workspaceContextString = '';
	let messagesReady = false;

	onMount(async () => {
		// Set current section and clear notification count
		notificationCounts.setCurrentSection('notes');
		notificationCounts.clearCount('notes');

		await loadData();

		// Load conversation and context
		try {
			// Get or create conversation for notes scope
			conversation = await getOrCreateConversation('notes');

			// Load recent messages from database
			const dbMessages = await getRecentMessages(conversation.id, 50);

			// Convert DB messages to UI messages
			if (dbMessages.length > 0) {
				chatMessages = dbMessages.map(msg => ({
					role: msg.role === 'assistant' ? 'ai' : 'user',
					content: msg.content
				}));
			} else {
				// Show welcome message if no history
				chatMessages = [{
					role: 'ai',
					content: "Hi! I'm your Notes AI. I can help you create, organize, and search your notes. What would you like to capture today?"
				}];
			}

			// Load workspace context
			const workspaceContext = await loadWorkspaceContext();
			workspaceContextString = formatWorkspaceContextForAI(workspaceContext);

				await scrollChatToBottom();
			messagesReady = true;
		} catch (error) {
			console.error('Error loading conversation:', error);
				// Show welcome message as fallback
			chatMessages = [{
				role: 'ai',
				content: "Hi! I'm your Notes AI. I can help you create, organize, and search your notes. What would you like to capture today?"
			}];
			await scrollChatToBottom();
			messagesReady = true;
		}
	});

	async function loadData() {
		loading = true;
		try {
			[notes, projects] = await Promise.all([
				getNotes(),
				getProjects()
			]);

			// Create a map of project IDs to project objects for easy lookup
			projectsMap = projects.reduce((acc, p) => {
				acc[p.id] = p;
				return acc;
			}, {} as Record<string, Project>);
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			loading = false;
		}
	}

	async function handleCreateNote() {
		if (!newNoteTitle.trim()) return;

		try {
			await createNote({
				title: newNoteTitle,
				content: newNoteContent || undefined,
				project_id: newNoteProjectId
			});

			newNoteTitle = '';
			newNoteContent = '';
			newNoteProjectId = null;
			showNewNoteModal = false;
			await loadData();
		} catch (error) {
			console.error('Error creating note:', error);
		}
	}

	function truncateTitle(title: string, maxLength: number = 30) {
		if (!title) return 'Untitled';
		if (title.length <= maxLength) return title;
		return title.substring(0, maxLength) + '...';
	}

	function formatDate(dateString: string) {
		const date = new Date(dateString);
		const now = new Date();
		const diffInMs = now.getTime() - date.getTime();
		const diffInHours = diffInMs / (1000 * 60 * 60);

		if (diffInHours < 1) {
			const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
			return `Updated ${diffInMinutes}m ago`;
		} else if (diffInHours < 24) {
			return `Updated ${Math.floor(diffInHours)}h ago`;
		} else if (diffInHours < 48) {
			return 'Updated yesterday';
		} else if (diffInHours < 168) {
			return `Updated ${Math.floor(diffInHours / 24)} days ago`;
		} else if (diffInHours < 336) {
			return 'Updated last week';
		} else {
			return `Updated ${Math.floor(diffInHours / 168)} weeks ago`;
		}
	}

	function getContentPreview(note: NoteWithBlocks): string {
		if (!note.note_blocks || note.note_blocks.length === 0) return 'No content yet...';

		// Get first text block
		const firstTextBlock = note.note_blocks.find((block: NoteBlock) => block.type === 'text');
		if (!firstTextBlock || !firstTextBlock.content?.text) return 'No content yet...';

		const text = firstTextBlock.content.text;
		return text.length > 200 ? text.substring(0, 200) + '...' : text;
	}

	function getWordCount(note: NoteWithBlocks): number {
		if (!note.note_blocks || note.note_blocks.length === 0) return 0;

		// Combine all text blocks
		let allText = '';
		for (const block of note.note_blocks) {
			if (block.type === 'text' && block.content?.text) {
				allText += block.content.text + ' ';
			}
		}

		if (!allText.trim()) return 0;
		return allText.trim().split(/\s+/).length;
	}

	async function handleDeleteNote() {
		if (!deleteNoteId) return;

		try {
			await deleteNote(deleteNoteId);
			deleteNoteId = null;
			await loadData();
		} catch (error) {
			console.error('Error deleting note:', error);
			alert('Failed to delete note');
		}
	}

	function startEditNote(note: NoteWithBlocks) {
		editNoteId = note.id;
		editNoteTitle = note.title;
		const firstTextBlock = note.note_blocks?.find((b: NoteBlock) => b.type === 'text');
		editNoteContent = firstTextBlock?.content?.text || '';
		editBlockId = firstTextBlock?.id || '';
	}

	async function handleUpdateNote() {
		if (!editNoteId || !editNoteTitle.trim()) return;

		try {
			// Update note title
			await updateNote(editNoteId, { title: editNoteTitle });

			// Update note block content if it exists
			if (editBlockId && editNoteContent !== undefined) {
				await updateNoteBlock(editBlockId, editNoteContent);
			}

			editNoteId = null;
			await loadData();
		} catch (error) {
			console.error('Error updating note:', error);
			alert('Failed to update note');
		}
	}

	async function scrollChatToBottom() {
		await tick();
		if (chatMessagesContainer) {
			chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
		}
	}

	async function sendChatMessage(message?: string) {
		const userMessage = message || chatInput.trim();
		if (!userMessage || isChatStreaming || !conversation) return;

		chatInput = '';

		// Build conversation history BEFORE adding new message (last 50 messages)
		const allMessages = chatMessages.filter(m => m.content && typeof m.content === 'string' && m.content.trim() && !m.isTyping);
		const recentMessages = allMessages.slice(-50);

		const conversationHistory = recentMessages.map(m => ({
			role: m.role,
			content: m.content
		}));

		// Save user message to database
		try {
			await addMessage(conversation.id, 'user', userMessage);
		} catch (error) {
			console.error('Error saving user message:', error);
		}

		// Add user message
		chatMessages = [...chatMessages, { role: 'user', content: userMessage }];
		scrollChatToBottom();

		// Add placeholder for AI response
		const aiMessageIndex = chatMessages.length;
		chatMessages = [...chatMessages, { role: 'ai', content: '' }];
		isChatStreaming = true;

		// Show loading message
		chatMessages[aiMessageIndex] = {
			role: 'ai',
			content: '',
		isTyping: true
		};
		chatMessages = chatMessages;
		scrollChatToBottom();

		try {

			const response = await fetch(`${PUBLIC_WORKER_URL}/api/ai/chat`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					message: userMessage,
					conversationHistory: conversationHistory,
					conversationSummary: conversation.conversation_summary,
					workspaceContext: workspaceContextString,
					context: {
						scope: 'notes'
					}
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			// Handle structured response from worker
			if (data.type === 'actions' && Array.isArray(data.actions)) {
				// Update loading message
				chatMessages[aiMessageIndex] = {
					role: 'ai',
					content: 'Processing...',
					isTyping: false
				};
				chatMessages = chatMessages;
				scrollChatToBottom();

				// Process all operations
				let createCount = 0;
				let updateCount = 0;
				let deleteCount = 0;

				for (const action of data.actions) {
					try {
						if (action.type === 'note') {
							if (action.operation === 'create') {
								const noteData = action.data;
								await createNote({
									title: noteData.title,
									content: noteData.content,
									project_id: null
								});
								createCount++;
							} else if (action.operation === 'update' && action.id) {
								// Filter out 'content' field - notes use block-based architecture
								const { content, ...validChanges } = action.changes;
								if (content) {
									console.warn('Ignoring content field in note update - use note_blocks instead');
								}
								await updateNote(action.id, validChanges);
								updateCount++;
							} else if (action.operation === 'delete' && action.id) {
								await deleteNote(action.id);
								deleteCount++;
							}
						}
					} catch (error) {
						console.error(`Error processing ${action.operation} note:`, error);
					}
				}

				// Reload notes
				await loadData();

				// Show custom confirmation message
				const parts = [];
				if (createCount > 0) parts.push(`Created ${createCount} note${createCount > 1 ? 's' : ''}`);
				if (updateCount > 0) parts.push(`Updated ${updateCount} note${updateCount > 1 ? 's' : ''}`);
				if (deleteCount > 0) parts.push(`Deleted ${deleteCount} note${deleteCount > 1 ? 's' : ''}`);
				const confirmMessage = parts.length > 0 ? parts.join(', ') + '.' : 'No changes made.';

				// Save AI response to database
				try {
					await addMessage(conversation!.id, 'assistant', confirmMessage);
				} catch (error) {
					console.error('Error saving AI message:', error);
				}

				chatMessages[aiMessageIndex] = {
					role: 'ai',
					content: confirmMessage,
					isTyping: false
				};
				chatMessages = chatMessages;
			} else if (data.type === 'message') {
				// Save conversational AI response
				try {
					await addMessage(conversation!.id, 'assistant', data.message);
				} catch (error) {
					console.error('Error saving AI message:', error);
				}

				// Conversational response
				chatMessages[aiMessageIndex] = {
					role: 'ai',
					content: data.message,
					isTyping: false
				};
				chatMessages = chatMessages;
			}
		} catch (error) {
			console.error('Error sending message:', error);
			chatMessages[aiMessageIndex] = {
				role: 'ai',
				content: 'Sorry, I encountered an error processing your request. Please try again.',
				isTyping: false
			};
			chatMessages = chatMessages;
		} finally {
			isChatStreaming = false;
			scrollChatToBottom();
		}
	}
</script>

<AppLayout>
<div class="notes-page">
	<div class="notes-container">
		<!-- Notes List Section -->
		<div class="notes-section">
			<header class="section-header">
				<h1>Notes</h1>
				<div class="header-actions">
					<button class="icon-btn" title="Search">
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="9" cy="9" r="7"/>
							<path d="M14 14l5 5"/>
						</svg>
					</button>
					<button class="primary-btn" on:click={() => showNewNoteModal = true}>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M8 2v12M2 8h12"/>
						</svg>
						New Note
					</button>
				</div>
			</header>

			{#if loading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Loading notes...</p>
				</div>
			{:else if notes.length === 0}
				<div class="empty-state">
					<img src="/notes.webp" alt="Notes" class="empty-icon" />
					<h2>No notes yet</h2>
					<p>Create your first note to get started</p>
				</div>
			{:else}
				<div class="notes-list">
					{#each notes as note (note.id)}
						<div class="note-card" class:standalone={!note.project_id}>
							<a href="/notes/{note.id}" class="note-link">
								<div class="note-header">
									<h3>{truncateTitle(note.title)}</h3>
									{#if note.project_id && projectsMap[note.project_id]}
										<span class="note-project">{projectsMap[note.project_id].name}</span>
									{:else}
										<span class="note-badge">Standalone</span>
									{/if}
								</div>
								<p class="note-preview">{getContentPreview(note)}</p>
								<div class="note-footer">
									<span class="note-date">{formatDate(note.updated_at)}</span>
									<span class="note-meta">{getWordCount(note)} words</span>
								</div>
							</a>
							<div class="card-actions">
								<button
									class="icon-action-btn"
									on:click|stopPropagation={() => startEditNote(note)}
									title="Edit note"
								>
									<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M10.5 2l1.5 1.5L5 10.5H3.5V9L10.5 2z"/>
									</svg>
								</button>
								<button
									class="icon-action-btn delete-action-btn"
									on:click|stopPropagation={() => deleteNoteId = note.id}
									title="Delete note"
								>
									<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M2 3h10M5 3V2a1 1 0 011-1h2a1 1 0 011 1v1M11 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3"/>
									</svg>
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Notes AI Chat Section -->
		<div class="chat-section">
			<div class="chat-header">
				<div class="header-content">
					<div class="chat-title">
						<img src="/notes.webp" alt="Notes AI" class="ai-icon" />
						<div>
							<h2>Notes AI</h2>
							<p class="ai-subtitle">Your note-taking assistant</p>
						</div>
					</div>
				</div>
			</div>

			{#if !messagesReady}
				<div class="chat-loading-overlay">
					<div class="spinner"></div>
					<p>Loading conversation...</p>
				</div>
			{/if}

			<div class="messages" bind:this={chatMessagesContainer} style:opacity={messagesReady ? '1' : '0'}>
				{#each chatMessages as message (message)}
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

			<form class="input-container" on:submit|preventDefault={() => sendChatMessage()}>
				<input
					type="text"
					bind:value={chatInput}
					placeholder="Ask about notes..."
					class="message-input"
					disabled={isChatStreaming}
				/>
				<button type="submit" class="send-btn" disabled={isChatStreaming || !chatInput.trim()}>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M5 15L15 5"/>
						<path d="M9 5h6v6"/>
					</svg>
				</button>
			</form>
		</div>
	</div>

	<!-- Mobile Layout (matches Chat structure) -->
	<div class="mobile-content">
		<header class="mobile-header">
			<div class="mobile-header-left">
				<button class="mobile-logo-button">
					<img src="/logo.webp" alt="Chatkin" class="mobile-logo" />
				</button>
				<h1>Notes</h1>
			</div>
			<MobileUserMenu />
		</header>

		<div class="mobile-notes">
			{#if loading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Loading notes...</p>
				</div>
			{:else if notes.length === 0}
				<div class="empty-state">
					<img src="/notes.webp" alt="Notes" class="empty-icon" />
					<h2>No notes yet</h2>
					<p>Create your first note to get started</p>
				</div>
			{:else}
				{#each notes as note (note.id)}
					<div class="note-card" class:standalone={!note.project_id}>
						<a href="/notes/{note.id}" class="note-link">
							<div class="note-header">
								<h3>{truncateTitle(note.title)}</h3>
								{#if note.project_id && projectsMap[note.project_id]}
									<span class="note-project">{projectsMap[note.project_id].name}</span>
								{:else}
									<span class="note-badge">Standalone</span>
								{/if}
							</div>
							<p class="note-preview">{getContentPreview(note)}</p>
							<div class="note-footer">
								<span class="note-date">{formatDate(note.updated_at)}</span>
								<span class="note-meta">{getWordCount(note)} words</span>
							</div>
						</a>
						<div class="card-actions">
							<button
								class="icon-action-btn"
								on:click|stopPropagation={() => startEditNote(note)}
								title="Edit note"
							>
								<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M10.5 2l1.5 1.5L5 10.5H3.5V9L10.5 2z"/>
								</svg>
							</button>
							<button
								class="icon-action-btn delete-action-btn"
								on:click|stopPropagation={() => deleteNoteId = note.id}
								title="Delete note"
							>
								<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M2 3h10M5 3V2a1 1 0 011-1h2a1 1 0 011 1v1M11 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3"/>
								</svg>
							</button>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- New Note Modal -->
	{#if showNewNoteModal}
		<div class="modal-overlay" on:click={() => showNewNoteModal = false} role="button" tabindex="0">
			<div class="modal" on:click|stopPropagation role="dialog" tabindex="0">
				<h2>Create New Note</h2>
				<form on:submit|preventDefault={handleCreateNote}>
					<div class="form-group">
						<label for="note-title">Title</label>
						<input
							type="text"
							id="note-title"
							bind:value={newNoteTitle}
							placeholder="e.g., Meeting Notes"
							maxlength="50"
							required
						/>
					</div>
					<div class="form-group">
						<label for="note-content">Content (optional)</label>
						<textarea
							id="note-content"
							bind:value={newNoteContent}
							placeholder="Start writing your note..."
							rows="6"
						></textarea>
					</div>
					<div class="form-group">
						<label for="note-project">Project (optional)</label>
						<select id="note-project" bind:value={newNoteProjectId}>
							<option value={null}>Standalone note</option>
							{#each projects as project}
								<option value={project.id}>{project.name}</option>
							{/each}
						</select>
					</div>
					<div class="modal-actions">
						<button type="button" class="secondary-btn" on:click={() => showNewNoteModal = false}>
							Cancel
						</button>
						<button type="submit" class="primary-btn">
							Create Note
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Edit Note Modal -->
	{#if editNoteId}
		<div class="modal-overlay" on:click={() => editNoteId = null}>
			<div class="modal edit-modal" on:click|stopPropagation>
				<h2>Edit Note</h2>
				<form on:submit|preventDefault={handleUpdateNote}>
					<div class="form-group">
						<label for="edit-title">Title</label>
						<input
							type="text"
							id="edit-title"
							bind:value={editNoteTitle}
							placeholder="Note title"
							maxlength="50"
							required
							autofocus
						/>
					</div>
					<div class="form-group">
						<label for="edit-content">Content</label>
						<textarea
							id="edit-content"
							bind:value={editNoteContent}
							placeholder="Note content (supports Markdown)"
							rows="10"
						></textarea>
					</div>
					<div class="modal-actions">
						<button type="button" class="secondary-btn" on:click={() => editNoteId = null}>
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

	<!-- Delete Confirmation Modal -->
	{#if deleteNoteId}
		<div class="modal-overlay" on:click={() => deleteNoteId = null}>
			<div class="modal" on:click|stopPropagation>
				<h2>Delete Note?</h2>
				<p>Are you sure you want to delete this note? This action cannot be undone.</p>
				<div class="modal-actions">
					<button type="button" class="secondary-btn" on:click={() => deleteNoteId = null}>
						Cancel
					</button>
					<button type="button" class="danger-btn" on:click={handleDeleteNote}>
						Delete Note
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Floating Action Button with Menu (Mobile Only) -->
	<div class="fab-container">
		{#if showFabMenu}
			<div class="fab-menu">
				<button class="fab-menu-item" on:click={() => { showNewNoteModal = true; showFabMenu = false; }}>
					<svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M15 3l2 2-9 9-4 1 1-4 9-9z"/>
					</svg>
					<span>Quick Add</span>
				</button>
				<button class="fab-menu-item" on:click={() => goto('/notes/chat')}>
					<svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor">
						<path d="M10 2l1.5 3.5L15 7l-3.5 1.5L10 12l-1.5-3.5L5 7l3.5-1.5L10 2z"/>
						<path d="M5 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/>
						<path d="M15 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/>
					</svg>
					<span>Create with AI</span>
				</button>
			</div>
		{/if}
		<button class="fab" on:click={() => showFabMenu = !showFabMenu} aria-label="Create options">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<path d="M12 5v14M5 12h14"/>
			</svg>
		</button>
	</div>

</div>
</AppLayout>

<style>
	.notes-page {
		height: 100vh;
		overflow: hidden;
		background: var(--bg-primary);
	}

	.notes-container {
		display: flex;
		height: 100vh;
		overflow: hidden;
	}

	/* Mobile Layout (hidden on desktop) */
	.mobile-content {
		display: none;
	}

	/* Notes List Section */
	.notes-section {
		flex: 2;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.section-header {
		flex-shrink: 0;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-color);
		height: 64px;
		box-sizing: border-box;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.section-header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.header-actions {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.header-actions .primary-btn {
		display: flex;
		align-items: center;
		padding: 10px 20px;
		font-size: 0.9375rem;
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

	.notes-list {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.note-card {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		position: relative;
		transition: all 0.2s ease;
	}

	.note-link {
		padding: 16px;
		text-decoration: none;
		color: var(--text-primary);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.note-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		border-color: var(--accent-primary);
		background: var(--bg-secondary);
	}

	.note-card:active {
		transform: scale(0.99);
	}

	.card-actions {
		position: absolute;
		top: 12px;
		right: 12px;
		display: flex;
		gap: 6px;
		opacity: 1;
		transition: all 0.2s ease;
		z-index: 2;
	}

	.icon-action-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.icon-action-btn:hover {
		background: var(--bg-primary);
		border-color: var(--accent-primary);
		color: var(--accent-primary);
	}

	.delete-action-btn:hover {
		background: rgba(239, 68, 68, 0.1);
		border-color: rgb(239, 68, 68);
		color: rgb(239, 68, 68);
	}

	.icon-action-btn:active {
		transform: scale(0.95);
	}

	.note-header {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.note-header h3 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
		letter-spacing: -0.01em;
	}

	.note-project {
		font-size: 0.8125rem;
		color: var(--accent-primary);
		font-weight: 500;
	}

	.note-badge {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.note-preview {
		font-size: 0.875rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.note-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8125rem;
		color: var(--text-muted);
		padding-top: 8px;
		border-top: 1px solid var(--border-color);
	}

	.note-date {
		color: var(--text-muted);
	}

	.note-meta {
		color: var(--text-muted);
	}

	/* Chat Section */
	.chat-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
		min-width: 400px;
	}

	.chat-header {
		flex-shrink: 0;
		padding: 16px 20px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
	}

	.header-content {
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

	.chat-title h2 {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 2px;
	}

	.ai-subtitle {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		opacity: 0;
	}

	.chat-loading-overlay {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		padding-top: calc(50% + 20px);
		gap: 16px;
		background: var(--bg-primary);
	}

	.chat-loading-overlay p {
		color: var(--text-secondary);
		font-size: 0.9375rem;
		margin: 0;
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
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		text-align: left;
		max-width: 95%;
	}

	/* Typing Indicator */
	.typing-indicator {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 8px 4px;
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

	.input-container {
		flex-shrink: 0;
		padding: 16px;
		padding-bottom: max(16px, env(safe-area-inset-bottom));
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		display: flex;
		gap: 12px;
		min-height: calc(76px + env(safe-area-inset-bottom));
		box-sizing: border-box;
		transform: translate3d(0, 0, 0);
		-webkit-transform: translate3d(0, 0, 0);
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

	/* Loading and Empty States */
	.loading-state,
	.empty-state {
		padding: 60px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 400px;
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

	.empty-icon {
		width: 100px;
		height: 100px;
		margin-bottom: 12px;
	}

	.empty-state h2 {
		font-size: 1.5rem;
		margin-bottom: 8px;
	}

	.empty-state p {
		color: var(--text-secondary);
		margin-bottom: 24px;
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
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 24px;
		max-width: 500px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.edit-modal {
		max-width: 600px;
	}

	.modal h2 {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0 0 20px 0;
		letter-spacing: -0.02em;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		margin-bottom: 6px;
		color: var(--text-primary);
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-family: 'Inter', sans-serif;
		transition: all 0.2s ease;
	}

	.form-group input:focus,
	.form-group textarea:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 80px;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		margin-top: 24px;
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.message-input:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	/* Modal buttons */
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

	/* Mobile Responsive */
	@media (max-width: 1023px) {
		/* Hide desktop layout */
		.notes-container {
			display: none;
		}

		/* Show mobile layout */
		.mobile-content {
			display: flex;
			flex-direction: column;
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 50px; /* Above bottom nav */
			background: var(--bg-secondary);
		}

		.mobile-header {
			flex-shrink: 0;
			padding: 16px 20px;
			background: var(--bg-secondary);
			border-bottom: 1px solid var(--border-color);
			height: 64px;
			box-sizing: border-box;
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.mobile-header-left {
			display: flex;
			align-items: center;
			gap: 12px;
		}

		.mobile-logo-button {
			display: flex;
			align-items: center;
			background: none;
			border: none;
			padding: 0;
			cursor: pointer;
		}

		.mobile-logo {
			width: 62px;
			height: 62px;
			border-radius: var(--radius-sm);
			transition: all 0.15s ease;
		}

		.mobile-logo-button:active .mobile-logo {
			transform: translateY(4px) scale(0.95);
		}

		.mobile-header h1 {
			font-size: 1.5rem;
			font-weight: 700;
			letter-spacing: -0.02em;
			margin: 0;
		}

		.fab-container {
			display: none;
		}

		@media (max-width: 1023px) {
			.fab-container {
				display: block;
				position: fixed;
				bottom: 80px;
				left: 27px;
				z-index: 50;
				margin-bottom: env(safe-area-inset-bottom);
			}

			.fab {
				width: 56px;
				height: 56px;
				border-radius: 50%;
				background: var(--accent-primary);
				color: white;
				border: none;
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
				transition: transform 0.3s ease;
				opacity: 0.7;
			}

			.fab:active {
				transform: scale(0.95);
			}

			.fab-menu {
				position: absolute;
				bottom: calc(100% + 12px);
				left: 0;
				background: var(--bg-secondary);
				border: 1px solid var(--border-color);
				border-radius: var(--radius-md);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
				min-width: 180px;
				overflow: hidden;
				animation: slideUp 0.2s ease;
			}

			@keyframes slideUp {
				from {
					opacity: 0;
					transform: translateY(10px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}

			.fab-menu-item {
				display: flex;
				align-items: center;
				gap: 12px;
				padding: 14px 16px;
				width: 100%;
				background: transparent;
				border: none;
				border-bottom: 1px solid var(--border-color);
				cursor: pointer;
				transition: background 0.2s ease;
				color: var(--text-primary);
				font-size: 0.9375rem;
				font-weight: 500;
				text-align: left;
			}

			.fab-menu-item:last-child {
				border-bottom: none;
			}

			.fab-menu-item:hover {
				background: var(--bg-tertiary);
			}

			.fab-menu-item:active {
				transform: scale(0.98);
			}

			.fab-menu-item svg {
				flex-shrink: 0;
				color: var(--text-secondary);
			}
		}

		.mobile-notes {
			flex: 1;
			overflow-y: auto;
			-webkit-overflow-scrolling: touch;
			padding: 20px;
			padding-bottom: 120px;
			background: var(--bg-secondary);
			display: flex;
			flex-direction: column;
			gap: 12px;
		}
	}
</style>
