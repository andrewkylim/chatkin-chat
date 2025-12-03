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
	starterTasks: Array<{
		domain: 'Body' | 'Mind' | 'Purpose' | 'Connection' | 'Growth' | 'Finance';
		title: string;
		description: string;
		priority: 'low' | 'medium' | 'high';
		status: 'todo';
	}>;
	explorationQuestions: string[]; // 0-6 questions stored in user_profiles
	domainPrimers: Array<{
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

		// Generate onboarding content (starter tasks + exploration questions + domain primers)
		const client = createAnthropicClient(env.ANTHROPIC_API_KEY);
		const onboardingContent = await generateOnboardingContent(
			client,
			profile.profile_summary,
			results.domain_scores,
			responses || []
		);

		// 1. Create 3-5 starter tasks (using domain -> project_id mapping)
		const tasksToCreate = onboardingContent.starterTasks
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
				logger.error('Failed to create starter tasks', { error: tasksError });
			}
		}

		// 2. Store exploration questions in user_profiles
		if (onboardingContent.explorationQuestions.length > 0) {
			const { error: questionsError } = await supabaseAdmin
				.from('user_profiles')
				.update({
					exploration_questions: onboardingContent.explorationQuestions
				})
				.eq('user_id', user.userId);

			if (questionsError) {
				logger.error('Failed to store exploration questions', { error: questionsError });
			}
		}

		// 3. Create 6 domain primer notes (using domain -> project_id mapping)
		const notesToCreate = onboardingContent.domainPrimers
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
					content: note.content,
					is_system_generated: true // Mark as AI-generated
				};
			})
			.filter((n) => n !== null);

		if (notesToCreate.length > 0) {
			const { error: notesError } = await supabaseAdmin.from('notes').insert(notesToCreate);

			if (notesError) {
				logger.error('Failed to create domain primer notes', { error: notesError });
			}
		}

		logger.info('Onboarding content generated successfully', {
			userId: user.userId,
			starterTasks: tasksToCreate.length,
			explorationQuestions: onboardingContent.explorationQuestions.length,
			domainPrimers: notesToCreate.length
		});

		return new Response(
			JSON.stringify({
				success: true,
				created: {
					tasks: tasksToCreate.length,
					explorationQuestions: onboardingContent.explorationQuestions.length,
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

async function generateOnboardingContent(
	client: any,
	profileSummary: string,
	domainScores: any,
	responses: any[]
): Promise<OnboardingContent> {
	const domainScoresText = Object.entries(domainScores)
		.map(([domain, score]) => `- ${domain}: ${score}/10`)
		.join('\n');

	// Generate all 3 components in parallel for speed
	logger.info('Generating onboarding content (tasks + questions + primers)...');

	const [starterTasks, explorationQuestions, domainPrimers] = await Promise.all([
		generateStarterTasks(client, profileSummary, domainScoresText, domainScores),
		generateExplorationQuestions(client, profileSummary, domainScoresText, responses),
		generateDomainPrimers(client, profileSummary, domainScoresText)
	]);

	return { starterTasks, explorationQuestions, domainPrimers };
}

async function generateStarterTasks(
	client: any,
	profileSummary: string,
	domainScoresText: string,
	domainScores: any
): Promise<OnboardingContent['starterTasks']> {
	// Identify focus areas (lowest 3 scoring domains)
	const focusAreas = Object.entries(domainScores)
		.sort(([, a]: any, [, b]: any) => a - b)
		.slice(0, 3)
		.map(([domain]) => domain);

	const prompt = `You are creating 3-5 starter tasks for someone who just completed a life assessment. These are ACTUAL tasks that will appear in their workspace to help them get started.

PROFILE SUMMARY:
${profileSummary.substring(0, 800)}

DOMAIN SCORES:
${domainScoresText}

FOCUS AREAS (lowest scoring): ${focusAreas.join(', ')}

Create 3-5 starter tasks that:
1. **Address their focus areas** (prioritize lowest scoring domains)
2. **Are specific and actionable** (not vague like "exercise more")
3. **Connect to what they said** (use profile insights)
4. **Mix exploration and experiments** (not all action, not all reflection)
5. **Are low-stakes** (easy to delete if not relevant, mostly low priority)

Task Types to Include:
- **Exploration tasks**: "Explore: What kind of movement feels good to you?" (helps discovery)
- **Experiment tasks**: "Try: 10-min walk after dinner 3x this week" (low-commitment test)
- **Connection tasks**: "Text [friend] and ask for a real conversation" (specific action)
- **Reflection tasks**: "Journal: What am I avoiding right now?" (structures thinking)

Return ONLY JSON array (3-5 tasks):
[
  {"domain": "Body|Mind|Purpose|Connection|Growth|Finance", "title": "Task title (max 60 chars)", "description": "What and why (max 150 chars)", "priority": "low|medium|high", "status": "todo"}
]

CRITICAL: Use EXACT domain names. Generate 3-5 tasks total. Mostly low priority.`;

	const message = await client.messages.create({
		model: 'claude-3-5-haiku-20241022',
		max_tokens: 1500,
		messages: [{ role: 'user', content: prompt }]
	});

	const responseText = message.content[0].text.trim();
	const jsonMatch = responseText.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		logger.error('Failed to parse starter tasks', { responseText: responseText.substring(0, 500) });
		throw new WorkerError('Failed to parse starter tasks', 500);
	}

	return JSON.parse(jsonMatch[0]);
}

async function generateExplorationQuestions(
	client: any,
	profileSummary: string,
	domainScoresText: string,
	responses: any[]
): Promise<string[]> {
	const responsesText = responses
		.slice(0, 15)
		.map((r: any) => {
			const answer = r.response_value || r.response_text || 'No response';
			return `Q: ${r.assessment_questions?.question_text}\nA: ${answer}`;
		})
		.join('\n\n');

	const prompt = `You are creating 0-6 exploration questions for AI coaching. These are NOT tasks—they're conversation starters the AI will use contextually during coaching.

PROFILE SUMMARY:
${profileSummary.substring(0, 800)}

DOMAIN SCORES:
${domainScoresText}

SAMPLE RESPONSES:
${responsesText.substring(0, 1000)}

Create 0-6 exploration questions that:
1. **Address gaps or avoidance patterns** (what they didn't fully answer)
2. **Create self-awareness** (help them see blind spots)
3. **Connect to their struggles** (use profile insights)
4. **Are open-ended** (no yes/no questions)
5. **Feel conversational** (not clinical or formal)

Examples of GOOD exploration questions:
- "What kind of movement actually feels good to you?"
- "What are you avoiding thinking about right now?"
- "When was the last time you felt genuinely connected to someone?"
- "What would having energy look like in your day-to-day?"

Examples of BAD exploration questions:
- "Do you exercise regularly?" (yes/no, too generic)
- "How can we improve your health?" (too vague, corporate-y)

Return ONLY JSON array of strings (0-6 questions):
["Question 1", "Question 2", ...]

If no gaps or patterns warrant exploration questions, return empty array: []`;

	const message = await client.messages.create({
		model: 'claude-3-5-haiku-20241022',
		max_tokens: 1000,
		messages: [{ role: 'user', content: prompt }]
	});

	const responseText = message.content[0].text.trim();
	const jsonMatch = responseText.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		logger.warn('Failed to parse exploration questions, returning empty array');
		return [];
	}

	return JSON.parse(jsonMatch[0]);
}

async function generateDomainPrimers(
	client: any,
	profileSummary: string,
	domainScoresText: string
): Promise<OnboardingContent['domainPrimers']> {
	const prompt = `You are creating 6 domain primer notes—one for each wellness domain. These are brief (2-3 sentence) notes that AI-generated to help users understand each domain and how it relates to their life.

PROFILE SUMMARY:
${profileSummary.substring(0, 800)}

DOMAIN SCORES:
${domainScoresText}

Create 6 domain primer notes (one per domain: Body, Mind, Purpose, Connection, Growth, Finance) that:
1. **Explain the domain** (what it covers in 1 sentence)
2. **Connect to their situation** (use profile insights, scores)
3. **Are encouraging but honest** (acknowledge struggles, point to possibility)
4. **Are brief** (2-3 sentences, ~100-150 chars total)

Example primer note:
Domain: Body
Title: "About Body"
Content: "Body is about physical health—energy, movement, nutrition, sleep. Your score (6.2/10) suggests you're managing but might be running on fumes. Small consistent changes here ripple everywhere."

Return ONLY JSON array (exactly 6 notes, one per domain):
[
  {"domain": "Body|Mind|Purpose|Connection|Growth|Finance", "title": "About [Domain]", "content": "2-3 sentences (100-150 chars)"}
]

CRITICAL: Use EXACT domain names (Body, Mind, Purpose, Connection, Growth, Finance). Generate exactly 6 notes.`;

	const message = await client.messages.create({
		model: 'claude-3-5-haiku-20241022',
		max_tokens: 1500,
		messages: [{ role: 'user', content: prompt }]
	});

	const responseText = message.content[0].text.trim();
	const jsonMatch = responseText.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		logger.error('Failed to parse domain primers', { responseText: responseText.substring(0, 500) });
		throw new WorkerError('Failed to parse domain primers', 500);
	}

	return JSON.parse(jsonMatch[0]);
}
