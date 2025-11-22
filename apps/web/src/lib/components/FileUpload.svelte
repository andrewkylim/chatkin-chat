<script lang="ts">
	import { PUBLIC_WORKER_URL } from '$env/static/public';
	import { createFile } from '$lib/db/files';

	interface UploadedFile {
		name: string;
		originalName: string;
		size: number;
		type: string;
		url: string;
	}

	export let onUploadComplete: ((file: UploadedFile) => void) | undefined = undefined;
	export let conversationId: string | null = null;
	export let accept: string = '*/*';
	export let maxSizeMB: number = 10;

	let uploading = false;
	let uploadProgress = 0;
	let error: string | null = null;
	let fileInput: HTMLInputElement;

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

		try {
			const formData = new FormData();
			formData.append('file', file);

			const response = await fetch(`${PUBLIC_WORKER_URL}/api/upload`, {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				throw new Error(`Upload failed: ${response.statusText}`);
			}

			const result = await response.json();

			if (result.success && result.file) {
				// Save file metadata to Supabase
				await createFile({
					name: result.file.originalName,
					storage_path: result.file.name,
					mime_type: result.file.type,
					size: result.file.size,
					conversation_id: conversationId,
				});

				// Notify parent component
				if (onUploadComplete) {
					onUploadComplete(result.file);
				}

				uploadProgress = 100;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Upload failed';
			console.error('Upload error:', err);
		} finally {
			uploading = false;
		}
	}

	function triggerFileSelect() {
		fileInput?.click();
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

	<button
		type="button"
		class="upload-btn"
		on:click={triggerFileSelect}
		disabled={uploading}
		title="Upload file"
	>
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M3 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
			<path d="M7 7l3-3 3 3"/>
			<path d="M10 4v10"/>
		</svg>
	</button>

	{#if uploading}
		<div class="upload-progress">
			<div class="progress-bar" style="width: {uploadProgress}%"></div>
		</div>
	{/if}

	{#if error}
		<div class="upload-error">{error}</div>
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

	.upload-progress {
		position: absolute;
		bottom: -8px;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--border-color);
		border-radius: 1px;
		overflow: hidden;
	}

	.progress-bar {
		height: 100%;
		background: var(--accent-primary);
		transition: width 0.3s ease;
	}

	.upload-error {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 4px;
		padding: 4px 8px;
		background: #ff4444;
		color: white;
		font-size: 0.75rem;
		border-radius: 4px;
		white-space: nowrap;
		z-index: 10;
	}
</style>
