/**
 * Project actions helper module
 *
 * This module wraps CRUD operations with error handling for the project chat page.
 * All actions follow a consistent pattern: try the operation, handle errors, and re-throw
 * so the component can manage UI updates appropriately.
 */

import { updateProject as dbUpdateProject } from '$lib/db/projects';
import { toggleTaskComplete as dbToggleTaskComplete } from '$lib/db/tasks';
import { handleError } from '$lib/utils/error-handler';

// ============================================================================
// ACTION FUNCTIONS
// ============================================================================

/**
 * Updates a project (description only)
 * @param projectId - Project ID to update
 * @param updates - Only description can be updated for domain projects
 * @returns Promise that resolves when project is updated
 */
export async function updateProjectAction(
	projectId: string,
	updates: { description: string | null }
): Promise<void> {
	try {
		await dbUpdateProject(projectId, updates);
	} catch (error) {
		handleError(error, { operation: 'Update project', component: 'ProjectChatPage' });
		throw error;
	}
}

/**
 * Toggles task completion status with error handling
 * @param taskId - Task ID to toggle
 * @param completed - New completion status
 * @returns Promise that resolves when task is toggled
 */
export async function toggleTaskCompleteAction(
	taskId: string,
	completed: boolean
): Promise<void> {
	try {
		await dbToggleTaskComplete(taskId, completed);
	} catch (error) {
		handleError(error, { operation: 'Toggle task', component: 'ProjectChatPage' });
		throw error;
	}
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Main hook that provides all project action functions
 * @returns Object with all action functions
 */
export function useProjectActions() {
	return {
		updateProject: updateProjectAction,
		toggleTaskComplete: toggleTaskCompleteAction
	};
}
