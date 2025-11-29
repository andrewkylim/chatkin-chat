<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_WORKER_URL } from '$env/static/public';
	import AppLayout from '$lib/components/AppLayout.svelte';
	import MobileUserMenu from '$lib/components/MobileUserMenu.svelte';
	import FileCard from '$lib/components/FileCard.svelte';
	import FileRow from '$lib/components/FileRow.svelte';
	import ImageViewer from '$lib/components/ImageViewer.svelte';
	import { deleteFile, getUserStorageUsage, getLibraryFiles, createFile } from '$lib/db/files';
	import type { File, Project } from '@chatkin/types';

	let files: File[] = [];
	let projects: Project[] = [];
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
	let fabFileInput: HTMLInputElement;
	let desktopFileInput: HTMLInputElement;
	let isDragging = false;
	let dragCounter = 0;
	let isUploading = false;

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
		await loadProjects();
		setupInfiniteScroll();
	});

	async function loadProjects() {
		try {
			const { getProjects } = await import('$lib/db/projects');
			projects = await getProjects();
		} catch (error) {
			console.error('Failed to load projects:', error);
		}
	}

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

	async function handleBulkAddToProject(event: Event) {
		const select = event.target as HTMLSelectElement;
		const projectId = select.value === '__none__' ? null : select.value;

		if (!projectId && select.value !== '__none__') return;

		try {
			const { bulkAddFilesToProject } = await import('$lib/db/files');
			await bulkAddFilesToProject(Array.from(selectedFiles), projectId);

			selectedFiles.clear();
			selectedFiles = selectedFiles; // Trigger reactivity
			await loadFiles();

			// Reset select
			select.value = '';
		} catch (error) {
			console.error('Failed to add files to project:', error);
			alert('Failed to add files to project');
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

	// Drag and drop handlers
	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter++;
		if (e.dataTransfer?.types.includes('Files')) {
			isDragging = true;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter--;
		if (dragCounter === 0) {
			isDragging = false;
		}
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragging = false;
		dragCounter = 0;

		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;

		// Only handle single file for now
		const file = files[0];

		// Validate file size
		const maxSizeBytes = 10 * 1024 * 1024; // 10MB
		if (file.size > maxSizeBytes) {
			alert('File size must be less than 10MB');
			return;
		}

		// Validate file type
		const allowedTypes = [
			'image/jpeg',
			'image/png',
			'image/gif',
			'image/webp',
			'application/pdf',
			'text/plain',
			'application/msword',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		];

		if (!allowedTypes.includes(file.type)) {
			alert('File type not supported. Please upload images, PDFs, or documents.');
			return;
		}

		isUploading = true;

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

				await loadFiles();
				await loadStorageUsage();
			}
		} catch (error) {
			console.error('Upload failed:', error);
			alert('Failed to upload file. Please try again.');
		} finally {
			isUploading = false;
		}
	}
</script>

