/**
 * Context Loading for AI Conversations
 * Provides workspace context (projects, tasks, notes) to AI conversations
 */
import { supabase } from '$lib/supabase';
import type { WellnessDomain } from '@chatkin/types';

export interface WorkspaceContext {
	projects: ProjectSummary[];
	tasks: TaskSummary[];
	notes: NoteSummary[];
	userProfile?: UserProfileSummary;
}

export interface UserProfileSummary {
	summary: string;
	communicationTone: string;
	focusAreas: string[];
	hasCompletedQuestionnaire: boolean;
}

// Database response types
interface TaskDBResponse {
	id: string;
	status: 'todo' | 'in_progress' | 'completed';
}

interface TaskWithProjectResponse {
	id: string;
	title: string;
	status: 'todo' | 'in_progress' | 'completed';
	priority: 'low' | 'medium' | 'high';
	due_date: string | null;
	domain: WellnessDomain;
	project_id: string | null;
	projects: { name: string } | null;
}

interface NoteWithProjectResponse {
	id: string;
	title: string | null;
	updated_at: string;
	domain: WellnessDomain;
	project_id: string | null;
	projects: { name: string } | null;
}

export interface ProjectSummary {
	id: string;
	name: string;
	description: string | null;
	taskCount: number;
	completedTaskCount: number;
	noteCount: number;
	fileCount: number;
}

export interface TaskSummary {
	id: string;
	title: string;
	status: 'todo' | 'in_progress' | 'completed';
	priority: 'low' | 'medium' | 'high';
	due_date: string | null;
	domain: WellnessDomain;
	project_name: string | null;
}

export interface NoteSummary {
	id: string;
	title: string | null;
	domain: WellnessDomain;
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

	// Load user profile
	const userProfile = await loadUserProfile();

	return { projects, tasks, notes, userProfile };
}

/**
 * Load user profile for AI context
 */
async function loadUserProfile(): Promise<UserProfileSummary | undefined> {
	const { data, error } = await supabase
		.from('user_profiles')
		.select('profile_summary, communication_tone, focus_areas, has_completed_questionnaire')
		.maybeSingle();

	if (error || !data || !data.has_completed_questionnaire) {
		return undefined;
	}

	return {
		summary: data.profile_summary || '',
		communicationTone: data.communication_tone || 'encouraging',
		focusAreas: data.focus_areas || [],
		hasCompletedQuestionnaire: data.has_completed_questionnaire
	};
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
		const [tasksResult, notesResult, filesResult] = await Promise.all([
			supabase
				.from('tasks')
				.select('id, status')
				.eq('project_id', project.id),
			supabase
				.from('notes')
				.select('id')
				.eq('project_id', project.id),
			supabase
				.from('files')
				.select('id')
				.eq('project_id', project.id)
				.eq('is_hidden_from_library', false)
		]);

		const tasks = (tasksResult.data as TaskDBResponse[]) || [];
		const notes = notesResult.data || [];
		const files = filesResult.data || [];
		const completedTasks = tasks.filter(t => t.status === 'completed').length;

		projectSummaries.push({
			id: project.id,
			name: project.name,
			description: project.description,
			taskCount: tasks.length,
			completedTaskCount: completedTasks,
			noteCount: notes.length,
			fileCount: files.length
		});
	}

	return projectSummaries;
}

/**
 * Load tasks summary with project names and domains
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
			domain,
			project_id,
			projects (name)
		`)
		.order('created_at', { ascending: false })
		.limit(100); // Limit to avoid overwhelming the AI

	if (error) throw error;
	if (!tasks) return [];

	return (tasks as unknown as TaskWithProjectResponse[]).map(task => ({
		id: task.id,
		title: task.title,
		status: task.status,
		priority: task.priority,
		due_date: task.due_date,
		domain: task.domain,
		project_name: task.projects?.name || null
	}));
}

/**
 * Load notes summary with project names and domains
 */
async function loadNotesSummary(): Promise<NoteSummary[]> {
	const { data: notes, error } = await supabase
		.from('notes')
		.select(`
			id,
			title,
			updated_at,
			domain,
			project_id,
			projects (name)
		`)
		.order('updated_at', { ascending: false })
		.limit(50); // Limit to avoid overwhelming the AI

	if (error) throw error;
	if (!notes) return [];

	return (notes as unknown as NoteWithProjectResponse[]).map(note => ({
		id: note.id,
		title: note.title,
		domain: note.domain,
		project_name: note.projects?.name || null,
		updated_at: note.updated_at
	}));
}

/**
 * Format workspace context as a string for AI consumption
 */
export function formatWorkspaceContextForAI(context: WorkspaceContext): string {
	let formatted = '## Workspace Context\n\n';

	// User Profile section (if available)
	if (context.userProfile && context.userProfile.summary) {
		formatted += '### User Profile & Psychological Analysis\n\n';
		formatted += context.userProfile.summary;
		formatted += '\n\n';
		formatted += `**Communication Preference**: ${context.userProfile.communicationTone}\n`;
		formatted += `**Priority Focus Areas**: ${context.userProfile.focusAreas.join(', ')}\n\n`;
		formatted += '**Using This Profile**: This analysis informs all your interactions. Reference specific insights when relevant, tailor suggestions to this user\'s unique situation, and maintain awareness of their challenges and goals.\n\n';
	}

	// Projects section
	if (context.projects.length > 0) {
		formatted += '### Projects\n';
		for (const project of context.projects) {
			formatted += `- **${project.name}** [id: ${project.id}]`;
			if (project.description) {
				formatted += `: ${project.description}`;
			}
			formatted += ` (${project.completedTaskCount}/${project.taskCount} tasks done, ${project.noteCount} notes, ${project.fileCount} files)\n`;
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
				formatted += ` [Domain: ${task.domain}]`;
				if (task.project_name) {
					formatted += ` [Project: ${task.project_name}]`;
				}
				formatted += '\n';
			}
		}

		if (inProgressTasks.length > 0) {
			formatted += '**In Progress:**\n';
			for (const task of inProgressTasks.slice(0, 5)) {
				formatted += `- ${task.title} [id: ${task.id}]`;
				formatted += ` [Domain: ${task.domain}]`;
				if (task.project_name) {
					formatted += ` [Project: ${task.project_name}]`;
				}
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
			formatted += ` [Domain: ${note.domain}]`;
			if (note.project_name) {
				formatted += ` [Project: ${note.project_name}]`;
			}
			formatted += '\n';
		}
		formatted += '\n';
	} else {
		formatted += '### Recent Notes\n(No notes yet)\n\n';
	}

	return formatted;
}
