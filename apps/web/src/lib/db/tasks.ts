import { supabase } from '$lib/supabase';
import type { Task, RecurrencePattern } from '@chatkin/types';

type TaskInsert = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>;
type TaskUpdate = Partial<Omit<Task, 'id' | 'user_id' | 'created_at'>>;

export async function getTasks(domainOrProjectId?: string) {
	let query = supabase
		.from('tasks')
		.select('*')
		.order('created_at', { ascending: false });

	if (domainOrProjectId) {
		// Filter by domain
		query = query.eq('domain', domainOrProjectId);
	}

	const { data, error } = await query;

	if (error) throw error;
	return data as Task[];
}

export async function getTask(id: string) {
	const { data, error } = await supabase
		.from('tasks')
		.select('*')
		.eq('id', id)
		.single();

	if (error) throw error;
	return data as Task;
}

export async function createTask(
	task: Omit<TaskInsert, 'user_id' | 'is_all_day' | 'due_time' | 'is_recurring' | 'recurrence_pattern' | 'parent_task_id' | 'recurrence_end_date'> &
	Partial<Pick<TaskInsert, 'is_all_day' | 'due_time' | 'is_recurring' | 'recurrence_pattern' | 'parent_task_id' | 'recurrence_end_date'>>
) {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	// Provide defaults for optional fields
	const isAllDay = task.is_all_day ?? true;
	const taskData = {
		...task,
		user_id: user.id,
		is_all_day: isAllDay,
		due_time: isAllDay ? null : (task.due_time ?? null),
		is_recurring: task.is_recurring ?? false,
		recurrence_pattern: task.recurrence_pattern ?? null,
		parent_task_id: task.parent_task_id ?? null,
		recurrence_end_date: task.recurrence_end_date ?? null
	};

	const { data, error } = await supabase
		.from('tasks')
		.insert(taskData)
		.select()
		.single();

	if (error) throw error;
	return data as Task;
}

export async function updateTask(id: string, updates: TaskUpdate) {
	// If changing to all-day, clear due_time
	const updateData = {
		...updates,
		updated_at: new Date().toISOString()
	};

	if (updates.is_all_day === true) {
		updateData.due_time = null;
	}

	const { data, error } = await supabase
		.from('tasks')
		.update(updateData)
		.eq('id', id)
		.select()
		.single();

	if (error) throw error;
	return data as Task;
}

export async function deleteTask(id: string) {
	const { error } = await supabase
		.from('tasks')
		.delete()
		.eq('id', id);

	if (error) throw error;
}

export async function toggleTaskComplete(id: string, completed: boolean) {
	return updateTask(id, {
		status: completed ? 'completed' : 'todo',
		completed_at: completed ? new Date().toISOString() : null
	});
}

export async function deleteOldCompletedTasks() {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	// Calculate date 30 days ago
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const { error } = await supabase
		.from('tasks')
		.delete()
		.eq('user_id', user.id)
		.eq('status', 'completed')
		.lt('completed_at', thirtyDaysAgo.toISOString());

	if (error) throw error;
}

/**
 * Calculate the next occurrence date for a recurring task
 */
export function calculateNextOccurrence(
	currentDate: Date,
	pattern: RecurrencePattern
): Date {
	const next = new Date(currentDate);

	switch (pattern.frequency) {
		case 'daily':
			next.setDate(next.getDate() + pattern.interval);
			break;

		case 'weekly':
			next.setDate(next.getDate() + (7 * pattern.interval));
			// If days_of_week is specified, find the next matching day
			if (pattern.days_of_week && pattern.days_of_week.length > 0) {
				const currentDay = next.getDay();
				const sortedDays = [...pattern.days_of_week].sort((a, b) => a - b);
				let nextDay = sortedDays.find(day => day > currentDay);
				if (nextDay === undefined) {
					// Wrap to next week
					nextDay = sortedDays[0];
					next.setDate(next.getDate() + (7 - currentDay + nextDay));
				} else {
					next.setDate(next.getDate() + (nextDay - currentDay));
				}
			}
			break;

		case 'monthly':
			next.setMonth(next.getMonth() + pattern.interval);
			if (pattern.day_of_month) {
				next.setDate(pattern.day_of_month);
			}
			break;

		case 'yearly':
			next.setFullYear(next.getFullYear() + pattern.interval);
			if (pattern.month_of_year) {
				next.setMonth(pattern.month_of_year - 1); // Months are 0-indexed
			}
			if (pattern.day_of_month) {
				next.setDate(pattern.day_of_month);
			}
			break;
	}

	return next;
}

/**
 * Create a new instance of a recurring task
 */
export async function createRecurringTaskInstance(
	parentTask: Task,
	dueDate: string
): Promise<Task> {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	const newTask: Omit<TaskInsert, 'user_id'> = {
		project_id: parentTask.project_id || null,
		title: parentTask.title,
		description: parentTask.description,
		status: 'todo',
		priority: parentTask.priority,
		due_date: dueDate,
		due_time: parentTask.due_time,
		is_all_day: parentTask.is_all_day,
		is_recurring: false, // Instances are not recurring themselves
		recurrence_pattern: null,
		parent_task_id: parentTask.id, // Link back to parent
		recurrence_end_date: null
	};

	return createTask(newTask);
}

/**
 * Get all instances of a recurring task
 */
export async function getRecurringTaskInstances(parentTaskId: string): Promise<Task[]> {
	const { data, error } = await supabase
		.from('tasks')
		.select('*')
		.eq('parent_task_id', parentTaskId)
		.order('due_date', { ascending: true });

	if (error) throw error;
	return data as Task[];
}

/**
 * Format recurrence pattern as human-readable text
 */
export function formatRecurrencePattern(pattern: RecurrencePattern): string {
	const { frequency, interval, days_of_week, day_of_month } = pattern;

	const _intervalText = interval === 1 ? '' : `every ${interval} `;

	switch (frequency) {
		case 'daily':
			return interval === 1 ? 'Daily' : `Every ${interval} days`;

		case 'weekly': {
			if (days_of_week && days_of_week.length > 0) {
				const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
				const selectedDays = days_of_week.map(d => dayNames[d]).join(', ');
				return interval === 1
					? `Weekly on ${selectedDays}`
					: `Every ${interval} weeks on ${selectedDays}`;
			}
			return interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
		}

		case 'monthly':
			if (day_of_month) {
				const suffix = ['th', 'st', 'nd', 'rd'][
					day_of_month % 10 > 3 ? 0 : (day_of_month % 100 - day_of_month % 10 !== 10 ? day_of_month % 10 : 0)
				];
				return interval === 1
					? `Monthly on the ${day_of_month}${suffix}`
					: `Every ${interval} months on the ${day_of_month}${suffix}`;
			}
			return interval === 1 ? 'Monthly' : `Every ${interval} months`;

		case 'yearly':
			return interval === 1 ? 'Yearly' : `Every ${interval} years`;

		default:
			return 'Custom recurrence';
	}
}
