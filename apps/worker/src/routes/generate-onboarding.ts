/**
 * Generate onboarding content endpoint - Multi-call optimized version
 * Creates comprehensive life plan with projects, tasks, and notes via multiple fast AI calls
 */

import type { Env, CorsHeaders } from '../types';
import { createAnthropicClient } from '../ai/client';
import { requireAuth } from '../middleware/auth';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { createSupabaseAdmin } from '../utils/supabase-admin';

interface OnboardingContent {
	projects: Array<{
		name: string;
		description: string;
		color: string;
	}>;
	tasks: Array<{
		project_name: string;
		title: string;
		description: string;
		priority: 'low' | 'medium' | 'high';
		status: 'todo';
	}>;
	notes: Array<{
		project_name: string;
		title: string;
		content: string;
	}>;
}

export async function handleGenerateOnboarding(
	request: Request,
	env: Env,
	corsHeaders: CorsHeaders
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	try {
		const user = await requireAuth(request, env);
		logger.debug('Generating onboarding content', { userId: user.userId });

		const supabaseAdmin = createSupabaseAdmin(env);

		// Fetch user profile and assessment results
		const { data: profile, error: profileError } = await supabaseAdmin
			.from('user_profiles')
			.select('profile_summary, focus_areas')
			.eq('user_id', user.userId)
			.single();

		if (profileError || !profile) {
			logger.error('Failed to fetch user profile', { error: profileError });
			throw new WorkerError('User profile not found', 404);
		}

		const { data: results, error: resultsError } = await supabaseAdmin
			.from('assessment_results')
			.select('domain_scores')
			.eq('user_id', user.userId)
			.single();

		if (resultsError || !results) {
			logger.error('Failed to fetch assessment results', { error: resultsError });
			throw new WorkerError('Assessment results not found', 404);
		}

		// Fetch responses for context
		const { data: responses, error: responsesError } = await supabaseAdmin
			.from('assessment_responses')
			.select(
				`
				response_value,
				response_text,
				assessment_questions (
					question_text,
					domain
				)
			`
			)
			.eq('user_id', user.userId);

		if (responsesError) {
			logger.error('Failed to fetch responses', { error: responsesError });
			throw new WorkerError('Failed to fetch questionnaire responses', 500);
		}

		// Generate onboarding content via multiple fast calls
		const client = createAnthropicClient(env.ANTHROPIC_API_KEY);
		const onboardingContent = await generateOnboardingContentMultiCall(
			client,
			profile.profile_summary,
			results.domain_scores,
			responses || []
		);

		// Create projects first
		const projectMap = new Map<string, string>();

		for (const project of onboardingContent.projects) {
			const { data: createdProject, error: projectError } = await supabaseAdmin
				.from('projects')
				.insert({
					user_id: user.userId,
					name: project.name,
					description: project.description,
					color: project.color
				})
				.select('id, name')
				.single();

			if (projectError) {
				logger.error('Failed to create project', { error: projectError, project });
				continue;
			}

			if (createdProject) {
				projectMap.set(project.name, createdProject.id);
			}
		}

		// Create tasks
		const tasksToCreate = onboardingContent.tasks
			.map((task) => {
				const projectId = projectMap.get(task.project_name);
				if (!projectId) return null;

				return {
					user_id: user.userId,
					project_id: projectId,
					title: task.title,
					description: task.description,
					priority: task.priority,
					status: task.status
				};
			})
			.filter((t) => t !== null);

		if (tasksToCreate.length > 0) {
			const { error: tasksError } = await supabaseAdmin.from('tasks').insert(tasksToCreate);

			if (tasksError) {
				logger.error('Failed to create tasks', { error: tasksError });
			}
		}

		// Create notes
		const notesToCreate = onboardingContent.notes
			.map((note) => {
				const projectId = projectMap.get(note.project_name);
				if (!projectId) return null;

				return {
					user_id: user.userId,
					project_id: projectId,
					title: note.title,
					content: note.content
				};
			})
			.filter((n) => n !== null);

		if (notesToCreate.length > 0) {
			const { error: notesError } = await supabaseAdmin.from('notes').insert(notesToCreate);

			if (notesError) {
				logger.error('Failed to create notes', { error: notesError });
			}
		}

		logger.info('Onboarding content generated successfully', {
			userId: user.userId,
			projects: onboardingContent.projects.length,
			tasks: tasksToCreate.length,
			notes: notesToCreate.length
		});

		return new Response(
			JSON.stringify({
				success: true,
				created: {
					projects: onboardingContent.projects.length,
					tasks: tasksToCreate.length,
					notes: notesToCreate.length
				}
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		return handleError(error, 'generate-onboarding', corsHeaders);
	}
}

async function generateOnboardingContentMultiCall(
	client: any,
	profileSummary: string,
	domainScores: any,
	responses: any[]
): Promise<OnboardingContent> {
	const domainScoresText = Object.entries(domainScores)
		.map(([domain, score]) => `- ${domain}: ${score}/10`)
		.join('\n');

	const responsesText = responses
		.slice(0, 10) // Reduced for speed
		.map((r: any) => {
			const answer = r.response_value || r.response_text || 'No response';
			return `Q: ${r.assessment_questions?.question_text}\nA: ${answer}`;
		})
		.join('\n\n');

	// Call 1: Generate projects (5-7s)
	logger.info('Generating projects...');
	const projects = await generateProjects(client, profileSummary, domainScoresText);

	// Call 2: Generate all tasks in one optimized call (8-12s)
	logger.info('Generating tasks...');
	const tasks = await generateAllTasks(client, profileSummary, domainScoresText, responsesText, projects);

	// Notes will be generated separately via /api/generate-notes endpoint
	// This keeps the main onboarding flow fast (<30s)
	const notes: OnboardingContent['notes'] = [];

	return { projects, tasks, notes };
}

async function generateProjects(
	client: any,
	profileSummary: string,
	domainScoresText: string
): Promise<OnboardingContent['projects']> {
	const prompt = `Create 6 personalized project titles for a life organization system - one for each life domain.

PROFILE: ${profileSummary.substring(0, 500)}
SCORES: ${domainScoresText}

Return ONLY JSON array with 6 projects (one per domain):
[
  {"name": "Personalized Body Project Title", "description": "Description based on physical health needs", "color": "green"},
  {"name": "Personalized Mind Project Title", "description": "Description for mental/emotional wellbeing", "color": "purple"},
  {"name": "Personalized Purpose Project Title", "description": "Description for career/work goals", "color": "orange"},
  {"name": "Personalized Connection Project Title", "description": "Description for relationships", "color": "red"},
  {"name": "Personalized Growth Project Title", "description": "Description for learning goals", "color": "yellow"},
  {"name": "Personalized Finance/Security Project Title", "description": "Description for financial stability and security", "color": "blue"}
]

Keep names under 40 chars, descriptions under 100 chars.`;

	const message = await client.messages.create({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 1000,
		messages: [{ role: 'user', content: prompt }]
	});

	const responseText = message.content[0].text.trim();
	let jsonText = responseText;

	// Remove markdown code blocks if present
	if (responseText.startsWith('```')) {
		jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
	}

	const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		logger.error('Failed to parse projects response', { responseText: responseText.substring(0, 300) });
		throw new WorkerError('Failed to parse projects', 500);
	}

	return JSON.parse(jsonMatch[0]);
}

async function generateAllTasks(
	client: any,
	profileSummary: string,
	domainScoresText: string,
	responsesText: string,
	projects: OnboardingContent['projects']
): Promise<OnboardingContent['tasks']> {
	const projectNames = projects.map((p) => p.name).join('\n- ');

	const prompt = `Generate 36-48 specific, actionable tasks across these projects:
- ${projectNames}

PROFILE: ${profileSummary.substring(0, 600)}
SCORES: ${domainScoresText}
KEY RESPONSES: ${responsesText.substring(0, 800)}

Create tasks that are:
- Specific and actionable (e.g., "Schedule annual physical exam" not "improve health")
- Personalized to their situation
- Distributed across all projects (6-8 tasks per project)
- Varied priority (20% high, 50% medium, 30% low)

Return ONLY JSON array:
[
  {"project_name": "exact project name", "title": "Task title (max 50 chars)", "description": "What and why (max 150 chars)", "priority": "high|medium|low", "status": "todo"}
]

CRITICAL: Use EXACT project names from the list. Generate 36-48 tasks total.`;

	const message = await client.messages.create({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 4000,
		messages: [{ role: 'user', content: prompt }]
	});

	const responseText = message.content[0].text.trim();
	let jsonText = responseText;

	// Remove markdown code blocks if present
	if (responseText.startsWith('```')) {
		jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
	}

	const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		logger.error('Failed to parse tasks response', { responseText: responseText.substring(0, 500) });
		throw new WorkerError('Failed to parse tasks', 500);
	}

	return JSON.parse(jsonMatch[0]);
}
