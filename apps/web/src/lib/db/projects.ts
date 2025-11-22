import { supabase } from '$lib/supabase';
import type { Database } from '@chatkin/types';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export async function getProjects() {
	const { data, error } = await supabase
		.from('projects')
		.select('*')
		.order('updated_at', { ascending: false });

	if (error) throw error;
	return data as Project[];
}

export async function getProject(id: string) {
	const { data, error } = await supabase
		.from('projects')
		.select('*')
		.eq('id', id)
		.single();

	if (error) throw error;
	return data as Project;
}

export async function createProject(project: Omit<ProjectInsert, 'user_id'>) {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	const { data, error } = await supabase
		.from('projects')
		.insert({ ...project, user_id: user.id })
		.select()
		.single();

	if (error) throw error;
	return data as Project;
}

export async function updateProject(id: string, updates: ProjectUpdate) {
	const { data, error } = await supabase
		.from('projects')
		.update({ ...updates, updated_at: new Date().toISOString() })
		.eq('id', id)
		.select()
		.single();

	if (error) throw error;
	return data as Project;
}

export async function deleteProject(id: string) {
	const { error } = await supabase
		.from('projects')
		.delete()
		.eq('id', id);

	if (error) throw error;
}

// Get project statistics
export async function getProjectStats(projectId: string) {
	const [tasksResult, notesResult] = await Promise.all([
		supabase
			.from('tasks')
			.select('id, status')
			.eq('project_id', projectId),
		supabase
			.from('notes')
			.select('id')
			.eq('project_id', projectId)
	]);

	const tasks = tasksResult.data || [];
	const notes = notesResult.data || [];

	const completedTasks = tasks.filter(t => t.status === 'completed').length;

	return {
		totalTasks: tasks.length,
		completedTasks,
		totalNotes: notes.length
	};
}
