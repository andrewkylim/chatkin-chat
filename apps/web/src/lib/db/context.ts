/**
 * Context Loading for AI Conversations
 * Provides workspace context (projects, tasks, notes) to AI conversations
 */
import { supabase } from '$lib/supabase';
import type { WellnessDomain } from '@chatkin/types';
import { getAllConversationsWithHistory } from './conversations';

export interface WorkspaceContext {
	domains: DomainSummary[];
	tasks: TaskSummary[];
	notes: NoteSummary[];
	userProfile?: UserProfileSummary;
	crossDomainConversations?: CrossDomainConversation[];
	draftTasks?: DraftTask[];
}

export interface DraftTask {
	domain: WellnessDomain;
	title: string;
	description: string;
	priority: 'low' | 'medium' | 'high';
}

export interface DomainSummary {
	domain: WellnessDomain;
	taskCount: number;
	completedTaskCount: number;
	noteCount: number;
	fileCount: number;
}

export interface CrossDomainConversation {
	scope: string;
	domain: string | null;
	summary: string | null;
	recentMessages: Array<{
		role: string;
		content: string;
	}>;
}

export interface UserProfileSummary {
	summary: string;
	focusAreas: string[];
	hasCompletedQuestionnaire: boolean;
	domainScore?: number;
	domainName?: WellnessDomain;
}

// Database response types
interface TaskDBResponse {
	id: string;
	status: 'todo' | 'in_progress' | 'completed';
}

interface TaskWithDomainResponse {
	id: string;
	title: string;
	status: 'todo' | 'in_progress' | 'completed';
	priority: 'low' | 'medium' | 'high';
	due_date: string | null;
	domain: WellnessDomain;
}

interface NoteWithDomainResponse {
	id: string;
	title: string | null;
	content: string | null;
	updated_at: string;
	domain: WellnessDomain;
	is_system_generated: boolean;
}

export interface TaskSummary {
	id: string;
	title: string;
	status: 'todo' | 'in_progress' | 'completed';
	priority: 'low' | 'medium' | 'high';
	due_date: string | null;
	domain: WellnessDomain;
}

export interface NoteSummary {
	id: string;
	title: string | null;
	content: string | null;
	domain: WellnessDomain;
	updated_at: string;
	is_system_generated: boolean;
}

/**
 * Load full workspace context for AI
 * Includes domain summaries, tasks, and notes
 * Optionally filter by scope and domain
 * For global scope, includes cross-domain conversation history
 */
export async function loadWorkspaceContext(options?: {
	scope?: 'global' | 'tasks' | 'notes' | 'project';
	domain?: WellnessDomain;
}): Promise<WorkspaceContext> {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	const scope = options?.scope || 'global';
	const domain = options?.domain;

	// Load domain summaries with stats (or filter to specific domain)
	const domains = await loadDomainsSummary(domain);

	// Load tasks (filtered by domain if specified)
	const tasks = await loadTasksSummary(domain);

	// Load notes (filtered by domain if specified)
	const notes = await loadNotesSummary(domain);

	// Load user profile (with domain score if specified)
	const userProfile = await loadUserProfile(domain);

	// Load draft tasks (if any exist from recent assessment)
	const draftTasks = await loadDraftTasks();

	// For global scope, load cross-domain conversations
	let crossDomainConversations: CrossDomainConversation[] | undefined;
	if (scope === 'global') {
		try {
			const conversations = await getAllConversationsWithHistory(20);
			crossDomainConversations = conversations.map(conv => ({
				scope: conv.scope,
				domain: conv.domain,
				summary: conv.summary,
				recentMessages: conv.recentMessages.map(msg => ({
					role: msg.role,
					content: msg.content
				}))
			}));
		} catch (error) {
			console.warn('Failed to load cross-domain conversations:', error);
			// Don't fail the whole context load if conversations fail
			crossDomainConversations = undefined;
		}
	}

	return { domains, tasks, notes, userProfile, crossDomainConversations, draftTasks };
}

/**
 * Load draft tasks from assessment results
 * These are AI-generated suggestions that haven't been committed yet
 */
async function loadDraftTasks(): Promise<DraftTask[] | undefined> {
	const { data, error } = await supabase
		.from('assessment_results')
		.select('draft_tasks')
		.maybeSingle();

	if (error || !data || !data.draft_tasks) {
		return undefined;
	}

	return data.draft_tasks as DraftTask[];
}

/**
 * Load user profile for AI context
 * Optionally include domain-specific assessment score
 */
