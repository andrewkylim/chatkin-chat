/**
 * Tasks page logic helper module
 *
 * This module extracts all the business logic from the tasks page component,
 * providing utility functions, task categorization, and action handlers.
 * The component remains responsible only for UI state and rendering.
 */

import type { Task, Project } from '@chatkin/types';
import {
	createTask as dbCreateTask,
	toggleTaskComplete,
	updateTask as dbUpdateTask,
	deleteTask as dbDeleteTask
} from '$lib/db/tasks';
import { handleError } from '$lib/utils/error-handler';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Truncates a title to a maximum length with ellipsis
 * @param title - The title to truncate
 * @param maxLength - Maximum length (default: 30)
 * @returns Truncated title with ellipsis if needed
 */
export function truncateTitle(title: string | null, maxLength: number = 30): string {
	if (!title) return 'Untitled';
	if (title.length <= maxLength) return title;
	return title.substring(0, maxLength) + '...';
}

/**
 * Checks if a date string represents today
 * @param date - ISO date string or null
 * @returns True if the date is today
 */
export function isToday(date: string | null): boolean {
	if (!date) return false;
	const today = new Date();
	const taskDate = new Date(date);
	return taskDate.toDateString() === today.toDateString();
}

/**
 * Checks if a date is within the next 7 days (but not today)
 * @param date - ISO date string or null
 * @returns True if the date is within this week
 */
export function isThisWeek(date: string | null): boolean {
	if (!date) return false;
	const today = new Date();
	const taskDate = new Date(date);
	const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
	return taskDate > today && taskDate <= weekFromNow;
}

/**
 * Formats a due date for display
 * @param date - ISO date string or null
 * @returns Formatted date string ('Due today', 'Overdue', or formatted date)
 */
