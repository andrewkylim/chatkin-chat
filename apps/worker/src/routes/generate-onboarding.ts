/**
 * Generate onboarding content endpoint - Multi-call optimized version
 * Creates comprehensive life plan with draft tasks (notes generated separately)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Env, CorsHeaders } from '../types';
import { createAnthropicClient } from '../ai/client';
import { requireAuth } from '../middleware/auth';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { createSupabaseAdmin } from '../utils/supabase-admin';

interface StarterTask {
	domain: 'Body' | 'Mind' | 'Purpose' | 'Connection' | 'Growth' | 'Finance';
	title: string;
	description: string;
	priority: 'low' | 'medium' | 'high';
	status: 'todo';
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


		// Generate starter tasks only (notes will be generated separately by generate-notes endpoint)
		const client = createAnthropicClient(env.ANTHROPIC_API_KEY);

		const domainScoresText = Object.entries(results.domain_scores)
			.map(([domain, score]) => `- ${domain}: ${score}/10`)
			.join('\n');

		const starterTasks = await generateStarterTasks(
			client,
			profile.profile_summary,
			domainScoresText,
			results.domain_scores
		);

		// Store draft tasks for co-creation (NOT creating real tasks yet)
		// These will be presented to user in first chat session
		const draftTasks = starterTasks.map((task) => ({
			domain: task.domain,
			title: task.title,
			description: task.description,
			priority: task.priority
		}));

		// Save drafts to assessment_results
		const { error: draftError } = await supabaseAdmin
			.from('assessment_results')
			.update({ draft_tasks: draftTasks })
			.eq('user_id', user.userId);

		if (draftError) {
			logger.error('Failed to save draft tasks', { error: draftError });
		}

		logger.info('Onboarding draft tasks generated successfully', {
			userId: user.userId,
			draftTasks: draftTasks.length
		});

		return new Response(
			JSON.stringify({
				success: true,
				created: {
					draft_tasks: draftTasks.length,
					notes: 0
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

async function generateStarterTasks(
	client: any,
	profileSummary: string,
	domainScoresText: string,
	domainScores: any
): Promise<StarterTask[]> {
	// Identify focus areas (lowest 3 scoring domains)
	const focusAreas = Object.entries(domainScores)
		.sort(([, a]: any, [, b]: any) => a - b)
		.slice(0, 3)
		.map(([domain]) => domain);

	const prompt = `You are creating a comprehensive life plan with up to 5 tasks per domain (up to 30 tasks total). These are ACTUAL tasks that will appear in their workspace.

PROFILE SUMMARY:
${profileSummary.substring(0, 800)}

DOMAIN SCORES:
${domainScoresText}

FOCUS AREAS (lowest scoring): ${focusAreas.join(', ')}

**Task Distribution by Score:**
- Low-scoring domains (1-4): Create 5 tasks, mostly medium/high priority
- Mid-scoring domains (5-7): Create 3-4 tasks, mixed priority
- High-scoring domains (8-10): Create 2-3 tasks, mostly low priority

**Task Types to Mix:**
- **Quick wins** (5-10 min actions): "Schedule doctor appointment", "Text [friend] to reconnect"
- **Experiments** (low-commitment tests): "Try 10-min walk after dinner Mon/Wed/Fri"
- **Reflections** (structured thinking): "Journal: What am I avoiding in [domain]?"
- **Deep work** (significant but important): "Research financial advisors", "Draft career vision"
- **Habits** (recurring patterns): "Daily 5-min meditation", "Weekly budget review"

**Requirements:**
1. **Specific and actionable** (never vague like "exercise more")
2. **Connect to their assessment** (use actual insights from profile)
3. **Prioritized by domain score** (struggling domains get urgent/important tasks)
4. **Varied difficulty** (mix of easy wins and deeper work)
5. **Realistic** (they should feel empowered, not overwhelmed)

Return ONLY JSON array (20-30 tasks distributed across all 6 domains):
[
  {"domain": "Body|Mind|Purpose|Connection|Growth|Finance", "title": "Task title (max 60 chars)", "description": "What and why (max 150 chars)", "priority": "low|medium|high", "status": "todo"}
]

CRITICAL: Use EXACT domain names. Create 20-30 tasks total. Weight toward lower-scoring domains.`;

	const message = await client.messages.create({
		model: 'claude-3-5-haiku-20241022',
		max_tokens: 3000,
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
