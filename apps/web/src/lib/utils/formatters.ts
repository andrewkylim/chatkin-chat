/**
 * Shared utility functions for formatting text, dates, and display values
 */

import type { Task } from '@chatkin/types';

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

/**
 * Format time string (HH:MM:SS or HH:MM) to 12-hour format
 */
export function formatTime(time: string | null): string {
	if (!time) return '';

	const parts = time.split(':');
	const hours = parseInt(parts[0], 10);
	const minutes = parseInt(parts[1], 10);
	const period = hours >= 12 ? 'PM' : 'AM';
	const displayHours = hours % 12 || 12;

	return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format due date and time for display
 */
export function formatDueDateTime(
	date: string | null,
	time: string | null,
	isAllDay: boolean
): string {
	if (!date) return 'No due date';

	const dueDate = new Date(date);
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const dueDateOnly = new Date(dueDate);
	dueDateOnly.setHours(0, 0, 0, 0);

	// Check if overdue (date only comparison for all-day, full datetime for timed)
	if (!isAllDay && time) {
		const [hours, minutes, seconds = 0] = time.split(':').map(Number);
		const fullDueDate = new Date(dueDate);
		fullDueDate.setHours(hours, minutes, seconds);

		if (fullDueDate < new Date()) {
			return 'Overdue';
		}
	} else if (dueDateOnly < today) {
		return 'Overdue';
	}

	// Check if today
	if (isToday(date)) {
		if (isAllDay) {
			return 'Due today';
		}
		return `Due today at ${formatTime(time)}`;
	}

	// Format date
	const dateStr = dueDate.toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	});

	// Add time if not all-day
	if (!isAllDay && time) {
		return `${dateStr} at ${formatTime(time)}`;
	}

	return dateStr;
}

/**
 * Check if task is overdue (considering time if not all-day)
 */
export function isOverdue(task: Task): boolean {
	if (!task.due_date) return false;
	if (task.status === 'completed') return false;

	const now = new Date();
	const dueDate = new Date(task.due_date);

	if (task.is_all_day) {
		// For all-day tasks, compare dates only (due at end of day)
		dueDate.setHours(23, 59, 59, 999);
		return now > dueDate;
	}

	// For timed tasks, combine date and time
	if (task.due_time) {
		const [hours, minutes, seconds = 0] = task.due_time.split(':').map(Number);
		dueDate.setHours(hours, minutes, seconds);
		return now > dueDate;
	}

	return false;
}
