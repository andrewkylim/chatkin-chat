import { supabase } from '$lib/supabase';
import type { Project, WellnessDomain } from '@chatkin/types';

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

export async function getProjectByDomain(domain: WellnessDomain): Promise<Project> {
	const { data, error } = await supabase
		.from('projects')
		.select('*')
		.eq('domain', domain)
		.single();

	if (error) throw error;
	return data as Project;
}

export async function updateProject(id: string, updates: { description: string | null }) {
	const { data, error } = await supabase
		.from('projects')
		.update({
			description: updates.description,
			updated_at: new Date().toISOString()
		})
		.eq('id', id)
		.select()
		.single();

	if (error) throw error;
	return data as Project;
}

// Get domain statistics (by domain name or project_id for backward compatibility)
export async function getProjectStats(domainOrProjectId: string) {
	const [tasksResult, notesResult, filesResult] = await Promise.all([
		supabase
			.from('tasks')
			.select('id, status')
			.or(`domain.eq.${domainOrProjectId},project_id.eq.${domainOrProjectId}`),
		supabase
			.from('notes')
			.select('id')
			.or(`domain.eq.${domainOrProjectId},project_id.eq.${domainOrProjectId}`),
		supabase
			.from('files')
			.select('id')
			.or(`domain.eq.${domainOrProjectId},project_id.eq.${domainOrProjectId}`)
			.eq('is_hidden_from_library', false)
	]);

	const tasks = tasksResult.data || [];
	const notes = notesResult.data || [];
	const files = filesResult.data || [];

	const completedTasks = tasks.filter((t: { status: string }) => t.status === 'completed').length;

	return {
		totalTasks: tasks.length,
		completedTasks,
		totalNotes: notes.length,
		totalFiles: files.length
	};
}
