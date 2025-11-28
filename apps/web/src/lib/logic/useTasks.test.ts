import { describe, it, expect, beforeEach } from 'vitest';
import {
	truncateTitle,
	isToday,
	isThisWeek,
	formatDueDate,
	categorizeTasks
} from './useTasks';
import type { Task } from '@chatkin/types';

describe('useTasks utility functions', () => {
	describe('truncateTitle', () => {
		it('should return title as-is if shorter than max length', () => {
			expect(truncateTitle('Short title', 30)).toBe('Short title');
		});

		it('should return title as-is if equal to max length', () => {
			const title = 'Exactly thirty characters!!';
			expect(truncateTitle(title, 30)).toBe(title);
		});

		it('should truncate and add ellipsis if longer than max length', () => {
			const longTitle = 'This is a very long title that exceeds the maximum length';
			const result = truncateTitle(longTitle, 30);
			expect(result).toBe('This is a very long title that...');
			expect(result.length).toBe(33); // 30 + 3 for '...'
		});

		it('should use default max length of 30', () => {
			const longTitle = 'a'.repeat(50);
			const result = truncateTitle(longTitle);
			expect(result).toBe('a'.repeat(30) + '...');
		});
	});

	describe('isToday', () => {
		it('should return false for null date', () => {
			expect(isToday(null)).toBe(false);
		});

		it('should return true for today\'s date', () => {
			const today = new Date();
			const todayStr = today.toISOString().split('T')[0];
			expect(isToday(todayStr)).toBe(true);
		});

		it('should return false for yesterday', () => {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			const yesterdayStr = yesterday.toISOString().split('T')[0];
			expect(isToday(yesterdayStr)).toBe(false);
		});

		it('should return false for tomorrow', () => {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const tomorrowStr = tomorrow.toISOString().split('T')[0];
			expect(isToday(tomorrowStr)).toBe(false);
		});
	});

	describe('isThisWeek', () => {
		it('should return false for null date', () => {
			expect(isThisWeek(null)).toBe(false);
		});

		it('should return false for today', () => {
			const today = new Date();
			const todayStr = today.toISOString().split('T')[0];
			expect(isThisWeek(todayStr)).toBe(false);
		});

		it('should return true for date 3 days from now', () => {
			const threeDaysFromNow = new Date();
			threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
			const dateStr = threeDaysFromNow.toISOString().split('T')[0];
			expect(isThisWeek(dateStr)).toBe(true);
		});

		it('should return true for date 7 days from now', () => {
			const sevenDaysFromNow = new Date();
			sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
			const dateStr = sevenDaysFromNow.toISOString().split('T')[0];
			expect(isThisWeek(dateStr)).toBe(true);
		});

		it('should return false for date 8 days from now', () => {
			const eightDaysFromNow = new Date();
			eightDaysFromNow.setDate(eightDaysFromNow.getDate() + 8);
			const dateStr = eightDaysFromNow.toISOString().split('T')[0];
			expect(isThisWeek(dateStr)).toBe(false);
		});

		it('should return false for yesterday', () => {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			const yesterdayStr = yesterday.toISOString().split('T')[0];
			expect(isThisWeek(yesterdayStr)).toBe(false);
		});
	});

	describe('formatDueDate', () => {
		it('should return "No due date" for null', () => {
			expect(formatDueDate(null)).toBe('No due date');
		});

		it('should return "Due today" for today\'s date', () => {
			const today = new Date();
			const todayStr = today.toISOString().split('T')[0];
			expect(formatDueDate(todayStr)).toBe('Due today');
		});

		it('should return "Overdue" for yesterday', () => {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			const yesterdayStr = yesterday.toISOString().split('T')[0];
			expect(formatDueDate(yesterdayStr)).toBe('Overdue');
		});

		it('should return formatted date for future dates', () => {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const tomorrowStr = tomorrow.toISOString().split('T')[0];
			const result = formatDueDate(tomorrowStr);
			// Should be in format like "Mon, Jan 1"
			expect(result).toMatch(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/);
		});
	});

	describe('categorizeTasks', () => {
		let mockTasks: Task[];

		beforeEach(() => {
			const today = new Date();
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const nextWeek = new Date();
			nextWeek.setDate(nextWeek.getDate() + 5);
			const nextMonth = new Date();
			nextMonth.setDate(nextMonth.getDate() + 30);

			mockTasks = [
				// Today tasks
				{
					id: '1',
					title: 'Task due today',
					status: 'todo',
					priority: 'high',
					due_date: today.toISOString().split('T')[0],
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					description: null,
					project_id: null
				},
				// This week tasks
				{
					id: '2',
					title: 'Task due tomorrow',
					status: 'todo',
					priority: 'medium',
					due_date: tomorrow.toISOString().split('T')[0],
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					description: null,
					project_id: null
				},
				{
					id: '3',
					title: 'Task due next week',
					status: 'todo',
					priority: 'low',
					due_date: nextWeek.toISOString().split('T')[0],
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					description: null,
					project_id: null
				},
				// Later tasks
				{
					id: '4',
					title: 'Task due next month',
					status: 'todo',
					priority: 'low',
					due_date: nextMonth.toISOString().split('T')[0],
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					description: null,
					project_id: null
				},
				{
					id: '5',
					title: 'Task with no due date',
					status: 'todo',
					priority: 'medium',
					due_date: null,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					description: null,
					project_id: null
				},
				// Completed tasks
				{
					id: '6',
					title: 'Completed task 1',
					status: 'completed',
					priority: 'high',
					due_date: yesterday.toISOString().split('T')[0],
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					description: null,
					project_id: null
				},
				{
					id: '7',
					title: 'Completed task 2',
					status: 'completed',
					priority: 'medium',
					due_date: today.toISOString().split('T')[0],
					created_at: new Date().toISOString(),
					updated_at: new Date(Date.now() - 1000).toISOString(), // Older
					description: null,
					project_id: null
				}
			] as Task[];
		});

		it('should categorize tasks into correct groups', () => {
			const result = categorizeTasks(mockTasks);

			expect(result.todayTasks).toHaveLength(1);
			expect(result.todayTasks[0].id).toBe('1');

			expect(result.thisWeekTasks).toHaveLength(2);
			expect(result.thisWeekTasks.map(t => t.id)).toContain('2');
			expect(result.thisWeekTasks.map(t => t.id)).toContain('3');

			expect(result.laterTasks).toHaveLength(2);
			expect(result.laterTasks.map(t => t.id)).toContain('4');
			expect(result.laterTasks.map(t => t.id)).toContain('5');

			expect(result.completedTasks).toHaveLength(2);
			expect(result.completedTasks.map(t => t.id)).toContain('6');
			expect(result.completedTasks.map(t => t.id)).toContain('7');
		});

		it('should sort active tasks by due date (earliest first)', () => {
			const result = categorizeTasks(mockTasks);

			// This week tasks should be sorted by due date
			expect(result.thisWeekTasks[0].id).toBe('2'); // Tomorrow
			expect(result.thisWeekTasks[1].id).toBe('3'); // Next week
		});

		it('should sort completed tasks by updated_at (most recent first)', () => {
			const result = categorizeTasks(mockTasks);

			// Task 6 has newer updated_at than task 7
			expect(result.completedTasks[0].id).toBe('6');
			expect(result.completedTasks[1].id).toBe('7');
		});

		it('should place tasks with no due date in laterTasks', () => {
			const result = categorizeTasks(mockTasks);

			const noDueDateTask = result.laterTasks.find(t => t.id === '5');
			expect(noDueDateTask).toBeDefined();
		});

		it('should handle empty task array', () => {
			const result = categorizeTasks([]);

			expect(result.todayTasks).toHaveLength(0);
			expect(result.thisWeekTasks).toHaveLength(0);
			expect(result.laterTasks).toHaveLength(0);
			expect(result.completedTasks).toHaveLength(0);
		});
	});
});
