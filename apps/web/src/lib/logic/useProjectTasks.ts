/**
 * Project tasks logic helper module
 *
 * This module extracts all task-related business logic from the project chat page,
 * providing utility functions for formatting, filtering, and categorizing tasks.
 * The component remains responsible only for UI state and rendering.
 */

import type { Task } from '@chatkin/types';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Truncates a title to a maximum length with ellipsis
 * @param title - The title to truncate
 * @param maxLength - Maximum length (default: 30)
 * @returns Truncated title with ellipsis if needed, or 'Untitled' if empty
 */
export function truncateTitle(title: string, maxLength: number = 30): string {
	if (!title) return 'Untitled';
	if (title.length <= maxLength) return title;
	return title.substring(0, maxLength) + '...';
}

/**
 * Formats a due date for display
 * @param date - ISO date string or null
 * @returns Formatted string like "Due today", "Overdue", or formatted date
 */
export function formatDueDate(date: string | null): string {
	if (!date) return 'No due date';

	const dueDate = new Date(date);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	dueDate.setHours(0, 0, 0, 0);

	const diffTime = dueDate.getTime() - today.getTime();
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return 'Due today';
	if (diffDays < 0) return 'Overdue';

	return dueDate.toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Checks if a date is today
 * @param date - ISO date string or null
 * @returns True if date is today
 */
export function isToday(date: string | null): boolean {
	if (!date) return false;
	const d = new Date(date);
	const today = new Date();
	return d.toDateString() === today.toDateString();
}

/**
 * Checks if a date is within this week (but not today)
 * @param date - ISO date string or null
 * @returns True if date is within next 7 days (excluding today)
 */
export function isThisWeek(date: string | null): boolean {
	if (!date) return false;
	const dueDate = new Date(date);
	const today = new Date();
	const weekFromNow = new Date();
	weekFromNow.setDate(today.getDate() + 7);

	return dueDate > today && dueDate <= weekFromNow && !isToday(date);
}

// ============================================================================
// TASK CATEGORIZATION
// ============================================================================

/**
 * Categorized tasks by time period and completion status
 */
export interface CategorizedTasks {
	todayTasks: Task[];
	thisWeekTasks: Task[];
	laterTasks: Task[];
	completedTasks: Task[];
}

/**
 * Categorizes tasks into time-based groups
 * @param tasks - Array of tasks to categorize
 * @returns Object with tasks grouped by category
 */
export function categorizeTasks(tasks: Task[]): CategorizedTasks {
	const active = tasks.filter((t) => t.status !== 'completed');
	const completed = tasks.filter((t) => t.status === 'completed');

	return {
		todayTasks: active.filter((t) => isToday(t.due_date)).sort(sortByDueDate),
		thisWeekTasks: active.filter((t) => isThisWeek(t.due_date)).sort(sortByDueDate),
		laterTasks: active
			.filter((t) => !isToday(t.due_date) && !isThisWeek(t.due_date))
			.sort(sortByDueDate),
		completedTasks: completed.sort(sortByUpdatedAt)
	};
}

/**
 * Sorts tasks by due date (earliest first)
 * Tasks without due dates are sorted last
 */
function sortByDueDate(a: Task, b: Task): number {
	if (!a.due_date && !b.due_date) return 0;
	if (!a.due_date) return 1;
	if (!b.due_date) return -1;
	return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
}

/**
 * Sorts tasks by updated_at timestamp (most recent first)
 */
function sortByUpdatedAt(a: Task, b: Task): number {
	return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Main hook that provides all task-related utilities and functions
 * @returns Object with all utilities and categorization functions
 */
export function useProjectTasks() {
	return {
		// Utilities
		truncateTitle,
		formatDueDate,
		isToday,
		isThisWeek,

		// Categorization
		categorizeTasks
	};
}
