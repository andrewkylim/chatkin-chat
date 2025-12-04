/**
 * File Operations Service
 *
 * Handles file saving to library with worker integration.
 */

import { createFile } from '$lib/db/files';
import { workerService } from './worker';
import { handleError } from '$lib/utils/error-handler';
import { logger } from '$lib/utils/logger';

export interface FileSaveRequest {
	name: string;
	url: string;
	type: string;
	size: number;
	conversationId?: string | null;
}

export class FileOperationsService {
	/**
	 * Save a temporary file to permanent library
	 */
	async saveToLibrary(file: FileSaveRequest): Promise<void> {
		try {
			// Call worker to move file and generate metadata
			const result = await workerService.saveToLibrary({
				tempUrl: file.url,
				originalName: file.name,
				mimeType: file.type,
				sizeBytes: file.size
			});

			if (result.success && result.file) {
				// Create DB entry for permanent file
				await createFile({
					filename: result.file.originalName,
					r2_key: result.file.name,
					r2_url: result.file.url,
					mime_type: result.file.type,
					size_bytes: result.file.size,
					note_id: null,
					conversation_id: file.conversationId || null,
					message_id: null,
					domain: 'Mind', // Default to Mind for conversation files
					is_hidden_from_library: false,
					title: result.file.title || null,
					description: result.file.description || null,
					ai_generated_metadata: result.file.ai_generated_metadata || false
				});

				logger.debug('File saved to library', { filename: file.name });
			}
		} catch (error) {
			handleError(error, {
				operation: 'Save file to library',
				component: 'FileOperationsService'
			});
			throw error;
		}
	}
}

// Singleton instance
export const fileOperationsService = new FileOperationsService();