async function loadUserProfile(domain?: WellnessDomain): Promise<UserProfileSummary | undefined> {
	const { data, error } = await supabase
		.from('user_profiles')
		.select('profile_summary, focus_areas, has_completed_questionnaire')
		.maybeSingle();

	if (error || !data || !data.has_completed_questionnaire) {
		return undefined;
	}

	const profile: UserProfileSummary = {
		summary: data.profile_summary || '',
		focusAreas: data.focus_areas || [],
		hasCompletedQuestionnaire: data.has_completed_questionnaire
	};

	// If domain specified, load domain score from assessment results
	if (domain) {
		const { data: assessmentData } = await supabase
			.from('assessment_results')
			.select('domain_scores')
			.maybeSingle();

		if (assessmentData?.domain_scores && assessmentData.domain_scores[domain]) {
			profile.domainScore = assessmentData.domain_scores[domain];
			profile.domainName = domain;
		}
	}

	return profile;
}

/**
 * Load domain summaries with task/note/file counts
 * Optionally filter to a specific domain
 */
async function loadDomainsSummary(filterDomain?: WellnessDomain): Promise<DomainSummary[]> {
	const allDomains: WellnessDomain[] = ['Body', 'Mind', 'Purpose', 'Connection', 'Growth', 'Finance'];
	const domainsToLoad = filterDomain ? [filterDomain] : allDomains;

	const domainSummaries: DomainSummary[] = [];

	for (const domain of domainsToLoad) {
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

		const tasks = (tasksResult.data as TaskDBResponse[]) || [];
		const notes = notesResult.data || [];
		const files = filesResult.data || [];
		const completedTasks = tasks.filter(t => t.status === 'completed').length;

		domainSummaries.push({
			domain,
			taskCount: tasks.length,
			completedTaskCount: completedTasks,
			noteCount: notes.length,
			fileCount: files.length
		});
	}

	return domainSummaries;
}

/**
 * Load tasks summary with domains
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
			domain
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

	return (tasks as unknown as TaskWithDomainResponse[]).map(task => ({
		id: task.id,
		title: task.title,
		status: task.status,
		priority: task.priority,
		due_date: task.due_date,
		domain: task.domain
	}));
}

/**
 * Load notes summary with domains
 * Optionally filter to a specific domain
 * Loads: system-generated notes + recently updated user notes (last 7 days)
 */
async function loadNotesSummary(domain?: WellnessDomain): Promise<NoteSummary[]> {
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

	let query = supabase
		.from('notes')
		.select(`
			id,
			title,
			content,
			updated_at,
			domain,
			is_system_generated
		`)
		.order('updated_at', { ascending: false })
		.limit(15); // Reduced limit to prevent context overflow with content

	// Filter to specific domain if provided
	if (domain) {
		query = query.eq('domain', domain);
	}

	// Filter to system notes OR recently updated user notes
	query = query.or(`is_system_generated.eq.true,updated_at.gte.${sevenDaysAgo}`);

	const { data: notes, error } = await query;

	if (error) throw error;
	if (!notes) return [];

	// Fetch note blocks for each note to get the actual content
	const notesWithContent = await Promise.all(
		(notes as unknown as NoteWithDomainResponse[]).map(async (note) => {
			// Fetch blocks for this note
			const { data: blocks } = await supabase
				.from('note_blocks')
				.select('content')
				.eq('note_id', note.id)
				.order('position', { ascending: true });

			// Concatenate block content with newlines
			const blockContent = blocks?.map(b => b.content).join('\n\n') || '';

			return {
				id: note.id,
				title: note.title,
				content: blockContent || note.content, // Use block content, fallback to note.content
				domain: note.domain,
				updated_at: note.updated_at,
				is_system_generated: note.is_system_generated || false
			};
		})
	);

	return notesWithContent;
}

/**
 * Format workspace context as a string for AI consumption
 */
