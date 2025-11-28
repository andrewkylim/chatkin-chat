<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { PUBLIC_WORKER_URL } from '$env/static/public';
	import AppLayout from '$lib/components/AppLayout.svelte';
	import MobileUserMenu from '$lib/components/MobileUserMenu.svelte';
	import FileCard from '$lib/components/FileCard.svelte';
	import FileRow from '$lib/components/FileRow.svelte';
	import ImageViewer from '$lib/components/ImageViewer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import { getFiles, deleteFile, getUserStorageUsage, getLibraryFiles, createFile } from '$lib/db/files';
	import type { File } from '@chatkin/types';

	let files: File[] = [];
	let selectedFiles: Set<string> = new Set();
	let searchQuery = '';
	let viewMode: 'grid' | 'list' = 'grid'; // Default to grid
	let storageUsed = 0;
	let loading = true;
	let loadingMore = false;
	let hasMore = true;
	let viewingFile: File | null = null;
	let imageFiles: File[] = [];
	let sentinelElement: HTMLElement | null = null;
	let showUploadModal = false;
	let mobileFileInput: HTMLInputElement;

	const PAGE_SIZE = 50;

	// Convert relative URLs to absolute URLs for backward compatibility
	function normalizeFileUrl(url: string): string {
		if (url.startsWith('/api/files/')) {
			return `${PUBLIC_WORKER_URL}${url}`;
		}
		return url;
	}

	// Load view preference from localStorage
	onMount(async () => {
		const savedView = localStorage.getItem('files-view-mode');
		if (savedView === 'list' || savedView === 'grid') {
			viewMode = savedView;
		}

		await loadFiles();
		await loadStorageUsage();
		setupInfiniteScroll();
	});

	async function loadFiles() {
		loading = true;
		try {
			const loadedFiles = await getLibraryFiles({ limit: PAGE_SIZE, offset: 0 });
			files = loadedFiles.map((f) => ({
				...f,
				r2_url: normalizeFileUrl(f.r2_url)
			}));
			hasMore = loadedFiles.length === PAGE_SIZE;
		} catch (error) {
			console.error('Failed to load files:', error);
		}
		loading = false;
	}

	async function loadMoreFiles() {
		if (loadingMore || !hasMore) return;

		loadingMore = true;
		try {
			const loadedFiles = await getLibraryFiles({ limit: PAGE_SIZE, offset: files.length });
			const newFiles = loadedFiles.map((f) => ({
				...f,
				r2_url: normalizeFileUrl(f.r2_url)
			}));
			files = [...files, ...newFiles];
			hasMore = loadedFiles.length === PAGE_SIZE;
		} catch (error) {
			console.error('Failed to load more files:', error);
		}
		loadingMore = false;
	}

	function setupInfiniteScroll() {
		if (!sentinelElement) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loadingMore) {
					loadMoreFiles();
				}
			},
			{ threshold: 0.1 }
		);

		observer.observe(sentinelElement);

		return () => observer.disconnect();
	}

	async function loadStorageUsage() {
		try {
			storageUsed = await getUserStorageUsage();
		} catch (error) {
			console.error('Failed to load storage usage:', error);
		}
	}

	function setViewMode(mode: 'grid' | 'list') {
		viewMode = mode;
		localStorage.setItem('files-view-mode', mode);
	}

	// Filter files based on search query
	$: filteredFiles = files.filter((file) => {
		const query = searchQuery.toLowerCase();
		return (
			file.filename.toLowerCase().includes(query) ||
			file.title?.toLowerCase().includes(query) ||
			file.description?.toLowerCase().includes(query)
		);
	});

	// Filter only image files for viewer navigation
	$: imageFiles = filteredFiles.filter((file) => file.mime_type.startsWith('image/'));

	function openViewer(file: File) {
		viewingFile = file;
	}

	function closeViewer() {
		viewingFile = null;
	}

	function navigateViewer(file: File) {
		viewingFile = file;
	}

	// Format bytes to human-readable
	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i];
	}

	// Calculate storage percentage
	$: storagePercent = Math.min(100, (storageUsed / (1024 * 1024 * 1024)) * 100); // 1GB cap
	$: selectedCount = selectedFiles.size;

	// Bulk actions
	async function handleBulkDelete() {
		if (!confirm(`Delete ${selectedCount} file(s)?`)) return;

		try {
			await Promise.all(Array.from(selectedFiles).map((id) => deleteFile(id)));
			selectedFiles.clear();
			await loadFiles();
			await loadStorageUsage();
		} catch (error) {
			console.error('Failed to delete files:', error);
		}
	}

	function toggleFileSelection(fileId: string) {
		if (selectedFiles.has(fileId)) {
			selectedFiles.delete(fileId);
		} else {
			selectedFiles.add(fileId);
		}
		selectedFiles = selectedFiles; // Trigger reactivity
	}

	function toggleSelectAll() {
		if (selectedFiles.size === filteredFiles.length) {
			selectedFiles.clear();
		} else {
			selectedFiles = new Set(filteredFiles.map((f) => f.id));
		}
		selectedFiles = selectedFiles; // Trigger reactivity
	}

	async function handleUploadComplete() {
		// Reload files and storage usage after upload
		showUploadModal = false;
		await loadFiles();
		await loadStorageUsage();
	}

	async function handleMobileFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		// Validate file size
		const maxSizeBytes = 10 * 1024 * 1024; // 10MB
		if (file.size > maxSizeBytes) {
			alert('File size must be less than 10MB');
			target.value = '';
			return;
		}

		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('permanent', 'true');

			const response = await fetch(`${PUBLIC_WORKER_URL}/api/upload`, {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
			}

			const result = await response.json();

			if (result.success && result.file) {
				// Create DB entry for permanent file
				await createFile({
					filename: result.file.originalName,
					r2_key: result.file.name,
					r2_url: result.file.url,
					mime_type: result.file.type,
					size_bytes: result.file.size,
					note_id: null,
					conversation_id: null,
					message_id: null,
					is_hidden_from_library: false,
					title: result.file.title || null,
					description: result.file.description || null,
					ai_generated_metadata: !!(result.file.title || result.file.description),
				});

				await handleUploadComplete();
			}
		} catch (error) {
			console.error('Upload failed:', error);
			alert('Failed to upload file. Please try again.');
		} finally {
			target.value = '';
		}
	}
