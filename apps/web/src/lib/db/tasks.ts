import { supabase } from '$lib/supabase';
import type { Task } from '@chatkin/types';

type TaskInsert = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>;
type TaskUpdate = Partial<Omit<Task, 'id' | 'user_id' | 'created_at'>>;

export async function getTasks(projectId?: string) {
	let query = supabase
		.from('tasks')
		.select('*')
		.order('created_at', { ascending: false });

	if (projectId) {
		query = query.eq('project_id', projectId);
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

export async function createTask(task: Omit<TaskInsert, 'user_id'>) {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	const { data, error } = await supabase
		.from('tasks')
		.insert({ ...task, user_id: user.id })
		.select()
		.single();

	if (error) throw error;
	return data as Task;
}

export async function updateTask(id: string, updates: TaskUpdate) {
	const { data, error } = await supabase
		.from('tasks')
		.update({ ...updates, updated_at: new Date().toISOString() })
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