export function formatWorkspaceContextForAI(context: WorkspaceContext): string {
	let formatted = '## Workspace Context\n\n';

	// User Profile section (if available)
	if (context.userProfile && context.userProfile.summary) {
		formatted += '### User Profile & Psychological Analysis\n\n';

		// Just include the rich profile summary - no generic score interpretations
		formatted += context.userProfile.summary;
		formatted += '\n\n';
		formatted += `**Priority Focus Areas**: ${context.userProfile.focusAreas.join(', ')}\n\n`;

		// Add guidance on how to use the profile naturally
		formatted += '**How to use this profile:**\n';
		formatted += '- Think of this as deep background knowledge about the user - it informs your understanding but doesn\'t need to be explicitly mentioned in every response\n';
		formatted += '- Like a good friend who knows your history: you remember it, it shapes how you respond, but you don\'t constantly bring it up\n';
		formatted += '- Reference specific insights when they\'re genuinely relevant to what the user is discussing\n';
		formatted += '- The profile helps you understand WHY certain patterns exist, which makes you more effective when the conversation goes deeper\n';
		formatted += '- In casual exchanges, let this context inform your tone and awareness, but don\'t force it into the conversation\n\n';
	}

	// Draft Tasks section (FIRST SESSION AFTER ASSESSMENT)
	if (context.draftTasks && context.draftTasks.length > 0) {
		formatted += '### 🎯 FIRST SESSION - Draft Tasks for Co-Creation\n\n';
		formatted += '**IMPORTANT: These are draft suggestions, NOT committed tasks yet.**\n\n';
		formatted += 'The user just completed their assessment and was redirected here.\n';
		formatted += 'Your job: Present these drafts and co-create the actual tasks with them.\n\n';
		formatted += '**Draft tasks to present:**\n';
		for (const draft of context.draftTasks) {
			formatted += `- [${draft.domain}] ${draft.title}\n`;
			formatted += `  ${draft.description}\n`;
			formatted += `  Priority: ${draft.priority}\n\n`;
		}
		formatted += '**Your opening:** Lead with these. Present them confidently but invite refinement.\n';
		formatted += 'Example: "Based on your assessment, here\'s what I think you should tackle first: [list 3-5]. Which of these actually matters to you?"\n\n';
		formatted += '**After they respond:** Use Action Mode to create only the tasks they commit to.\n\n';
	}

	// Domains section (skip if empty to reduce noise in scoped contexts)
	if (context.domains.length > 0) {
		formatted += '### Wellness Domains\n';
		const domainEmojis: Record<WellnessDomain, string> = {
			Body: '💪',
			Mind: '🧠',
			Purpose: '🎯',
			Connection: '🤝',
			Growth: '🌱',
			Finance: '💰'
		};
		for (const domainSummary of context.domains) {
			const emoji = domainEmojis[domainSummary.domain];
			formatted += `- ${emoji} **${domainSummary.domain}**: ${domainSummary.completedTaskCount}/${domainSummary.taskCount} tasks done, ${domainSummary.noteCount} notes, ${domainSummary.fileCount} files\n`;
		}
		formatted += '\n';
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
				formatted += '\n';
			}
		}

		if (inProgressTasks.length > 0) {
			formatted += '**In Progress:**\n';
			for (const task of inProgressTasks.slice(0, 5)) {
				formatted += `- ${task.title} [id: ${task.id}]`;
				formatted += ` [Domain: ${task.domain}]`;
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
		formatted += '*These notes contain frameworks, strategies, and resources. Reference them in conversations.*\n\n';

		for (const note of context.notes.slice(0, 15)) {
			formatted += `**${note.title || 'Untitled'}** [id: ${note.id}] [Domain: ${note.domain}]`;
			if (note.is_system_generated) {
				formatted += ' [System-Generated]';
			}
			formatted += '\n';

			// Include note content for AI to reference
			if (note.content) {
				// For system-generated notes: include full content (frameworks/strategies)
				// For user notes: include first 300 chars to keep context manageable
				const content = note.is_system_generated
					? note.content
					: note.content.length > 300
						? note.content.substring(0, 297) + '...'
						: note.content;

				formatted += content + '\n\n';
			} else {
				formatted += '*(No content)*\n\n';
			}
		}
	} else {
		formatted += '### Recent Notes\n(No notes yet)\n\n';
	}

	// Cross-domain conversations (for global AI only)
	if (context.crossDomainConversations && context.crossDomainConversations.length > 0) {
		formatted += '### Cross-Domain Conversation History\n';
		formatted += '*This section shows your conversations across all domains and scopes. Use this to identify patterns, connections, and provide holistic insights.*\n\n';

		for (const conv of context.crossDomainConversations) {
			const scopeLabel = conv.domain ? `${conv.domain} Domain` : conv.scope.charAt(0).toUpperCase() + conv.scope.slice(1);
			formatted += `**${scopeLabel} Chat:**\n`;

			// Include summary if available
			if (conv.summary) {
				formatted += `*Summary of earlier conversation:* ${conv.summary}\n\n`;
			}

			// Include recent messages (last 20)
			if (conv.recentMessages && conv.recentMessages.length > 0) {
				formatted += '*Recent messages:*\n';
				for (const msg of conv.recentMessages.slice(-10)) {
					const role = msg.role === 'user' ? 'User' : 'AI';
					// Truncate long messages for context efficiency
					const content = msg.content.length > 200 ? msg.content.substring(0, 197) + '...' : msg.content;
					formatted += `- ${role}: ${content}\n`;
				}
				formatted += '\n';
			} else {
				formatted += '*(No recent messages)*\n\n';
			}
		}
	}

	return formatted;
}
