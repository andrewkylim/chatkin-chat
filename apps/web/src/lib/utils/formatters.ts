/**
 * Shared utility functions for formatting text, dates, and display values
 */

import type { Project } from '@chatkin/types';

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string | null | undefined, maxLength: number = 30): string {
	if (!text) return 'Untitled';
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength) + '...';
}

/**
 * Format a due date to a human-readable string
 */
export function formatDueDate(date: string | null): string {
	if (!date) return 'No due date';

	const taskDate = new Date(date);
	const today = new Date();

	// Check if today
	if (taskDate.toDateString() === today.toDateString()) {
		return 'Due today';
	}

	// Compare dates without time component
	const taskDateOnly = new Date(taskDate);
	taskDateOnly.setHours(0, 0, 0, 0);

	const todayOnly = new Date(today);
	todayOnly.setHours(0, 0, 0, 0);

	if (taskDateOnly < todayOnly) {
		return 'Overdue';
	}

	return taskDate.toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Get relative time string (e.g., "2h ago", "3 days ago")
 */
export function getRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffInMs = now.getTime() - date.getTime();
	const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
	const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
	const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

	if (diffInMinutes < 1) {
		return 'Just now';
	} else if (diffInMinutes < 60) {
		return `${diffInMinutes}m ago`;
	} else if (diffInHours < 24) {
		return `${diffInHours}h ago`;
	} else if (diffInDays === 1) {
		return 'Yesterday';
	} else if (diffInDays < 7) {
		return `${diffInDays} days ago`;
	} else {
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}
}

/**
 * Get project name from project ID
 */
export function getProjectName(
	projectId: string | null,
	projects: Project[]
): string | null {
	if (!projectId) return null;
	const project = projects.find(p => p.id === projectId);
	return project?.name || null;
}

/**
 * Check if a date is today
 */
export function isToday(date: string | null): boolean {
	if (!date) return false;
	const today = new Date();
	const taskDate = new Date(date);
	return taskDate.toDateString() === today.toDateString();
}

/**
 * Check if a date is within the next 7 days
 */
export function isThisWeek(date: string | null): boolean {
	if (!date) return false;
	const today = new Date();
	const taskDate = new Date(date);
	const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
	return taskDate >= today && taskDate <= weekFromNow;
}