</script>

<AppLayout>
	<div class="files-page">
		<!-- Desktop Header -->
		<header class="page-header">
			<div class="header-content">
				<div class="header-left">
					<h1>Files</h1>
					<span class="file-count"
						>{filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}</span
					>
				</div>
				<div class="header-right">
					<!-- Storage Quota -->
					<div class="quota-display">
						<span class="quota-text">{formatBytes(storageUsed)} / 1 GB</span>
						<div class="quota-bar">
							<div
								class="quota-fill"
								style="width: {storagePercent}%"
								class:warning={storagePercent > 80}
							></div>
						</div>
					</div>
					<!-- Upload Button -->
					<button class="primary-btn" on:click={() => showUploadModal = true}>
						<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
							<path d="M7 7l3-3 3 3"/>
							<path d="M10 4v10"/>
						</svg>
						Upload
					</button>
				</div>
			</div>
		</header>

		<!-- Mobile Header -->
		<header class="mobile-header">
			<div class="mobile-header-left">
				<button class="mobile-logo-button">
					<img src="/logo.webp" alt="Chatkin" class="mobile-logo" />
				</button>
				<h1>Files</h1>
				<div class="mobile-header-info">
					<div class="mobile-file-count">{filteredFiles.length} files</div>
					<div class="mobile-storage-text">
						{(storageUsed / (1024 * 1024)).toFixed(1)} MB / 1 GB
					</div>
				</div>
			</div>
			<MobileUserMenu />
		</header>

		<!-- Controls Bar -->
		<div class="controls-bar">
			<div class="view-controls">
				<button
					class="view-toggle-btn"
					class:active={viewMode === 'grid'}
					on:click={() => setViewMode('grid')}
					aria-label="Grid view"
				>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
						<rect x="2" y="2" width="6" height="6" rx="1" />
						<rect x="12" y="2" width="6" height="6" rx="1" />
						<rect x="2" y="12" width="6" height="6" rx="1" />
						<rect x="12" y="12" width="6" height="6" rx="1" />
					</svg>
				</button>
				<button
					class="view-toggle-btn"
					class:active={viewMode === 'list'}
					on:click={() => setViewMode('list')}
					aria-label="List view"
				>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
						<rect x="2" y="3" width="16" height="2" rx="1" />
						<rect x="2" y="9" width="16" height="2" rx="1" />
						<rect x="2" y="15" width="16" height="2" rx="1" />
					</svg>
				</button>
			</div>

			<div class="search-container">
				<input
					type="search"
					class="search-input"
					placeholder="Search files..."
					bind:value={searchQuery}
				/>
			</div>
		</div>

		<!-- Bulk Selection Bar -->
		{#if selectedCount > 0}
			<div class="bulk-actions-bar">
				<button class="bulk-select-btn" on:click={toggleSelectAll}>
					{selectedCount === filteredFiles.length ? 'Deselect all' : 'Select all'}
				</button>
				<span class="bulk-count">{selectedCount} selected</span>
				<button class="bulk-delete-btn" on:click={handleBulkDelete}>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path
							d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"
						/>
						<path
							fill-rule="evenodd"
							d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
						/>
					</svg>
					Delete
				</button>
			</div>
		{/if}

		<!-- File Display -->
		<div class="files-content">
			{#if loading}
				<div class="loading-state">
					<p>Loading files...</p>
				</div>
			{:else if filteredFiles.length === 0}
				{#if searchQuery}
					<div class="empty-state">
						<h2>No files found</h2>
						<p>Try a different search term</p>
					</div>
				{:else}
					<div class="empty-state">
						<img src="/files.webp" alt="Files" class="empty-icon" />
						<h2>No files yet</h2>
						<p>Upload files in chat and save them to your library</p>
					</div>
				{/if}
			{:else if viewMode === 'grid'}
				<div class="file-grid">
					{#each filteredFiles as file (file.id)}
						<FileCard
							{file}
							selected={selectedFiles.has(file.id)}
							on:toggle={() => toggleFileSelection(file.id)}
							on:delete={loadFiles}
							on:update={loadFiles}
							on:view={() => openViewer(file)}
						/>
					{/each}
				</div>

				<!-- Infinite Scroll Sentinel -->
				{#if hasMore && !searchQuery}
					<div class="scroll-sentinel" bind:this={sentinelElement}></div>
				{/if}

				<!-- Loading More Indicator -->
				{#if loadingMore}
					<div class="loading-more">
						<p>Loading more files...</p>
					</div>
				{/if}
			{:else}
				<div class="file-list">
					{#each filteredFiles as file (file.id)}
						<FileRow
							{file}
							selected={selectedFiles.has(file.id)}
							on:toggle={() => toggleFileSelection(file.id)}
							on:delete={loadFiles}
							on:update={loadFiles}
						/>
					{/each}
				</div>

				<!-- Infinite Scroll Sentinel -->
				{#if hasMore && !searchQuery}
					<div class="scroll-sentinel" bind:this={sentinelElement}></div>
				{/if}

				<!-- Loading More Indicator -->
				{#if loadingMore}
					<div class="loading-more">
						<p>Loading more files...</p>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Floating Action Button (Mobile Only) -->
		<div class="fab-container">
			<button class="fab" on:click={() => showUploadModal = true} aria-label="Upload file">
				<svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5">
					<path d="M3 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
					<path d="M7 7l3-3 3 3"/>
					<path d="M10 4v10"/>
				</svg>
			</button>
		</div>
	</div>
</AppLayout>

<!-- Image Viewer Modal -->
{#if viewingFile}
	<ImageViewer
		file={viewingFile}
		allFiles={imageFiles}
		on:close={closeViewer}
		on:navigate={(e) => navigateViewer(e.detail)}
	/>
{/if}

<!-- Upload Modal -->
{#if showUploadModal}
	<div class="modal-overlay" on:click={() => showUploadModal = false}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<div class="modal-title-section">
					<div class="modal-icon">
						<svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
							<path d="M7 7l3-3 3 3"/>
							<path d="M10 4v10"/>
						</svg>
					</div>
					<h2>Upload to Library</h2>
				</div>
				<button class="modal-close-btn" on:click={() => showUploadModal = false} aria-label="Close">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M15 5L5 15M5 5l10 10"/>
					</svg>
				</button>
			</div>
			<div class="modal-body">
				<!-- Desktop: Drag and drop -->
				<div class="upload-area desktop-upload">
					<FileUpload
						accept="image/*,application/pdf,.doc,.docx,.txt"
						maxSizeMB={10}
						permanent={true}
						conversationId={null}
						showDragDrop={true}
						onUploadComplete={handleUploadComplete}
					/>
				</div>
				<!-- Mobile: Simple tap to upload -->
				<div class="upload-area mobile-upload" on:click={() => mobileFileInput?.click()}>
					<div class="mobile-upload-content">
						<div class="mobile-upload-icon">
							<svg width="56" height="56" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
								<path d="M3 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
								<path d="M7 7l3-3 3 3"/>
								<path d="M10 4v10"/>
							</svg>
						</div>
						<p class="mobile-upload-title">Tap to upload file</p>
						<p class="mobile-upload-subtitle">Images, PDFs, and documents</p>
					</div>
					<input
						bind:this={mobileFileInput}
						type="file"
						accept="image/*,application/pdf,.doc,.docx,.txt"
						style="display: none;"
						on:change={handleMobileFileSelect}
					/>
				</div>
				<div class="upload-info">
					<p class="upload-hint">
						<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
							<path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/>
						</svg>
						Maximum file size: 10MB
					</p>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.files-page {
		padding: 0 0 80px 0; /* Bottom padding for mobile nav */
	}

	/* Desktop Header */
	.page-header {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--bg-primary);
		padding: 24px 32px 16px;
		border-bottom: 1px solid var(--border-color);
	}

	.header-content {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.header-left h1 {
		font-size: 1.875rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.file-count {
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.primary-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 18px;
		background: var(--accent-primary);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.primary-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.primary-btn:active {
		transform: translateY(0);
	}

	/* Storage Quota */
	.quota-display {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		min-width: 120px;
	}

	.quota-text {
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 600;
	}

	.quota-bar {
		width: 120px;
		height: 4px;
		background: var(--border-color);
		border-radius: 2px;
		overflow: hidden;
	}

	.quota-fill {
		height: 100%;
		background: var(--accent-success);
		transition:
			width 0.3s ease,
			background 0.3s ease;
	}

	.quota-fill.warning {
		background: var(--danger);
	}

	/* Mobile Header */
	.mobile-header {
		display: none;
	}

	/* Floating Action Button */
	.fab-container {
		display: none;
	}

	/* Controls Bar */
	.controls-bar {
		padding: 16px 32px;
		background: var(--bg-primary);
		display: flex;
		align-items: center;
		gap: 16px;
		max-width: 1200px;
		margin: 0 auto;
	}

	.search-container {
		flex: 1;
	}

	.search-input {
		width: 100%;
		padding: 10px 16px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
		color: var(--text-primary);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	.view-controls {
		display: flex;
		gap: 4px;
		background: var(--bg-tertiary);
		padding: 4px;
		border-radius: var(--radius-md);
	}

	.view-toggle-btn {
		padding: 8px 12px;
		background: transparent;
		border: none;
		border-radius: 6px;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.view-toggle-btn.active {
		background: var(--bg-secondary);
		color: var(--accent-primary);
	}

	/* Bulk Actions Bar */
	.bulk-actions-bar {
		padding: 10px 32px;
		background: var(--accent-primary);
		color: white;
		display: flex;
		align-items: center;
		gap: 12px;
		max-width: 1200px;
		margin: 0 auto;
		position: sticky;
		top: 0;
		z-index: 20;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.bulk-select-btn {
		padding: 6px 14px;
		background: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: var(--radius-md);
		color: white;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.bulk-select-btn:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.bulk-count {
		font-size: 0.875rem;
		font-weight: 500;
		flex: 1;
	}

	.bulk-delete-btn {
		padding: 6px 14px;
		background: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: var(--radius-md);
		color: white;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.bulk-delete-btn:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	/* File Display */
	.files-content {
		position: relative;
		padding: 24px 32px;
		max-width: 1200px;
		margin: 0 auto;
		min-height: 400px;
	}

	.file-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 16px;
	}

	@media (min-width: 640px) {
		.file-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.file-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.file-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* Empty/Loading States */
	.empty-state {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		padding: 60px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		width: 100%;
		max-width: 400px;
	}

	.empty-icon {
		width: 100px;
		height: 100px;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-state h2 {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 8px 0;
	}

	.empty-state p {
		color: var(--text-secondary);
		margin: 0;
	}

	.loading-state {
		text-align: center;
		padding: 60px 20px;
		color: var(--text-secondary);
	}

	/* Mobile Styles */
	@media (max-width: 768px) {
		.page-header {
			display: none;
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
			position: sticky;
			top: 0;
			z-index: 10;
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

		.mobile-header-info {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: 2px;
			margin-left: 8px;
		}

		.mobile-file-count {
			font-size: 0.6875rem;
			font-weight: 600;
			color: var(--text-secondary);
		}

		.mobile-storage-text {
			font-size: 0.6875rem;
			color: var(--text-muted);
		}

		.controls-bar {
			padding: 12px 20px;
			flex-direction: row;
			gap: 12px;
		}

		.view-controls {
			flex-shrink: 0;
		}

		.search-container {
			flex: 1;
		}

		.bulk-actions-bar {
			padding: 10px 16px;
			gap: 8px;
			top: 64px;
		}

		.bulk-select-btn,
		.bulk-delete-btn {
			padding: 6px 12px;
			font-size: 0.8125rem;
		}

		.bulk-count {
			font-size: 0.8125rem;
		}

		.files-content {
			padding: 16px 20px 80px;
		}

		.file-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 12px;
		}

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
	}

	/* Infinite Scroll */
	.scroll-sentinel {
		height: 1px;
		visibility: hidden;
	}

	.loading-more {
		display: flex;
		justify-content: center;
		padding: 32px;
		color: var(--text-secondary);
	}

	.loading-more p {
		margin: 0;
		font-size: 0.875rem;
	}

	/* Upload Modal */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 20px;
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.modal-content {
		background: var(--bg-primary);
		border-radius: var(--radius-lg);
		max-width: 520px;
		width: 100%;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-color);
		animation: slideUp 0.3s ease;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.modal-header {
		padding: 24px 24px 20px;
		border-bottom: 1px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.modal-title-section {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.modal-icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-primary);
		border-radius: var(--radius-md);
		color: white;
	}

	.modal-header h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
		color: var(--text-primary);
	}

	.modal-close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.modal-close-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.modal-body {
		padding: 32px 24px 24px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.upload-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 32px;
		background: var(--bg-secondary);
		border: 2px dashed var(--border-color);
		border-radius: var(--radius-lg);
		transition: all 0.2s ease;
		min-height: 200px;
	}

	.upload-area:hover {
		border-color: var(--accent-primary);
		background: var(--bg-tertiary);
	}

	/* Desktop upload (with drag and drop) */
	.desktop-upload {
		display: flex;
	}

	.mobile-upload {
		display: none;
	}

	/* Mobile upload (tap to upload) */
	.mobile-upload-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		width: 100%;
		cursor: pointer;
		user-select: none;
	}

	.mobile-upload-icon {
		color: var(--accent-primary);
		opacity: 0.8;
		transition: all 0.2s ease;
	}

	.mobile-upload-content:active .mobile-upload-icon {
		transform: scale(0.95);
		opacity: 1;
	}

	.mobile-upload-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.mobile-upload-subtitle {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
	}

	@media (max-width: 768px) {
		.desktop-upload {
			display: none;
		}

		.mobile-upload {
			display: flex;
		}

		.upload-area {
			padding: 56px 32px;
		}

		.modal-content {
			max-width: 90%;
		}
	}

	.upload-info {
		padding: 16px;
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
	}

	.upload-hint {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.5;
	}

	.upload-hint svg {
		flex-shrink: 0;
		opacity: 0.7;
	}
</style>