<AppLayout>
	<div
		class="files-page"
		on:dragenter={handleDragEnter}
		on:dragover={handleDragOver}
		on:dragleave={handleDragLeave}
		on:drop={handleDrop}
	>
		<!-- Drag Overlay -->
		{#if isDragging}
			<div class="drag-overlay">
				<div class="drag-overlay-content">
					<svg width="80" height="80" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M3 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
						<path d="M7 7l3-3 3 3"/>
						<path d="M10 4v10"/>
					</svg>
					<h2>Drop file to upload</h2>
					<p>Maximum 10MB • Images, PDFs, and documents</p>
				</div>
			</div>
		{/if}

		<!-- Upload Progress Overlay -->
		{#if isUploading}
			<div class="upload-progress-overlay">
				<div class="upload-progress-content">
					<div class="spinner"></div>
					<p>Uploading...</p>
				</div>
			</div>
		{/if}

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
					<button class="primary-btn" on:click={() => desktopFileInput?.click()}>
						<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
							<path d="M7 7l3-3 3 3"/>
							<path d="M10 4v10"/>
						</svg>
						Upload
					</button>
					<input
						bind:this={desktopFileInput}
						type="file"
						accept="image/*,application/pdf,.doc,.docx,.txt"
						style="display: none;"
						on:change={handleMobileFileSelect}
					/>
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

				<div class="bulk-project-wrapper">
					<svg class="bulk-icon mobile-only" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
						<line x1="12" y1="11" x2="12" y2="17"/>
						<line x1="9" y1="14" x2="15" y2="14"/>
					</svg>
					<select class="bulk-project-select" on:change={handleBulkAddToProject} value="">
						<option value="" disabled>Add to project...</option>
						<option value="__none__">Remove from project</option>
						{#each projects as project}
							<option value={project.id}>{project.name}</option>
						{/each}
					</select>
				</div>

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
					<span class="btn-text">Delete</span>
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
							{projects}
							selected={selectedFiles.has(file.id)}
							selectMode={selectedCount > 0}
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
			<button class="fab" on:click={() => fabFileInput?.click()} aria-label="Upload file">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<path d="M12 5v14M5 12h14"/>
				</svg>
			</button>
			<input
				bind:this={fabFileInput}
				type="file"
				accept="image/*,application/pdf,.doc,.docx,.txt"
				style="display: none;"
				on:change={handleMobileFileSelect}
			/>
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


<style>
	.files-page {
		padding: 0 0 80px 0; /* Bottom padding for mobile nav */
	}

	/* Desktop Header */
	.page-header {
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
		padding: 16px 20px;
		height: 64px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.header-content {
		width: 100%;
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
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
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
		-webkit-tap-highlight-color: transparent;
	}

	.bulk-select-btn:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.bulk-select-btn:active {
		background: rgba(255, 255, 255, 0.3);
		opacity: 1;
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

	.bulk-project-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.bulk-project-select {
		padding: 8px 12px;
		background: rgba(255, 255, 255, 0.2);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: 0.9rem;
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
	}

	.bulk-project-select:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.bulk-project-select option {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.mobile-only {
		display: none;
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
			padding: 8px;
			font-size: 0.8125rem;
			justify-content: center;
		}

		.btn-text {
			display: none;
		}

		.mobile-only {
			display: block;
		}

		.bulk-project-wrapper {
			width: 34px;
			height: 34px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: rgba(255, 255, 255, 0.2);
			border: 1px solid rgba(255, 255, 255, 0.3);
			border-radius: var(--radius-md);
		}

		.bulk-project-select {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			opacity: 0;
			padding: 0;
			border: none;
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


	/* Drag and Drop Overlay */
	.drag-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(199, 124, 92, 0.95);
		backdrop-filter: blur(8px);
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: fadeIn 0.2s ease;
		pointer-events: none;
	}

	.drag-overlay-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		color: white;
		text-align: center;
		padding: 48px;
		border: 3px dashed rgba(255, 255, 255, 0.5);
		border-radius: var(--radius-xl);
		background: rgba(0, 0, 0, 0.2);
		max-width: 500px;
	}

	.drag-overlay-content h2 {
		font-size: 2rem;
		font-weight: 700;
		margin: 0;
		letter-spacing: -0.02em;
	}

	.drag-overlay-content p {
		font-size: 1rem;
		margin: 0;
		opacity: 0.9;
	}

	.drag-overlay-content svg {
		opacity: 0.9;
		animation: bounce 1s ease infinite;
	}

	@keyframes bounce {
		0%, 100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}

	/* Upload Progress Overlay */
	.upload-progress-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		z-index: 9998;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: fadeIn 0.2s ease;
	}

	.upload-progress-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 20px;
		padding: 40px;
		background: var(--bg-primary);
		border-radius: var(--radius-xl);
		border: 1px solid var(--border-color);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.upload-progress-content p {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid var(--border-color);
		border-top-color: var(--accent-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
