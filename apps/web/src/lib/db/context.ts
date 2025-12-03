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
 * Optionally filter by scope and domain
 */
export async function loadWorkspaceContext(options?: {
	scope?: 'global' | 'tasks' | 'notes' | 'project';
	domain?: WellnessDomain;
}): Promise<WorkspaceContext> {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	const scope = options?.scope || 'global';
	const domain = options?.domain;

	// Load all projects with stats (or filter to specific domain if in project scope)
	const projects = await loadProjectsSummary(domain);

	// Load tasks (filtered by domain if in project scope)
	const tasks = await loadTasksSummary(domain);

	// Load notes (filtered by domain if in project scope)
	const notes = await loadNotesSummary(domain);

	// Load user profile (only for global scope, not for domain-specific chats)
	const userProfile = scope === 'global' ? await loadUserProfile() : undefined;

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
 * Optionally filter to a specific domain
 */
async function loadProjectsSummary(domain?: WellnessDomain): Promise<ProjectSummary[]> {
	let query = supabase
		.from('projects')
		.select('id, name, description')
		.order('updated_at', { ascending: false});

	// Filter to specific domain if provided (domain is stored as project name)
	if (domain) {
		query = query.eq('name', domain);
	}

	const { data: projects, error: projectsError } = await query;

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
 * Optionally filter to a specific domain
 */
async function loadTasksSummary(domain?: WellnessDomain): Promise<TaskSummary[]> {
	let query = supabase
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

	// Filter to specific domain if provided
	if (domain) {
		query = query.eq('domain', domain);
	}

	const { data: tasks, error } = await query;

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
 * Optionally filter to a specific domain
 */
async function loadNotesSummary(domain?: WellnessDomain): Promise<NoteSummary[]> {
	let query = supabase
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

	// Filter to specific domain if provided
	if (domain) {
		query = query.eq('domain', domain);
	}

	const { data: notes, error } = await query;

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
