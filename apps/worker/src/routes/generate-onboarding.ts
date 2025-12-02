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
	tasks: Array<{
		domain: 'Body' | 'Mind' | 'Purpose' | 'Connection' | 'Growth' | 'Finance';
		title: string;
		description: string;
		priority: 'low' | 'medium' | 'high';
		status: 'todo';
	}>;
	notes: Array<{
		domain: 'Body' | 'Mind' | 'Purpose' | 'Connection' | 'Growth' | 'Finance';
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

		// Fetch existing 6 domain projects (created by database trigger)
		const { data: existingProjects, error: projectsError } = await supabaseAdmin
			.from('projects')
			.select('id, domain')
			.eq('user_id', user.userId);

		if (projectsError || !existingProjects || existingProjects.length === 0) {
			logger.error('Failed to fetch user projects', { error: projectsError });
			throw new WorkerError('User projects not found. Please contact support.', 404);
		}

		// Create domain -> project_id mapping
		const domainMap = new Map<string, string>();
		for (const project of existingProjects) {
			domainMap.set(project.domain, project.id);
		}

		// Generate onboarding content via multiple fast calls
		const client = createAnthropicClient(env.ANTHROPIC_API_KEY);
		const onboardingContent = await generateOnboardingContentMultiCall(
			client,
			profile.profile_summary,
			results.domain_scores,
			responses || []
		);

		// Create tasks (using domain -> project_id mapping)
		const tasksToCreate = onboardingContent.tasks
			.map((task) => {
				const projectId = domainMap.get(task.domain);
				if (!projectId) {
					logger.warn('No project found for domain', { domain: task.domain });
					return null;
				}

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

		// Create notes (using domain -> project_id mapping)
		const notesToCreate = onboardingContent.notes
			.map((note) => {
				const projectId = domainMap.get(note.domain);
				if (!projectId) {
					logger.warn('No project found for domain', { domain: note.domain });
					return null;
				}

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
			tasks: tasksToCreate.length,
			notes: notesToCreate.length
		});

		return new Response(
			JSON.stringify({
				success: true,
				created: {
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

	// Generate all tasks in one optimized call (8-12s)
	logger.info('Generating tasks...');
	const tasks = await generateAllTasks(client, profileSummary, domainScoresText, responsesText);

	// Notes will be generated separately via /api/generate-notes endpoint
	// This keeps the main onboarding flow fast (<20s)
	const notes: OnboardingContent['notes'] = [];

	return { tasks, notes };
}

async function generateAllTasks(
	client: any,
	profileSummary: string,
	domainScoresText: string,
	responsesText: string
): Promise<OnboardingContent['tasks']> {
	const prompt = `Generate 36-48 specific, actionable tasks across the 6 wellness domains.

PROFILE: ${profileSummary.substring(0, 600)}
SCORES: ${domainScoresText}
KEY RESPONSES: ${responsesText.substring(0, 800)}

Create tasks distributed across these 6 domains (6-8 tasks per domain):
1. Body - Physical health, fitness, nutrition, sleep
2. Mind - Mental & emotional wellbeing, stress management
3. Purpose - Career, work, goals, meaning, productivity
4. Connection - Relationships, family, friends, community
5. Growth - Learning, education, skills, hobbies
6. Finance - Money, budgets, investments, savings

Create tasks that are:
- Specific and actionable (e.g., "Schedule annual physical exam" not "improve health")
- Personalized to their situation and domain scores
- Distributed evenly across all 6 domains (6-8 tasks per domain)
- Varied priority (20% high, 50% medium, 30% low)

Return ONLY JSON array:
[
  {"domain": "Body|Mind|Purpose|Connection|Growth|Finance", "title": "Task title (max 50 chars)", "description": "What and why (max 150 chars)", "priority": "high|medium|low", "status": "todo"}
]

CRITICAL: Use EXACT domain names (Body, Mind, Purpose, Connection, Growth, Finance). Generate 36-48 tasks total.`;

	const message = await client.messages.create({
		model: 'claude-3-5-haiku-20241022',
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
