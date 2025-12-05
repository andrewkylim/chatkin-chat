/**
 * Project actions helper module
 *
 * This module wraps CRUD operations with error handling for the project chat page.
 * All actions follow a consistent pattern: try the operation, handle errors, and re-throw
 * so the component can manage UI updates appropriately.
 *
 * Note: Projects are now domain-based (hardcoded), so there's no updateProject function.
 */

import { toggleTaskComplete as dbToggleTaskComplete } from '$lib/db/tasks';
import { handleError } from '$lib/utils/error-handler';

// ============================================================================
// ACTION FUNCTIONS
// ============================================================================

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
		toggleTaskComplete: toggleTaskCompleteAction
	};
}
