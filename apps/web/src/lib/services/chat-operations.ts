/**
 * Chat Operations Service
 *
 * Handles execution of AI-proposed operations (CRUD for tasks/notes/projects/files).
 * Separated from UI logic to enable testing and reuse.
 */

import { createTask, updateTask, deleteTask } from '$lib/db/tasks';
import { createNote, updateNote, deleteNote } from '$lib/db/notes';
import { updateFileProject, deleteFile } from '$lib/db/files';
import { loadWorkspaceContext, formatWorkspaceContextForAI } from '$lib/db/context';
import { notificationCounts } from '$lib/stores/notifications';
import { logger } from '$lib/utils/logger';
import type { Operation } from '$lib/types/chat';

export interface ExecutionResult {
	successCount: number;
	errorCount: number;
	results: string[];
}

interface TaskData {
	title: string;
	description?: string;
	priority?: 'low' | 'medium' | 'high';
	status?: 'todo' | 'in_progress' | 'completed';
	due_date?: string | null;
	project_id?: string | null;
}

interface NoteData {
	title: string;
	content?: string;
	project_id?: string | null;
}

export class ChatOperationsService {
	/**
	 * Execute a list of operations sequentially
	 * @param operations - Operations to execute
	 * @param projectId - Current project context (for smart project assignment)
	 * @returns Execution results
	 */
	async executeOperations(
		operations: Operation[],
		projectId?: string
	): Promise<ExecutionResult> {
		let successCount = 0;
		let errorCount = 0;
		const results: string[] = [];
		let lastCreatedProjectId: string | null = null;

		for (const op of operations) {
			try {
				if (op.operation === 'create') {
					await this.executeCreate(op, projectId, lastCreatedProjectId);
					results.push(`✓ Created ${op.type}: ${this.getItemTitle(op)}`);
					successCount++;
				} else if (op.operation === 'update') {
					await this.executeUpdate(op);
					results.push(`✓ Updated ${op.type}`);
					successCount++;
				} else if (op.operation === 'delete') {
					await this.executeDelete(op);
					results.push(`✓ Deleted ${op.type}`);
					successCount++;
				}
			} catch (error) {
				logger.error(`Error executing ${op.operation} ${op.type}`, error);
				results.push(`✗ Failed to ${op.operation} ${op.type}`);
				errorCount++;
			}
		}

		return { successCount, errorCount, results };
	}

	/**
	 * Execute create operation
	 */
	private async executeCreate(
		op: Operation,
		projectId?: string,
		lastCreatedProjectId?: string | null
	): Promise<void> {
		if (!op.data) throw new Error('Missing data for create operation');

		if (op.type === 'task') {
			const taskData = op.data as unknown as TaskData;

			// Validate project_id - must be a valid UUID or null
			// AI sometimes returns project names instead of IDs, so we need to filter those out
			let targetProjectId = taskData.project_id || lastCreatedProjectId || projectId || null;

			// Log what the AI provided
			logger.info('Task creation - project_id analysis', {
				aiProvided: taskData.project_id,
				lastCreated: lastCreatedProjectId,
				contextProjectId: projectId,
				finalChoice: targetProjectId
			});

			// UUID validation regex
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
			if (targetProjectId && !uuidRegex.test(targetProjectId)) {
				logger.warn(`Invalid project_id "${targetProjectId}", using fallback`, {
					operation: 'create task',
					providedId: targetProjectId
				});
				targetProjectId = lastCreatedProjectId || projectId || null;
			}

			await createTask({
				title: taskData.title,
				description: taskData.description || null,
				priority: taskData.priority || 'medium',
				status: taskData.status || 'todo',
				due_date: taskData.due_date || null,
				project_id: targetProjectId,
				is_recurring: false,
				recurrence_pattern: null,
				parent_task_id: null,
				recurrence_end_date: null
			});
			notificationCounts.incrementCount('tasks');
		} else if (op.type === 'note') {
			const noteData = op.data as unknown as NoteData;

			// Validate project_id - must be a valid UUID or null
			let targetProjectId = noteData.project_id || lastCreatedProjectId || projectId || null;

			// UUID validation regex
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
			if (targetProjectId && !uuidRegex.test(targetProjectId)) {
				logger.warn(`Invalid project_id "${targetProjectId}", using fallback`, {
					operation: 'create note',
					providedId: targetProjectId
				});
				targetProjectId = lastCreatedProjectId || projectId || null;
			}

			await createNote({
				title: noteData.title,
				content: noteData.content || '',
				project_id: targetProjectId
			});
			notificationCounts.incrementCount('notes');
		}
		// Add project creation if needed in the future
	}

	/**
	 * Execute update operation
	 */
	private async executeUpdate(op: Operation): Promise<void> {
		if (!op.id) throw new Error('Missing ID for update operation');
		if (!op.changes) throw new Error('Missing changes for update operation');

		if (op.type === 'task') {
			await updateTask(op.id, op.changes);
		} else if (op.type === 'note') {
			// Filter out 'content' field - notes use block-based architecture
			const { content, ...validChanges } = op.changes as Record<string, unknown>;
			if (content) {
				logger.warn('Ignoring content field in note update - use note_blocks instead');
			}
			await updateNote(op.id, validChanges);
		}
		// Handle file updates (not in type system but supported at runtime)
		const opType = op.type as string;
		if (opType === 'file') {
			const changes = op.changes as Record<string, unknown>;
			if (changes.project_id !== undefined) {
				await updateFileProject(op.id, changes.project_id as string | null);
			}
		}
	}

	/**
	 * Execute delete operation
	 */
	private async executeDelete(op: Operation): Promise<void> {
		if (!op.id) throw new Error('Missing ID for delete operation');

		if (op.type === 'task') {
			await deleteTask(op.id);
		} else if (op.type === 'note') {
			await deleteNote(op.id);
		}
		// Handle file deletes (not in type system but supported at runtime)
		const opType = op.type as string;
		if (opType === 'file') {
			// Get auth token for file deletion
			const { supabase } = await import('$lib/supabase');
			const {
				data: { session }
			} = await supabase.auth.getSession();
			await deleteFile(op.id, session?.access_token);
		}
	}

	/**
	 * Get item title for display
	 */
	private getItemTitle(op: Operation): string {
		if (op.type === 'task' || op.type === 'note') {
			return (op.data as { title?: string })?.title || 'Untitled';
		}
		if (op.type === 'project') {
			return (op.data as { name?: string })?.name || 'Untitled';
		}
		return 'Item';
	}

	/**
	 * Reload workspace context after operations complete
	 * @returns Formatted context string for AI
	 */
	async reloadWorkspaceContext(): Promise<string> {
		try {
			const context = await loadWorkspaceContext();
			return formatWorkspaceContextForAI(context);
		} catch (error) {
			logger.error('Error reloading workspace context', error);
			return '';
		}
	}
}

// Singleton instance
export const chatOperationsService = new ChatOperationsService();
