/**
 * Context Loading for AI Conversations
 * Provides workspace context (projects, tasks, notes) to AI conversations
 */
import { supabase } from '$lib/supabase';
import type { Project, Task, Note } from '@chatkin/types';

export interface WorkspaceContext {
	projects: ProjectSummary[];
	tasks: TaskSummary[];
	notes: NoteSummary[];
}

export interface ProjectSummary {
	id: string;
	name: string;
	description: string | null;
	taskCount: number;
	completedTaskCount: number;
	noteCount: number;
}

export interface TaskSummary {
	id: string;
	title: string;
	status: 'todo' | 'in_progress' | 'completed';
	priority: 'low' | 'medium' | 'high';
	due_date: string | null;
	project_name: string | null;
}

export interface NoteSummary {
	id: string;
	title: string | null;
	project_name: string | null;
	updated_at: string;
}

/**
 * Load full workspace context for AI
 * Includes all projects, tasks, and notes summaries
 */
export async function loadWorkspaceContext(): Promise<WorkspaceContext> {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	// Load all projects with stats
	const projects = await loadProjectsSummary();

	// Load all tasks with project names
	const tasks = await loadTasksSummary();

	// Load all notes with project names
	const notes = await loadNotesSummary();

	return { projects, tasks, notes };
}

/**
 * Load projects summary with task/note counts
 */
async function loadProjectsSummary(): Promise<ProjectSummary[]> {
	const { data: projects, error: projectsError } = await supabase
		.from('projects')
		.select('id, name, description')
		.order('updated_at', { ascending: false });

	if (projectsError) throw projectsError;
	if (!projects) return [];

	// Load task counts for each project
	const projectSummaries: ProjectSummary[] = [];

	for (const project of projects) {
		const [tasksResult, notesResult] = await Promise.all([
			supabase
				.from('tasks')
				.select('id, status')
				.eq('project_id', project.id),
			supabase
				.from('notes')
				.select('id')
				.eq('project_id', project.id)
		]);

		const tasks = tasksResult.data || [];
		const notes = notesResult.data || [];
		const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;

		projectSummaries.push({
			id: project.id,
			name: project.name,
			description: project.description,
			taskCount: tasks.length,
			completedTaskCount: completedTasks,
			noteCount: notes.length
		});
	}

	return projectSummaries;
}

/**
 * Load tasks summary with project names
 */
async function loadTasksSummary(): Promise<TaskSummary[]> {
	const { data: tasks, error } = await supabase
		.from('tasks')
		.select(`
			id,
			title,
			status,
			priority,
			due_date,
			project_id,
			projects (name)
		`)
		.order('created_at', { ascending: false })
		.limit(100); // Limit to avoid overwhelming the AI

	if (error) throw error;
	if (!tasks) return [];

	return tasks.map((task: any) => ({
		id: task.id,
		title: task.title,
		status: task.status,
		priority: task.priority,
		due_date: task.due_date,
		project_name: task.projects?.name || null
	}));
}

/**
 * Load notes summary with project names
 */
async function loadNotesSummary(): Promise<NoteSummary[]> {
	const { data: notes, error } = await supabase
		.from('notes')
		.select(`
			id,
			title,
			updated_at,
			project_id,
			projects (name)
		`)
		.order('updated_at', { ascending: false })
		.limit(50); // Limit to avoid overwhelming the AI

	if (error) throw error;
	if (!notes) return [];

	return notes.map((note: any) => ({
		id: note.id,
		title: note.title,
		project_name: note.projects?.name || null,
		updated_at: note.updated_at
	}));
}

/**
 * Format workspace context as a string for AI consumption
 */
export function formatWorkspaceContextForAI(context: WorkspaceContext): string {
	let formatted = '## Workspace Context\n\n';

	// Projects section
	if (context.projects.length > 0) {
		formatted += '### Projects\n';
		for (const project of context.projects) {
			formatted += `- **${project.name}** [id: ${project.id}]`;
			if (project.description) {
				formatted += `: ${project.description}`;
			}
			formatted += ` (${project.completedTaskCount}/${project.taskCount} tasks done, ${project.noteCount} notes)\n`;
		}
		formatted += '\n';
	} else {
		formatted += '### Projects\n(No projects yet)\n\n';
	}

	// Tasks section
	if (context.tasks.length > 0) {
		formatted += '### Recent Tasks\n';

		// Group by status
		const todoTasks = context.tasks.filter(t => t.status === 'todo');
		const inProgressTasks = context.tasks.filter(t => t.status === 'in_progress');
		const completedTasks = context.tasks.filter(t => t.status === 'completed');

		if (todoTasks.length > 0) {
			formatted += '**To Do:**\n';
			for (const task of todoTasks.slice(0, 10)) {
				formatted += `- ${task.title} [id: ${task.id}]`;
				if (task.priority === 'high') formatted += ' [HIGH]';
				if (task.due_date) formatted += ` (due: ${task.due_date})`;
				if (task.project_name) formatted += ` [${task.project_name}]`;
				formatted += '\n';
			}
		}

		if (inProgressTasks.length > 0) {
			formatted += '**In Progress:**\n';
			for (const task of inProgressTasks.slice(0, 5)) {
				formatted += `- ${task.title} [id: ${task.id}]`;
				if (task.project_name) formatted += ` [${task.project_name}]`;
				formatted += '\n';
			}
		}

		if (completedTasks.length > 0) {
			formatted += `**Completed:** ${completedTasks.length} tasks\n`;
		}

		formatted += '\n';
	} else {
		formatted += '### Recent Tasks\n(No tasks yet)\n\n';
	}

	// Notes section
	if (context.notes.length > 0) {
		formatted += '### Recent Notes\n';
		for (const note of context.notes.slice(0, 15)) {
			formatted += `- ${note.title || 'Untitled'} [id: ${note.id}]`;
			if (note.project_name) formatted += ` [${note.project_name}]`;
			formatted += '\n';
		}
		formatted += '\n';
	} else {
		formatted += '### Recent Notes\n(No notes yet)\n\n';
	}

	return formatted;
}
