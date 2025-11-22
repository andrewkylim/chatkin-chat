<script lang="ts">
	import AppLayout from '$lib/components/AppLayout.svelte';
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
					<button class="primary-btn">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M8 2v12M2 8h12"/>
						</svg>
						New Note
					</button>
				</div>
			</header>

			<div class="notes-list">
				<a href="/notes/1" class="note-card">
					<div class="note-header">
						<h3>Wedding Venue Research</h3>
						<span class="note-project">Wedding Planning</span>
					</div>
					<p class="note-preview">Comparing 5 different venues in the area. The Grand Ballroom has great reviews and can accommodate 150 guests...</p>
					<div class="note-footer">
						<span class="note-date">Updated 2h ago</span>
						<span class="note-meta">842 words</span>
					</div>
				</a>

				<a href="/notes/2" class="note-card">
					<div class="note-header">
						<h3>Contractor Quotes Comparison</h3>
						<span class="note-project">House Renovation</span>
					</div>
					<p class="note-preview">Kitchen Renovation Quotes:
1. ABC Contractors - $45,000
2. XYZ Builders - $38,500
3. Quality Home - $42,000...</p>
					<div class="note-footer">
						<span class="note-date">Updated yesterday</span>
						<span class="note-meta">1,250 words</span>
					</div>
				</a>

				<a href="/notes/3" class="note-card">
					<div class="note-header">
						<h3>Marketing Campaign Ideas</h3>
						<span class="note-project">Product Launch</span>
					</div>
					<p class="note-preview">Brainstorming session notes for Q2 launch campaign. Key themes: innovation, sustainability, user-first design...</p>
					<div class="note-footer">
						<span class="note-date">Created 3 days ago</span>
						<span class="note-meta">624 words</span>
					</div>
				</a>

				<a href="/notes/4" class="note-card">
					<div class="note-header">
						<h3>Gift Registry Ideas</h3>
						<span class="note-project">Wedding Planning</span>
					</div>
					<p class="note-preview">Items we want for the new house:
• Kitchen appliances (KitchenAid mixer, espresso machine)
• Bedding and linens...</p>
					<div class="note-footer">
						<span class="note-date">Updated last week</span>
						<span class="note-meta">423 words</span>
					</div>
				</a>

				<a href="/notes/5" class="note-card standalone">
					<div class="note-header">
						<h3>Book Recommendations</h3>
						<span class="note-badge">Standalone</span>
					</div>
					<p class="note-preview">Fiction: The Night Circus, Project Hail Mary
Non-fiction: Atomic Habits, The Power of Now...</p>
					<div class="note-footer">
						<span class="note-date">Updated 2 weeks ago</span>
						<span class="note-meta">187 words</span>
					</div>
				</a>
			</div>
		</div>

		<!-- Notes AI Chat Section -->
		<div class="chat-section">
			<div class="chat-header">
				<div class="header-content">
					<div class="chat-title">
						<img src="/notes.png" alt="Notes AI" class="ai-icon" />
						<div>
							<h2>Notes AI</h2>
							<p class="ai-subtitle">Your note-taking assistant</p>
						</div>
					</div>
				</div>
			</div>

			<div class="messages">
				<div class="message ai">
					<div class="message-bubble">
						<p>Hi! I'm your Notes AI. I can help you create, organize, and search your notes. What would you like to capture today?</p>
					</div>
				</div>
			</div>

			<form class="input-container">
				<input
					type="text"
					placeholder="Ask about notes..."
					class="message-input"
				/>
				<button type="submit" class="send-btn">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
						<path d="M2 3l16 7-16 7V3zm0 8.5V14l8-4-8-4v5.5z"/>
					</svg>
				</button>
			</form>
		</div>
	</div>
</div>
</AppLayout>

<style>
	.notes-page {
		min-height: 100vh;
		background: var(--bg-primary);
	}

	.notes-container {
		display: flex;
		height: 100vh;
		overflow: hidden;
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
		padding: 16px;
		text-decoration: none;
		color: var(--text-primary);
		transition: all 0.2s ease;
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

	/* Mobile Responsive */
	@media (max-width: 1023px) {
		.chat-section {
			display: none;
		}

		.notes-section {
			border-right: none;
		}
	}
</style>