export function formatDueDate(date: string | null): string {
	if (!date) return 'No due date';
	const taskDate = new Date(date);
	const today = new Date();

	if (isToday(date)) return 'Due today';

	// Compare dates without time component
	taskDate.setHours(0, 0, 0, 0);
	today.setHours(0, 0, 0, 0);
	if (taskDate < today) return 'Overdue';

	return taskDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Gets the project name from a project ID
 * @param projectId - Project ID or null
 * @param projects - Array of all projects
 * @returns Project name or null if not found
 */
function getProjectNameInternal(projectId: string | null, projects: Project[]): string | null {
	if (!projectId) return null;
	const project = projects.find(p => p.id === projectId);
	return project?.name || null;
}

// ============================================================================
// TASK CATEGORIZATION
// ============================================================================

/**
 * Categorized tasks by time period
 */
export interface CategorizedTasks {
	todayTasks: Task[];
	thisWeekTasks: Task[];
	laterTasks: Task[];
	completedTasks: Task[];
}

/**
 * Categorizes tasks into today, this week, later, and completed
 * @param tasks - Array of all tasks
 * @returns Categorized and sorted tasks
 */
export function categorizeTasks(tasks: Task[]): CategorizedTasks {
	const sortByDueDate = (a: Task, b: Task) => {
		if (!a.due_date) return 1;
		if (!b.due_date) return -1;
		return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
	};

	const todayTasks = tasks
		.filter(t => t.status !== 'completed' && isToday(t.due_date))
		.sort(sortByDueDate);

	const thisWeekTasks = tasks
		.filter(t => t.status !== 'completed' && !isToday(t.due_date) && isThisWeek(t.due_date))
		.sort(sortByDueDate);

	const laterTasks = tasks
		.filter(t => t.status !== 'completed' && !isToday(t.due_date) && !isThisWeek(t.due_date))
		.sort(sortByDueDate);

	const completedTasks = tasks
		.filter(t => t.status === 'completed')
		.sort((a, b) => {
			if (!a.updated_at) return 1;
			if (!b.updated_at) return -1;
			return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
		});

	return { todayTasks, thisWeekTasks, laterTasks, completedTasks };
}

// ============================================================================
// ACTION FUNCTIONS
// ============================================================================

/**
 * Creates a new task with error handling
 * @param taskData - Task data to create
 * @returns Promise that resolves when task is created
 */
export async function createTaskAction(taskData: {
	title: string;
	description: string | null;
	priority: 'low' | 'medium' | 'high';
	due_date: string | null;
	project_id: string | null;
	status: 'todo' | 'in_progress' | 'completed';
	due_time?: string | null;
	is_all_day?: boolean;
	is_recurring?: boolean;
	recurrence_pattern?: RecurrencePattern | null;
	parent_task_id?: string | null;
	recurrence_end_date?: string | null;
}): Promise<void> {
	try {
		await dbCreateTask({
			...taskData,
			due_time: taskData.due_time ?? null,
			is_all_day: taskData.is_all_day ?? true,
			is_recurring: taskData.is_recurring ?? false,
			recurrence_pattern: taskData.recurrence_pattern ?? null,
			parent_task_id: taskData.parent_task_id ?? null,
			recurrence_end_date: taskData.recurrence_end_date ?? null
		});
	} catch (error) {
		handleError(error, { operation: 'Create task', component: 'TasksPage' });
		throw error; // Re-throw so caller can handle UI updates
	}
}

/**
 * Toggles a task's completion status with error handling
 * @param taskId - Task ID to toggle
 * @param currentStatus - Current task status
 * @returns Promise that resolves when task is toggled
 */
export async function toggleTaskAction(taskId: string, currentStatus: string): Promise<void> {
	try {
		const completed = currentStatus !== 'completed';
		await toggleTaskComplete(taskId, completed);
	} catch (error) {
		handleError(error, { operation: 'Toggle task completion', component: 'TasksPage' });
		throw error;
	}
}

/**
 * Updates a task with error handling
 * @param taskId - Task ID to update
 * @param updatedTask - Partial task data to update
 * @returns Promise that resolves when task is updated
 */
export async function updateTaskAction(taskId: string, updatedTask: Partial<Task>): Promise<void> {
	try {
		await dbUpdateTask(taskId, updatedTask);
	} catch (error) {
		handleError(error, { operation: 'Update task', component: 'TasksPage' });
		throw error;
	}
}

/**
 * Deletes a task with error handling
 * @param taskId - Task ID to delete
 * @returns Promise that resolves when task is deleted
 */
export async function deleteTaskAction(taskId: string): Promise<void> {
	try {
		await dbDeleteTask(taskId);
	} catch (error) {
		handleError(error, { operation: 'Delete task', component: 'TasksPage' });
		throw error;
	}
}

// ============================================================================
// LOCALSTORAGE HELPERS
// ============================================================================

const SHOW_COMPLETED_KEY = 'showCompletedTasks';

/**
 * Loads the show completed tasks preference from localStorage
 * @returns True if completed tasks should be shown
 */
export function loadCompletedTasksPreference(): boolean {
	const saved = localStorage.getItem(SHOW_COMPLETED_KEY);
	if (saved !== null) {
		return saved === 'true';
	}
	return false; // Default to not showing completed tasks
}

/**
 * Saves the show completed tasks preference to localStorage
 * @param show - Whether to show completed tasks
 */
export function saveCompletedTasksPreference(show: boolean): void {
	localStorage.setItem(SHOW_COMPLETED_KEY, String(show));
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Main hook that provides all task-related utilities and functions
 * @param projects - Array of all projects
 * @returns Object with all utilities and action functions
 */
export function useTasks(projects: Project[]) {
	return {
		// Utilities - pre-bound with dependencies
		truncateTitle,
		formatDueDate,
		getProjectName: (id: string | null) => getProjectNameInternal(id, projects),

		// Categorization
		categorize: (tasks: Task[]) => categorizeTasks(tasks),

		// Actions
		createTask: createTaskAction,
		toggleTask: toggleTaskAction,
		updateTask: updateTaskAction,
		deleteTask: deleteTaskAction,

		// LocalStorage
		loadCompletedPreference: loadCompletedTasksPreference,
		saveCompletedPreference: saveCompletedTasksPreference,
	};
}
