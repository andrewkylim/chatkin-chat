<script lang="ts">
	import { PUBLIC_WORKER_URL } from '$env/static/public';
	import { createFile } from '$lib/db/files';
	import { handleError } from '$lib/utils/error-handler';

	interface UploadedFile {
		name: string;
		originalName: string;
		size: number;
		type: string;
		url: string;
		temporary?: boolean;
		title?: string;
		description?: string;
	}

	export let onUploadComplete: ((file: UploadedFile) => void) | undefined = undefined;
	export let conversationId: string | null = null;
	export let accept: string = '*/*';
	export let maxSizeMB: number = 10;
	export let permanent: boolean = false; // NEW: If true, save to permanent bucket with DB entry
	export let showDragDrop: boolean = false; // NEW: If true, show drag and drop area

	// Export upload state so parent can display status
	export let uploading = false;
	export let uploadProgress = 0;
	export let uploadStatus: string = '';

	let error: string | null = null;
	let fileInput: HTMLInputElement;
	let isDragging = false;

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		// Validate file size
		const maxSizeBytes = maxSizeMB * 1024 * 1024;
		if (file.size > maxSizeBytes) {
			error = `File size must be less than ${maxSizeMB}MB`;
			return;
		}

		await uploadFile(file);

		// Reset input
		target.value = '';
	}

	async function uploadFile(file: File) {
		uploading = true;
		error = null;
		uploadProgress = 0;
		uploadStatus = 'Uploading image...';

		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('permanent', permanent.toString()); // Pass permanent flag to backend

			// Track upload stages
			uploadProgress = 25; // Starting upload

			// Use local worker URL in development
			const workerUrl = import.meta.env.DEV ? 'http://localhost:8787' : PUBLIC_WORKER_URL;

			const response = await fetch(`${workerUrl}/api/upload`, {
				method: 'POST',
				body: formData,
			});

			uploadProgress = 75; // Upload complete, processing
			uploadStatus = 'Checking content safety...';

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
			}

			const result = await response.json();

			if (result.success && result.file) {
				// Only save to DB if permanent (temp files skip DB)
				if (permanent && !result.file.temporary) {
					await createFile({
						filename: result.file.originalName,
						r2_key: result.file.name,
						r2_url: result.file.url,
						mime_type: result.file.type,
						size_bytes: result.file.size,
						note_id: null,
						conversation_id: conversationId,
						message_id: null,
						is_hidden_from_library: false,
						title: result.file.title || null,
						description: result.file.description || null,
						ai_generated_metadata: !!(result.file.title || result.file.description),
					});
				}

				// Notify parent component
				if (onUploadComplete) {
					onUploadComplete(result.file);
				}

				uploadProgress = 100;
				uploadStatus = 'Complete!';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Upload failed';
			uploadStatus = '';
			handleError(err, { operation: 'File upload', component: 'FileUpload' });
		} finally {
			uploading = false;
			// Clear status after a brief delay
			setTimeout(() => {
				uploadStatus = '';
			}, 1000);
		}
	}

	function triggerFileSelect() {
		fileInput?.click();
	}

	// Drag and drop handlers
	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragging = false;
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragging = false;

		const file = e.dataTransfer?.files[0];
		if (!file) return;

		// Validate file size
		const maxSizeBytes = maxSizeMB * 1024 * 1024;
		if (file.size > maxSizeBytes) {
			error = `File size must be less than ${maxSizeMB}MB`;
			return;
		}

		await uploadFile(file);
	}
</script>

<div class="file-upload">
	<input
		bind:this={fileInput}
		type="file"
		{accept}
		on:change={handleFileSelect}
		disabled={uploading}
		style="display: none;"
	/>

	{#if showDragDrop}
		<!-- Drag and drop area for modal -->
		<div
			class="drag-drop-area"
			class:dragging={isDragging}
			class:uploading
			on:dragenter={handleDragEnter}
			on:dragleave={handleDragLeave}
			on:dragover={handleDragOver}
			on:drop={handleDrop}
			on:click={triggerFileSelect}
			role="button"
			tabindex="0"
		>
			<div class="drag-drop-icon">
				<svg width="48" height="48" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M3 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
					<path d="M7 7l3-3 3 3"/>
					<path d="M10 4v10"/>
				</svg>
			</div>
			<div class="drag-drop-text">
				{#if error}
					<p class="drag-drop-title error-text">Upload failed</p>
					<p class="drag-drop-subtitle error-text">{error}</p>
				{:else if uploading}
					<p class="drag-drop-title">Uploading...</p>
					<p class="drag-drop-subtitle">
						{#if uploadProgress < 50}
							Uploading file...
						{:else if uploadProgress < 100}
							Checking content safety...
						{:else}
							Complete!
						{/if}
					</p>
				{:else if isDragging}
					<p class="drag-drop-title">Drop file here</p>
				{:else}
					<p class="drag-drop-title">Drag and drop file here</p>
					<p class="drag-drop-subtitle">or click to browse</p>
				{/if}
			</div>
			{#if uploading}
				<div class="drag-drop-progress">
					<div class="drag-drop-progress-bar" style="width: {uploadProgress}%"></div>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Simple button for inline upload -->
		<button
			type="button"
			class="upload-btn"
			class:uploading
			on:click={triggerFileSelect}
			disabled={uploading}
			aria-label="Upload file"
		>
			<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<path d="M3 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
				<path d="M7 7l3-3 3 3"/>
				<path d="M10 4v10"/>
			</svg>
		</button>
	{/if}
</div>

<style>
	.file-upload {
		position: relative;
	}

	.upload-btn {
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

	.upload-btn:hover:not(:disabled) {
		background: var(--bg-primary);
		transform: translateY(-1px);
	}

	.upload-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.upload-btn.uploading {
		opacity: 1;
		cursor: not-allowed;
	}

	.upload-btn.uploading svg {
		animation: flash-orange 2s ease-in-out infinite;
	}

	@keyframes flash-orange {
		0%, 100% {
			color: var(--text-primary);
			opacity: 1;
		}
		50% {
			color: #ff6b00;
			opacity: 1;
		}
	}

	/* Drag and drop area */
	.drag-drop-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		width: 100%;
		cursor: pointer;
		transition: all 0.2s ease;
		user-select: none;
	}

	.drag-drop-area.dragging {
		background: var(--bg-primary) !important;
		border-color: var(--accent-primary) !important;
	}

	.drag-drop-area.uploading {
		cursor: not-allowed;
		pointer-events: none;
	}

	.drag-drop-icon {
		color: var(--accent-primary);
		opacity: 0.8;
		transition: all 0.2s ease;
	}

	.drag-drop-area:hover .drag-drop-icon {
		opacity: 1;
		transform: translateY(-2px);
	}

	.drag-drop-area.dragging .drag-drop-icon {
		opacity: 1;
		transform: scale(1.1);
	}

	.drag-drop-text {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.drag-drop-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.drag-drop-subtitle {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.error-text {
		color: #ef4444 !important;
	}

	.drag-drop-progress {
		width: 100%;
		height: 6px;
		background: var(--border-color);
		border-radius: 3px;
		overflow: hidden;
		margin-top: 8px;
	}

	.drag-drop-progress-bar {
		height: 100%;
		background: var(--accent-primary);
		transition: width 0.3s ease;
		border-radius: 3px;
	}
</style>
