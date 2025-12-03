/**
 * Worker API Service
 *
 * Centralizes all calls to the Cloudflare Worker backend.
 * Handles URL construction, authentication, and error handling.
 */

import { PUBLIC_WORKER_URL } from '$env/static/public';
import { handleError } from '$lib/utils/error-handler';
import type { Operation, AIQuestion } from '$lib/types/chat';

export interface FileAttachment {
	name: string;
	url: string;
	type: string;
	size: number;
	temporary?: boolean;
	saving?: boolean;
	saved?: boolean;
}

export interface ChatRequest {
	message: string;
	files?: FileAttachment[];
	conversationHistory: Array<{
		role: string;
		content: string;
		files?: FileAttachment[];
	}>;
	conversationSummary: string | null;
	workspaceContext: string;
	context: {
		scope: 'global' | 'tasks' | 'notes' | 'project';
		projectId?: string;
	};
	authToken?: string;
	mode: 'chat' | 'action';
}

export interface ChatResponse {
	type: 'message' | 'actions' | 'questions';
	message?: string;
	summary?: string;
	actions?: Operation[];
	questions?: AIQuestion[];
}

export interface SaveToLibraryRequest {
	tempUrl: string;
	originalName: string;
	mimeType: string;
	sizeBytes: number;
}

export interface SaveToLibraryResponse {
	success: boolean;
	file?: {
		name: string;
		url: string;
		type: string;
		size: number;
		originalName: string;
		title?: string;
		description?: string;
		ai_generated_metadata?: boolean;
	};
	error?: string;
}

export interface NotificationRequest {
	notification_type: 'ai_proposal' | 'ai_insight';
	channels: Array<'email' | 'browser'>;
	title: string;
	body: string;
	action_url: string;
	operation_count?: number;
}

export class WorkerService {
	/**
	 * Get worker URL based on environment
	 */
	private getWorkerUrl(): string {
		return import.meta.env.DEV ? 'http://localhost:8787' : PUBLIC_WORKER_URL;
	}

	/**
	 * Get authentication token from Supabase session
	 */
	private async getAuthToken(): Promise<string | undefined> {
		// Import dynamically to avoid circular dependencies
		const { supabase } = await import('$lib/supabase');
		const {
			data: { session }
		} = await supabase.auth.getSession();
		return session?.access_token;
	}

	/**
	 * Generic fetch wrapper with error handling
	 */
	private async fetchWorker<T>(
		endpoint: string,
		options: {
			method: 'GET' | 'POST' | 'DELETE';
			body?: unknown;
			requireAuth?: boolean;
		}
	): Promise<T> {
		const url = `${this.getWorkerUrl()}${endpoint}`;
		const token = options.requireAuth !== false ? await this.getAuthToken() : undefined;

		try {
			const response = await fetch(url, {
				method: options.method,
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {})
				},
				...(options.body ? { body: JSON.stringify(options.body) } : {})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
			}

			return await response.json();
		} catch (error) {
			handleError(error, {
				operation: `Worker API: ${endpoint}`,
				component: 'WorkerService'
			});
			throw error;
		}
	}

	/**
	 * Send a chat message to AI
	 */
	async chat(request: ChatRequest): Promise<ChatResponse> {
		return this.fetchWorker<ChatResponse>('/api/ai/chat', {
			method: 'POST',
			body: request,
			requireAuth: true
		});
	}

	/**
	 * Save a temporary file to permanent library
	 */
	async saveToLibrary(request: SaveToLibraryRequest): Promise<SaveToLibraryResponse> {
		return this.fetchWorker<SaveToLibraryResponse>('/api/save-to-library', {
			method: 'POST',
			body: request,
			requireAuth: true
		});
	}

	/**
	 * Delete a file from R2 storage
	 */
	async deleteFile(r2Key: string): Promise<void> {
		await this.fetchWorker<{ success: boolean }>('/api/delete-file', {
			method: 'DELETE',
			body: { r2_key: r2Key },
			requireAuth: true
		});
	}

	/**
	 * Send a notification (email/browser)
	 * Fire-and-forget - does not throw errors
	 */
	async sendNotification(request: NotificationRequest): Promise<void> {
		this.fetchWorker<{ success: boolean }>('/api/send-notification', {
			method: 'POST',
			body: request,
			requireAuth: true
		}).catch((err) => {
			console.warn('Failed to send notification:', err);
		});
	}
}

// Singleton instance
export const workerService = new WorkerService();
