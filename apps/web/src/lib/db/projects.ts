import { supabase } from '$lib/supabase';

// Get domain statistics by domain name
export async function getProjectStats(domain: string) {
	const [tasksResult, notesResult, filesResult] = await Promise.all([
		supabase
			.from('tasks')
			.select('id, status')
			.eq('domain', domain),
		supabase
			.from('notes')
			.select('id')
			.eq('domain', domain),
		supabase
			.from('files')
			.select('id')
			.eq('domain', domain)
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
